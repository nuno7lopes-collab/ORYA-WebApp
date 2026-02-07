#!/usr/bin/env node

const BASE_URL = (process.env.ORYA_E2E_BASE_URL || "http://localhost:3000").replace(/\/+$/, "");
const SESSION_COOKIE = process.env.ORYA_E2E_COOKIE || "";
const ORG_ID_RAW = process.env.ORYA_E2E_ORGANIZATION_ID || "";
const EXISTING_EVENT_ID_RAW = process.env.ORYA_E2E_EVENT_ID || "";
const KEEP_EVENT = /^(1|true|yes)$/i.test(process.env.ORYA_E2E_KEEP_EVENT || "");

const ORG_ID = Number.isFinite(Number(ORG_ID_RAW)) ? Number(ORG_ID_RAW) : null;
const EXISTING_EVENT_ID = Number.isFinite(Number(EXISTING_EVENT_ID_RAW)) ? Number(EXISTING_EVENT_ID_RAW) : null;

const state = {
  addressDetails: null,
  eventId: EXISTING_EVENT_ID,
  eventSlug: null,
  createdEvent: false,
};

const steps = [];

function nowIso(offsetMs) {
  return new Date(Date.now() + offsetMs).toISOString();
}

function unwrapPayload(raw) {
  if (!raw || typeof raw !== "object") return raw;
  if ("data" in raw && raw.data && typeof raw.data === "object") return raw.data;
  return raw;
}

