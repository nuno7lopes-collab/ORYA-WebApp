type PerfMark = {
  at: number;
};

const isDev = typeof __DEV__ !== "undefined" && __DEV__;
const marks = new Map<string, PerfMark>();

export const perfMark = (name: string) => {
  if (!isDev) return;
  marks.set(name, { at: Date.now() });
};

export const perfMeasure = (label: string, startMark: string, endMark?: string) => {
  if (!isDev) return;
  const start = marks.get(startMark)?.at;
  const end = endMark ? marks.get(endMark)?.at : Date.now();
  if (!start) return;
  const duration = Math.max(0, end - start);
  console.info(`[perf] ${label}: ${duration}ms`);
};

export const perfLog = (label: string, data?: Record<string, unknown>) => {
  if (!isDev) return;
  if (data) {
    console.info(`[perf] ${label}`, data);
  } else {
    console.info(`[perf] ${label}`);
  }
};
