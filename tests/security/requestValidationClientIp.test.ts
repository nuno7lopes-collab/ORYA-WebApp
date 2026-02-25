import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { getClientIp } from "@/lib/auth/requestValidation";

function makeRequest(headers: Record<string, string>) {
  return new NextRequest("http://localhost/api/auth/login", {
    method: "POST",
    headers,
  });
}

describe("getClientIp", () => {
  it("prioriza headers de cliente confiável quando disponíveis", () => {
    const req = makeRequest({
      "cf-connecting-ip": "198.51.100.7",
      "x-forwarded-for": "203.0.113.8, 198.51.100.9",
    });

    expect(getClientIp(req)).toBe("198.51.100.7");
  });

  it("usa o hop mais próximo (right-most) no x-forwarded-for", () => {
    const req = makeRequest({
      "x-forwarded-for": "1.1.1.1, 203.0.113.21, 198.51.100.77",
    });

    expect(getClientIp(req)).toBe("198.51.100.77");
  });

  it("normaliza ipv4 com porta no x-real-ip", () => {
    const req = makeRequest({
      "x-real-ip": "203.0.113.42:54421",
    });

    expect(getClientIp(req)).toBe("203.0.113.42");
  });

  it("interpreta header Forwarded com for=", () => {
    const req = makeRequest({
      forwarded: "for=203.0.113.61;proto=https;host=orya.pt",
    });

    expect(getClientIp(req)).toBe("203.0.113.61");
  });

  it("devolve unknown quando não há IP válido", () => {
    const req = makeRequest({
      "x-forwarded-for": "malformed, nope",
      "x-real-ip": "invalid",
    });

    expect(getClientIp(req)).toBe("unknown");
  });
});
