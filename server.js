const path = require("path");
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const shortid = require("shortid");
const QRCode = require("qrcode");
const axios = require("axios");
const UAParser = require("ua-parser-js");
const { Parser } = require("json2csv");
require("dotenv").config();

const Link = require("./models/Link");

const app = express();
app.set("trust proxy", true);

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;

function getBaseUrl(req) {
  if (process.env.BASE_URL) {
    return process.env.BASE_URL.replace(/\/+$/, "");
  }
  return `${req.protocol}://${req.get("host")}`;
}

function normalizeUrl(input) {
  const value = String(input || "").trim();
  if (!value) return null;

  try {
    return new URL(value).toString();
  } catch {
    try {
      return new URL(`https://${value}`).toString();
    } catch {
      return null;
    }
  }
}

function sanitizeCustomName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 30);
}

async function connectDatabase() {
  if (!process.env.MONGO_URL) {
    throw new Error("MONGO_URL is missing. Add it to the .env file or Render environment variables.");
  }

  await mongoose.connect(process.env.MONGO_URL, {
    serverSelectionTimeoutMS: 10000
  });

  console.log("MongoDB Connected ☁️");
}

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    database: mongoose.connection.readyState === 1 ? "connected" : "disconnected"
  });
});

app.post("/api/login", (req, res) => {
  const username = process.env.ADMIN_USERNAME || "admin";
  const password = process.env.ADMIN_PASSWORD || "1234";

  if (req.body.username === username && req.body.password === password) {
    return res.json({ success: true });
  }

  return res.status(401).json({ error: "Invalid username or password" });
});

app.post("/shorten", async (req, res) => {
  try {
    const url = normalizeUrl(req.body.url);
    const title = String(req.body.title || "Untitled").trim().slice(0, 100);
    const customName = sanitizeCustomName(req.body.customName);
    const expiry = req.body.expiry ? new Date(req.body.expiry) : null;
    const password = String(req.body.password || "").trim() || null;

    if (!url) {
      return res.status(400).json({ error: "Enter a valid URL" });
    }

    if (expiry && Number.isNaN(expiry.getTime())) {
      return res.status(400).json({ error: "Invalid expiry date" });
    }

    if (expiry && expiry <= new Date()) {
      return res.status(400).json({ error: "Expiry date must be in the future" });
    }

    let shortId = customName || shortid.generate();

    if (customName) {
      const exists = await Link.exists({ shortId });
      if (exists) {
        return res.status(409).json({ error: "This custom name is already being used" });
      }
    } else {
      while (await Link.exists({ shortId })) {
        shortId = shortid.generate();
      }
    }

    const baseUrl = getBaseUrl(req);
    const shortLink = `${baseUrl}/${shortId}`;
    const qrCode = await QRCode.toDataURL(shortLink, {
      width: 360,
      margin: 2,
      errorCorrectionLevel: "H"
    });

    const link = await Link.create({
      shortId,
      url,
      title,
      qrCode,
      expiry,
      password
    });

    return res.status(201).json({
      id: link._id,
      shortLink,
      qr: qrCode,
      expiry: link.expiry
    });
  } catch (error) {
    console.error("Create link error:", error);
    return res.status(500).json({ error: "Unable to create the short link" });
  }
});

app.get("/stats/all", async (req, res) => {
  try {
    const links = await Link.find().sort({ createdAt: -1 }).lean();
    const baseUrl = getBaseUrl(req);

    return res.json(
      links.map((link) => ({
        ...link,
        shortLink: `${baseUrl}/${link.shortId}`,
        passwordProtected: Boolean(link.password),
        password: undefined
      }))
    );
  } catch (error) {
    console.error("Stats error:", error);
    return res.status(500).json({ error: "Unable to load analytics" });
  }
});

app.get("/stats/:id", async (req, res) => {
  try {
    const link = await Link.findById(req.params.id).lean();

    if (!link) {
      return res.status(404).json({ error: "Link not found" });
    }

    delete link.password;
    return res.json(link);
  } catch (error) {
    return res.status(400).json({ error: "Invalid link ID" });
  }
});

app.delete("/delete/:id", async (req, res) => {
  try {
    const deleted = await Link.findByIdAndDelete(req.params.id);

    if (!deleted) {
      return res.status(404).json({ error: "Link not found" });
    }

    return res.json({ success: true });
  } catch (error) {
    return res.status(400).json({ error: "Invalid link ID" });
  }
});

