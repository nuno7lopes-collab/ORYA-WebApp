import { describe, expect, it } from "vitest";
import { resolveMobileLink } from "@/lib/mobile/links";
import { resolveNotificationLink } from "@/lib/mobile/notifications";

describe("mobile deep-link critical coverage", () => {
  it("maps critical bookings and registrations links to native routes", () => {
    expect(resolveMobileLink("https://orya.pt/me/reservas")).toEqual({
      kind: "native",
      path: "/reservas",
    });

    expect(resolveMobileLink("https://orya.pt/me/reservas/123")).toEqual({
      kind: "native",
      path: "/reservas?bookingId=123",
    });

    expect(resolveMobileLink("https://orya.pt/inscricoes/77")).toEqual({
      kind: "native",
      path: "/inscricoes/77",
    });
  });

  it("maps org chat links and keeps legacy manage links blocked", () => {
    expect(resolveMobileLink("https://orya.pt/org/51/chat")).toEqual({
      kind: "native",
      path: "/messages",
    });

    expect(resolveMobileLink("https://orya.pt/org/51/chat?conversationId=abc")).toEqual({
      kind: "native",
      path: "/messages/abc",
    });

    expect(resolveMobileLink("https://orya.pt/org/51/manage", { allowWeb: true })).toEqual({
      kind: "none",
    });
  });

  it("propagates notification source on native routes", () => {
    expect(resolveNotificationLink("https://orya.pt/eventos/open-final")).toEqual({
      kind: "native",
      path: "/event/open-final?source=notifications",
    });

    expect(resolveNotificationLink("https://orya.pt/me/compras/loja/ord_123")).toEqual({
      kind: "native",
      path: "/store/purchases/ord_123?source=notifications",
    });
  });
});
