import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const createSupabaseServer = vi.hoisted(() => vi.fn());
const getUserWithPolicy = vi.hoisted(() => vi.fn());
const normalizeAndValidateUsername = vi.hoisted(() => vi.fn());
const setUsernameForOwner = vi.hoisted(() => vi.fn());
const isValidPhone = vi.hoisted(() => vi.fn((value: string) => value.trim().startsWith("+")));
const normalizePhone = vi.hoisted(() => vi.fn((value: string) => value.replace(/\s+/g, "")));
const resolvePhoneNormalizationOptions = vi.hoisted(() => vi.fn(() => ({})));

const prisma = vi.hoisted(() => ({
  profile: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  padelPlayerProfile: {
    findFirst: vi.fn(),
    updateMany: vi.fn(),
  },
  event: {
    findFirst: vi.fn(),
  },
  padelEventCategoryLink: {
    findFirst: vi.fn(),
  },
  padelCategory: {
    findFirst: vi.fn(),
  },
  $transaction: vi.fn(),
}));

vi.mock("@/lib/supabaseServer", () => ({ createSupabaseServer }));
vi.mock("@/lib/auth/getUserWithPolicy", () => ({ getUserWithPolicy }));
vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("@/lib/globalUsernames", () => ({
  normalizeAndValidateUsername: (...args: unknown[]) => normalizeAndValidateUsername(...args),
  setUsernameForOwner: (...args: unknown[]) => setUsernameForOwner(...args),
  UsernameTakenError: class UsernameTakenError extends Error {},
}));
vi.mock("@/lib/phone", () => ({
  isValidPhone: (...args: unknown[]) => isValidPhone(...args),
  normalizePhone: (...args: unknown[]) => normalizePhone(...args),
  resolvePhoneNormalizationOptions: (...args: unknown[]) => resolvePhoneNormalizationOptions(...args),
}));

