import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const requireUser = vi.hoisted(() => vi.fn());
const startJoinRequest = vi.hoisted(() => vi.fn());
const startExitRequest = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/requireUser", () => ({ requireUser }));
vi.mock("@/lib/domain/groupGovernance", () => ({ startJoinRequest, startExitRequest }));

import { POST as joinRequestPost } from "@/app/api/org-hub/groups/join-requests/route";
import { POST as exitRequestPost } from "@/app/api/org-hub/groups/exit-requests/route";

describe("group join/exit routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUser.mockResolvedValue({ id: "user-1" });
  });

  it("maps ORGANIZATION_INACTIVE to 409 on join start", async () => {
    startJoinRequest.mockRejectedValue(new Error("ORGANIZATION_INACTIVE"));

    const res = await joinRequestPost(
      new NextRequest("http://localhost/api/org-hub/groups/join-requests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ groupId: 10, organizationId: 99 }),
      }),
    );

    expect(res.status).toBe(409);
  });

  it("maps ONLY_GROUP_OWNER to 403 on join start", async () => {
    startJoinRequest.mockRejectedValue(new Error("ONLY_GROUP_OWNER"));

    const res = await joinRequestPost(
      new NextRequest("http://localhost/api/org-hub/groups/join-requests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ groupId: 10, organizationId: 99 }),
      }),
    );

    expect(res.status).toBe(403);
  });

  it("maps ORGANIZATION_INACTIVE to 409 on exit start", async () => {
    startExitRequest.mockRejectedValue(new Error("ORGANIZATION_INACTIVE"));

    const res = await exitRequestPost(
      new NextRequest("http://localhost/api/org-hub/groups/exit-requests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          groupId: 10,
          organizationId: 99,
          mode: "KEEP_OWNER",
        }),
      }),
    );

    expect(res.status).toBe(409);
  });
});
