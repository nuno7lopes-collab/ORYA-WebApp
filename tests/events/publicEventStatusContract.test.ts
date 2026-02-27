import { describe, expect, it } from "vitest";
import { PublicEventCardSchema } from "@orya/shared";
import { resolvePublicEventStatus } from "@/domain/events/publicEventCard";

describe("public event status contract", () => {
  it("rejeita DRAFT no schema partilhado", () => {
    const parsed = PublicEventCardSchema.safeParse({
      id: 10,
      type: "EVENT",
      slug: "legacy-draft",
      title: "Legacy Draft",
      startsAt: "2026-03-01T10:00:00.000Z",
      endsAt: "2026-03-01T12:00:00.000Z",
      status: "DRAFT",
    });

    expect(parsed.success).toBe(false);
  });

  it("aplica fail-closed para DRAFT no mapeamento público", () => {
    const status = resolvePublicEventStatus({
      status: "DRAFT",
      startsAt: "2026-03-01T10:00:00.000Z",
      endsAt: "2026-03-01T12:00:00.000Z",
    });

    expect(status).toBe("PAST");
  });
});
