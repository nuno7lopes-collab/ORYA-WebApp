#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const { Pool } = require("pg");
const { createClient } = require("@supabase/supabase-js");

require("./load-env");

const REPORT_DATE = process.env.REPORT_DATE || new Date().toISOString().slice(0, 10);
const REPORT = process.env.REPORT || path.join("reports", `p1_closeout_${REPORT_DATE}.md`);
const BASE_URL = process.env.API_BASE_URL || process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_BASE_URL;
const ORYA_CRON_SECRET = process.env.ORYA_CRON_SECRET || "";

const E2E_EMAIL = process.env.E2E_EMAIL || "test-orya@orya.pt";
const E2E_PASSWORD = process.env.E2E_PASSWORD || "TestOrya123!";
const AUTO_CONFIRM_STRIPE = process.env.AUTO_CONFIRM_STRIPE === "1";

if (!BASE_URL) {
  console.error("Missing API_BASE_URL / APP_BASE_URL / NEXT_PUBLIC_BASE_URL");
  process.exit(1);
}

const reportLines = [];
const writeReport = (line = "") => reportLines.push(line);

const redact = (value) => {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (/secret|token|key/i.test(k)) {
        out[k] = v ? "<redacted>" : v;
      } else {
        out[k] = redact(v);
      }
    }
    return out;
  }
  return value;
};

const apiCall = async (method, path, body, bearer, extraHeaders) => {
  const url = `${BASE_URL}${path}`;
  const headers = { Accept: "application/json" };
  if (method !== "GET") headers["Content-Type"] = "application/json";
  if (bearer) headers.Authorization = `Bearer ${bearer}`;
  if (extraHeaders) Object.assign(headers, extraHeaders);
  const res = await fetch(url, {
    method,
    headers,
    body: method === "GET" ? undefined : JSON.stringify(body ?? {}),
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { status: res.status, json };
};

const pollStatus = async (purchaseId, attempts = 12, intervalMs = 5000) => {
  for (let i = 1; i <= attempts; i += 1) {
    const resp = await apiCall("GET", `/api/checkout/status?purchaseId=${purchaseId}`);
    const status = resp?.json?.data?.status || resp?.json?.status || null;
    writeReport(`- checkout status attempt ${i}/${attempts}: ${status ?? "unknown"}`);
    if (["PAID", "FAILED", "REFUNDED", "DISPUTED"].includes(status)) return resp;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return apiCall("GET", `/api/checkout/status?purchaseId=${purchaseId}`);
};

const resolveDbUrl = () => {
  const raw = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    parsed.searchParams.delete("options");
    return parsed.toString();
  } catch {
    return raw;
  }
};

async function getAuthBearer() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) throw new Error("Missing SUPABASE_URL / SUPABASE_ANON_KEY");
  const supabase = createClient(supabaseUrl, anonKey);
  const { data, error } = await supabase.auth.signInWithPassword({
    email: E2E_EMAIL,
    password: E2E_PASSWORD,
  });
  if (error) throw new Error(`Supabase sign-in failed: ${error.message}`);
  const token = data?.session?.access_token;
  if (!token) throw new Error("Supabase sign-in returned no access token.");
  return token;
}

async function dbQueryOne(sql) {
  const url = resolveDbUrl();
  if (!url) throw new Error("DATABASE_URL or DIRECT_URL missing");
  const pool = new Pool({
    connectionString: url,
    ssl: process.env.NODE_ENV === "production" ? undefined : { rejectUnauthorized: false },
  });
  try {
    const res = await pool.query(sql);
    return res.rows[0] || null;
  } finally {
    await pool.end();
  }
}