app.get(["/export", "/export/csv"], async (req, res) => {
  try {
    const links = await Link.find().sort({ createdAt: -1 }).lean();
    const baseUrl = getBaseUrl(req);

    const rows = links.map((link) => ({
      title: link.title,
      originalUrl: link.url,
      shortLink: `${baseUrl}/${link.shortId}`,
      customName: link.shortId,
      clicks: link.clicks,
      visitors: link.visits.length,
      expiry: link.expiry ? new Date(link.expiry).toISOString() : "No expiry",
      passwordProtected: Boolean(link.password),
      createdAt: new Date(link.createdAt).toISOString()
    }));

    const parser = new Parser();
    const csv = parser.parse(rows);

    res.header("Content-Type", "text/csv; charset=utf-8");
    res.attachment("smart-link-tracker-report.csv");
    return res.send(csv);
  } catch (error) {
    console.error("CSV export error:", error);
    return res.status(500).json({ error: "Unable to export the report" });
  }
});

app.post("/unlock/:id", async (req, res) => {
  try {
    const link = await Link.findOne({ shortId: req.params.id });

    if (!link) return res.status(404).json({ error: "Link not found" });
    if (!link.password) return res.json({ success: true });
    if (req.body.password !== link.password) {
      return res.status(401).json({ error: "Incorrect password" });
    }

    return res.json({ success: true, redirectUrl: link.url });
  } catch {
    return res.status(500).json({ error: "Unable to unlock link" });
  }
});

async function collectVisitor(req) {
  const rawForwarded = req.headers["x-forwarded-for"];
  let ip = rawForwarded
    ? rawForwarded.split(",")[0].trim()
    : req.ip || req.socket.remoteAddress || "Unknown";

  ip = String(ip).replace("::ffff:", "");

  let country = "Unknown";
  let city = "Unknown";
  let lat = 0;
  let lon = 0;

  const localIp =
    ip === "::1" ||
    ip === "127.0.0.1" ||
    ip.startsWith("192.168.") ||
    ip.startsWith("10.") ||
    ip.startsWith("172.16.");

  if (!localIp && ip !== "Unknown") {
    try {
      const geo = await axios.get(`https://ipapi.co/${encodeURIComponent(ip)}/json/`, {
        timeout: 4500,
        headers: { "User-Agent": "SmartLinkTracker/3.0" }
      });

      country = geo.data.country_name || "Unknown";
      city = geo.data.city || "Unknown";
      lat = Number(geo.data.latitude) || 0;
      lon = Number(geo.data.longitude) || 0;
    } catch {
      console.log("Location lookup unavailable for:", ip);
    }
  }

  const ua = new UAParser(req.headers["user-agent"]);
  return {
    ip,
    country,
    city,
    lat,
    lon,
    device: ua.getDevice().type || "Desktop",
    browser: ua.getBrowser().name || "Unknown",
    os: ua.getOS().name || "Unknown",
    referrer: req.get("referer") || "Direct"
  };
}

app.get("/:id", async (req, res, next) => {
  try {
    if (req.params.id.includes(".")) return next();

    const link = await Link.findOne({ shortId: req.params.id });

    if (!link) {
      return res.status(404).sendFile(path.join(__dirname, "public", "404.html"));
    }

    if (link.expiry && new Date() > link.expiry) {
      return res.status(410).sendFile(path.join(__dirname, "public", "expired.html"));
    }

    if (link.password) {
      return res.sendFile(path.join(__dirname, "public", "unlock.html"));
    }

    const visitor = await collectVisitor(req);
    link.visits.push(visitor);
    link.clicks += 1;
    await link.save();

    return res.redirect(link.url);
  } catch (error) {
    console.error("Redirect error:", error);
    return res.status(500).send("Unable to open this link");
  }
});

app.post("/track-and-redirect/:id", async (req, res) => {
  try {
    const link = await Link.findOne({ shortId: req.params.id });
    if (!link) return res.status(404).json({ error: "Link not found" });

    if (link.expiry && new Date() > link.expiry) {
      return res.status(410).json({ error: "Link expired" });
    }

    if (link.password && req.body.password !== link.password) {
      return res.status(401).json({ error: "Incorrect password" });
    }

    const visitor = await collectVisitor(req);
    link.visits.push(visitor);
    link.clicks += 1;
    await link.save();

    return res.json({ redirectUrl: link.url });
  } catch {
    return res.status(500).json({ error: "Unable to open link" });
  }
});

app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, "public", "404.html"));
});

connectDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running 🚀 on port ${PORT}`);
      if (process.env.BASE_URL) {
        console.log(`Public URL: ${process.env.BASE_URL}`);
      } else {
        console.log(`Local URL: http://localhost:${PORT}`);
      }
    });
  })
  .catch((error) => {
    console.error("MongoDB connection error:", error.message);
    process.exit(1);
  });
