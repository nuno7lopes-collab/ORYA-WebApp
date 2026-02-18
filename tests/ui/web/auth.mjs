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

function supabaseAdminConfig() {
  const supabaseUrl = pickNonEmpty(process.env.SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_URL);
  const serviceRoleKey = pickNonEmpty(process.env.SUPABASE_SERVICE_ROLE);
  if (!supabaseUrl || !serviceRoleKey) return null;
  return { supabaseUrl, serviceRoleKey };
}

function isProvisionableCandidate(role, candidate) {
  if (role !== "user") return false;
  return (
    candidate.source === "E2E_USER_EMAIL/E2E_USER_PASSWORD" ||
    candidate.source === "E2E_EMAIL/E2E_PASSWORD" ||
    candidate.source === "default_test_user"
  );
}

async function findUserByEmail(adminClient, email) {
  const target = email.trim().toLowerCase();
  if (!target) return null;

  let page = 1;
  const perPage = 200;
  while (page <= 20) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage });
    if (error) return null;
    const users = data?.users ?? [];
    const matched = users.find((user) => (user.email ?? "").trim().toLowerCase() === target);
    if (matched) return matched;
    if (users.length < perPage) break;
    page += 1;
  }

  return null;
}

async function provisionUserCandidate(candidate) {
  const adminCfg = supabaseAdminConfig();
  if (!adminCfg) {
    return { ok: false, reason: "SUPABASE_SERVICE_ROLE_MISSING" };
  }

  const adminClient = createClient(adminCfg.supabaseUrl, adminCfg.serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  const normalizedEmail = candidate.email.trim().toLowerCase();

  const existing = await findUserByEmail(adminClient, normalizedEmail);
  if (existing?.id) {
    const { error } = await adminClient.auth.admin.updateUserById(existing.id, {
      password: candidate.password,
      email_confirm: true,
      user_metadata: {
        ...(existing.user_metadata ?? {}),
        full_name:
          typeof existing.user_metadata?.full_name === "string" && existing.user_metadata.full_name.trim()
            ? existing.user_metadata.full_name
            : "E2E User",
      },
    });
    if (error) {
      return { ok: false, reason: `UPDATE_USER_FAILED: ${error.message}` };
    }
    return { ok: true, mode: "update" };
  }

  const { error } = await adminClient.auth.admin.createUser({
    email: normalizedEmail,
    password: candidate.password,
    email_confirm: true,
    user_metadata: { full_name: "E2E User" },
  });
  if (error) {
    return { ok: false, reason: `CREATE_USER_FAILED: ${error.message}` };
  }
  return { ok: true, mode: "create" };
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
  const roleCandidates = candidates(role);
  const failures = [];

  for (const candidate of roleCandidates) {
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

  const provisionFailures = [];
  for (const candidate of roleCandidates) {
    if (!isProvisionableCandidate(role, candidate)) continue;
    const provision = await provisionUserCandidate(candidate);
    if (!provision.ok) {
      provisionFailures.push({ source: candidate.source, message: provision.reason });
      continue;
    }

    const { data, error } = await client.auth.signInWithPassword({
      email: candidate.email,
      password: candidate.password,
    });
    const token = data?.session?.access_token;
    if (!error && token) {
      return token;
    }
    provisionFailures.push({ source: candidate.source, message: error?.message ?? "MISSING_TOKEN_AFTER_PROVISION" });
  }

  if (provisionFailures.length > 0) {
    failures.push(...provisionFailures);
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

  const { response, json } = await fetchJson(
    `${baseURL.replace(/\/+$/, "")}/api/org-hub/organizations`,
    bearer,
  );

  if (!response.ok) {
    if (envOrgId) {
      const parsed = Number(envOrgId);
      if (Number.isFinite(parsed) && parsed > 0) return parsed;
    }
    return null;
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

  const fallbackOrgId = pickNonEmpty(envOrgId, process.env.ORYA_E2E_ORGANIZATION_ID);
  if (fallbackOrgId) {
    const parsed = Number(fallbackOrgId);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }

  return null;
}

export async function assertPublicBaseline(baseURL) {
  const normalizedBase = baseURL.replace(/\/+$/, "");
  const routes = ["/", "/eventos", "/descobrir"];

  for (const route of routes) {
    const response = await fetch(`${normalizedBase}${route}`, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok && response.status >= 500) {
      throw new Error(`UI_E2E_PUBLIC_BASELINE_FAILED route=${route} status=${response.status}`);
    }
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