async function main() {
  writeReport(`# P1 Closeout Report — ${REPORT_DATE}`);
  writeReport("");
  writeReport("## E2E P1 (manual)");

  const bearer = await getAuthBearer();

  writeReport("");
  writeReport("### Ops / Saúde");
  const opsHealth = await apiCall("GET", "/api/internal/ops/health", null, null, {
    "X-ORYA-CRON-SECRET": ORYA_CRON_SECRET,
  });
  const opsDashboard = await apiCall("GET", "/api/internal/ops/dashboard", null, null, {
    "X-ORYA-CRON-SECRET": ORYA_CRON_SECRET,
  });
  const opsSlo = await apiCall("GET", "/api/internal/ops/slo", null, null, {
    "X-ORYA-CRON-SECRET": ORYA_CRON_SECRET,
  });
  writeReport("```json");
  writeReport(JSON.stringify(redact({ health: opsHealth, dashboard: opsDashboard, slo: opsSlo }), null, 2));
  writeReport("```");

  const paid = await dbQueryOne(
    "select e.id as event_id, e.slug, tt.id as ticket_type_id, tt.price, tt.currency from app_v3.ticket_types tt join app_v3.events e on e.id = tt.event_id where tt.price > 0 and e.is_deleted = false order by e.starts_at desc limit 1",
  );
  const free = await dbQueryOne(
    "select e.id as event_id, e.slug, tt.id as ticket_type_id, tt.price, tt.currency from app_v3.ticket_types tt join app_v3.events e on e.id = tt.event_id where tt.price = 0 and e.is_deleted = false order by e.starts_at desc limit 1",
  );

  writeReport("");
  writeReport("### Flow A: payments intent → confirm → webhook → reconcile → ledger");
  if (!paid?.slug || !paid?.ticket_type_id) {
    writeReport("_Paid checkout skipped (no paid ticket types found)._");
  } else {
    const paidPayload = {
      slug: paid.slug,
      items: [{ ticketTypeId: paid.ticket_type_id, quantity: 1 }],
      paymentScenario: "SINGLE",
      paymentMethod: "card",
      idempotencyKey: `e2e-paid-${Date.now()}`,
    };
    const paidResp = await apiCall("POST", "/api/payments/intent", paidPayload, bearer);
    writeReport("#### Paid checkout (intent)");
    writeReport("```json");
    writeReport(JSON.stringify(redact(paidResp), null, 2));
    writeReport("```");

    const paidPurchaseId = paidResp?.json?.data?.purchaseId;
    const paidIntentId = paidResp?.json?.data?.paymentIntentId;

    if (AUTO_CONFIRM_STRIPE && paidIntentId && process.env.STRIPE_SECRET_KEY) {
      const stripeResp = await fetch(`https://api.stripe.com/v1/payment_intents/${paidIntentId}/confirm`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "payment_method=pm_card_visa",
      });
      const stripeJson = await stripeResp.json();
      writeReport("#### Stripe confirm");
      writeReport("```json");
      writeReport(JSON.stringify(redact({ status: stripeResp.status, json: stripeJson }), null, 2));
      writeReport("```");
    } else if (paidIntentId) {
      writeReport("_Stripe confirm skipped (AUTO_CONFIRM_STRIPE=0 or missing STRIPE_SECRET_KEY)._");
    }

    if (paidPurchaseId) {
      writeReport("");
      writeReport("#### Checkout status");
      const statusResp = await pollStatus(paidPurchaseId);
      writeReport("```json");
      writeReport(JSON.stringify(redact(statusResp), null, 2));
      writeReport("```");
    }
  }

  writeReport("");
  writeReport("### Flow B: free checkout → reconcile → entitlement → check-in");
  if (!free?.slug || !free?.ticket_type_id) {
    writeReport("_Free checkout skipped (no free ticket types found)._");
  } else {
    const freePayload = {
      slug: free.slug,
      items: [{ ticketTypeId: free.ticket_type_id, quantity: 1 }],
      paymentScenario: "FREE_CHECKOUT",
      paymentMethod: "card",
      idempotencyKey: `e2e-free-${Date.now()}`,
    };
    const freeResp = await apiCall("POST", "/api/payments/intent", freePayload, bearer);
    writeReport("#### Free checkout (intent)");
    writeReport("```json");
    writeReport(JSON.stringify(redact(freeResp), null, 2));
    writeReport("```");

    const freePurchaseId = freeResp?.json?.data?.purchaseId;
    if (freePurchaseId) {
      const reconcileResp = await apiCall("POST", "/api/internal/reconcile", { minutes: 1 }, null, {
        "X-ORYA-CRON-SECRET": ORYA_CRON_SECRET,
      });
      writeReport("#### Reconcile");
      writeReport("```json");
      writeReport(JSON.stringify(redact(reconcileResp), null, 2));
      writeReport("```");

      writeReport("");
      writeReport("#### Checkout status (free)");
      const statusResp = await pollStatus(freePurchaseId);
      writeReport("```json");
      writeReport(JSON.stringify(redact(statusResp), null, 2));
      writeReport("```");

      const ent = await dbQueryOne(
        `select id, event_id from app_v3.entitlements where purchase_id = '${freePurchaseId}' order by created_at desc limit 1`,
      );
      if (ent?.id) {
        const walletResp = await apiCall("GET", `/api/me/wallet/${ent.id}`, null, bearer);
        writeReport("#### Wallet");
        writeReport("```json");
        writeReport(JSON.stringify(redact(walletResp), null, 2));
        writeReport("```");

        const qrToken = walletResp?.json?.data?.qrToken || walletResp?.json?.qrToken;
        if (qrToken) {
          const checkinPayload = { qrPayload: qrToken, eventId: ent.event_id, deviceId: "e2e-script" };
          const checkinResp = await apiCall("POST", "/api/internal/checkin/consume", checkinPayload, null, {
            "X-ORYA-CRON-SECRET": ORYA_CRON_SECRET,
          });
          writeReport("#### Check-in consume");
          writeReport("```json");
          writeReport(JSON.stringify(redact(checkinResp), null, 2));
          writeReport("```");
        }
      }
    }
  }

  writeReport("");
  writeReport("## Notes");
  writeReport("- AUTO_CONFIRM_STRIPE=1 para confirmar PaymentIntent (usa Stripe live).");
  writeReport("- Endpoints internos requerem ORYA_CRON_SECRET.");

  fs.mkdirSync(path.dirname(REPORT), { recursive: true });
  fs.writeFileSync(REPORT, `${reportLines.join("\\n")}\n`, "utf8");
  console.log(`[run-e2e-p1-manual] Report written: ${REPORT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
