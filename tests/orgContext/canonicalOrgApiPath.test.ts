import { afterEach, describe, expect, it } from "vitest";
import { resolveCanonicalOrgApiPath } from "@/lib/canonicalOrgApiPath";

const originalWindow = (globalThis as { window?: unknown }).window;
const originalDocument = (globalThis as { document?: unknown }).document;

function setBrowserContext(pathname: string, search = "") {
  (globalThis as { window?: unknown }).window = {
    location: { pathname, search },
    sessionStorage: { getItem: () => null },
  };
  (globalThis as { document?: unknown }).document = { cookie: "" };
}

afterEach(() => {
  if (typeof originalWindow === "undefined") {
    delete (globalThis as { window?: unknown }).window;
  } else {
    (globalThis as { window?: unknown }).window = originalWindow;
  }
  if (typeof originalDocument === "undefined") {
    delete (globalThis as { document?: unknown }).document;
  } else {
    (globalThis as { document?: unknown }).document = originalDocument;
  }
});

describe("resolveCanonicalOrgApiPath", () => {
  it("maps legacy org scoped endpoints to /api/org/:orgId preserving PT segments", () => {
    setBrowserContext("/org/99/overview");
    expect(resolveCanonicalOrgApiPath("/api/organizacao/reservas?organizationId=42&from=2026-02-01")).toBe(
      "/api/org/42/reservas?from=2026-02-01",
    );
    expect(resolveCanonicalOrgApiPath("/api/organizacao/inscricoes/10?organizationId=7")).toBe(
      "/api/org/7/inscricoes/10",
    );
    expect(resolveCanonicalOrgApiPath("/api/organizacao/servicos/5?organizationId=7")).toBe(
      "/api/org/7/servicos/5",
    );
    expect(resolveCanonicalOrgApiPath("/api/organizacao/checkin?organizationId=7")).toBe(
      "/api/org/7/checkin",
    );
  });

  it("maps legacy hub/system endpoints to canonical namespaces", () => {
    setBrowserContext("/org/42/overview");
    expect(resolveCanonicalOrgApiPath("/api/organizacao/organizations/members")).toBe(
      "/api/org-hub/organizations/members",
    );
    expect(resolveCanonicalOrgApiPath("/api/organizacao/become")).toBe("/api/org-hub/become");
    expect(resolveCanonicalOrgApiPath("/api/organizacao/payouts/webhook")).toBe(
      "/api/org-system/payouts/webhook",
    );
  });

  it("resolves /api/org/[orgId] placeholders from explicit orgId or browser context", () => {
    setBrowserContext("/org/88/overview");
    expect(resolveCanonicalOrgApiPath("/api/org/[orgId]/promo")).toBe("/api/org/88/promo");
    expect(resolveCanonicalOrgApiPath("/api/org/[orgId]/events/list", 55)).toBe(
      "/api/org/55/events/list",
    );
    expect(resolveCanonicalOrgApiPath("/api/org/:orgId/crm/clientes?organizationId=72&q=ana")).toBe(
      "/api/org/72/crm/clientes?q=ana",
    );
  });

  it("does not rewrite padel/tournaments legacy routes", () => {
    setBrowserContext("/org/11/overview");
    expect(resolveCanonicalOrgApiPath("/api/organizacao/padel/waitlist?eventId=90&organizationId=11")).toBe(
      "/api/organizacao/padel/waitlist?eventId=90&organizationId=11",
    );
    expect(resolveCanonicalOrgApiPath("/api/organizacao/tournaments/create?organizationId=11")).toBe(
      "/api/organizacao/tournaments/create?organizationId=11",
    );
  });

  it("passes through fully canonical concrete endpoints", () => {
    setBrowserContext("/org/50/overview");
    expect(resolveCanonicalOrgApiPath("/api/org/50/reservas?from=2026-01-01")).toBe(
      "/api/org/50/reservas?from=2026-01-01",
    );
    expect(resolveCanonicalOrgApiPath("/api/org-hub/organizations")).toBe(
      "/api/org-hub/organizations",
    );
  });
});
