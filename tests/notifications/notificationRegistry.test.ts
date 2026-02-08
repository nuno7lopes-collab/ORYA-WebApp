import { describe, expect, it } from "vitest";
import { NotificationType } from "@prisma/client";
import { resolveNotificationCategory, resolveNotificationContent, validateNotificationInput } from "@/domain/notifications/registry";

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
});
