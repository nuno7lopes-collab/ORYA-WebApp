import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function readLocal(pathname: string) {
  return readFileSync(resolve(process.cwd(), pathname), "utf8");
}

const BOOKING_SCREEN_PATHS = [
  "app/service/[id]/booking.tsx",
  "apps/mobile/app/service/[id]/booking.tsx",
];

function readBookingSource() {
  for (const path of BOOKING_SCREEN_PATHS) {
    const absolute = resolve(process.cwd(), path);
    if (existsSync(absolute)) {
      return readLocal(path);
    }
  }
  throw new Error(`booking.tsx não encontrado em: ${BOOKING_SCREEN_PATHS.join(" | ")}`);
}

describe("mobile service booking duration policy", () => {
  it("usa durações ativas da policy e preços por duração em COURT", () => {
    const source = readBookingSource();

    expect(source).toContain("bookingPolicy.activeDurations");
    expect(source).toContain("bookingPolicy.allowedDurations");
    expect(source).toContain("durationPrices");
    expect(source).toContain("activeDurationOptions.map");
    expect(source).toContain("setSelectedDurationMinutes(duration)");
  });

  it("envia durationMinutes e remove packageId para reservas de campo", () => {
    const source = readBookingSource();

    expect(source).toContain("durationMinutes: isCourtService ? effectiveDurationMinutes : null");
    expect(source).toContain("packageId: isCourtService ? null : selectedPackageId");
    expect(source).toContain("if (isCourtService && effectiveDurationMinutes > 0)");
    expect(source).toContain("params.set(\"durationMinutes\", String(effectiveDurationMinutes))");
  });

  it("oculta UI de pacotes para COURT", () => {
    const source = readBookingSource();

    expect(source).toContain("!isCourtService && service.packages && service.packages.length > 0");
  });
});