describe("/api/padel/onboarding flow", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    createSupabaseServer.mockResolvedValue({});
    getUserWithPolicy.mockResolvedValue({
      data: { user: { id: "user-1", email: "jogador@orya.pt" } },
    });

    normalizeAndValidateUsername.mockReturnValue({ ok: true, username: "jogador.pt" });
    setUsernameForOwner.mockResolvedValue(undefined);

    prisma.profile.findUnique.mockResolvedValue({
      fullName: "Jogador Teste",
      username: "jogador_antigo",
      contactPhone: null,
      gender: null,
      avatarUrl: null,
      padelLevel: null,
      padelPreferredSide: null,
      padelClubName: null,
    });
    prisma.padelPlayerProfile.findFirst.mockResolvedValue(null);
    prisma.event.findFirst.mockResolvedValue(null);
    prisma.padelEventCategoryLink.findFirst.mockResolvedValue(null);
    prisma.padelCategory.findFirst.mockResolvedValue(null);
    prisma.profile.update.mockResolvedValue({
      fullName: "Jogador Teste",
      username: "jogador.pt",
      contactPhone: "+351912345678",
      gender: "MALE",
      padelLevel: "3",
      padelPreferredSide: "ESQUERDA",
      padelClubName: "Clube Teste",
    });
    prisma.padelPlayerProfile.updateMany.mockResolvedValue({ count: 1 });
    prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(prisma));
  });

  it("GET devolve contexto de evento/categoria e missing completo", async () => {
    prisma.event.findFirst.mockResolvedValueOnce({
      id: 12,
      title: "Open Lisboa",
      slug: "open-lisboa",
    });
    prisma.padelEventCategoryLink.findFirst.mockResolvedValueOnce({
      category: {
        id: 77,
        label: "M3",
        genderRestriction: "MALE",
      },
    });

    const { GET } = await import("@/app/api/padel/onboarding/route");
    const req = new NextRequest(
      "http://localhost/api/padel/onboarding?eventId=12&organizationId=3&categoryId=77",
    );
    const res = await GET(req);
    const body = await res.json();
    const payload = body.result ?? body;

    expect(res.status).toBe(200);
    expect(body.ok ?? body.result?.ok).toBe(true);
    expect(payload.event).toEqual({ id: 12, title: "Open Lisboa", slug: "open-lisboa" });
    expect(payload.category).toEqual({ id: 77, label: "M3", genderRestriction: "MALE" });
    expect(payload.missing).toMatchObject({
      gender: true,
      level: true,
      preferredSide: true,
    });
    expect(payload.completed).toBe(false);
  });

  it("POST bloqueia género incompatível com categoria", async () => {
    prisma.profile.findUnique.mockResolvedValueOnce({
      fullName: "Jogadora",
      username: "jogadora",
      contactPhone: "+351919999999",
      gender: "FEMALE",
      padelLevel: "3",
      padelPreferredSide: "DIREITA",
      padelClubName: null,
    });
    prisma.padelEventCategoryLink.findFirst.mockResolvedValueOnce({
      category: { genderRestriction: "MALE" },
    });

    const { POST } = await import("@/app/api/padel/onboarding/route");
    const req = new NextRequest("http://localhost/api/padel/onboarding", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        fullName: "Jogadora",
        username: "jogadora",
        contactPhone: "+351 919 999 999",
        gender: "FEMALE",
        level: "3",
        preferredSide: "DIREITA",
        eventId: 12,
        categoryId: 77,
      }),
    });

    const res = await POST(req);
    const body = await res.json();
    const payload = body.result ?? body;

    expect(res.status).toBe(409);
    expect(payload.error).toBe("CATEGORY_GENDER_MISMATCH");
  });

  it("POST persiste perfil e devolve onboarding completo", async () => {
    prisma.profile.findUnique.mockResolvedValueOnce({
      fullName: "Jogador Teste",
      username: "old_user",
      contactPhone: null,
      gender: null,
      padelLevel: null,
      padelPreferredSide: null,
      padelClubName: null,
    });

    const { POST } = await import("@/app/api/padel/onboarding/route");
    const req = new NextRequest("http://localhost/api/padel/onboarding", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        fullName: "Jogador Teste",
        username: "jogador.pt",
        contactPhone: "+351 912 345 678",
        gender: "MALE",
        level: "3",
        preferredSide: "ESQUERDA",
        clubName: "Clube Teste",
      }),
    });

    const res = await POST(req);
    const body = await res.json();
    const payload = body.result ?? body;

    expect(res.status).toBe(200);
    expect(body.ok ?? body.result?.ok).toBe(true);
    expect(payload.completed).toBe(true);
    expect(payload.missing).toEqual({});
    expect(setUsernameForOwner).toHaveBeenCalled();
    expect(prisma.profile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          username: "jogador.pt",
          contactPhone: "+351912345678",
          gender: "MALE",
          padelLevel: "3",
          padelPreferredSide: "ESQUERDA",
          onboardingDone: true,
        }),
      }),
    );
  });

  it("POST completa onboarding sem telemóvel", async () => {
    prisma.profile.findUnique.mockResolvedValueOnce({
      fullName: "Jogador Teste",
      username: "old_user",
      contactPhone: null,
      gender: null,
      padelLevel: null,
      padelPreferredSide: null,
      padelClubName: null,
    });
    prisma.profile.update.mockResolvedValueOnce({
      fullName: "Jogador Teste",
      username: "jogador.pt",
      contactPhone: null,
      gender: "MALE",
      padelLevel: "3",
      padelPreferredSide: "ESQUERDA",
      padelClubName: null,
    });

    const { POST } = await import("@/app/api/padel/onboarding/route");
    const req = new NextRequest("http://localhost/api/padel/onboarding", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        fullName: "Jogador Teste",
        username: "jogador.pt",
        gender: "MALE",
        level: "3",
        preferredSide: "ESQUERDA",
      }),
    });

    const res = await POST(req);
    const body = await res.json();
    const payload = body.result ?? body;

    expect(res.status).toBe(200);
    expect(payload.completed).toBe(true);
    expect(payload.missing).toEqual({});
    expect(prisma.profile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          contactPhone: null,
          onboardingDone: true,
        }),
      }),
    );
  });
});
