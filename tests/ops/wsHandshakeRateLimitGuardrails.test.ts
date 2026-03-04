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

  it("enforces mobile version gate parity and platform kill switches in ws handshake", () => {
    const wsServer = readLocal("scripts/chat-ws-server.js");

    expect(wsServer).toContain("resolveMobileMinVersion");
    expect(wsServer).toContain("MOBILE_KILL_SWITCH_IOS");
    expect(wsServer).toContain("MOBILE_KILL_SWITCH_ANDROID");
    expect(wsServer).toContain('detail: "APP_VERSION_INVALID"');
    expect(wsServer).toContain('detail: "PLATFORM_KILL_SWITCH"');
    expect(wsServer).toContain("type: \"handshake:error\"");
  });

  it("mantém modo degradado sem shutdown quando redis está indisponível", () => {
    const wsServer = readLocal("scripts/chat-ws-server.js");

    expect(wsServer).toContain("[chat-ws] REDIS_URL em falta em produção. A correr em modo degradado");
    expect(wsServer).toContain("[chat-ws] Redis indisponível em produção. A continuar em modo degradado.");
    expect(wsServer).not.toContain('process.exit(1); // fail-fast in production for reliability');
  });

  it("keeps client handling for RATE_LIMITED reconnect backoff", () => {
    const webChat = readLocal("app/org/_internal/core/(dashboard)/chat/ChatInternoV2Client.tsx");
    const webPreview = readLocal("app/org/_internal/core/(dashboard)/chat/preview/useChatPreviewData.ts");
    const mobileChat = readLocal("apps/mobile/app/comunidade/mensagens/[threadId].tsx");

    expect(webChat).toMatch(/reason\s*===\s*"RATE_LIMITED"\s*\?\s*60000\s*:\s*undefined/);
    expect(webPreview).toMatch(/reason\s*===\s*"RATE_LIMITED"\s*\?\s*60000\s*:\s*undefined/);
    expect(mobileChat).toMatch(
      /const reconnectDelayMs[\s\S]*reason\s*===\s*"RATE_LIMITED"[\s\S]*\?\s*60000[\s\S]*:\s*2000/,
    );
    expect(mobileChat).toContain("Muitas tentativas de ligação ao chat. Tenta novamente em 1 minuto.");
  });
});
