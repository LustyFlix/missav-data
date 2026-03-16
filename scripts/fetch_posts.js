const fs = require("fs");
const path = require("path");
const xml2js = require("xml2js");

// List of sitemap URLs
const SITEMAP_URLS = [
  "https://eroticmv.com/post-sitemap.xml",
  "https://eroticmv.com/post-sitemap2.xml"
];

const POSTS_DIR = path.join(__dirname, "../data/posts");
const INDEX_FILE = path.join(__dirname, "../data/index.json");

// Ensure base posts folder exists
if (!fs.existsSync(POSTS_DIR)) fs.mkdirSync(POSTS_DIR, { recursive: true });

// Load index.json safely
let index = {};
if (fs.existsSync(INDEX_FILE)) {
  try {
    const raw = fs.readFileSync(INDEX_FILE, "utf-8").trim();
    index = raw ? JSON.parse(raw) : {};
  } catch (err) {
    console.warn("Warning: index.json is corrupted or empty. Resetting index.");
    index = {};
  }
}

// Parse sitemap XML into URLs
async function fetchSitemap(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch " + url);
  const xml = await res.text();
  const parser = new xml2js.Parser();
  const result = await parser.parseStringPromise(xml);
  const urls = result.urlset.url.map(u => u.loc[0]);
  return urls;
}

// Convert post URL into safe relative path with subfolder
function slugFromUrl(url) {
  const slug = url.replace(/https?:\/\/[^\/]+\/|\/$/g, "").replace(/\//g, "-") + ".html";
  const prefix = slug.slice(0, 2); // first 2 chars of slug as subfolder
  const dir = path.join(POSTS_DIR, prefix);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return path.join(prefix, slug); // relative path for index.json
}

// Download a single post HTML
async function downloadPost(url) {
  if (index[url]) {
    console.log("Already downloaded:", url);
    return;
  }

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to fetch post");
    const html = await res.text();

    const relativePath = slugFromUrl(url);
    const filePath = path.join(POSTS_DIR, relativePath);
    fs.writeFileSync(filePath, html, "utf-8");

    index[url] = relativePath;
    console.log("Saved:", url);
  } catch (err) {
    console.error("Error downloading:", url, err.message);
  }
}

// Main function
(async function run() {
  for (const sitemap of SITEMAP_URLS) {
    console.log("Processing sitemap:", sitemap);
    try {
      const urls = await fetchSitemap(sitemap);

      // Parallel downloads in batches of 10
      const BATCH_SIZE = 10;
      for (let i = 0; i < urls.length; i += BATCH_SIZE) {
        const batch = urls.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map(downloadPost));
      }

    } catch (err) {
      console.error("Error processing sitemap:", sitemap, err.message);
    }
  }

  // Save updated index.json
  fs.writeFileSync(INDEX_FILE, JSON.stringify(index, null, 2));
  console.log("Finished updating posts. Total posts:", Object.keys(index).length);
})();
