import { beforeEach, describe, expect, it, vi } from "vitest";

const crmContactFindMany = vi.hoisted(() => vi.fn());
const crmContactCount = vi.hoisted(() => vi.fn());
const crmInteractionFindMany = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({
  prisma: {
    crmContact: {
      findMany: crmContactFindMany,
      count: crmContactCount,
    },
    crmInteraction: {
      findMany: crmInteractionFindMany,
    },
  },
}));

import { EmptySegmentDefinitionError, resolveSegmentAudience } from "@/lib/crm/segmentQuery";

describe("segment query", () => {
  beforeEach(() => {
    crmContactFindMany.mockReset();
    crmContactCount.mockReset();
    crmInteractionFindMany.mockReset();
  });

  it("falha quando a definição do segmento está vazia", async () => {
    await expect(
      resolveSegmentAudience({
        organizationId: 10,
        rules: {
          version: 2,
          root: { kind: "group", id: "root", logic: "AND", children: [] },
        },
      }),
    ).rejects.toBeInstanceOf(EmptySegmentDefinitionError);
  });

  it("devolve contacto ordenado de forma determinística", async () => {
    crmContactFindMany.mockResolvedValueOnce([{ id: "contact-b" }, { id: "contact-a" }]);

    const resolved = await resolveSegmentAudience({
      organizationId: 20,
      rules: {
        version: 2,
        root: {
          kind: "group",
          id: "root",
          logic: "AND",
          children: [
            {
              kind: "rule",
              id: "r1",
              field: "contactType",
              op: "eq",
              value: "LEAD",
            },
          ],
        },
      },
      maxContacts: 10,
    });

    expect(resolved.total).toBe(2);
    expect(resolved.contactIds).toEqual(["contact-a", "contact-b"]);
  });
});
