import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const getUserWithPolicy = vi.hoisted(() => vi.fn());
const resolveUsernameOwner = vi.hoisted(() => vi.fn());
const getUserFollowStatus = vi.hoisted(() => vi.fn());

const profileFindUnique = vi.hoisted(() => vi.fn());
const profileFindFirst = vi.hoisted(() => vi.fn());
const eventFindMany = vi.hoisted(() => vi.fn());
const organizationFindUnique = vi.hoisted(() => vi.fn());

vi.mock("@/lib/http/withApiEnvelope", () => ({ withApiEnvelope: (handler: unknown) => handler }));

vi.mock("@/lib/auth/getUserWithPolicy", () => ({
  getUserWithPolicy,
}));

vi.mock("@/lib/supabaseServer", () => ({
  createSupabaseServer: vi.fn(async () => ({})),
}));

vi.mock("@/lib/username/resolveUsernameOwner", () => ({
  resolveUsernameOwner,
}));

vi.mock("@/domain/social/follows", () => ({
  getUserFollowStatus,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    profile: {
      findUnique: profileFindUnique,
      findFirst: profileFindFirst,
    },
    event: {
      findMany: eventFindMany,
    },
    organization: {
      findUnique: organizationFindUnique,
    },
  },
}));

let GET: typeof import("@/app/api/public/profile/events/route").GET;

beforeEach(async () => {
  vi.resetModules();
  delete process.env.FEATURE_SOCIAL_FRIENDS_ONLY;

  getUserWithPolicy.mockReset();
  resolveUsernameOwner.mockReset();
  getUserFollowStatus.mockReset();
  profileFindUnique.mockReset();
  profileFindFirst.mockReset();
  eventFindMany.mockReset();
  organizationFindUnique.mockReset();

  getUserWithPolicy.mockResolvedValue({ data: { user: { id: "viewer-1" } } });
  resolveUsernameOwner.mockResolvedValue({ ownerType: "user", ownerId: "target-1" });
  profileFindUnique.mockResolvedValue({
    id: "target-1",
    username: "target",
    fullName: "Target User",
    visibility: "FOLLOWERS",
    isDeleted: false,
  });
  profileFindFirst.mockResolvedValue(null);
  getUserFollowStatus.mockResolvedValue({
    isFollowing: true,
    isFollower: false,
    isMutual: false,
    isFriend: false,
    requestPending: false,
  });
  eventFindMany.mockResolvedValue([]);
  organizationFindUnique.mockResolvedValue(null);

  GET = (await import("@/app/api/public/profile/events/route")).GET;
});

describe("GET /api/public/profile/events friends-only privacy", () => {
  it("devolve feed bloqueado sem amizade mesmo com follow unilateral", async () => {
    const req = new NextRequest("http://localhost/api/public/profile/events?username=target");
    const res = await GET(req);
    const body = await res.json();
    const payload = body?.data ?? body?.result ?? body;

    expect(res.status).toBe(200);
    expect(payload.type).toBe("user");
    expect(payload.locked).toBe(true);
    expect(payload.privacy?.isPrivate).toBe(true);
    expect(payload.privacy?.canView).toBe(false);
    expect(Array.isArray(payload.upcoming)).toBe(true);
    expect(Array.isArray(payload.past)).toBe(true);
    expect(payload.upcoming).toHaveLength(0);
    expect(payload.past).toHaveLength(0);
    expect(eventFindMany).not.toHaveBeenCalled();
  });
});
