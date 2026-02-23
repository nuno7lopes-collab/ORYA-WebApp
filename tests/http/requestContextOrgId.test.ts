import { describe, expect, it } from "vitest";
import { resolveRequestContext } from "@/lib/http/requestContext";
import { ORYA_ORG_ID_HEADER } from "@/lib/http/headers";

function makeHeaders(orgId: string) {
  const headers = new Headers();
  headers.set(ORYA_ORG_ID_HEADER, orgId);
  return headers;
}

describe("request context orgId parsing", () => {
  it("accepts only positive integer orgId from header", () => {
    const ctx = resolveRequestContext(makeHeaders("42"));
    expect(ctx.orgId).toBe(42);
  });

  it("rejects decimal orgId from header", () => {
    const ctx = resolveRequestContext(makeHeaders("42.5"));
    expect(ctx.orgId).toBeNull();
  });

  it("rejects non-numeric orgId from header", () => {
    const ctx = resolveRequestContext(makeHeaders("abc"));
    expect(ctx.orgId).toBeNull();
  });

  it("rejects non-positive orgId from header", () => {
    const ctx = resolveRequestContext(makeHeaders("0"));
    expect(ctx.orgId).toBeNull();
  });
});
