import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const isRedisConfigured = vi.hoisted(() => vi.fn(() => false));
const getRedisPublisherClient = vi.hoisted(() => vi.fn());
const getRedisCommandClient = vi.hoisted(() => vi.fn());

vi.mock("@/lib/redis/client", () => ({
  isRedisConfigured,
  getRedisPublisherClient,
  getRedisCommandClient,
}));

let publishChatEvent: typeof import("@/lib/chat/redis").publishChatEvent;
let isChatUserOnline: typeof import("@/lib/chat/redis").isChatUserOnline;

function readLocal(pathname: string) {
  return readFileSync(resolve(process.cwd(), pathname), "utf8");
}

const ROUTE_FILES = [
  "lib/messages/handlers/chat/conversations/route.ts",
  "lib/messages/handlers/chat/conversations/[conversationId]/route.ts",
  "lib/messages/handlers/chat/conversations/[conversationId]/read/route.ts",
  "lib/messages/handlers/chat/conversations/[conversationId]/leave/route.ts",
  "lib/messages/handlers/chat/messages/[messageId]/route.ts",
  "lib/messages/handlers/chat/messages/[messageId]/reactions/route.ts",
  "lib/messages/handlers/chat/messages/[messageId]/pins/route.ts",
  "lib/messages/handlers/me/messages/conversations/[conversationId]/messages/[messageId]/route.ts",
  "app/api/messages/grants/[grantId]/accept/route.ts",
  "app/api/messages/conversations/resolve/route.ts",
];

beforeEach(async () => {
  vi.resetModules();
  isRedisConfigured.mockReset();
  getRedisPublisherClient.mockReset();
  getRedisCommandClient.mockReset();
  ({ publishChatEvent, isChatUserOnline } = await import("@/lib/chat/redis"));
});

describe("chat redis fallback", () => {
  it("devolve false ao publicar quando redis não está configurado", async () => {
    isRedisConfigured.mockReturnValue(false);

    const published = await publishChatEvent({ type: "message:new", conversationId: "c1" });

    expect(published).toBe(false);
  });

  it("devolve false ao publicar quando redis falha", async () => {
    isRedisConfigured.mockReturnValue(true);
    getRedisPublisherClient.mockRejectedValueOnce(new Error("redis unavailable"));

    const published = await publishChatEvent({ type: "message:new", conversationId: "c1" });

    expect(published).toBe(false);
  });

  it("devolve false em presença quando redis falha", async () => {
    isRedisConfigured.mockReturnValue(true);
    getRedisCommandClient.mockRejectedValueOnce(new Error("redis unavailable"));

    const online = await isChatUserOnline("user-1");

    expect(online).toBe(false);
  });

  it("mantém guardrails de fallback nas rotas de chat sem 503 por redis", () => {
    for (const routeFile of ROUTE_FILES) {
      const source = readLocal(routeFile);
      expect(source).toContain("REALTIME_DEGRADED");
      expect(source).not.toContain("CHAT_REDIS_UNAVAILABLE");
      expect(source).not.toContain("status: 503");
    }
  });
});
