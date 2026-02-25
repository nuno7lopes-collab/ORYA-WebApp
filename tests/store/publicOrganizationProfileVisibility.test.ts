import { describe, expect, it } from "vitest";
import {
  canAcceptPublicReservasBookings,
  canOpenPublicStorefront,
  canShowPublicReservasSection,
} from "@/lib/publicOrganizationProfile";

describe("publicOrganizationProfile store visibility", () => {
  it("only opens storefront when all operational gates pass", () => {
    expect(
      canOpenPublicStorefront({
        status: "ACTIVE",
        showOnProfile: true,
        checkoutEnabled: true,
        catalogLocked: false,
        paymentsReady: true,
        publicProductCount: 3,
      }),
    ).toBe(true);
  });

  it("closes storefront when checkout is disabled", () => {
    expect(
      canOpenPublicStorefront({
        status: "ACTIVE",
        showOnProfile: true,
        checkoutEnabled: false,
        catalogLocked: false,
        paymentsReady: true,
        publicProductCount: 3,
      }),
    ).toBe(false);
  });

  it("closes storefront when catalog is locked, products are missing, or payments are not ready", () => {
    expect(
      canOpenPublicStorefront({
        status: "ACTIVE",
        showOnProfile: true,
        checkoutEnabled: true,
        catalogLocked: true,
        paymentsReady: true,
        publicProductCount: 3,
      }),
    ).toBe(false);
    expect(
      canOpenPublicStorefront({
        status: "ACTIVE",
        showOnProfile: true,
        checkoutEnabled: true,
        catalogLocked: false,
        paymentsReady: true,
        publicProductCount: 0,
      }),
    ).toBe(false);
    expect(
      canOpenPublicStorefront({
        status: "ACTIVE",
        showOnProfile: true,
        checkoutEnabled: true,
        catalogLocked: false,
        paymentsReady: false,
        publicProductCount: 2,
      }),
    ).toBe(false);
  });
});

describe("publicOrganizationProfile reservas visibility", () => {
  it("hides reservas when module is disabled or there are no active services", () => {
    expect(
      canShowPublicReservasSection({
        moduleEnabled: false,
        services: [{ assignmentMode: "PROFESSIONAL_ONLY" }],
        professionals: [{ id: 10 }],
      }),
    ).toBe(false);

    expect(
      canShowPublicReservasSection({
        moduleEnabled: true,
        services: [],
        professionals: [{ id: 10 }],
      }),
    ).toBe(false);
  });

  it("requires availability compatible with assignment mode", () => {
    expect(
      canShowPublicReservasSection({
        moduleEnabled: true,
        organizationAssignmentMode: "PROFESSIONAL_ONLY",
        services: [{ assignmentMode: "PROFESSIONAL_ONLY" }],
        professionals: [],
        resources: [{ id: 5, capacity: 2, courtId: null }],
      }),
    ).toBe(false);

    expect(
      canShowPublicReservasSection({
        moduleEnabled: true,
        organizationAssignmentMode: "RESOURCE_ONLY",
        services: [{ assignmentMode: "RESOURCE_ONLY" }],
        professionals: [{ id: 10 }],
        resources: [],
      }),
    ).toBe(false);

    expect(
      canShowPublicReservasSection({
        moduleEnabled: true,
        organizationAssignmentMode: "PROFESSIONAL_AND_RESOURCE",
        services: [{ assignmentMode: "PROFESSIONAL_AND_RESOURCE" }],
        professionals: [{ id: 10 }],
        resources: [],
      }),
    ).toBe(false);
  });

  it("respects explicit service links for professionals/resources", () => {
    expect(
      canShowPublicReservasSection({
        moduleEnabled: true,
        organizationAssignmentMode: "PROFESSIONAL_ONLY",
        services: [{ assignmentMode: "PROFESSIONAL_ONLY", professionalLinks: [{ professionalId: 44 }] }],
        professionals: [{ id: 10 }],
      }),
    ).toBe(false);

    expect(
      canShowPublicReservasSection({
        moduleEnabled: true,
        organizationAssignmentMode: "PROFESSIONAL_AND_RESOURCE",
        services: [
          {
            assignmentMode: "PROFESSIONAL_AND_RESOURCE",
            professionalLinks: [{ professionalId: 10 }],
            resourceLinks: [{ resourceId: 20 }],
          },
        ],
        professionals: [{ id: 10 }],
        resources: [{ id: 20, capacity: 2, courtId: null }],
      }),
    ).toBe(true);
  });

  it("enforces court-only resources for court services", () => {
    expect(
      canShowPublicReservasSection({
        moduleEnabled: true,
        organizationAssignmentMode: "RESOURCE_ONLY",
        services: [{ kind: "COURT", assignmentMode: "RESOURCE_ONLY" }],
        resources: [{ id: 20, capacity: 4, courtId: null }],
      }),
    ).toBe(false);

    expect(
      canShowPublicReservasSection({
        moduleEnabled: true,
        organizationAssignmentMode: "RESOURCE_ONLY",
        services: [{ kind: "COURT", assignmentMode: "RESOURCE_ONLY" }],
        resources: [{ id: 20, capacity: 4, courtId: 7 }],
      }),
    ).toBe(true);
  });

  it("separa visibilidade pública da aceitação operacional de novas reservas", () => {
    const input = {
      moduleEnabled: true,
      acceptNewBookings: false,
      organizationAssignmentMode: "RESOURCE_ONLY",
      services: [{ kind: "COURT", assignmentMode: "RESOURCE_ONLY" }],
      resources: [{ id: 20, capacity: 4, courtId: 7 }],
    };

    expect(canShowPublicReservasSection(input)).toBe(true);
    expect(canAcceptPublicReservasBookings(input)).toBe(false);
  });
});
