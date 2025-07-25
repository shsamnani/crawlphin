const mongoose = require("mongoose");

const UrlAnalysisSchema = new mongoose.Schema({
  url: { type: String, required: true, unique: true },
  status: {
    type: String,
    enum: ["queued", "running", "done", "error"],
    default: "queued",
  },
  htmlVersion: String,
  pageTitle: String,
  headingCounts: {
    h1: { type: Number, default: 0 },
    h2: { type: Number, default: 0 },
    h3: { type: Number, default: 0 },
    h4: { type: Number, default: 0 },
    h5: { type: Number, default: 0 },
    h6: { type: Number, default: 0 },
  },
  internalLinks: { type: Number, default: 0 },
  externalLinks: { type: Number, default: 0 },
  brokenLinks: [
    {
      link: String,
      statusCode: Number,
      errorMessage: String,
    },
  ],
  workingLinks: [
    {
      link: String,
      statusCode: Number,
    },
  ],
  hasLoginForm: { type: Boolean, default: false },
  lastAnalyzed: { type: Date, default: Date.now },
  errorMessage: String, // To store details if status is 'error'
});

module.exports = mongoose.model("UrlAnalysis", UrlAnalysisSchema);
