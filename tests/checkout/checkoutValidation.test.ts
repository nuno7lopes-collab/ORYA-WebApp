import { describe, expect, it } from "vitest";
import { validateGuestDetails } from "@/app/components/checkout/checkoutValidation";
import { buildDeterministicIdemKey } from "@/app/components/checkout/checkoutUtils";

describe("checkout guest validation", () => {
  it("flags required fields", () => {
    const result = validateGuestDetails({ name: " ", email: " " });
    expect(result.hasErrors).toBe(true);
    expect(result.errors.name).toBeDefined();
    expect(result.errors.email).toBeDefined();
  });

  it("flags invalid email and mismatch", () => {
    const invalid = validateGuestDetails({
      name: "Ana",
      email: "ana",
      emailConfirm: "ana",
    });
    expect(invalid.errors.email).toBeDefined();

    const mismatch = validateGuestDetails({
      name: "Ana",
      email: "ana@orya.pt",
      emailConfirm: "ana2@orya.pt",
    });
    expect(mismatch.errors.email).toBeDefined();
  });

  it("normalizes name/email and accepts valid phone", () => {
    const result = validateGuestDetails({
      name: "  Ana Silva ",
      email: " ana@orya.pt ",
      emailConfirm: "ana@orya.pt",
      phone: "+351 912 345 678",
    });

    expect(result.hasErrors).toBe(false);
    expect(result.normalized.name).toBe("Ana Silva");
    expect(result.normalized.email).toBe("ana@orya.pt");
    expect(result.normalized.phone).toBe("+351912345678");
  });
});

describe("checkout idempotency key", () => {
  it("returns null for empty fingerprints", () => {
    expect(buildDeterministicIdemKey("")).toBeNull();
    expect(buildDeterministicIdemKey("   ")).toBeNull();
    expect(buildDeterministicIdemKey(null)).toBeNull();
  });

  it("returns stable deterministic keys", () => {
    const keyA = buildDeterministicIdemKey("fingerprint-1");
    const keyB = buildDeterministicIdemKey("fingerprint-1");
    const keyC = buildDeterministicIdemKey("fingerprint-2");
    expect(keyA).toBe(keyB);
    expect(keyA).not.toBe(keyC);
  });
});
