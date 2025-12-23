"use client";

import { CTA_PRIMARY, CTA_SECONDARY } from "@/app/organizador/dashboardUi";

type FlowStickyFooterProps = {
  backLabel?: string;
  nextLabel: string;
  helper?: string;
  disabledReason?: string | null;
  loading?: boolean;
  loadingLabel?: string;
  showLoadingHint?: boolean;
  disableBack?: boolean;
  disableNext?: boolean;
  onBack?: () => void;
  onNext?: () => void;
};

export function FlowStickyFooter({
  backLabel = "Voltar",
  nextLabel,
  helper,
  disabledReason,
  loading,
  loadingLabel,
  showLoadingHint,
  disableBack,
  disableNext,
  onBack,
  onNext,
}: FlowStickyFooterProps) {
  const nextIsDisabled = disableNext || Boolean(disabledReason);
  return (
    <div className="sticky bottom-0 left-0 right-0 z-[var(--z-footer)] pt-4">
      <div className="relative overflow-hidden border-t border-white/10 bg-black/30 px-4 py-3 md:px-5 md:py-4 backdrop-blur-xl shadow-[0_-18px_45px_rgba(0,0,0,0.45)]">
        {loading && showLoadingHint && (
          <div className="absolute left-0 right-0 top-0 h-[3px] overflow-hidden">
            <div className="h-full w-full animate-pulse bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5]" />
          </div>
        )}
        <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-[12px] text-white/70 leading-snug">
            {helper ? <p>{helper}</p> : <p>Guarda e revê no final. Navega sem perder contexto.</p>}
            {disabledReason && <p className="text-white/55">{disabledReason}</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onBack}
              disabled={disableBack}
              className={`${CTA_SECONDARY} disabled:opacity-55`}
            >
              {backLabel}
            </button>
            <button
              type="button"
              onClick={onNext}
              disabled={nextIsDisabled || loading}
              className={`${CTA_PRIMARY} px-6 text-sm font-semibold shadow-none disabled:opacity-60`}
              title={disabledReason ?? ""}
            >
              {loading ? loadingLabel || "A processar..." : nextLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
