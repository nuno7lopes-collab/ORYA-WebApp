"use client";

type StepId = "formato" | "essenciais" | "datas_local" | "bilhetes" | "revisao";

export type WizardStep = { id: StepId; title: string };

export function StepperDots({
  steps,
  current,
  maxUnlockedIndex,
  onGoTo,
}: {
  steps: WizardStep[];
  current: StepId;
  maxUnlockedIndex: number;
  onGoTo?: (id: StepId) => void;
}) {
  const currentIndex = Math.max(
    0,
    steps.findIndex((s) => s.id === current),
  );
  const progress =
    steps.length > 1 ? Math.min(100, Math.max(0, (currentIndex / (steps.length - 1)) * 100)) : 0;
  const dotSize = 36; // px
  const lineTop = dotSize / 2; // center of the dot

  return (
    <div className="w-full">
      <div className="relative py-3">
        <div
          className="absolute left-0 right-0 h-px bg-white/10"
          style={{ top: lineTop }}
          aria-hidden
        />
        <div
          className="absolute left-0 h-px bg-gradient-to-r from-[var(--orya-blue)] via-[var(--orya-cyan)] to-[var(--orya-pink)]"
          style={{ width: `${progress}%`, top: lineTop }}
          aria-hidden
        />

        <ol className="relative flex items-start justify-between gap-4 px-1">
          {steps.map((s, i) => {
            const clickable = i <= maxUnlockedIndex;
            const status = i < currentIndex ? "done" : i === currentIndex ? "current" : "todo";
            const isLockedFuture = i > maxUnlockedIndex;
            const isUnlockedFuture = i > currentIndex && !isLockedFuture;
            return (
              <li
                key={s.id}
                className="group min-w-0 flex flex-1 flex-col items-center text-center"
              >
                <button
                  type="button"
                  onClick={() => clickable && onGoTo?.(s.id)}
                  disabled={!clickable}
                  className={[
                    "relative grid place-items-center rounded-full outline-none",
                    "transition-all duration-250 ease-[cubic-bezier(0.2,0.8,0.2,1)] transform",
                    clickable ? "cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--orya-cyan)]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent" : "cursor-not-allowed",
                    status === "done" &&
                      "bg-emerald-400/10 border border-emerald-300/25 backdrop-blur-md shadow-[0_0_0_1px_rgba(16,185,129,.12),0_0_18px_rgba(16,185,129,.14)]",
                    status === "current" &&
                      "bg-white/8 border border-white/25 backdrop-blur-md shadow-[0_0_0_1px_rgba(255,255,255,.10),0_0_26px_rgba(255,255,255,.16)] scale-100",
                    status === "todo" &&
                      (isLockedFuture
                        ? "bg-white/4 border border-white/10 opacity-35"
                        : "bg-white/5 border border-white/14 opacity-70 hover:opacity-90"),
                    clickable && "hover:border-white/20 hover:shadow-[0_0_18px_rgba(255,255,255,0.1)]",
                    status !== "current" && "scale-[0.98]",
                  ].join(" ")}
                  aria-current={status === "current" ? "step" : undefined}
                  title={clickable ? "Editar este passo" : undefined}
                  style={{ width: dotSize, height: dotSize }}
                >
                  <span
                    className={[
                      "text-xs font-semibold",
                      status === "done" ? "text-emerald-200" : status === "current" ? "text-white/90" : "text-white/80",
                    ].join(" ")}
                  >
                    {i + 1}
                  </span>
                </button>

                <span
                  className={[
                    "mt-2 text-[11px] font-semibold tracking-[0.18em] uppercase leading-tight transition-colors",
                    status === "done"
                      ? "text-emerald-200/80"
                      : status === "current"
                        ? "text-white"
                        : isUnlockedFuture
                          ? "text-white/65 group-hover:text-white/85"
                          : "text-white/40",
                  ].join(" ")}
                >
                  {s.title}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
