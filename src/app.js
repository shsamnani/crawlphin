const crawlerService = require("./services/crawlerService");

crawlerService
  .crawlUrl("https://www.gmail.com")
  .then((result) => {
    console.log(result);
  })
  .catch((error) => {
    console.error("Error during crawling:", error);
  })
  .finally(() => {
    console.log("Crawling completed.");
  });
