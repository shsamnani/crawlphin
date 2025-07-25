const express = require("express");
const router = express.Router();
const UrlAnalysis = require("../models/UrlAnalysis");
const { addUrlToQueue } = require("../services/queueService");

// Add a new URL for analysis
router.post("/", async (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ message: "URL is required" });
  }
  try {
    // Check if URL already exists
    let urlAnalysis = await UrlAnalysis.findOne({ url });
    if (urlAnalysis) {
      // If exists, just re-queue it or update its status to queued
      urlAnalysis.status = "queued";
      urlAnalysis.errorMessage = undefined; // Clear previous errors
      await urlAnalysis.save();
    } else {
      urlAnalysis = new UrlAnalysis({ url });
      await urlAnalysis.save();
    }

    await addUrlToQueue(urlAnalysis._id);
    res.status(201).json(urlAnalysis);
  } catch (error) {
    if (error.code === 11000) {
      // Duplicate key error
      return res
        .status(409)
        .json({ message: "URL already exists and is in queue or analyzed." });
    }
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Get all URLs with paginated/sorted/filtered data
router.get("/", async (req, res) => {
  const {
    page = 0,
    pageSize = 10,
    sortBy = "lastAnalyzed",
    sortOrder = "desc",
    filter = "",
  } = req.query;

  const query = {};
  if (filter) {
    // Simple global search across relevant fields (adjust as needed)
    query.$or = [
      { pageTitle: { $regex: filter, $options: "i" } },
      { url: { $regex: filter, $options: "i" } },
      { htmlVersion: { $regex: filter, $options: "i" } },
      { status: { $regex: filter, $options: "i" } },
    ];
  }

  try {
    const totalCount = await UrlAnalysis.countDocuments(query);
    const urls = await UrlAnalysis.find(query)
      .sort({ [sortBy]: sortOrder === "asc" ? 1 : -1 })
      .skip(parseInt(page) * parseInt(pageSize))
      .limit(parseInt(pageSize));

    res.json({
      data: urls,
      totalCount: totalCount,
      page: parseInt(page),
      pageSize: parseInt(pageSize),
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Get a single URL's details
router.get("/:id", async (req, res) => {
  try {
    const urlAnalysis = await UrlAnalysis.findById(req.params.id);
    if (!urlAnalysis) {
      return res.status(404).json({ message: "URL not found" });
    }
    res.json(urlAnalysis);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Re-run analysis for selected URLs
router.post("/re-run", async (req, res) => {
  const { ids } = req.body; // Array of URL IDs
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ message: "No URLs selected for re-run" });
  }
  try {
    for (const id of ids) {
      const urlAnalysis = await UrlAnalysis.findById(id);
      if (urlAnalysis) {
        urlAnalysis.status = "queued";
        urlAnalysis.errorMessage = undefined;
        await urlAnalysis.save();
        await addUrlToQueue(id); // Add to queue again
      }
    }
    res.json({ message: "URLs re-queued for analysis" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Delete selected URLs
router.delete("/", async (req, res) => {
  const { ids } = req.body; // Array of URL IDs
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ message: "No URLs selected for deletion" });
  }
  try {
    await UrlAnalysis.deleteMany({ _id: { $in: ids } });
    res.json({ message: "URLs deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

module.exports = router;
