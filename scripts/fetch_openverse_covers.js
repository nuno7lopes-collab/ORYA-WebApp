#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = process.cwd();
const DEST_ROOT = path.resolve(ROOT, process.env.COVER_DEST || "public/covers/library");
const PAGE_SIZE = Number(process.env.COVER_PAGE_SIZE || "80");
const PER_CATEGORY = Number(process.env.COVER_PER_CATEGORY || "30");
const MIN_WIDTH = Number(process.env.COVER_MIN_WIDTH || "1600");
const MIN_HEIGHT = Number(process.env.COVER_MIN_HEIGHT || "900");
const MIN_ASPECT_RATIO = Number(process.env.COVER_MIN_ASPECT || "1.2");
const MAX_PER_QUERY = Number(process.env.COVER_MAX_PER_QUERY || "80");
const COMMONS_PAGE_SIZE = Number(process.env.COVER_COMMONS_PAGE_SIZE || "50");
const OPENVERSE_PAGE_SIZE = Math.min(PAGE_SIZE, 50);
const MAX_SLUG_LENGTH = Number(process.env.COVER_MAX_SLUG || "72");
const DOWNLOAD_RETRIES = Number(process.env.COVER_DOWNLOAD_RETRIES || "3");
const DOWNLOAD_RETRY_DELAY = Number(process.env.COVER_DOWNLOAD_RETRY_DELAY || "1200");
const FORCE = process.argv.includes("--force");

const OPENVERSE_API = process.env.OPENVERSE_API || "https://api.openverse.org/v1/images/";
const OPENVERSE_TOKEN_API =
  process.env.OPENVERSE_TOKEN_API || "https://api.openverse.org/v1/auth_tokens/token/";
const OPENVERSE_CLIENT_ID = process.env.OPENVERSE_CLIENT_ID || "";
const OPENVERSE_CLIENT_SECRET = process.env.OPENVERSE_CLIENT_SECRET || "";
const OPENVERSE_TOKEN = process.env.OPENVERSE_TOKEN || "";

const COMMONS_API = "https://commons.wikimedia.org/w/api.php";
const PROVIDER = String(process.env.COVER_PROVIDER || "auto").toLowerCase();
const DEBUG = process.env.COVER_DEBUG === "1";

const ALLOWED_EXT = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const LICENSE_ALLOWLIST = String(
  process.env.COVER_LICENSES || "cc0,pdm,public domain,public-domain,publicdomain",
)
  .split(",")
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean);

const CATEGORIES = [
  {
    key: "eventos",
    count: PER_CATEGORY,
    queries: [
      "concert lights stage",
      "festival lights night",
      "neon city night",
      "live music stage lights",
      "abstract neon light",
      "night skyline city lights",
      "crowd lights concert",
    ],
  },
  {
    key: "padel",
    count: PER_CATEGORY,
    queries: [
      "padel court",
      "padel racket",
      "tennis court aerial",
      "sports court blue",
      "sports net court",
      "racket sport court",
    ],
  },
  {
    key: "reservas",
    count: PER_CATEGORY,
    queries: [
      "hotel lobby interior",
      "spa interior minimal",
      "restaurant table setting",
      "modern meeting room",
      "calendar desk minimal",
      "workstation booking",
    ],
  },
  {
    key: "geral",
    count: PER_CATEGORY,
    queries: [
      "abstract gradient texture",
      "geometric pattern dark",
      "minimal abstract background",
      "light leak abstract",
      "soft blur bokeh",
      "glass texture abstract",
    ],
  },
];

let cachedProvider = null;
let openverseAuthHeader = OPENVERSE_TOKEN ? `Bearer ${OPENVERSE_TOKEN}` : null;
let openverseAuthChecked = Boolean(openverseAuthHeader);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function toSlug(input) {
  const slug = String(input || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (slug.length <= MAX_SLUG_LENGTH) return slug;
  return slug.slice(0, MAX_SLUG_LENGTH).replace(/-+$/g, "");
}

function cleanTitle(input) {
  return String(input || "")
    .replace(/^File:/i, "")
    .replace(/\.[^./]+$/, "")
    .trim();
}

function stripHtml(value) {
  return String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isLicenseAllowed(licenseText) {
  const normalized = String(licenseText || "").toLowerCase();
  return LICENSE_ALLOWLIST.some((token) => normalized.includes(token));
}

function isLargeEnough(width, height) {
  if (width < MIN_WIDTH || height < MIN_HEIGHT) return false;
  if (MIN_ASPECT_RATIO > 0 && height > 0 && width / height < MIN_ASPECT_RATIO) return false;
  return true;
}

function pickImageUrl(result) {
  const candidates = [result.url, result.image, result.thumbnail, result.detail_url];
  for (const candidate of candidates) {
    if (typeof candidate !== "string") continue;
    const ext = path.extname(new URL(candidate).pathname).toLowerCase();
    if (ALLOWED_EXT.has(ext)) return candidate;
  }
  return null;
}

function isPublicDomainOpenverse(result) {
  const licenseType = String(result.license_type || "").toLowerCase();
  const license = String(result.license || "").toLowerCase();
  return (
    licenseType.includes("cc0") ||
    licenseType.includes("pdm") ||
    license.includes("cc0") ||
    license.includes("pdm") ||
    license.includes("publicdomain")
  );
}

async function getOpenverseAuthHeader() {
  if (openverseAuthChecked) return openverseAuthHeader;
  openverseAuthChecked = true;
  if (!OPENVERSE_CLIENT_ID || !OPENVERSE_CLIENT_SECRET) return null;

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: OPENVERSE_CLIENT_ID,
    client_secret: OPENVERSE_CLIENT_SECRET,
  });

  const res = await fetch(OPENVERSE_TOKEN_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!res.ok) {
    console.warn(`Openverse auth falhou (${res.status}).`);
    return null;
  }

  const data = await res.json();
  if (!data || !data.access_token) return null;
  openverseAuthHeader = `Bearer ${data.access_token}`;
  return openverseAuthHeader;
}

