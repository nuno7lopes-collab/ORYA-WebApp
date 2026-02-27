import { describe, expect, it } from "vitest";
import {
  buildInventoryHoldFingerprint,
  buildInventoryHoldFingerprintSeed,
} from "@orya/shared";

describe("inventory fingerprint", () => {
  it("gera hash determinístico para o mesmo subject", () => {
    const input = {
      orgId: 10,
      subjectType: "STORE_VARIANT",
      storeId: 3,
      productId: 7,
      variantId: 9,
      eventId: null,
      ticketTypeId: null,
    } as const;

    const first = buildInventoryHoldFingerprint(input);
    const second = buildInventoryHoldFingerprint(input);

    expect(first).toBe(second);
    expect(first).toMatch(/^[a-f0-9]{64}$/);
  });

  it("normaliza null/undefined no seed canónico", () => {
    const firstSeed = buildInventoryHoldFingerprintSeed({
      orgId: 20,
      subjectType: "TICKET_TYPE",
      eventId: 55,
      ticketTypeId: 77,
      storeId: null,
      productId: null,
      variantId: null,
    });
    const secondSeed = buildInventoryHoldFingerprintSeed({
      orgId: 20,
      subjectType: "TICKET_TYPE",
      eventId: 55,
      ticketTypeId: 77,
      storeId: undefined,
      productId: undefined,
      variantId: undefined,
    });

    expect(firstSeed).toBe(secondSeed);
    expect(buildInventoryHoldFingerprint({
      orgId: 20,
      subjectType: "TICKET_TYPE",
      eventId: 55,
      ticketTypeId: 77,
      storeId: null,
      productId: null,
      variantId: null,
    })).toBe(buildInventoryHoldFingerprint({
      orgId: 20,
      subjectType: "TICKET_TYPE",
      eventId: 55,
      ticketTypeId: 77,
      storeId: undefined,
      productId: undefined,
      variantId: undefined,
    }));
  });

  it("muda fingerprint quando muda qualquer eixo canónico", () => {
    const base = buildInventoryHoldFingerprint({
      orgId: 1,
      subjectType: "STORE_PRODUCT",
      storeId: 2,
      productId: 3,
      variantId: null,
      eventId: null,
      ticketTypeId: null,
    });
    const changedProduct = buildInventoryHoldFingerprint({
      orgId: 1,
      subjectType: "STORE_PRODUCT",
      storeId: 2,
      productId: 4,
      variantId: null,
      eventId: null,
      ticketTypeId: null,
    });

    expect(changedProduct).not.toBe(base);
  });
});
