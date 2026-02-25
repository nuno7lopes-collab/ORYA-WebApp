import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { OrganizationStatus } from "@prisma/client";
import { AuthUnavailableError, EmailNotVerifiedError } from "@/lib/security";

const createSupabaseServer = vi.hoisted(() => vi.fn());
const getUserWithPolicy = vi.hoisted(() => vi.fn());
const organizationFindUnique = vi.hoisted(() => vi.fn());
const setActiveOrganizationForUser = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabaseServer", () => ({ createSupabaseServer }));
vi.mock("@/lib/auth/getUserWithPolicy", () => ({ getUserWithPolicy }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    organization: {
      findUnique: organizationFindUnique,
    },
  },
}));
vi.mock("@/lib/organizationContext", () => ({ setActiveOrganizationForUser }));

import { POST } from "@/app/api/org-hub/organizations/switch/route";

function readOrganizationId(payload: any) {
  return payload?.organizationId ?? payload?.data?.organizationId ?? payload?.result?.organizationId ?? null;
}

describe("org-hub organizations switch route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createSupabaseServer.mockResolvedValue({
      auth: { getUser: vi.fn() },
    });
    getUserWithPolicy.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    organizationFindUnique.mockResolvedValue({
      id: 7,
      status: OrganizationStatus.ACTIVE,
    });
    setActiveOrganizationForUser.mockResolvedValue({
      ok: true,
      changed: true,
      membership: {
        role: "ADMIN",
        groupId: 11,
        memberId: "gm-1",
        rolePack: null,
      },
    });
  });

  it("switch bem sucedido devolve 200 e escreve cookie", async () => {
    const res = await POST(
      new NextRequest("http://localhost/api/org-hub/organizations/switch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ organizationId: 7 }),
      }),
    );

    expect(res.status).toBe(200);
    const payload = await res.json();
    expect(payload?.ok).toBe(true);
    expect(readOrganizationId(payload)).toBe(7);
    expect(res.headers.get("set-cookie")).toContain("orya_organization=7");
  });

  it("rejeita organizationId inválido sem tocar no contexto", async () => {
    const res = await POST(
      new NextRequest("http://localhost/api/org-hub/organizations/switch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ organizationId: "12.5" }),
      }),
    );

    expect(res.status).toBe(400);
    expect(setActiveOrganizationForUser).not.toHaveBeenCalled();
  });

  it("devolve 403 quando actor não pertence à organização", async () => {
    setActiveOrganizationForUser.mockResolvedValueOnce({ ok: false, error: "NOT_MEMBER" });

    const res = await POST(
      new NextRequest("http://localhost/api/org-hub/organizations/switch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ organizationId: 7 }),
      }),
    );

    expect(res.status).toBe(403);
  });

  it("devolve 400 quando contexto recebe organizationId inválido", async () => {
    setActiveOrganizationForUser.mockResolvedValueOnce({
      ok: false,
      error: "INVALID_ORGANIZATION_ID",
    });

    const res = await POST(
      new NextRequest("http://localhost/api/org-hub/organizations/switch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ organizationId: 7 }),
      }),
    );

    expect(res.status).toBe(400);
  });

  it("mapeia EmailNotVerified para 403", async () => {
    getUserWithPolicy.mockRejectedValueOnce(new EmailNotVerifiedError());

    const res = await POST(
      new NextRequest("http://localhost/api/org-hub/organizations/switch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ organizationId: 7 }),
      }),
    );

    expect(res.status).toBe(403);
  });

  it("mapeia AuthUnavailable para 503", async () => {
    getUserWithPolicy.mockRejectedValueOnce(new AuthUnavailableError());

    const res = await POST(
      new NextRequest("http://localhost/api/org-hub/organizations/switch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ organizationId: 7 }),
      }),
    );

    expect(res.status).toBe(503);
  });
});
