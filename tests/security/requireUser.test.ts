import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthUnavailableError, EmailNotVerifiedError, UnauthenticatedError } from "@/lib/security";

const createSupabaseServer = vi.hoisted(() => vi.fn(async () => ({ auth: {} })));
const ensureAuthenticated = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabaseServer", () => ({
  createSupabaseServer,
}));

vi.mock("@/lib/security", async () => {
  const actual = await vi.importActual<typeof import("@/lib/security")>("@/lib/security");
  return {
    ...actual,
    ensureAuthenticated,
  };
});

import { AuthRequiredError, requireUser } from "@/lib/auth/requireUser";

describe("requireUser", () => {
  beforeEach(() => {
    createSupabaseServer.mockClear();
    ensureAuthenticated.mockReset();
  });

  it("usa requireVerifiedEmail=true por omissão", async () => {
    ensureAuthenticated.mockResolvedValue({ id: "user_1" });

    const user = await requireUser();

    expect(user).toMatchObject({ id: "user_1" });
    expect(createSupabaseServer).toHaveBeenCalledTimes(1);
    expect(ensureAuthenticated).toHaveBeenCalledWith(expect.any(Object), { requireVerifiedEmail: true });
  });

  it("aceita override requireVerifiedEmail=false", async () => {
    ensureAuthenticated.mockResolvedValue({ id: "user_2" });

    const user = await requireUser({ requireVerifiedEmail: false });

    expect(user).toMatchObject({ id: "user_2" });
    expect(ensureAuthenticated).toHaveBeenCalledWith(expect.any(Object), { requireVerifiedEmail: false });
  });

  it("mapeia sessão ausente para AuthRequiredError 401", async () => {
    ensureAuthenticated.mockRejectedValue(new UnauthenticatedError());

    await expect(requireUser()).rejects.toMatchObject({
      name: "AuthRequiredError",
      code: "UNAUTHENTICATED",
      status: 401,
      message: "UNAUTHENTICATED",
    });
  });

  it("mapeia email não verificado para AuthRequiredError 403", async () => {
    ensureAuthenticated.mockRejectedValue(new EmailNotVerifiedError());

    await expect(requireUser()).rejects.toMatchObject({
      name: "AuthRequiredError",
      code: "EMAIL_NOT_VERIFIED",
      status: 403,
      message: "EMAIL_NOT_VERIFIED",
    });
  });

  it("mapeia indisponibilidade auth para AuthRequiredError 503", async () => {
    ensureAuthenticated.mockRejectedValue(new AuthUnavailableError());

    await expect(requireUser()).rejects.toMatchObject({
      name: "AuthRequiredError",
      code: "AUTH_UNAVAILABLE",
      status: 503,
      message: "AUTH_UNAVAILABLE",
    });
  });
});
