import { describe, expect, it } from "vitest";
import { NotificationType } from "@prisma/client";
import {
  resolveNotificationCategory,
  resolveNotificationContent,
  safeCtaUrl,
  validateNotificationInput,
} from "@/domain/notifications/registry";

describe("notification registry", () => {
  it("cobre todos os tipos e devolve conteúdo", () => {
    const types = Object.values(NotificationType);
    for (const type of types) {
      const content = resolveNotificationContent({ type });
      expect(content.title).toBeTruthy();
      expect(resolveNotificationCategory(type)).toBeTruthy();
    }
  });

  it("valida campos obrigatórios por tipo", () => {
    const missing = validateNotificationInput({ type: NotificationType.EVENT_INVITE });
    expect(missing).toContain("eventId");
  });

  it("normaliza CTA legado de analytics vendas para view canonical", () => {
    expect(safeCtaUrl("/org/2/analytics?tab=vendas&eventId=784")).toBe("/org/2/analytics?eventId=784&view=buyers");
    expect(safeCtaUrl("/org/2/finance?section=sales&eventId=784")).toBe("/org/2/analytics?eventId=784&view=buyers");
  });
});
