import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const meBookingsRoutePath = resolve(process.cwd(), "app/api/me/reservas/route.ts");
const meBookingsPagePath = resolve(process.cwd(), "app/me/reservas/page.tsx");
const mobileBookingsTabPath = resolve(process.cwd(), "apps/mobile/app/(tabs)/reservas.tsx");

describe("reservas court snapshot contract", () => {
  it("expõe courtSnapshot na API e usa snapshot na web/mobile", () => {
    const meBookingsRoute = readFileSync(meBookingsRoutePath, "utf8");
    const meBookingsPage = readFileSync(meBookingsPagePath, "utf8");
    const mobileBookingsTab = readFileSync(mobileBookingsTabPath, "utf8");

    expect(meBookingsRoute).toContain("courtSnapshot:");
    expect(meBookingsRoute).toContain("buildCompactCourtSnapshot");
    expect(meBookingsRoute).toContain("courtSnapshotCoverImageUrl");
    expect(meBookingsRoute).toContain("courtSnapshotName");

    expect(meBookingsPage).toContain("resolveBookingCoverUrl");
    expect(meBookingsPage).toContain("booking.courtSnapshot");

    expect(mobileBookingsTab).toContain("booking.courtSnapshot?.coverImageUrl");
    expect(mobileBookingsTab).toContain("booking.courtSnapshot?.name");
  });
});
