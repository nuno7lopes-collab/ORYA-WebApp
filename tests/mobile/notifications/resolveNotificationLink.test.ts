import { describe, it, expect } from "vitest";

import { resolveNotificationLink } from "@/lib/mobile/notifications";

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
    expectNative("/eventos/campeonato", "/event/campeonato?source=notifications");
    expectNative(
      "https://www.orya.pt/eventos/campeonato",
      "/event/campeonato?source=notifications",
    );
  });

  it("maps wallet and tickets shortcuts", () => {
    expectNative("/me/carteira", "/tickets?source=notifications");
    expectNative("/me/inscricoes", "/tickets?source=notifications");
    expectNative("/me/reservas", "/reservas?source=notifications");
    expectNative("/me/bilhetes/ent_123", "/wallet/ent_123?source=notifications");
  });

  it("maps registration detail deep links", () => {
    expectNative("/inscricoes/77", "/inscricoes/77?source=notifications");
    expectNative("/me/inscricoes/77", "/inscricoes/77?source=notifications");
  });

  it("maps social notifications tab", () => {
    expectNative("/social?tab=notifications", "/notifications?source=notifications");
    expectNative("https://www.orya.pt/social?tab=notifications", "/notifications?source=notifications");
  });

  it("rejects legacy organization chat links", () => {
    expect(resolveNotificationLink("/organizacao/chat?conversationId=abc")).toEqual({ kind: "none" });
    expect(resolveNotificationLink("/organizacao/chat")).toEqual({ kind: "none" });
  });

  it("keeps already mobile paths", () => {
    expectNative("/event/xyz", "/event/xyz?source=notifications");
    expectNative("/notifications", "/notifications?source=notifications");
  });

  it("falls back to none for unknown paths", () => {
    expect(resolveNotificationLink("/foo/bar")).toEqual({ kind: "none" });
    expect(resolveNotificationLink("https://www.orya.pt/unknown")).toEqual({
      kind: "native",
      path: "/unknown?source=notifications",
    });
  });
});
