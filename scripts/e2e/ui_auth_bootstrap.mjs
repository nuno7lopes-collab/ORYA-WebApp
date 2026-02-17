#!/usr/bin/env node

import { createClient } from "@supabase/supabase-js";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
require("../load-env.js");

function parseArgs(argv) {
  const out = {
    role: "user",
    tokenOnly: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--role") {
      out.role = String(argv[i + 1] ?? "user").trim().toLowerCase();
      i += 1;
      continue;
    }
    if (arg === "--token-only") {
      out.tokenOnly = true;
      continue;
    }
  }
  return out;
}

function pickNonEmpty(...values) {
  for (const value of values) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (trimmed.length > 0) return trimmed;
  }
  return null;
}

function getSupabaseConfig() {
  const supabaseUrl = pickNonEmpty(process.env.SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_URL);
  const supabaseAnonKey = pickNonEmpty(
    process.env.SUPABASE_ANON_KEY,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("SUPABASE_CONFIG_MISSING");
  }
  return { supabaseUrl, supabaseAnonKey };
}

function resolveBearerFromEnv(role) {
  if (role === "admin") {
    return pickNonEmpty(process.env.E2E_ADMIN_BEARER, process.env.E2E_USER_BEARER);
  }
  return pickNonEmpty(process.env.E2E_USER_BEARER);
}

function resolveCredentialCandidates(role) {
  const defaultUser = {
    email: "test-orya@orya.pt",
    password: "TestOrya123!",
    source: "default_test_user",
  };

  const userCandidates = [
    {
      email: pickNonEmpty(process.env.E2E_USER_EMAIL),
      password: pickNonEmpty(process.env.E2E_USER_PASSWORD),
      source: "E2E_USER_EMAIL/E2E_USER_PASSWORD",
    },
    {
      email: pickNonEmpty(process.env.E2E_EMAIL),
      password: pickNonEmpty(process.env.E2E_PASSWORD),
      source: "E2E_EMAIL/E2E_PASSWORD",
    },
    {
      email: pickNonEmpty(process.env.STAGING_ADMIN_EMAIL),
      password: pickNonEmpty(process.env.STAGING_ADMIN_PASSWORD),
      source: "STAGING_ADMIN_EMAIL/STAGING_ADMIN_PASSWORD",
    },
    defaultUser,
  ];

  const adminCandidates = [
    {
      email: pickNonEmpty(process.env.E2E_ADMIN_EMAIL),
      password: pickNonEmpty(process.env.E2E_ADMIN_PASSWORD),
      source: "E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD",
    },
    {
      email: pickNonEmpty(process.env.STAGING_ADMIN_EMAIL),
      password: pickNonEmpty(process.env.STAGING_ADMIN_PASSWORD),
      source: "STAGING_ADMIN_EMAIL/STAGING_ADMIN_PASSWORD",
    },
    {
      email: pickNonEmpty(process.env.E2E_EMAIL),
      password: pickNonEmpty(process.env.E2E_PASSWORD),
      source: "E2E_EMAIL/E2E_PASSWORD",
    },
    defaultUser,
  ];

  const selected = role === "admin" ? adminCandidates : userCandidates;
  return selected.filter((candidate) => candidate.email && candidate.password);
}

async function signInCandidate(client, candidate) {
  const { data, error } = await client.auth.signInWithPassword({
    email: candidate.email,
    password: candidate.password,
  });

  if (error || !data.session?.access_token) {
    return {
      ok: false,
      reason: error?.message ?? "MISSING_ACCESS_TOKEN",
      source: candidate.source,
      email: candidate.email,
    };
  }

  return {
    ok: true,
    source: candidate.source,
    email: candidate.email,
    bearer: data.session.access_token,
    userId: data.user?.id ?? null,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const role = args.role === "admin" ? "admin" : "user";

  const fromEnv = resolveBearerFromEnv(role);
  if (fromEnv) {
    if (args.tokenOnly) {
      process.stdout.write(`${fromEnv}\n`);
      return;
    }
    process.stdout.write(
      `${JSON.stringify({ ok: true, role, source: role === "admin" ? "E2E_ADMIN_BEARER" : "E2E_USER_BEARER", bearer: fromEnv })}\n`,
    );
    return;
  }

  const { supabaseUrl, supabaseAnonKey } = getSupabaseConfig();
  const client = createClient(supabaseUrl, supabaseAnonKey);
  const candidates = resolveCredentialCandidates(role);

  if (candidates.length === 0) {
    throw new Error(role === "admin" ? "ADMIN_CREDENTIALS_MISSING" : "USER_CREDENTIALS_MISSING");
  }

  const failures = [];
  for (const candidate of candidates) {
    const result = await signInCandidate(client, candidate);
    if (result.ok) {
      if (args.tokenOnly) {
        process.stdout.write(`${result.bearer}\n`);
      } else {
        process.stdout.write(`${JSON.stringify({ ok: true, role, ...result })}\n`);
      }
      return;
    }
    failures.push({ source: result.source, reason: result.reason, email: result.email });
  }

  throw new Error(
    JSON.stringify(
      {
        code: role === "admin" ? "ADMIN_LOGIN_FAILED" : "USER_LOGIN_FAILED",
        failures,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`[ui_auth_bootstrap] ${message}\n`);
  process.exit(1);
});
