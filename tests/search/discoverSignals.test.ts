import { beforeEach, describe, expect, it, vi } from "vitest";
import { sendDiscoverEventSignal } from "@/app/descobrir/_explorar/eventSignals";

describe("discover event signals", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("não envia para utilizador guest", async () => {
    const fetchSpy = vi.spyOn(global, "fetch");
    await sendDiscoverEventSignal({ eventId: 1, signalType: "CLICK" }, false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("faz dedupe de sinais CLICK no intervalo", async () => {
    vi.useFakeTimers();
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );

    await sendDiscoverEventSignal({ eventId: 99, signalType: "CLICK" }, true);
    await sendDiscoverEventSignal({ eventId: 99, signalType: "CLICK" }, true);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(6001);
    await sendDiscoverEventSignal({ eventId: 99, signalType: "CLICK" }, true);
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });
});

