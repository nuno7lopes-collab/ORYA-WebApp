import { beforeEach, describe, expect, it, vi } from "vitest";

const prisma = vi.hoisted(() => ({
  globalUsername: {
    findUnique: vi.fn(),
  },
  profile: {
    findFirst: vi.fn(),
  },
  organization: {
    findFirst: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma }));

describe("checkUsernameAvailability", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    prisma.globalUsername.findUnique.mockResolvedValue(null);
    prisma.profile.findFirst.mockResolvedValue(null);
    prisma.organization.findFirst.mockResolvedValue(null);
  });

  it("considera disponível quando o username já pertence ao próprio owner", async () => {
    const { checkUsernameAvailability } = await import("@/lib/globalUsernames");
    prisma.globalUsername.findUnique.mockResolvedValueOnce({
      ownerType: "user",
      ownerId: "user-1",
    });

    const result = await checkUsernameAvailability("nuno", undefined, {
      ignoreOwner: { ownerType: "user", ownerId: "user-1" },
    });

    expect(result).toEqual({ ok: true, available: true, username: "nuno" });
    expect(prisma.profile.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ NOT: { id: "user-1" } }),
      }),
    );
  });

  it("mantém indisponível quando o owner do username é outro", async () => {
    const { checkUsernameAvailability } = await import("@/lib/globalUsernames");
    prisma.globalUsername.findUnique.mockResolvedValueOnce({
      ownerType: "user",
      ownerId: "user-2",
    });

    const result = await checkUsernameAvailability("nuno", undefined, {
      ignoreOwner: { ownerType: "user", ownerId: "user-1" },
    });

    expect(result).toEqual({ ok: true, available: false, username: "nuno" });
    expect(prisma.profile.findFirst).not.toHaveBeenCalled();
    expect(prisma.organization.findFirst).not.toHaveBeenCalled();
  });

  it("deteta colisão local com outro perfil mesmo ao ignorar owner atual", async () => {
    const { checkUsernameAvailability } = await import("@/lib/globalUsernames");
    prisma.profile.findFirst.mockResolvedValueOnce({ id: "user-2" });

    const result = await checkUsernameAvailability("nuno", undefined, {
      ignoreOwner: { ownerType: "user", ownerId: "user-1" },
    });

    expect(result).toEqual({ ok: true, available: false, username: "nuno" });
  });
});
