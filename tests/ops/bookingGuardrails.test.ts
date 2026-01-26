import { describe, it } from "vitest";
import { execSync } from "child_process";

function assertNoMatches(command: string, label: string) {
  try {
    execSync(command, { stdio: "pipe" });
    throw new Error(`${label} found matches`);
  } catch (err: any) {
    if (typeof err?.status === "number" && err.status === 1) {
      return;
    }
    const output = err?.stdout ? String(err.stdout) : "";
    const stderr = err?.stderr ? String(err.stderr) : "";
    throw new Error(`${label} check failed\n${output}${stderr}`);
  }
}

describe("booking access guardrails", () => {
  it("blocks booking.status usage outside workflow/scheduling allowlist", () => {
    assertNoMatches(
      [
        "rg -n",
        "\"BookingStatus|booking\\\\.status|bookingStatus\"",
        "app/api -S",
        "-g '!app/api/servicos/[[]id[]]/checkout/route.ts'",
        "-g '!app/api/organizacao/reservas/[[]id[]]/checkout/route.ts'",
        "-g '!app/api/organizacao/reservas/[[]id[]]/reschedule/route.ts'",
        "-g '!app/api/organizacao/reservas/[[]id[]]/cancel/route.ts'",
        "-g '!app/api/organizacao/reservas/[[]id[]]/no-show/route.ts'",
        "-g '!app/api/me/reservas/[[]id[]]/review/route.ts'",
        "-g '!app/api/me/reservas/[[]id[]]/cancel/route.ts'",
        "-g '!app/api/me/reservas/route.ts'",
        "-g '!app/api/organizacao/club/finance/overview/route.ts'",
        "-g '!app/api/organizacao/agenda/soft-blocks/route.ts'",
        "-g '!app/api/padel/calendar/route.ts'",
        "-g '!app/api/padel/calendar/auto-schedule/route.ts'",
      ].join(" "),
      "Booking status usage",
    );
  });
});
