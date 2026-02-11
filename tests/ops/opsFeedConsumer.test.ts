import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma, SourceType } from "@prisma/client";
import { consumeEventLogToOpsFeed, consumeOpsFeedBatch } from "@/domain/opsFeed/consumer";
import { prisma } from "@/lib/prisma";

let eventLogs: any[] = [];
let feedItems: any[] = [];

vi.mock("@/lib/prisma", () => {
  const eventLog = {
    findUnique: vi.fn(({ where }: any) => eventLogs.find((evt) => evt.id === where.id) ?? null),
    findMany: vi.fn(({ where, take }: any) => {
      const types = new Set(where?.eventType?.in ?? []);
      const pending = eventLogs.filter(
        (evt) => types.has(evt.eventType) && evt.activityItem == null,
      );
      return pending.slice(0, take ?? pending.length);
    }),
  };
  const activityFeedItem = {
    ["create"]: vi.fn(({ data }: any) => {
      if (feedItems.some((item) => item.eventId === data.eventId)) {
        throw new Prisma.PrismaClientKnownRequestError("dup", {
          code: "P2002",
          clientVersion: "7.2.0",
        });
      }
      feedItems.push(data);
      return data;
    }),
  };
  const internalChatChannel = {
    findFirst: vi.fn(async () => null),
  };
  const internalChatMessage = {
    create: vi.fn(async () => ({})),
  };
  const organization = {
    findUnique: vi.fn(async () => ({ groupId: 1 })),
  };
  const organizationGroupMember = {
    findMany: vi.fn(async () => []),
  };
  const organizationGroupMemberOrganizationOverride = {
    findMany: vi.fn(async () => []),
  };
  const prisma = {
    eventLog,
    activityFeedItem,
    internalChatChannel,
    internalChatMessage,
    organization,
    organizationGroupMember,
    organizationGroupMemberOrganizationOverride,
  };
  return { prisma };
});

const prismaMock = vi.mocked(prisma);

describe("ops feed consumer", () => {
  beforeEach(() => {
    eventLogs = [];
    feedItems = [];
    prismaMock.eventLog.findUnique.mockClear();
    prismaMock.eventLog.findMany.mockClear();
    prismaMock.activityFeedItem["create"].mockClear();
    prismaMock.internalChatChannel.findFirst.mockClear();
    prismaMock.internalChatMessage.create.mockClear();
    prismaMock.organization.findUnique.mockClear();
    prismaMock.organizationGroupMember.findMany.mockClear();
    prismaMock.organizationGroupMemberOrganizationOverride.findMany.mockClear();
  });

  it("dedupe: mesmo eventId não duplica item", async () => {
    eventLogs = [
      {
        id: "evt-1",
        organizationId: 1,
        eventType: "checkin.success",
        createdAt: new Date(),
        activityItem: null,
      },
    ];

    const first = await consumeEventLogToOpsFeed("evt-1");
    expect(first.ok).toBe(true);
    const second = await consumeEventLogToOpsFeed("evt-1");
    expect(second.ok).toBe(true);
    expect(feedItems).toHaveLength(1);
  });

  it("whitelist: ignora eventos fora da lista", async () => {
    eventLogs = [
      {
        id: "evt-2",
        organizationId: 1,
        eventType: "custom.event",
        createdAt: new Date(),
        activityItem: null,
      },
    ];

    const res = await consumeEventLogToOpsFeed("evt-2");
    expect(res.ok).toBe(false);
    expect(feedItems).toHaveLength(0);
  });

  it("não cria item se faltar sourceType/sourceId consistente", async () => {
    eventLogs = [
      {
        id: "evt-2b",
        organizationId: 1,
        eventType: "payment.succeeded",
        createdAt: new Date(),
        activityItem: null,
        sourceType: SourceType.TICKET_ORDER,
        sourceId: null,
      },
    ];

    const res = await consumeEventLogToOpsFeed("evt-2b");
    expect(res.ok).toBe(false);
    expect(feedItems).toHaveLength(0);
  });

  it("batch: só processa pendentes elegíveis", async () => {
    eventLogs = [
      {
        id: "evt-3",
        organizationId: 1,
        eventType: "checkin.success",
        createdAt: new Date(),
        activityItem: null,
      },
      {
        id: "evt-4",
        organizationId: 1,
        eventType: "checkin.denied",
        createdAt: new Date(),
        activityItem: null,
      },
    ];

    const res = await consumeOpsFeedBatch({ limit: 10 });
    expect(res.processed).toBe(2);
    expect(feedItems).toHaveLength(2);
  });
});
