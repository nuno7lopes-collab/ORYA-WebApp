import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readLocal(pathname: string) {
  return readFileSync(resolve(process.cwd(), pathname), "utf8");
}

const BOOKING_SCREEN_PATH = "apps/mobile/app/service/[id]/booking.tsx";

describe("mobile service booking duration policy", () => {
  it("usa durações ativas da policy e preços por duração em COURT", () => {
    const source = readLocal(BOOKING_SCREEN_PATH);

    expect(source).toContain("bookingPolicy.activeDurations");
    expect(source).toContain("bookingPolicy.allowedDurations");
    expect(source).toContain("durationPrices");
    expect(source).toContain("activeDurationOptions.map");
    expect(source).toContain("setSelectedDurationMinutes(duration)");
  });

  it("envia durationMinutes e remove packageId para reservas de campo", () => {
    const source = readLocal(BOOKING_SCREEN_PATH);

    expect(source).toContain("durationMinutes: isCourtService ? effectiveDurationMinutes : null");
    expect(source).toContain("packageId: isCourtService ? null : selectedPackageId");
    expect(source).toContain("if (isCourtService && effectiveDurationMinutes > 0)");
    expect(source).toContain("params.set(\"durationMinutes\", String(effectiveDurationMinutes))");
  });

  it("oculta UI de pacotes para COURT", () => {
    const source = readLocal(BOOKING_SCREEN_PATH);

    expect(source).toContain("!isCourtService && service.packages && service.packages.length > 0");
  });
});
