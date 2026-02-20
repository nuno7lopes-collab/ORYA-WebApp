import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const checkoutPath = resolve(process.cwd(), "app/checkout/index.tsx");

describe("checkout booking polling contract", () => {
  it("evita polling concorrente da mesma reserva", () => {
    const file = readFileSync(checkoutPath, "utf8");
    expect(file).toContain("const bookingPollInFlightRef = useRef<Promise<void> | null>(null)");
    expect(file).toContain("if (bookingPollInFlightRef.current)");
    expect(file).toContain("bookingPollInFlightRef.current = task");
    expect(file).toContain("const bookingStatusInFlightRef = useRef<Promise<string | null> | null>(null)");
    expect(file).toContain("bookingStatusInFlightBookingIdRef");
  });

  it("pára polling quando a reserva entra em estado terminal", () => {
    const file = readFileSync(checkoutPath, "utf8");
    expect(file).toContain("const isBookingTerminalStatus = (status?: string | null)");
    expect(file).toContain("if (isBookingTerminalStatus(bookingStatus)) return;");
  });

  it("mostra estado de timeout de reserva mesmo com pagamento liquidado", () => {
    const file = readFileSync(checkoutPath, "utf8");
    expect(file).toContain("if (isServiceBooking && bookingTimedOut)");
    expect(file).toContain("Confirmação da reserva pendente");
  });
});
