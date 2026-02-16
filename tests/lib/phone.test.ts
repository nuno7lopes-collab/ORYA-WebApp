import { describe, expect, it } from "vitest";
import {
  inferCountryIso2FromHeaders,
  inferCountryIso2FromLocale,
  isValidPhone,
  normalizePhone,
  resolvePhoneNormalizationOptions,
  sanitizePhone,
} from "@/lib/phone";

describe("phone helpers", () => {
  it("sanitizes phone characters", () => {
    expect(sanitizePhone("+351 912-345-678")).toBe("+351912345678");
    expect(sanitizePhone(" 912 345 678 ")).toBe("912345678");
  });

  it("normalizes prefix to international format", () => {
    expect(normalizePhone("912345678")).toBe("+351912345678");
    expect(normalizePhone("00351912345678")).toBe("+351912345678");
    expect(normalizePhone("+351 912 345 678")).toBe("+351912345678");
  });

  it("normalizes using locale/country hints", () => {
    expect(normalizePhone("912345678", { defaultLocale: "en-US" })).toBe("+1912345678");
    expect(normalizePhone("912345678", { defaultCountryIso2: "GB" })).toBe("+44912345678");
  });

  it("validates syntactic phone lengths", () => {
    expect(isValidPhone("912345678")).toBe(true);
    expect(isValidPhone("+351912345678")).toBe(true);
    expect(isValidPhone("00351912345678")).toBe(true);
    expect(isValidPhone("123")).toBe(false);
    expect(isValidPhone("abc")).toBe(false);
  });

  it("infers country from locale and headers", () => {
    expect(inferCountryIso2FromLocale("en-US")).toBe("US");
    expect(inferCountryIso2FromLocale("pt-PT")).toBe("PT");

    const headers = new Headers({ "x-vercel-ip-country": "BR" });
    expect(inferCountryIso2FromHeaders(headers)).toBe("BR");
  });

  it("builds normalization options from headers", () => {
    const headers = new Headers({
      "x-vercel-ip-country": "US",
      "accept-language": "en-US,en;q=0.9",
    });
    const options = resolvePhoneNormalizationOptions({ headers });
    expect(options.defaultCountryIso2).toBe("US");
    expect(options.defaultLocale).toBe("en-US,en;q=0.9");
  });
});
