import { describe, expect, it } from "vitest";
import {
  normalizeStoreVisibility,
  isPublicVisibility,
  isArchivedVisibility,
  isVisibleInCatalog,
} from "@/lib/store/visibility";

describe("store visibility helpers", () => {
  it("normalizes to HIDDEN by default", () => {
    expect(normalizeStoreVisibility({})).toBe("HIDDEN");
    expect(normalizeStoreVisibility({ visibility: null })).toBe("HIDDEN");
  });

  it("keeps explicit visibility", () => {
    expect(normalizeStoreVisibility({ visibility: "PUBLIC" })).toBe("PUBLIC");
    expect(normalizeStoreVisibility({ visibility: "ARCHIVED" })).toBe("ARCHIVED");
  });

  it("exposes canonical predicates", () => {
    expect(isPublicVisibility("PUBLIC")).toBe(true);
    expect(isPublicVisibility("HIDDEN")).toBe(false);
    expect(isArchivedVisibility("ARCHIVED")).toBe(true);
    expect(isVisibleInCatalog("PUBLIC")).toBe(true);
    expect(isVisibleInCatalog("ARCHIVED")).toBe(false);
  });
});
