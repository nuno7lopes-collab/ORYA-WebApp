import { describe, expect, it } from "vitest";
import {
  AuthUnavailableError,
  UnauthenticatedError,
  ensureAuthenticated,
  isUnauthenticatedError,
} from "@/lib/security";

const buildSupabase = (getUser: () => Promise<any>) =>
  ({
    auth: { getUser },
  }) as any;

describe("ensureAuthenticated", () => {
  it("throws UnauthenticatedError when user is missing", async () => {
    const supabase = buildSupabase(async () => ({
      data: { user: null },
      error: null,
    }));
    await expect(ensureAuthenticated(supabase)).rejects.toBeInstanceOf(UnauthenticatedError);
  });

  it("throws AuthUnavailableError when supabase returns network error", async () => {
    const supabase = buildSupabase(async () => ({
      data: { user: null },
      error: { code: "EHOSTUNREACH", message: "connect EHOSTUNREACH" },
    }));
    await expect(ensureAuthenticated(supabase)).rejects.toBeInstanceOf(AuthUnavailableError);
  });

  it("throws AuthUnavailableError when getUser throws network error", async () => {
    const supabase = buildSupabase(async () => {
      const err = new Error("fetch failed");
      (err as any).code = "ETIMEDOUT";
      throw err;
    });
    await expect(ensureAuthenticated(supabase)).rejects.toBeInstanceOf(AuthUnavailableError);
  });
});

describe("isUnauthenticatedError", () => {
  it("returns true for UnauthenticatedError", () => {
    expect(isUnauthenticatedError(new UnauthenticatedError())).toBe(true);
  });

  it("throws AuthUnavailableError when passed auth-unavailable error", () => {
    expect(() => isUnauthenticatedError(new AuthUnavailableError())).toThrow(AuthUnavailableError);
  });
});
