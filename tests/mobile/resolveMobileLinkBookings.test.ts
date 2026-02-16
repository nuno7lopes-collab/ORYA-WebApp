import { describe, expect, it } from "vitest";
import { resolveMobileLink } from "@/lib/mobile/links";

describe("resolveMobileLink bookings and registrations", () => {
  it("maps me/reservas routes to native reservations", () => {
    expect(resolveMobileLink("https://orya.pt/me/reservas")).toEqual({
      kind: "native",
      path: "/reservas",
    });
    expect(resolveMobileLink("https://orya.pt/me/reservas/123")).toEqual({
      kind: "native",
      path: "/reservas?bookingId=123",
    });
  });

  it("maps registration detail links to native registration screen", () => {
    expect(resolveMobileLink("https://orya.pt/inscricoes/77")).toEqual({
      kind: "native",
      path: "/inscricoes/77",
    });
    expect(resolveMobileLink("https://orya.pt/me/inscricoes/77")).toEqual({
      kind: "native",
      path: "/inscricoes/77",
    });
  });
});
