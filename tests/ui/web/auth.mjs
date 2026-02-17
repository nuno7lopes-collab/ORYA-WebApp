import { createClient } from "@supabase/supabase-js";

let cachedUserBearer = null;
let cachedAdminBearer = null;

function pickNonEmpty(...values) {
  for (const value of values) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

function supabaseConfig() {
  const supabaseUrl = pickNonEmpty(process.env.SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_URL);
  const supabaseAnonKey = pickNonEmpty(
    process.env.SUPABASE_ANON_KEY,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("UI_E2E_SUPABASE_CONFIG_MISSING");
  }

  return { supabaseUrl, supabaseAnonKey };
}

function candidates(role) {
  const defaultUser = {
    email: "test-orya@orya.pt",
    password: "TestOrya123!",
    source: "default_test_user",
  };

  const userCandidates = [
    {
      email: pickNonEmpty(process.env.E2E_USER_EMAIL) ?? "",
      password: pickNonEmpty(process.env.E2E_USER_PASSWORD) ?? "",
      source: "E2E_USER_EMAIL/E2E_USER_PASSWORD",
    },
    {
      email: pickNonEmpty(process.env.E2E_EMAIL) ?? "",
      password: pickNonEmpty(process.env.E2E_PASSWORD) ?? "",
      source: "E2E_EMAIL/E2E_PASSWORD",
    },
    {
      email: pickNonEmpty(process.env.STAGING_ADMIN_EMAIL) ?? "",
      password: pickNonEmpty(process.env.STAGING_ADMIN_PASSWORD) ?? "",
      source: "STAGING_ADMIN_EMAIL/STAGING_ADMIN_PASSWORD",
    },
    defaultUser,
  ];

  const adminCandidates = [
    {
      email: pickNonEmpty(process.env.E2E_ADMIN_EMAIL) ?? "",
      password: pickNonEmpty(process.env.E2E_ADMIN_PASSWORD) ?? "",
      source: "E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD",
    },
    {
      email: pickNonEmpty(process.env.STAGING_ADMIN_EMAIL) ?? "",
      password: pickNonEmpty(process.env.STAGING_ADMIN_PASSWORD) ?? "",
      source: "STAGING_ADMIN_EMAIL/STAGING_ADMIN_PASSWORD",
    },
    {
      email: pickNonEmpty(process.env.E2E_EMAIL) ?? "",
      password: pickNonEmpty(process.env.E2E_PASSWORD) ?? "",
      source: "E2E_EMAIL/E2E_PASSWORD",
    },
    defaultUser,
  ];

  return (role === "admin" ? adminCandidates : userCandidates).filter(
    (candidate) => Boolean(candidate.email.trim() && candidate.password.trim()),
  );
}

async function loginWithCandidates(role) {
  const { supabaseUrl, supabaseAnonKey } = supabaseConfig();
  const client = createClient(supabaseUrl, supabaseAnonKey);
  const failures = [];

  for (const candidate of candidates(role)) {
    const { data, error } = await client.auth.signInWithPassword({
      email: candidate.email,
      password: candidate.password,
    });

    const token = data?.session?.access_token;
    if (!error && token) {
      return token;
    }

    failures.push({ source: candidate.source, message: error?.message ?? "MISSING_TOKEN" });
  }

  throw new Error(`${role.toUpperCase()}_LOGIN_FAILED ${JSON.stringify(failures, null, 2)}`);
}

export async function resolveBearer(role) {
  if (role === "admin" && cachedAdminBearer) return cachedAdminBearer;
  if (role === "user" && cachedUserBearer) return cachedUserBearer;

  if (role === "user") {
    const fromEnv = pickNonEmpty(process.env.E2E_USER_BEARER);
    if (fromEnv) {
      cachedUserBearer = fromEnv;
      return fromEnv;
    }
  }

  if (role === "admin") {
    const fromEnv = pickNonEmpty(process.env.E2E_ADMIN_BEARER);
    if (fromEnv) {
      cachedAdminBearer = fromEnv;
      return fromEnv;
    }
  }

  const token = await loginWithCandidates(role);
  if (role === "admin") {
    cachedAdminBearer = token;
  } else {
    cachedUserBearer = token;
  }
  return token;
}

function unwrap(payload) {
  if (!payload || typeof payload !== "object") return payload;
  if (payload.data && typeof payload.data === "object") return payload.data;
  return payload;
}

async function fetchJson(url, bearer) {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${bearer}`,
      Accept: "application/json",
    },
  });

  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  return { response, json, text };
}

export async function resolveOrgId(baseURL, bearer) {
  const envOrgId = pickNonEmpty(process.env.UI_E2E_ORG_ID);

  const { response, json, text } = await fetchJson(
    `${baseURL.replace(/\/+$/, "")}/api/org-hub/organizations`,
    bearer,
  );

  if (!response.ok) {
    if (envOrgId) return Number(envOrgId);
    throw new Error(`UI_E2E_ORG_LIST_FAILED status=${response.status} body=${text.slice(0, 280)}`);
  }

  const payload = unwrap(json);
  const items = Array.isArray(payload?.items) ? payload.items : [];
  const preferredUsername = pickNonEmpty(process.env.UI_E2E_SEED_ORG_USERNAME, "top_padel");
  const preferred = items.find((item) => item.organization?.username === preferredUsername);
  const fallback = items[0];
  const candidate = preferred?.organizationId ?? fallback?.organizationId;

  if (typeof candidate === "number" && Number.isFinite(candidate)) {
    return candidate;
  }

  const fallbackOrgId = pickNonEmpty(envOrgId, process.env.ORYA_E2E_ORGANIZATION_ID, "51");
  if (fallbackOrgId) {
    const parsed = Number(fallbackOrgId);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }

  throw new Error("UI_E2E_ORG_ID_UNRESOLVED");
}

export async function assertTopPadelSeed(baseURL) {
  const normalizedBase = baseURL.replace(/\/+$/, "");
  const username = pickNonEmpty(process.env.UI_E2E_SEED_ORG_USERNAME, "top_padel");

  const profile = await fetch(`${normalizedBase}/api/public/profile?username=${encodeURIComponent(username)}`, {
    headers: { Accept: "application/json" },
  });
  if (!profile.ok) {
    throw new Error(`UI_E2E_SEED_PROFILE_FAILED status=${profile.status}`);
  }

  const catalog = await fetch(
    `${normalizedBase}/api/public/store/catalog?username=${encodeURIComponent(username)}`,
    {
      headers: { Accept: "application/json" },
    },
  );
  if (!catalog.ok) {
    throw new Error(`UI_E2E_SEED_CATALOG_FAILED status=${catalog.status}`);
  }
}

export async function assertAdminBearer(baseURL, bearer) {
  const normalizedBase = baseURL.replace(/\/+$/, "");
  const { response, json, text } = await fetchJson(
    `${normalizedBase}/api/admin/organizacoes/list?page=1&pageSize=1`,
    bearer,
  );
  if (response.ok) return;

  const code =
    (json &&
      typeof json === "object" &&
      ((typeof json.errorCode === "string" && json.errorCode) ||
        (typeof json.code === "string" && json.code))) ||
    "";

  throw new Error(`UI_E2E_ADMIN_BEARER_INVALID status=${response.status} code=${code} body=${text.slice(0, 280)}`);
}

export function authHeaders(bearer) {
  return {
    Authorization: `Bearer ${bearer}`,
  };
}
