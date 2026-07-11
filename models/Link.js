const mongoose = require("mongoose");

const visitSchema = new mongoose.Schema(
  {
    ip: { type: String, default: "Unknown" },
    country: { type: String, default: "Unknown" },
    city: { type: String, default: "Unknown" },
    device: { type: String, default: "Desktop" },
    browser: { type: String, default: "Unknown" },
    os: { type: String, default: "Unknown" },
    lat: { type: Number, default: 0 },
    lon: { type: Number, default: 0 },
    referrer: { type: String, default: "Direct" },
    time: { type: Date, default: Date.now }
  },
  { _id: false }
);

const linkSchema = new mongoose.Schema(
  {
    shortId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true
    },
    url: {
      type: String,
      required: true,
      trim: true
    },
    title: {
      type: String,
      default: "Untitled",
      trim: true
    },
    qrCode: {
      type: String,
      required: true
    },
    expiry: {
      type: Date,
      default: null
    },
    password: {
      type: String,
      default: null
    },
    clicks: {
      type: Number,
      default: 0
    },
    visits: {
      type: [visitSchema],
      default: []
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Link", linkSchema);
