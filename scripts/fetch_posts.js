const fs = require("fs");
const path = require("path");
const fetch = require("node-fetch");
const xml2js = require("xml2js");

// Example sitemap URL
const SITEMAP_URLS = [
  "https://eroticmv.com/sitemap-posts-1.xml",
  "https://eroticmv.com/sitemap-posts-2.xml"
];

const POSTS_DIR = path.join(__dirname, "../data/posts");
const INDEX_FILE = path.join(__dirname, "../data/index.json");

// Ensure folders exist
if (!fs.existsSync(POSTS_DIR)) fs.mkdirSync(POSTS_DIR, { recursive: true });

// Load index.json to skip existing posts
let index = {};
if (fs.existsSync(INDEX_FILE)) {
  index = JSON.parse(fs.readFileSync(INDEX_FILE));
}

async function fetchSitemap(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch " + url);
  const xml = await res.text();
  const parser = new xml2js.Parser();
  const result = await parser.parseStringPromise(xml);
  const urls = result.urlset.url.map(u => u.loc[0]);
  return urls;
}

function slugFromUrl(url) {
  return url.replace(/https?:\/\/[^\/]+\/|\/$/g, "").replace(/\//g, "-") + ".html";
}

async function downloadPost(url) {
  if (index[url]) {
    console.log("Already downloaded:", url);
    return;
  }

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to fetch post");
    const html = await res.text();

    const slug = slugFromUrl(url);
    const filePath = path.join(POSTS_DIR, slug);
    fs.writeFileSync(filePath, html, "utf-8");

    index[url] = slug;
    console.log("Saved:", url);
  } catch (err) {
    console.error("Error downloading:", url, err.message);
  }
}

(async function run() {
  for (const sitemap of SITEMAP_URLS) {
    console.log("Processing sitemap:", sitemap);
    try {
      const urls = await fetchSitemap(sitemap);
      for (const url of urls) {
        await downloadPost(url);
      }
    } catch (err) {
      console.error("Error processing sitemap:", sitemap, err.message);
    }
  }

  // Save index.json
  fs.writeFileSync(INDEX_FILE, JSON.stringify(index, null, 2));
})();
