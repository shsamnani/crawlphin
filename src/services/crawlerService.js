const puppeteer = require("puppeteer");
const cheerio = require("cheerio");
const axios = require("axios"); // For checking link status

async function crawlUrl(url) {
  let browser;
  try {
    console.log(`Lauching headless browser for URL: ${url}`);
    browser = await puppeteer.launch({ headless: true }); // set to 'new' for new headless mode
    const page = await browser.newPage();
    console.log(`Opening page: ${url}`);
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 }); // Wait for DOM to load

    const htmlContent = await page.content();
    const $ = cheerio.load(htmlContent);

    const result = {
      htmlVersion: "",
      pageTitle: $("title").text() || "",
      headingCounts: { h1: 0, h2: 0, h3: 0, h4: 0, h5: 0, h6: 0 },
      internalLinks: 0,
      externalLinks: 0,
      brokenLinks: [],
      workingLinks: [],
      hasLoginForm: false,
    };

    // HTML Version (basic inference)
    console.log(`Identifying HTML version for URL: ${url}`);
    const doctype = htmlContent.match(/<!DOCTYPE[^>]*>/i);
    if (doctype) {
      if (doctype[0].toLowerCase().includes("html 5")) {
        result.htmlVersion = "HTML5";
      } else if (doctype[0].toLowerCase().includes("html 4.01")) {
        result.htmlVersion = "HTML 4.01";
      } else if (doctype[0].toLowerCase().includes("xhtml")) {
        result.htmlVersion = "XHTML";
      } else {
        result.htmlVersion = "Unknown/Other";
      }
    } else {
      result.htmlVersion = "No DOCTYPE";
    }

    // Heading Counts
    console.log(`Counting headings for URL: ${url}`);
    for (let i = 1; i <= 6; i++) {
      result.headingCounts[`h${i}`] = $(`h${i}`).length;
    }

    // Links
    console.log(`Extracting links for URL: ${url}`);
    const links = [];
    $("a").each((i, el) => {
      const href = $(el).attr("href");
      if (href) {
        try {
          const absoluteUrl = new URL(href, url).href; // Resolve relative URLs
          links.push(absoluteUrl);
        } catch (e) {
          // Invalid URL, skip
        }
      }
    });

    const urlDomain = new URL(url).hostname;
    console.log(`Processing ${links.length} links for URL: ${url}`);

    for (const [index, link] of links.entries()) {
      console.log(
        `Processing link #${index}: ${link}, progress: ${index + 1}/${
          links.length
        }`
      );
      try {
        const linkDomain = new URL(link).hostname;
        if (linkDomain === urlDomain) {
          result.internalLinks++;
        } else {
          result.externalLinks++;
        }

        // Check link accessibility - use HEAD request for efficiency
        const response = await axios.head(link, {
          timeout: 5000,
          validateStatus: (status) => true,
        });
        if (response.status >= 400) {
          result.brokenLinks.push({ link, statusCode: response.status });
        } else {
          result.workingLinks.push({ link, statusCode: response.status });
        }
      } catch (error) {
        // Network error, DNS error, etc.
        result.brokenLinks.push({
          link,
          statusCode: error.response
            ? error.response.status
            : "N/A (Network Error)",
        });
      }
    }
    console.log(`Finished processing URL: ${url}`);

    // Login Form Presence
    const loginFormIndicators = [
      'input[type="password"]',
      'form[action*="login"]',
      'form[id*="login"]',
      'form[class*="login"]',
    ];
    result.hasLoginForm = loginFormIndicators.some(
      (selector) => $(selector).length > 0
    );
    console.log(`Login form presence for URL ${url}: ${result.hasLoginForm}`);
    return result;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

module.exports = { crawlUrl };
