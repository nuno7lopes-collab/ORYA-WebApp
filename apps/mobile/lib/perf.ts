type PerfMark = {
  at: number;
};

const isDev = typeof __DEV__ !== "undefined" && __DEV__;
const perfFlagFromEnv =
  typeof process !== "undefined" &&
  typeof process.env?.EXPO_PUBLIC_ENABLE_PERF_DEBUG === "string" &&
  process.env.EXPO_PUBLIC_ENABLE_PERF_DEBUG === "1";
const perfFlagFromGlobal =
  (globalThis as typeof globalThis & { __ORYA_ENABLE_PERF_DEBUG__?: boolean })
    .__ORYA_ENABLE_PERF_DEBUG__ === true;
const isPerfEnabled = isDev && (perfFlagFromEnv || perfFlagFromGlobal);
const marks = new Map<string, PerfMark>();
const DEFAULT_FRAME_BUDGET_MS = 1000 / 60;

type FrameMonitorOptions = {
  sampleWindowMs?: number;
  frameBudgetMs?: number;
  longFrameMs?: number;
};

let frameMonitorSession = 0;

export const perfMark = (name: string) => {
  if (!isPerfEnabled) return;
  marks.set(name, { at: Date.now() });
};

export const perfMeasure = (label: string, startMark: string, endMark?: string) => {
  if (!isPerfEnabled) return;
  const start = marks.get(startMark)?.at;
  const end = endMark ? marks.get(endMark)?.at : Date.now();
  if (!start) return;
  if (typeof end !== "number") return;
  const duration = Math.max(0, end - start);
  console.info(`[perf] ${label}: ${duration}ms`);
};

export const perfLog = (label: string, data?: Record<string, unknown>) => {
  if (!isPerfEnabled) return;
  if (data) {
    console.info(`[perf] ${label}`, data);
  } else {
    console.info(`[perf] ${label}`);
  }
};

export const startFrameMonitor = (
  label = "app",
  options?: FrameMonitorOptions,
) => {
  if (!isPerfEnabled) return () => undefined;
  if (typeof requestAnimationFrame !== "function") return () => undefined;

  const sampleWindowMs = Math.max(1500, options?.sampleWindowMs ?? 5000);
  const frameBudgetMs = Math.max(8, options?.frameBudgetMs ?? DEFAULT_FRAME_BUDGET_MS);
  const longFrameMs = Math.max(frameBudgetMs * 1.5, options?.longFrameMs ?? 34);
  const sessionId = ++frameMonitorSession;
  const now =
    typeof globalThis?.performance?.now === "function"
      ? () => globalThis.performance.now()
      : () => Date.now();

  let rafId = 0;
  let active = true;
  let prevTs = now();
  let windowStart = prevTs;
  let totalFrames = 0;
  let droppedFrames = 0;
  let longFrames = 0;
  let worstFrameMs = 0;

  const flush = (windowEnd: number) => {
    const elapsed = Math.max(1, windowEnd - windowStart);
    const fps = (totalFrames * 1000) / elapsed;
    perfLog("frame_window", {
      label,
      sessionId,
      fps: Number(fps.toFixed(1)),
      droppedFrames,
      longFrames,
      worstFrameMs: Number(worstFrameMs.toFixed(1)),
      sampleWindowMs: Math.round(elapsed),
    });
    windowStart = windowEnd;
    totalFrames = 0;
    droppedFrames = 0;
    longFrames = 0;
    worstFrameMs = 0;
  };

  const loop = (ts: number) => {
    if (!active) return;
    const delta = Math.max(0, ts - prevTs);
    prevTs = ts;
    totalFrames += 1;
    worstFrameMs = Math.max(worstFrameMs, delta);

    if (delta > frameBudgetMs) {
      droppedFrames += Math.max(1, Math.round(delta / frameBudgetMs) - 1);
    }
    if (delta >= longFrameMs) {
      longFrames += 1;
    }
    if (ts - windowStart >= sampleWindowMs) {
      flush(ts);
    }
    rafId = requestAnimationFrame(loop);
  };

  rafId = requestAnimationFrame(loop);
  perfLog("frame_monitor_start", {
    label,
    sessionId,
    sampleWindowMs,
    frameBudgetMs,
    longFrameMs,
  });

  return () => {
    if (!active) return;
    active = false;
    if (rafId) cancelAnimationFrame(rafId);
    flush(now());
    perfLog("frame_monitor_stop", { label, sessionId });
  };
};
