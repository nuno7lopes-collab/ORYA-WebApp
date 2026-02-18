import { describe, expect, it } from "vitest";
import { resolveInviteActionFeedback } from "@/lib/invites/actionFeedback";

describe("resolveInviteActionFeedback", () => {
  it("marks invite-not-pending as refresh-required", () => {
    const feedback = resolveInviteActionFeedback({ ok: false, errorCode: "INVITE_NOT_PENDING" }, "fallback");
    expect(feedback.shouldRefresh).toBe(true);
    expect(feedback.errorCode).toBe("INVITE_NOT_PENDING");
    expect(feedback.message).toContain("já foi atualizado");
  });

  it("maps expired invite to refresh-required", () => {
    const feedback = resolveInviteActionFeedback({ ok: false, error: "INVITE_EXPIRED" }, "fallback");
    expect(feedback.shouldRefresh).toBe(true);
    expect(feedback.errorCode).toBe("INVITE_EXPIRED");
  });

  it("keeps non-invite business errors as non-refresh", () => {
    const feedback = resolveInviteActionFeedback({ ok: false, error: "Não tens permissões." }, "fallback");
    expect(feedback.shouldRefresh).toBe(false);
    expect(feedback.message).toBe("Não tens permissões.");
  });

  it("falls back when payload contains only technical token", () => {
    const feedback = resolveInviteActionFeedback({ ok: false, error: "FORBIDDEN" }, "fallback");
    expect(feedback.shouldRefresh).toBe(false);
    expect(feedback.message).toBe("fallback");
  });
});
