import { describe, expect, it } from "vitest";
import {
  normalizeCrmAbTestConfig,
  resolveCrmAbAssignment,
  resolveCrmAbMessage,
} from "@/lib/crm/abTesting";

describe("crm ab testing", () => {
  it("normaliza configuração apenas quando há >=2 variantes", () => {
    const cfg = normalizeCrmAbTestConfig({
      enabled: true,
      holdoutPercent: 12,
      variants: [{ id: "A", weight: 1 }, { id: "B", weight: 3 }],
    });

    expect(cfg.enabled).toBe(true);
    expect(cfg.holdoutPercent).toBe(12);
    expect(cfg.variants).toHaveLength(2);
  });

  it("atribui variante de forma determinística por contacto", () => {
    const cfg = normalizeCrmAbTestConfig({
      enabled: true,
      key: "campaign-ab",
      variants: [
        { id: "A", weight: 1 },
        { id: "B", weight: 1 },
      ],
    });

    const first = resolveCrmAbAssignment({
      scope: "campaign",
      entityId: "camp-1",
      contactId: "contact-1",
      config: cfg,
    });
    const second = resolveCrmAbAssignment({
      scope: "campaign",
      entityId: "camp-1",
      contactId: "contact-1",
      config: cfg,
    });

    expect(first.variantId).toBe(second.variantId);
    expect(first.bucket).toBe(second.bucket);
  });

  it("respeita holdout", () => {
    const cfg = normalizeCrmAbTestConfig({
      enabled: true,
      holdoutPercent: 95,
      variants: [
        { id: "A", weight: 1 },
        { id: "B", weight: 1 },
      ],
    });

    const assignment = resolveCrmAbAssignment({
      scope: "campaign",
      entityId: "camp-2",
      contactId: "contact-holdout",
      config: cfg,
    });

    expect(assignment.enabled).toBe(true);
    if (assignment.holdout) {
      expect(assignment.variantId).toBeNull();
    }
  });

  it("aplica overrides de conteúdo por variante", () => {
    const cfg = normalizeCrmAbTestConfig({
      enabled: true,
      variants: [
        { id: "A", weight: 100, title: "Titulo A", channel: "EMAIL", delayMinutes: 20 },
        { id: "B", weight: 1 },
      ],
    });

    const assignment = resolveCrmAbAssignment({
      scope: "journey",
      entityId: "journey-1:step-a",
      contactId: "contact-override",
      config: cfg,
    });

    const message = resolveCrmAbMessage({
      base: {
        title: "Base",
        body: "Body",
        ctaLabel: "Ver",
        ctaUrl: "/me",
        emailSubject: "Subject",
      },
      assignment,
      fallbackChannel: "BOTH",
    });

    if (assignment.variantId === "A") {
      expect(message.title).toBe("Titulo A");
      expect(message.channel).toBe("EMAIL");
      expect(message.delayMinutes).toBe(20);
    }
  });
});
