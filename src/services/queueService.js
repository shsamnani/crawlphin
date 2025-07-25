const { Queue, Worker } = require("bullmq");
const Redis = require("ioredis");
const crawlerService = require("./crawlerService");
const UrlAnalysis = require("../models/UrlAnalysis");

const connection = new Redis({
  host: process.env.REDIS_HOST || "localhost",
  port: process.env.REDIS_PORT || 6379,
  maxRetriesPerRequest: null,
});

const urlQueue = new Queue("url-analysis-queue", { connection });

// Function to register Socket.IO instance (passed from app.js)
let io;
const setSocketIoInstance = (socketIoInstance) => {
  io = socketIoInstance;
};

const addUrlToQueue = async (urlId) => {
  await urlQueue.add("analyze-url", { urlId });
};

const setupWorker = () => {
  new Worker(
    "url-analysis-queue",
    async (job) => {
      const { urlId } = job.data;
      const urlAnalysis = await UrlAnalysis.findById(urlId);

      if (!urlAnalysis) {
        console.error(`URL Analysis with ID ${urlId} not found.`);
        return;
      }

      try {
        urlAnalysis.status = "running";
        await urlAnalysis.save();
        console.log(`Saving to DB for ${urlId}`);

        if (io)
          io.emit("urlStatusUpdate", {
            id: urlAnalysis._id,
            status: "running",
          });

        console.log(`Crawling URL: ${urlId}`);
        const result = await crawlerService.crawlUrl(urlAnalysis.url); // Implement this
        // Sanitize brokenLinks to ensure statusCode is a number or null
        if (result.brokenLinks && Array.isArray(result.brokenLinks)) {
          result.brokenLinks = result.brokenLinks.map((link) => {
            if (typeof link.statusCode !== "number") {
              return {
                ...link,
                statusCode: null,
                errorMessage: link.statusCode,
              };
            }
            return link;
          });
        }
        Object.assign(urlAnalysis, result); // Update all fields from the crawler result
        urlAnalysis.status = "done";
        urlAnalysis.lastAnalyzed = new Date();
        urlAnalysis.errorMessage = undefined; // Clear any previous errors
      } catch (error) {
        console.error(`Error crawling ${urlAnalysis.url}:`, error);
        urlAnalysis.status = "error";
        urlAnalysis.errorMessage = error.message;
      } finally {
        console.log(`Saving final status for ${urlId}`);
        try {
          await urlAnalysis.save();
          console.log(`Status updated for URL: ${urlId}`);
        } catch (saveError) {
          console.error(`Failed to save URL Analysis for ${urlId}:`, saveError);
        }
        if (io) {
          console.log(`Emitting status update for ${urlId}`);
          io.emit("urlStatusUpdate", {
            id: urlAnalysis._id,
            status: urlAnalysis.status,
            pageTitle: urlAnalysis.pageTitle,
            htmlVersion: urlAnalysis.htmlVersion,
            internalLinks: urlAnalysis.internalLinks,
            externalLinks: urlAnalysis.externalLinks,
            brokenLinks: urlAnalysis.brokenLinks,
            hasLoginForm: urlAnalysis.hasLoginForm,
            errorMessage: urlAnalysis.errorMessage,
            lastAnalyzed: urlAnalysis.lastAnalyzed,
          });
        }
      }
    },
    { connection }
  );
};

module.exports = { addUrlToQueue, setupWorker, setSocketIoInstance };
