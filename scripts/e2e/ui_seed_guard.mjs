#!/usr/bin/env node

import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
require("../load-env.js");

function parseArgs(argv) {
  const out = {
    baseUrl: null,
    username: null,
    orgId: null,
    bearer: null,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--base-url") {
      out.baseUrl = argv[i + 1] ?? null;
      i += 1;
      continue;
    }
    if (arg === "--username") {
      out.username = argv[i + 1] ?? null;
      i += 1;
      continue;
    }
    if (arg === "--org-id") {
      out.orgId = argv[i + 1] ?? null;
      i += 1;
      continue;
    }
    if (arg === "--bearer") {
      out.bearer = argv[i + 1] ?? null;
      i += 1;
    }
  }

  return out;
}

function pickNonEmpty(...values) {
  for (const value of values) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { response, json, text };
}

function unwrap(payload) {
  if (!payload || typeof payload !== "object") return payload;
  if ("data" in payload && payload.data && typeof payload.data === "object") {
    return payload.data;
  }
  return payload;
}

async function assertPublicProfile(baseUrl, username) {
  if (!username) return;
  const endpoint = `${baseUrl}/api/public/profile?username=${encodeURIComponent(username)}`;
  const { response, json, text } = await fetchJson(endpoint);
  if (!response.ok) {
    throw new Error(`PROFILE_ENDPOINT_FAILED status=${response.status} body=${text.slice(0, 280)}`);
  }
  const data = unwrap(json);
  const hasIdentity = Boolean(data?.profile || data?.user || data?.username || data?.id);
  if (!hasIdentity) {
    throw new Error("PROFILE_ENDPOINT_EMPTY");
  }
}

async function assertPublicStore(baseUrl, username) {
  if (!username) return;
  const endpoint = `${baseUrl}/api/public/store/catalog?username=${encodeURIComponent(username)}`;
  const { response, json, text } = await fetchJson(endpoint);
  if (!response.ok) {
    throw new Error(`STORE_CATALOG_FAILED status=${response.status} body=${text.slice(0, 280)}`);
  }
  const data = unwrap(json);
  if (!data || (Array.isArray(data.items) && data.items.length === 0)) {
    throw new Error("STORE_CATALOG_EMPTY");
  }
}

async function assertOrgMe(baseUrl, orgId, bearer) {
  if (!orgId || !bearer) return;
  const endpoint = `${baseUrl}/api/org/${orgId}/me`;
  const { response, text } = await fetchJson(endpoint, {
    headers: {
      Authorization: `Bearer ${bearer}`,
    },
  });

  if (!response.ok) {
    throw new Error(`ORG_ME_FAILED status=${response.status} body=${text.slice(0, 280)}`);
  }
}

async function assertPublicBaseline(baseUrl) {
  const routes = ["/", "/eventos", "/descobrir"];
  for (const route of routes) {
    const { response, text } = await fetchJson(`${baseUrl}${route}`);
    if (!response.ok && response.status >= 500) {
      throw new Error(`PUBLIC_BASELINE_FAILED route=${route} status=${response.status} body=${text.slice(0, 280)}`);
    }
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const baseUrl = pickNonEmpty(
    args.baseUrl,
    process.env.UI_E2E_BASE_URL,
    process.env.ORYA_E2E_BASE_URL,
    process.env.API_BASE_URL,
    process.env.APP_BASE_URL,
    process.env.NEXT_PUBLIC_BASE_URL,
    "http://127.0.0.1:33123",
  )?.replace(/\/+$/, "");

  const username = pickNonEmpty(args.username, process.env.UI_E2E_SEED_ORG_USERNAME);
  const orgId = pickNonEmpty(args.orgId, process.env.UI_E2E_ORG_ID);
  const bearer = pickNonEmpty(args.bearer, process.env.E2E_USER_BEARER, process.env.E2E_ADMIN_BEARER);

  if (!baseUrl) {
    throw new Error("BASE_URL_MISSING");
  }

  await assertPublicBaseline(baseUrl);
  await assertPublicProfile(baseUrl, username);
  await assertPublicStore(baseUrl, username);
  await assertOrgMe(baseUrl, orgId, bearer);

  process.stdout.write(
    `${JSON.stringify({ ok: true, baseUrl, username, orgId: orgId ?? null, checkedOrgMe: Boolean(orgId && bearer) })}\n`,
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`[ui_seed_guard] ${message}\n`);
  process.stderr.write("[ui_seed_guard] seed legacy removido; criar e executar o novo seed canónico antes do UI gate.\n");
  process.exit(1);
});
