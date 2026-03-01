import { describe, expect, it } from "vitest";
import {
  CLUB_DASHBOARD_AREA_ORDER,
  resolveClubDashboardAreaByTool,
  resolveClubDashboardAreaByToolId,
  resolveClubDashboardViewModel,
} from "@/app/org/_internal/core/ClubDashboardViewModel";

describe("club dashboard view model", () => {
  it("keeps canonical club-first area order", () => {
    expect(CLUB_DASHBOARD_AREA_ORDER).toEqual([
      "Operação",
      "Competição",
      "Academia",
      "Comunidade",
      "Clube",
      "Negócio",
      "Configurações",
    ]);
  });

  it("maps org tool keys to club areas and labels", () => {
    expect(resolveClubDashboardViewModel("bookings")).toMatchObject({
      label: "Operação",
      area: "Operação",
    });
    expect(resolveClubDashboardViewModel("padel-tournaments")).toMatchObject({
      label: "Competição",
      area: "Competição",
    });
    expect(resolveClubDashboardAreaByTool("chat")).toBe("Comunidade");
    expect(resolveClubDashboardAreaByTool("settings")).toBe("Configurações");
  });

  it("maps dashboard tool ids to club areas", () => {
    expect(resolveClubDashboardAreaByToolId("reservas")).toBe("Operação");
    expect(resolveClubDashboardAreaByToolId("academia")).toBe("Academia");
    expect(resolveClubDashboardAreaByToolId("eventos")).toBe("Competição");
    expect(resolveClubDashboardAreaByToolId("mensagens")).toBe("Comunidade");
    expect(resolveClubDashboardAreaByToolId("financeiro")).toBe("Negócio");
    expect(resolveClubDashboardAreaByToolId("settings")).toBe("Configurações");
  });
});