async function fetchOpenversePage(query, page, authHeader) {
  const url = new URL(OPENVERSE_API);
  url.searchParams.set("q", query);
  url.searchParams.set("page", String(page));
  url.searchParams.set("page_size", String(OPENVERSE_PAGE_SIZE));
  url.searchParams.set("license", "cc0,pdm");
  url.searchParams.set("mature", "false");

  const res = await fetch(url.toString(), {
    headers: authHeader ? { Authorization: authHeader } : {},
  });

  if (!res.ok) {
    if (DEBUG) {
      const text = await res.text();
      console.warn(`Openverse error ${res.status}: ${text.slice(0, 200)}`);
    }
    throw new Error(`Openverse error ${res.status}`);
  }
  return res.json();
}

async function fetchCommonsPage(query, offset) {
  const url = new URL(COMMONS_API);
  const search = query.includes("filetype:") ? query : `${query} filetype:bitmap`;
  url.searchParams.set("action", "query");
  url.searchParams.set("format", "json");
  url.searchParams.set("formatversion", "2");
  url.searchParams.set("generator", "search");
  url.searchParams.set("gsrsearch", search);
  url.searchParams.set("gsrnamespace", "6");
  url.searchParams.set("gsrlimit", String(COMMONS_PAGE_SIZE));
  url.searchParams.set("gsroffset", String(offset));
  url.searchParams.set("prop", "imageinfo");
  url.searchParams.set("iiprop", "url|extmetadata|size|mime");
  url.searchParams.set("iiurlwidth", "0");
  url.searchParams.set("iiurlheight", "0");
  url.searchParams.set("uselang", "en");

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Commons error ${res.status}`);
  }
  return res.json();
}

function normalizeCommonsLicense(extmetadata) {
  if (!extmetadata) return "";
  const fields = [
    extmetadata.LicenseShortName?.value,
    extmetadata.License?.value,
    extmetadata.LicenseUrl?.value,
    extmetadata.UsageTerms?.value,
  ];
  return stripHtml(fields.filter(Boolean).join(" ")).toLowerCase();
}

async function downloadImage(url, destPath) {
  if (!FORCE && fs.existsSync(destPath)) return true;
  for (let attempt = 1; attempt <= DOWNLOAD_RETRIES; attempt += 1) {
    const res = await fetch(url);
    if (res.ok) {
      const buf = Buffer.from(await res.arrayBuffer());
      ensureDir(path.dirname(destPath));
      fs.writeFileSync(destPath, buf);
      return true;
    }

    if (res.status === 429 && attempt < DOWNLOAD_RETRIES) {
      if (DEBUG) {
        console.warn(`Download 429, retry ${attempt}/${DOWNLOAD_RETRIES}...`);
      }
      await sleep(DOWNLOAD_RETRY_DELAY * attempt);
      continue;
    }

    if (DEBUG) {
      console.warn(`Download failed ${res.status} (${url})`);
    }
    return false;
  }
  return false;
}

async function fetchCategoryOpenverse(category, authHeader) {
  console.log(`\n[${category.key}] openverse alvo ${category.count}`);
  if (DEBUG) {
    console.log(`[${category.key}] Openverse auth len ${authHeader ? authHeader.length : 0}`);
  }
  const usedIds = new Set();
  const picked = [];

  for (const query of category.queries) {
    let page = 1;
    let perQueryPicked = 0;

    while (picked.length < category.count && perQueryPicked < MAX_PER_QUERY) {
      const data = await fetchOpenversePage(query, page, authHeader);
      const results = Array.isArray(data.results) ? data.results : [];
      if (results.length === 0) break;

      for (const item of results) {
        if (picked.length >= category.count) break;
        const id = String(item.id || item.foreign_landing_url || item.url || "");
        if (!id || usedIds.has(id)) continue;
        if (!isPublicDomainOpenverse(item)) continue;
        const width = Number(item.width || 0);
        const height = Number(item.height || 0);
        if (!isLargeEnough(width, height)) continue;

        const imageUrl = pickImageUrl(item);
        if (!imageUrl) continue;

        usedIds.add(id);
        picked.push({
          id,
          title: item.title || item.creator || "cover",
          imageUrl,
        });
        perQueryPicked += 1;
      }

      page += 1;
      if (!data.next) break;
      await sleep(180);
    }
  }

  return picked;
}

async function fetchCategoryCommons(category) {
  console.log(`\n[${category.key}] commons alvo ${category.count}`);
  const usedIds = new Set();
  const picked = [];

  for (const query of category.queries) {
    let offset = 0;
    let perQueryPicked = 0;

    while (picked.length < category.count && perQueryPicked < MAX_PER_QUERY) {
      const data = await fetchCommonsPage(query, offset);
      const pages = Array.isArray(data?.query?.pages) ? data.query.pages : [];
      if (pages.length === 0) break;

      for (const page of pages) {
        if (picked.length >= category.count) break;
        const info = Array.isArray(page.imageinfo) ? page.imageinfo[0] : null;
        if (!info || !info.url) continue;
        if (info.mediatype && !String(info.mediatype).toLowerCase().includes("bitmap")) continue;

        const ext = path.extname(new URL(info.url).pathname).toLowerCase();
        if (!ALLOWED_EXT.has(ext)) continue;

        const width = Number(info.width || 0);
        const height = Number(info.height || 0);
        if (!isLargeEnough(width, height)) continue;

        const licenseText = normalizeCommonsLicense(info.extmetadata);
        if (!isLicenseAllowed(licenseText)) continue;

        const id = String(page.pageid || info.url || "");
        if (!id || usedIds.has(id)) continue;

        usedIds.add(id);
        picked.push({
          id,
          title: page.title || "cover",
          imageUrl: info.url,
        });
        perQueryPicked += 1;
      }

      if (!data?.continue?.gsroffset && data?.continue?.gsroffset !== 0) break;
      offset = Number(data.continue.gsroffset || 0);
      await sleep(180);
    }
  }

  return picked;
}

async function getProvider() {
  if (cachedProvider) return cachedProvider;
  if (PROVIDER === "commons") {
    cachedProvider = "commons";
    return cachedProvider;
  }
  if (PROVIDER === "openverse") {
    const authHeader = await getOpenverseAuthHeader();
    if (!authHeader) {
      throw new Error(
        "Openverse credentials missing. Register at https://api.openverse.org/v1/auth_tokens/register/ and define OPENVERSE_CLIENT_ID/SECRET or OPENVERSE_TOKEN."
      );
    }
    cachedProvider = "openverse";
    return cachedProvider;
  }

  const authHeader = await getOpenverseAuthHeader();
  cachedProvider = authHeader ? "openverse" : "commons";
  return cachedProvider;
}

async function fetchCategory(category) {
  const provider = await getProvider();
  if (provider === "openverse") {
    try {
      const authHeader = await getOpenverseAuthHeader();
      const picked = await fetchCategoryOpenverse(category, authHeader);
      if (picked.length > 0) return picked;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err || "erro");
      console.warn(`[${category.key}] Openverse falhou (${message}), a usar Wikimedia Commons.`);
      cachedProvider = "commons";
    }
  }

  return fetchCategoryCommons(category);
}

async function downloadCategory(category, picked) {
  let index = 1;
  for (const item of picked) {
    const title = cleanTitle(item.title);
    const slug = toSlug(title) || `cover-${index}`;
    const ext = path.extname(new URL(item.imageUrl).pathname).toLowerCase() || ".jpg";
    const fileName = `${String(index).padStart(2, "0")}-${slug}${ext}`;
    const destPath = path.join(DEST_ROOT, category.key, fileName);
    console.log(`- ${category.key}/${fileName}`);
    await downloadImage(item.imageUrl, destPath);
    index += 1;
  }
}

async function main() {
  ensureDir(DEST_ROOT);
  if (!global.fetch) {
    console.error("Fetch nao disponivel. Usa Node 18+.");
    process.exit(1);
  }

  let total = 0;
  for (const category of CATEGORIES) {
    const picked = await fetchCategory(category);
    await downloadCategory(category, picked);
    total += picked.length;
  }

  console.log(`\nTotal descarregado: ${total}`);
  const build = spawnSync("node", ["scripts/generate_cover_library.js"], { stdio: "inherit" });
  if (build.status !== 0) {
    process.exit(build.status || 1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
