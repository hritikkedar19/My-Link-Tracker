const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const shortid = require("shortid");
const QRCode = require("qrcode");
const axios = require("axios");
const UAParser = require("ua-parser-js");
const { Parser } = require("json2csv");
require("dotenv").config();

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(express.static("public"));

const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

mongoose
  .connect(process.env.MONGO_URL)
  .then(() => console.log("MongoDB Connected ☁️"))
  .catch((error) => {
    console.error("MongoDB connection error:", error.message);
  });

const linkSchema = new mongoose.Schema({
  shortId: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  url: {
    type: String,
    required: true,
    trim: true
  },
  title: {
    type: String,
    default: "Untitled"
  },
  qrCode: String,
  expiry: Date,
  clicks: {
    type: Number,
    default: 0
  },
  visits: [
    {
      ip: String,
      country: String,
      city: String,
      device: String,
      lat: Number,
      lon: Number,
      time: {
        type: Date,
        default: Date.now
      }
    }
  ]
});

const Link = mongoose.model("Link", linkSchema);

// Create short link
app.post("/shorten", async (req, res) => {
  try {
    const { url, title, customName, expiry } = req.body;

    if (!url) {
      return res.status(400).json({
        error: "Enter a URL"
      });
    }

    const shortId = customName?.trim() || shortid.generate();

    const existingLink = await Link.findOne({ shortId });

    if (existingLink) {
      return res.status(409).json({
        error: "This custom short name is already in use"
      });
    }

    const shortLink = `${BASE_URL}/${shortId}`;
    const qr = await QRCode.toDataURL(shortLink);

    const link = await Link.create({
      shortId,
      url,
      title: title || "Untitled",
      qrCode: qr,
      expiry: expiry ? new Date(expiry) : null
    });

    return res.status(201).json({
      id: link._id,
      shortLink,
      qr
    });
  } catch (error) {
    console.error("Shorten error:", error);

    return res.status(500).json({
      error: "Server error"
    });
  }
});

// Get all links
app.get("/stats/all", async (req, res) => {
  try {
    const links = await Link.find().sort({ _id: -1 });
    return res.json(links);
  } catch (error) {
    console.error("Stats error:", error);

    return res.status(500).json({
      error: "Unable to load links"
    });
  }
});

// Delete link
app.delete("/delete/:id", async (req, res) => {
  try {
    const deletedLink = await Link.findByIdAndDelete(req.params.id);

    if (!deletedLink) {
      return res.status(404).json({
        error: "Link not found"
      });
    }

    return res.json({
      status: "deleted"
    });
  } catch (error) {
    console.error("Delete error:", error);

    return res.status(500).json({
      error: "Unable to delete link"
    });
  }
});

// Export links as CSV
app.get(["/export", "/export/csv"], async (req, res) => {
  try {
    const links = await Link.find().lean();

    const exportData = links.map((link) => ({
      title: link.title,
      originalUrl: link.url,
      shortId: link.shortId,
      shortLink: `${BASE_URL}/${link.shortId}`,
      clicks: link.clicks,
      expiry: link.expiry || "",
      createdAt: link._id.getTimestamp()
    }));

    const parser = new Parser();
    const csv = parser.parse(exportData);

    res.header("Content-Type", "text/csv");
    res.attachment("links.csv");

    return res.send(csv);
  } catch (error) {
    console.error("CSV export error:", error);

    return res.status(500).json({
      error: "Unable to export CSV"
    });
  }
});

// Redirect and track visitor
app.get("/:id", async (req, res) => {
  try {
    const link = await Link.findOne({
      shortId: req.params.id
    });

    if (!link) {
      return res.status(404).send("Link not found");
    }

    if (link.expiry && new Date() > link.expiry) {
      return res.status(410).send("Link expired");
    }

    const forwardedIp = req.headers["x-forwarded-for"];

    const rawIp = forwardedIp
      ? forwardedIp.split(",")[0].trim()
      : req.socket.remoteAddress;

    const ip = rawIp?.replace("::ffff:", "") || "Unknown";

    let country = "Unknown";
    let city = "Unknown";
    let lat = 0;
    let lon = 0;

    const isLocalIp =
      ip === "::1" ||
      ip === "127.0.0.1" ||
      ip.startsWith("192.168.") ||
      ip.startsWith("10.");

    if (!isLocalIp && ip !== "Unknown") {
      try {
        const geo = await axios.get(`https://ipapi.co/${ip}/json/`, {
          timeout: 5000
        });

        country = geo.data.country_name || "Unknown";
        city = geo.data.city || "Unknown";
        lat = geo.data.latitude || 0;
        lon = geo.data.longitude || 0;
      } catch (error) {
        console.log("Geo lookup failed");
      }
    }

    const parser = new UAParser(req.headers["user-agent"]);
    const device = parser.getDevice().type || "Desktop";

    link.visits.push({
      ip,
      country,
      city,
      device,
      lat,
      lon
    });

    link.clicks += 1;

    await link.save();

    return res.redirect(link.url);
  } catch (error) {
    console.error("Redirect error:", error);

    return res.status(500).send("Server error");
  }
});

app.listen(PORT, () => {
  console.log(`Server running 🚀 on ${BASE_URL}`);
});