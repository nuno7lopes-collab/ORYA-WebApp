import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readLocal(pathname: string) {
  return readFileSync(resolve(process.cwd(), pathname), "utf8");
}

describe("ws handshake rate-limit guardrails", () => {
  it("enforces RATE_LIMITED in ws handshake server", () => {
    const wsServer = readLocal("scripts/chat-ws-server.js");

    expect(wsServer).toContain("consumeHandshakeRateLimit");
    expect(wsServer).toContain("HANDSHAKE_RATE_LIMIT_WINDOW_MS");
    expect(wsServer).toContain("HANDSHAKE_RATE_LIMIT_MAX_ATTEMPTS");
    expect(wsServer).toContain('reason: "RATE_LIMITED"');
    expect(wsServer).toContain("code: 4008");
  });

  it("keeps client handling for RATE_LIMITED reconnect backoff", () => {
    const webChat = readLocal("app/org/_internal/core/(dashboard)/chat/ChatInternoV2Client.tsx");
    const webPreview = readLocal("app/org/_internal/core/(dashboard)/chat/preview/useChatPreviewData.ts");
    const mobileChat = readLocal("apps/mobile/app/messages/[threadId].tsx");

    expect(webChat).toContain('reason === "RATE_LIMITED" ? 60000 : undefined');
    expect(webPreview).toContain('reason === "RATE_LIMITED" ? 60000 : undefined');
    expect(mobileChat).toContain('reason === "RATE_LIMITED" ? 60000 : 2000');
    expect(mobileChat).toContain("Muitas tentativas de ligação ao chat. Tenta novamente em 1 minuto.");
  });
});
