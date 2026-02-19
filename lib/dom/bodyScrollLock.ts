const LOCK_COUNT_KEY = "oryaScrollLockCount";
const LOCK_PREV_OVERFLOW_KEY = "oryaScrollLockPrevOverflow";

export function lockBodyScroll() {
  if (typeof document === "undefined") return () => {};

  const body = document.body;
  const currentCountRaw = body.dataset[LOCK_COUNT_KEY] ?? "0";
  const currentCount = Number.parseInt(currentCountRaw, 10);
  const safeCount = Number.isFinite(currentCount) && currentCount > 0 ? currentCount : 0;

  if (safeCount === 0) {
    body.dataset[LOCK_PREV_OVERFLOW_KEY] = body.style.overflow || "";
    body.style.overflow = "hidden";
  }
  body.dataset[LOCK_COUNT_KEY] = String(safeCount + 1);

  let released = false;
  return () => {
    if (released) return;
    released = true;

    const nextCountRaw = body.dataset[LOCK_COUNT_KEY] ?? "0";
    const nextCount = Number.parseInt(nextCountRaw, 10);
    const safeNextCount = Number.isFinite(nextCount) && nextCount > 0 ? nextCount : 0;

    if (safeNextCount <= 1) {
      body.style.overflow = body.dataset[LOCK_PREV_OVERFLOW_KEY] ?? "";
      delete body.dataset[LOCK_COUNT_KEY];
      delete body.dataset[LOCK_PREV_OVERFLOW_KEY];
      return;
    }

    body.dataset[LOCK_COUNT_KEY] = String(safeNextCount - 1);
  };
}
