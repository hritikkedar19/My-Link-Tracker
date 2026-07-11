const express = require("express");
const path = require("path");
const fs = require("fs/promises");
const crypto = require("crypto");
const QRCode = require("qrcode");
const axios = require("axios");
const UAParser = require("ua-parser-js");
const { Parser } = require("json2csv");
require("dotenv").config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const BASE_URL = (process.env.BASE_URL || `http://localhost:${PORT}`).replace(/\/$/, "");
const DATA_FILE = path.join(__dirname, "data", "links.json");

app.set("trust proxy", true);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

async function readLinks() {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    const links = JSON.parse(raw);
    return Array.isArray(links) ? links : [];
  } catch (error) {
    if (error.code === "ENOENT") {
      await writeLinks([]);
      return [];
    }
    throw error;
  }
}

async function writeLinks(links) {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  const tempFile = `${DATA_FILE}.tmp`;
  await fs.writeFile(tempFile, JSON.stringify(links, null, 2), "utf8");
  await fs.rename(tempFile, DATA_FILE);
}

function createShortId() {
  return crypto.randomBytes(4).toString("base64url").slice(0, 7);
}

function normalizeUrl(value) {
  const text = String(value || "").trim();
  if (!text) return null;

  try {
    const candidate = /^https?:\/\//i.test(text) ? text : `https://${text}`;
    const parsed = new URL(candidate);
    if (!["http:", "https:"].includes(parsed.protocol)) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function safeText(value, fallback = "Untitled") {
  const result = String(value || "").trim();
  return result ? result.slice(0, 120) : fallback;
}

app.get("/api/config", (req, res) => {
  res.json({ baseUrl: BASE_URL });
});

app.post("/shorten", async (req, res) => {
  try {
    const url = normalizeUrl(req.body.url);
    const title = safeText(req.body.title);
    const customName = String(req.body.customName || "").trim();
    const expiryText = String(req.body.expiry || "").trim();

    if (!url) {
      return res.status(400).json({ error: "Enter a valid website URL." });
    }

    if (customName && !/^[a-zA-Z0-9_-]{3,30}$/.test(customName)) {
      return res.status(400).json({
        error: "Custom name must be 3 to 30 characters using letters, numbers, - or _."
      });
    }

    let expiry = null;
    if (expiryText) {
      const expiryDate = new Date(`${expiryText}T23:59:59.999`);
      if (Number.isNaN(expiryDate.getTime()) || expiryDate <= new Date()) {
        return res.status(400).json({ error: "Choose a future expiry date." });
      }
      expiry = expiryDate.toISOString();
    }

    const links = await readLinks();
    let shortId = customName || createShortId();

    while (!customName && links.some((link) => link.shortId === shortId)) {
      shortId = createShortId();
    }

    if (links.some((link) => link.shortId.toLowerCase() === shortId.toLowerCase())) {
      return res.status(409).json({ error: "That custom short name is already in use." });
    }

    const shortLink = `${BASE_URL}/${shortId}`;
    const qrCode = await QRCode.toDataURL(shortLink, { width: 320, margin: 2 });

    const link = {
      _id: crypto.randomUUID(),
      shortId,
      url,
      title,
      qrCode,
      expiry,
      clicks: 0,
      visits: [],
      createdAt: new Date().toISOString()
    };

    links.unshift(link);
    await writeLinks(links);

    return res.status(201).json({
      id: link._id,
      shortLink,
      qr: qrCode,
      link
    });
  } catch (error) {
    console.error("Create link error:", error);
    return res.status(500).json({ error: "Could not create the short link." });
  }
});

app.get("/stats/all", async (req, res) => {
  try {
    const links = await readLinks();
    return res.json(links);
  } catch (error) {
    console.error("Load stats error:", error);
    return res.status(500).json({ error: "Could not load link statistics." });
  }
});

app.delete("/delete/:id", async (req, res) => {
  try {
    const links = await readLinks();
    const updated = links.filter((link) => link._id !== req.params.id);

    if (updated.length === links.length) {
      return res.status(404).json({ error: "Link not found." });
    }

    await writeLinks(updated);
    return res.json({ status: "deleted" });
  } catch (error) {
    console.error("Delete error:", error);
    return res.status(500).json({ error: "Could not delete the link." });
  }
});

app.get(["/export", "/export/csv"], async (req, res) => {
  try {
    const links = await readLinks();
    const rows = links.map((link) => ({
      Title: link.title,
      "Original URL": link.url,
      "Short Link": `${BASE_URL}/${link.shortId}`,
      Clicks: link.clicks,
      Expiry: link.expiry || "No limit",
      Created: link.createdAt,
      Visitors: link.visits.length
    }));

    const csv = new Parser().parse(rows);
    res.header("Content-Type", "text/csv; charset=utf-8");
    res.attachment("link-tracker-report.csv");
    return res.send(csv);
  } catch (error) {
    console.error("CSV error:", error);
    return res.status(500).json({ error: "Could not export the CSV report." });
  }
});

app.get("/:id", async (req, res, next) => {
  try {
    if (req.params.id.includes(".")) return next();

    const links = await readLinks();
    const link = links.find((item) => item.shortId === req.params.id);

    if (!link) {
      return res.status(404).sendFile(path.join(__dirname, "public", "404.html"));
    }

    if (link.expiry && new Date() > new Date(link.expiry)) {
      return res.status(410).send("This short link has expired.");
    }

    const ip = String(req.ip || req.socket.remoteAddress || "Unknown").replace("::ffff:", "");
    const parser = new UAParser(req.headers["user-agent"] || "");
    const browser = parser.getBrowser().name || "Unknown";
    const os = parser.getOS().name || "Unknown";
    const device = parser.getDevice().type || "Desktop";

    let country = "Unknown";
    let city = "Unknown";
    let lat = 0;
    let lon = 0;
    const localIp = ip === "::1" || ip === "127.0.0.1" || ip.startsWith("192.168.") || ip.startsWith("10.");

    if (!localIp && ip !== "Unknown") {
      try {
        const response = await axios.get(`https://ipapi.co/${encodeURIComponent(ip)}/json/`, {
          timeout: 2500
        });
        country = response.data.country_name || "Unknown";
        city = response.data.city || "Unknown";
        lat = Number(response.data.latitude) || 0;
        lon = Number(response.data.longitude) || 0;
      } catch {
        // Location is optional, so redirection still works when lookup fails.
      }
    }

    link.clicks += 1;
    link.visits.unshift({
      ip,
      country,
      city,
      device,
      browser,
      os,
      lat,
      lon,
      time: new Date().toISOString()
    });
    link.visits = link.visits.slice(0, 500);
    await writeLinks(links);

    return res.redirect(link.url);
  } catch (error) {
    console.error("Redirect error:", error);
    return res.status(500).send("Could not open this short link.");
  }
});

app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, "public", "404.html"));
});

app.listen(PORT, () => {
  console.log(`Smart Link Tracker running at ${BASE_URL}`);
});