function pick(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null) return value;
  }
  return null;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function api(path, options = {}) {
  const headers = {
    Accept: "application/json",
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(SESSION_COOKIE ? { Cookie: SESSION_COOKIE } : {}),
    ...(options.headers || {}),
  };

  const response = await fetch(`${BASE_URL}${path}`, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  let raw = null;
  try {
    raw = await response.json();
  } catch {
    raw = null;
  }
  const payload = unwrapPayload(raw);

  return { response, raw, payload };
}

async function runStep(name, fn, { optional = false } = {}) {
  const startedAt = Date.now();
  try {
    const details = await fn();
    const elapsedMs = Date.now() - startedAt;
    steps.push({ name, ok: true, elapsedMs, details: details || null });
    console.log(`OK   ${name} (${elapsedMs}ms)`);
    return details;
  } catch (error) {
    const elapsedMs = Date.now() - startedAt;
    const message = error instanceof Error ? error.message : String(error);
    steps.push({ name, ok: false, elapsedMs, error: message });
    if (optional) {
      console.log(`WARN ${name} (${elapsedMs}ms) - ${message}`);
      return null;
    }
    console.log(`FAIL ${name} (${elapsedMs}ms) - ${message}`);
    throw error;
  }
}

function buildEventPayloadFromAddress(details, title) {
  return {
    title,
    description: "E2E address flow (Apple Maps primary).",
    startsAt: nowIso(7 * 24 * 60 * 60 * 1000),
    endsAt: nowIso(7 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000),
    addressId: details?.addressId || null,
    templateType: "OTHER",
    pricingMode: "FREE_ONLY",
  };
}

async function main() {
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Auth cookie: ${SESSION_COOKIE ? "provided" : "missing"}`);
  console.log(`Organization ID: ${ORG_ID ?? "missing"}`);

  await runStep("Apple token endpoint", async () => {
    const { response, payload } = await api("/api/maps/apple-token");
    assert(response.ok, `HTTP ${response.status}`);
    assert(payload && payload.ok !== false, "Resposta Apple token invalida.");
    assert(typeof payload.token === "string" && payload.token.length > 20, "Token Apple Maps ausente.");
    return { expiresAt: payload.expiresAt || null };
  });

  const auto = await runStep("Geo autocomplete (Apple)", async () => {
    const query = encodeURIComponent("Avenida da Liberdade Lisboa");
    const { response, payload } = await api(`/api/geo/autocomplete?q=${query}&lang=pt-PT`);
    assert(response.ok, `HTTP ${response.status}`);
    const items = Array.isArray(payload?.items) ? payload.items : [];
    assert(items.length > 0, "Sem sugestoes de morada.");
    const first = items.find((item) => item && typeof item.providerId === "string") || items[0];
    assert(first && typeof first.providerId === "string", "providerId ausente na sugestao.");
    return {
      providerId: first.providerId,
      sourceProvider: first.sourceProvider || payload?.sourceProvider || "APPLE_MAPS",
      label: first.label || first.title || null,
      lat: typeof first.lat === "number" ? first.lat : null,
      lng: typeof first.lng === "number" ? first.lng : null,
    };
  });

  await runStep("Geo details + address normalization", async () => {
    const sourceProvider = auto?.sourceProvider || "APPLE_MAPS";
    const providerId = auto?.providerId;
    assert(providerId, "providerId indisponivel para details.");
    const { response, payload } = await api(
      `/api/geo/details?providerId=${encodeURIComponent(providerId)}&sourceProvider=${encodeURIComponent(sourceProvider)}&lang=pt-PT`,
    );
    assert(response.ok, `HTTP ${response.status}`);
    const item = payload?.item || null;
    assert(item && typeof item === "object", "Resposta details invalida.");
    assert(typeof item.addressId === "string" && item.addressId.length > 0, "addressId ausente.");
    assert(Number.isFinite(item.lat) && Number.isFinite(item.lng), "Coordenadas invalidas.");
    state.addressDetails = item;
    return {
      addressId: item.addressId,
      sourceProvider: item.sourceProvider || sourceProvider,
      formattedAddress: item.formattedAddress || null,
    };
  });

  const canRunProtected = Boolean(SESSION_COOKIE && ORG_ID);
  if (!canRunProtected) {
    await runStep(
      "Protected create/update/list flow",
      async () => {
        throw new Error(
          "Saltado: define ORYA_E2E_COOKIE e ORYA_E2E_ORGANIZATION_ID para validar criacao/edicao de evento.",
        );
      },
      { optional: true },
    );
    return;
  }

  if (!state.eventId) {
    await runStep("Create event with Apple normalized address", async () => {
      const title = `E2E Apple Address ${Date.now()}`;
      const payload = buildEventPayloadFromAddress(state.addressDetails, title);
      const { response, payload: createPayload, raw } = await api(
        `/api/organizacao/events/create?organizationId=${ORG_ID}`,
        { method: "POST", body: payload },
      );
      assert(response.ok, `HTTP ${response.status}`);
      const event = pick(createPayload?.event, raw?.event, raw?.data?.event);
      assert(event && typeof event.id === "number", "Evento nao criado.");
      state.eventId = event.id;
      state.eventSlug = typeof event.slug === "string" ? event.slug : null;
      state.createdEvent = true;
      return { eventId: state.eventId, slug: state.eventSlug };
    });
  }

  await runStep("List organization events", async () => {
    const { response, payload } = await api(`/api/organizacao/events/list?organizationId=${ORG_ID}`);
    assert(response.ok, `HTTP ${response.status}`);
    const items = Array.isArray(payload?.items) ? payload.items : [];
    const found = items.find((item) => item && item.id === state.eventId);
    assert(found, "Evento de teste nao encontrado na listagem.");
    if (!state.eventSlug && typeof found.slug === "string") {
      state.eventSlug = found.slug;
    }
    return { found: true, total: items.length };
  });

  await runStep("Update event location with same Apple address", async () => {
    assert(state.eventId, "eventId ausente para update.");
    const payload = buildEventPayloadFromAddress(
      state.addressDetails,
      `E2E Apple Address Updated ${Date.now()}`,
    );
    const { response, payload: updatePayload, raw } = await api("/api/organizacao/events/update", {
      method: "POST",
      body: {
        eventId: state.eventId,
        ...payload,
      },
    });
    assert(response.ok, `HTTP ${response.status}`);
    const updated = pick(updatePayload?.event, raw?.event, raw?.data?.event);
    assert(updated && updated.id === state.eventId, "Update nao confirmou o evento.");
    if (!state.eventSlug && typeof updated.slug === "string") {
      state.eventSlug = updated.slug;
    }
    return { eventId: state.eventId };
  });

  await runStep("Public event page loads", async () => {
    if (!state.eventSlug) {
      return { skipped: true };
    }
    const response = await fetch(`${BASE_URL}/eventos/${encodeURIComponent(state.eventSlug)}`, {
      headers: { ...(SESSION_COOKIE ? { Cookie: SESSION_COOKIE } : {}) },
      redirect: "follow",
    });
    assert(response.ok, `HTTP ${response.status}`);
    return { slug: state.eventSlug };
  });

  if (state.createdEvent && !KEEP_EVENT) {
    await runStep("Cleanup: archive test event", async () => {
      assert(state.eventId, "eventId ausente para cleanup.");
      const { response } = await api("/api/organizacao/events/update", {
        method: "POST",
        body: { eventId: state.eventId, archive: true },
      });
      assert(response.ok, `HTTP ${response.status}`);
      return { archivedEventId: state.eventId };
    });
  }
}

try {
  await main();
  const okCount = steps.filter((step) => step.ok).length;
  const failCount = steps.length - okCount;
  console.log("");
  console.log("E2E checklist summary");
  console.log(`- total: ${steps.length}`);
  console.log(`- passed: ${okCount}`);
  console.log(`- failed: ${failCount}`);
  process.exit(failCount === 0 ? 0 : 1);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error("");
  console.error(`Checklist failed: ${message}`);
  process.exit(1);
}
