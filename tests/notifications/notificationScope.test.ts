import { describe, expect, it } from "vitest";
import { NotificationType } from "@prisma/client";
import {
  buildOrganizationRelationFilter,
  isOrganizationNotificationType,
  parseNotificationScope,
  parseOrganizationId,
} from "@/domain/notifications/scope";

describe("notification scope helpers", () => {
  it("resolve scope com fallback seguro para user", () => {
    expect(parseNotificationScope("organization")).toBe("organization");
    expect(parseNotificationScope("user")).toBe("user");
    expect(parseNotificationScope("invalid")).toBe("user");
    expect(parseNotificationScope(null)).toBe("user");
  });

  it("faz parse robusto de organizationId", () => {
    expect(parseOrganizationId("42")).toBe(42);
    expect(parseOrganizationId(11)).toBe(11);
    expect(parseOrganizationId("12.5")).toBeNull();
    expect(parseOrganizationId("0")).toBeNull();
    expect(parseOrganizationId("-7")).toBeNull();
    expect(parseOrganizationId("abc")).toBeNull();
  });

  it("monta filtro relacional de organizacao", () => {
    expect(buildOrganizationRelationFilter(7)).toEqual({
      OR: [{ organizationId: 7 }, { event: { organizationId: 7 } }],
    });
  });

  it("classifica corretamente tipos organizacionais", () => {
    expect(isOrganizationNotificationType(NotificationType.CRM_CAMPAIGN)).toBe(true);
    expect(isOrganizationNotificationType(NotificationType.EVENT_SALE)).toBe(true);
    expect(isOrganizationNotificationType(NotificationType.FOLLOW_REQUEST)).toBe(false);
    expect(isOrganizationNotificationType(NotificationType.EVENT_REMINDER)).toBe(false);
  });
});
