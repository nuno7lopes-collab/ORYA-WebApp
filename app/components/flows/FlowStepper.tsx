"use client";

type StepStatus = "active" | "done" | "locked";

export type FlowStep = {
  key: string;
  title: string;
  subtitle?: string;
  status: StepStatus;
  onSelect?: () => void;
};

type FlowStepperProps = {
  steps: FlowStep[];
  className?: string;
  variant?: "default" | "compact";
};

export function FlowStepper({ steps, className, variant = "default" }: FlowStepperProps) {
  if (variant === "compact") {
    return (
      <div className={`flex gap-2 overflow-x-auto pb-1 ${className ?? ""}`}>
        {steps.map((step, idx) => {
          const isActive = step.status === "active";
          const isDone = step.status === "done";
          const clickable = step.status !== "locked" && Boolean(step.onSelect);
          const statusLabel = isActive ? "Em curso" : isDone ? "Completo" : "Por fazer";
          return (
            <button
              key={step.key}
              type="button"
              onClick={() => step.onSelect?.()}
              disabled={!clickable}
              className={`flex min-w-[160px] flex-1 items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs transition ${
                isActive
                  ? "border-white/50 bg-white/[0.08] shadow-[0_10px_30px_rgba(0,0,0,0.45)]"
                  : isDone
                    ? "border-emerald-300/35 bg-emerald-400/10 shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
                    : "border-white/12 bg-black/40"
              } ${clickable ? "hover:-translate-y-0.5 hover:border-white/30" : "cursor-default opacity-85"}`}
            >
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold ${
                  isActive
                    ? "border-white bg-white text-black shadow-[0_0_0_6px_rgba(255,255,255,0.1)]"
                    : isDone
                      ? "border-emerald-300/70 bg-emerald-300/25 text-emerald-50"
                      : "border-white/30 text-white/75"
                }`}
                aria-hidden
              >
                {isDone ? "✔" : idx + 1}
              </span>
              <div className="space-y-0.5">
                <p className={`font-semibold ${isActive ? "text-white" : isDone ? "text-emerald-50" : "text-white/80"}`}>
                  {step.title}
                </p>
                <p className="text-[11px] text-white/60">{statusLabel}</p>
              </div>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className={`grid gap-3 sm:grid-cols-2 lg:grid-cols-3 ${className ?? ""}`}>
      {steps.map((step, idx) => {
        const isActive = step.status === "active";
        const isDone = step.status === "done";
        const clickable = step.status !== "locked" && Boolean(step.onSelect);
        return (
          <button
            key={step.key}
            type="button"
            onClick={() => step.onSelect?.()}
            disabled={!clickable}
            className={`group relative overflow-hidden rounded-2xl border px-4 py-3 text-left transition-all duration-200 ${
              isActive
                ? "border-white/50 bg-white/[0.06] shadow-[0_18px_50px_rgba(0,0,0,0.45)]"
                : isDone
                  ? "border-emerald-300/25 bg-emerald-400/5 shadow-[0_12px_30px_rgba(0,0,0,0.35)]"
                  : "border-white/10 bg-black/30"
            } ${clickable ? "hover:-translate-y-0.5 hover:border-white/30" : "cursor-default opacity-90"}`}
          >
            <div
              className={`absolute inset-0 opacity-0 transition duration-200 ${
                isActive
                  ? "bg-gradient-to-br from-[#FF00C8]/15 via-[#6BFFFF]/10 to-[#1646F5]/20 opacity-100"
                  : ""
              }`}
            />
            <div className="relative flex items-start gap-3">
              <div
                className={`mt-0.5 flex h-10 w-10 items-center justify-center rounded-full border text-sm font-semibold transition-all duration-200 ${
                  isActive
                    ? "border-white bg-white text-black shadow-[0_0_0_8px_rgba(255,255,255,0.08)]"
                    : isDone
                      ? "border-emerald-300/70 bg-emerald-300/25 text-emerald-50"
                      : "border-white/30 text-white/70"
                }`}
                aria-hidden
              >
                {isDone ? "✔" : idx + 1}
              </div>
              <div className="space-y-1">
                <p
                  className={`text-sm font-semibold transition-colors ${
                    isActive ? "text-white" : isDone ? "text-emerald-50" : "text-white/80"
                  }`}
                >
                  {step.title}
                </p>
                {step.subtitle && (
                  <p className="text-[12px] leading-snug text-white/65">{step.subtitle}</p>
                )}
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-white/45">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      isActive ? "bg-white shadow-[0_0_0_5px_rgba(255,255,255,0.08)]" : "bg-white/40"
                    }`}
                  />
                  <span>{isActive ? "Em curso" : isDone ? "Completo" : "Bloqueado"}</span>
                </div>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
