import { beforeEach, describe, expect, it } from "vitest";
import { buildMfaSession, verifyMfaSession } from "@/lib/admin/mfaSession";

const TEST_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

describe("admin mfa session verification", () => {
  beforeEach(() => {
    process.env.ADMIN_TOTP_ENCRYPTION_KEY = TEST_KEY;
  });

  it("valida token gerado para o utilizador", () => {
    const token = buildMfaSession("user_1");
    const verified = verifyMfaSession(token, "user_1");
    expect(verified.ok).toBe(true);
  });

  it("não lança quando a assinatura tem comprimento diferente", () => {
    const token = buildMfaSession("user_1");
    const [encoded, signature] = token.split(".");
    const malformedToken = `${encoded}.${signature}x`;
    const verified = verifyMfaSession(malformedToken, "user_1");
    expect(verified).toEqual({ ok: false, reason: "signature" });
  });
});
