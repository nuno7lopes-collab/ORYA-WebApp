import { describe, it, expect, vi } from "vitest";

vi.mock("/Users/nuno/orya/ORYA-WebApp/apps/mobile/lib/env", () => ({
  getMobileEnv: () => ({
    apiBaseUrl: "https://www.orya.pt",
    appEnv: "test",
  }),
}));

vi.mock("/Users/nuno/orya/ORYA-WebApp/apps/mobile/lib/env.ts", () => ({
  getMobileEnv: () => ({
    apiBaseUrl: "https://www.orya.pt",
    appEnv: "test",
  }),
}));

import { resolveNotificationLink } from "@/apps/mobile/lib/notifications";

const expectNative = (input: string, path: string) => {
  expect(resolveNotificationLink(input)).toEqual({ kind: "native", path });
};

const expectWeb = (input: string, url: string) => {
  expect(resolveNotificationLink(input)).toEqual({ kind: "web", url });
};

describe("resolveNotificationLink", () => {
  it("returns none for empty input", () => {
    expect(resolveNotificationLink(null)).toEqual({ kind: "none" });
    expect(resolveNotificationLink(undefined)).toEqual({ kind: "none" });
    expect(resolveNotificationLink(" ")).toEqual({ kind: "none" });
  });

  it("maps eventos slug to mobile event route", () => {
    expectNative("/eventos/campeonato", "/event/campeonato");
    expectNative("/eventos/campeonato/live", "/event/campeonato");
    expectNative("https://www.orya.pt/eventos/campeonato", "/event/campeonato");
  });

  it("maps wallet and tickets shortcuts", () => {
    expectNative("/me/carteira", "/tickets");
    expectNative("/me/inscricoes", "/tickets");
    expectNative("/me/bilhetes/ent_123", "/wallet/ent_123");
  });

  it("maps social notifications tab", () => {
    expectNative("/social?tab=notifications", "/notifications");
    expectNative("https://www.orya.pt/social?tab=notifications", "/notifications");
  });

  it("maps organization chat conversation", () => {
    expectNative("/organizacao/chat?conversationId=abc", "/messages/abc");
    expectNative("/organizacao/chat", "/messages");
  });

  it("keeps already mobile paths", () => {
    expectNative("/event/xyz", "/event/xyz");
    expectNative("/notifications", "/notifications");
  });

  it("falls back to web for unknown paths", () => {
    expectWeb("/foo/bar", "https://www.orya.pt/foo/bar");
    expectWeb("https://www.orya.pt/unknown", "https://www.orya.pt/unknown");
  });
});
