import { describe, expect, it } from "vitest";
import {
  AuthUnavailableError,
  EmailNotVerifiedError,
  UnauthenticatedError,
  ensureAuthenticated,
  isUnauthenticatedError,
} from "@/lib/security";

const buildSupabase = (getUser: () => Promise<any>) =>
  ({
    auth: { getUser },
  }) as any;

describe("ensureAuthenticated", () => {
  it("returns user when session exists e email está verificado", async () => {
    const supabase = buildSupabase(async () => ({
      data: {
        user: {
          id: "user_1",
          email_confirmed_at: "2026-02-20T12:00:00.000Z",
        },
      },
      error: null,
    }));
    const user = await ensureAuthenticated(supabase);
    expect(user.id).toBe("user_1");
  });

  it("throws UnauthenticatedError when user is missing", async () => {
    const supabase = buildSupabase(async () => ({
      data: { user: null },
      error: null,
    }));
    await expect(ensureAuthenticated(supabase)).rejects.toBeInstanceOf(UnauthenticatedError);
  });

  it("throws EmailNotVerifiedError when session exists sem confirmação de email", async () => {
    const supabase = buildSupabase(async () => ({
      data: {
        user: {
          id: "user_2",
          email_confirmed_at: null,
          confirmed_at: null,
        },
      },
      error: null,
    }));
    await expect(ensureAuthenticated(supabase)).rejects.toBeInstanceOf(EmailNotVerifiedError);
  });

  it("permite sessão sem email confirmado quando requireVerifiedEmail=false", async () => {
    const supabase = buildSupabase(async () => ({
      data: {
        user: {
          id: "user_3",
          email_confirmed_at: null,
        },
      },
      error: null,
    }));
    const user = await ensureAuthenticated(supabase, { requireVerifiedEmail: false });
    expect(user.id).toBe("user_3");
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

  it("throws EmailNotVerifiedError when passed email-not-verified error", () => {
    expect(() => isUnauthenticatedError(new EmailNotVerifiedError())).toThrow(EmailNotVerifiedError);
  });

  it("throws AuthUnavailableError when passed auth-unavailable error", () => {
    expect(() => isUnauthenticatedError(new AuthUnavailableError())).toThrow(AuthUnavailableError);
  });

  it("returns false for generic errors", () => {
    expect(isUnauthenticatedError(new Error("generic"))).toBe(false);
  });
});
