import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const prisma = vi.hoisted(() => ({
  event: { findFirst: vi.fn() },
}));
const getPublicDiscoverBySlug = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("@/domain/search/publicDiscover", () => ({ getPublicDiscoverBySlug }));

let GET: typeof import("@/app/api/eventos/[slug]/public/route").GET;

beforeEach(async () => {
  vi.resetModules();
  prisma.event.findFirst.mockReset();
  getPublicDiscoverBySlug.mockReset();
  GET = (await import("@/app/api/eventos/[slug]/public/route")).GET;
});

describe("GET /api/eventos/[slug]/public fallback status guard", () => {
  it("bloqueia fallback indexado com estado DRAFT", async () => {
    prisma.event.findFirst.mockResolvedValue(null);
    getPublicDiscoverBySlug.mockResolvedValue({ id: 7, slug: "legacy", status: "DRAFT" });

    const req = new NextRequest("http://localhost/api/eventos/legacy/public");
    const res = await GET(req, { params: Promise.resolve({ slug: "legacy" }) } as any);
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.errorCode).toBe("NOT_FOUND");
  });

  it("mantem fallback indexado para estado publico valido", async () => {
    prisma.event.findFirst.mockResolvedValue(null);
    getPublicDiscoverBySlug.mockResolvedValue({ id: 8, slug: "ativo", status: "ACTIVE", title: "Ativo" });

    const req = new NextRequest("http://localhost/api/eventos/ativo/public");
    const res = await GET(req, { params: Promise.resolve({ slug: "ativo" }) } as any);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.item?.slug).toBe("ativo");
  });
});
