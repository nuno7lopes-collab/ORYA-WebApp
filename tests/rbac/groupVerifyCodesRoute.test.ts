import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const requireUser = vi.hoisted(() => vi.fn());
const verifyMembershipRequestCodes = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/requireUser", () => ({ requireUser }));
vi.mock("@/lib/domain/groupGovernance", () => ({ verifyMembershipRequestCodes }));

import { POST as joinVerifyPost } from "@/app/api/org-hub/groups/join-requests/[id]/verify-codes/route";
import { POST as exitVerifyPost } from "@/app/api/org-hub/groups/exit-requests/[id]/verify-codes/route";

describe("group verify-codes routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUser.mockResolvedValue({ id: "user-123" });
  });

  it("passes authenticated userId to JOIN code verification", async () => {
    verifyMembershipRequestCodes.mockResolvedValue({
      id: "req-1",
      status: "PENDING_EMAIL_CONFIRMATIONS",
    });

    const res = await joinVerifyPost(
      new NextRequest("http://localhost/api/org-hub/groups/join-requests/req-1/verify-codes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ groupOwnerCode: "111111", orgOwnerCode: "222222" }),
      }),
      { params: Promise.resolve({ id: "req-1" }) },
    );

    expect(res.status).toBe(200);
    expect(verifyMembershipRequestCodes).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: "req-1", kind: "JOIN", userId: "user-123" }),
    );
  });

  it("maps FORBIDDEN from domain on EXIT verification", async () => {
    verifyMembershipRequestCodes.mockRejectedValue(new Error("FORBIDDEN"));

    const res = await exitVerifyPost(
      new NextRequest("http://localhost/api/org-hub/groups/exit-requests/req-2/verify-codes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ orgOwnerCode: "111111", targetOwnerCode: "222222" }),
      }),
      { params: Promise.resolve({ id: "req-2" }) },
    );

    expect(res.status).toBe(403);
  });
});
