"use client";

import { CTA_PRIMARY } from "@/app/organizacao/dashboardUi";

type FreeCheckoutConfirmProps = {
  loading: boolean;
  error?: string | null;
  headerLabel: string;
  description: string;
  loadingLabel: string;
  confirmLabel: string;
  onConfirm?: () => void;
  onRetry?: () => void;
};

export default function FreeCheckoutConfirm({
  loading,
  error,
  headerLabel,
  description,
  loadingLabel,
  confirmLabel,
  onConfirm,
  onRetry,
}: FreeCheckoutConfirmProps) {
  if (error) {
    return (
      <div className="flex-1 rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-6 text-sm text-red-100 shadow-[0_0_30px_rgba(255,0,0,0.35)]">
        <p className="font-semibold mb-1 flex items-center gap-2">
          <span className="text-lg">⚠️</span> Ocorreu um problema
        </p>
        <p className="text-[12px] mb-4 leading-relaxed">{error}</p>
        <button
          type="button"
          onClick={onRetry}
          className="rounded-full bg-white text-red-700 px-5 py-1.5 text-[11px] font-semibold shadow hover:bg-white/90 transition"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex-1 rounded-2xl border border-white/12 bg-white/[0.05] px-6 py-12 flex flex-col justify-center items-center text-center shadow-[0_18px_50px_rgba(0,0,0,0.45)] backdrop-blur-xl">
        <div className="relative mb-6">
          <div className="h-14 w-14 rounded-full border-2 border-white/20 border-t-transparent animate-spin" />
          <div className="absolute inset-0 h-14 w-14 animate-pulse rounded-full border border-[#6BFFFF]/20" />
        </div>
        <h3 className="text-sm font-semibold mb-1 animate-pulse">{loadingLabel}</h3>
        <p className="text-[11px] text-white/65 max-w-xs leading-relaxed">{confirmLabel}</p>
      </div>
    );
  }

  return (
    <div className="flex-1 rounded-2xl border border-white/12 bg-white/[0.05] px-6 py-6 shadow-[0_0_60px_rgba(0,0,0,0.6)] backdrop-blur-xl space-y-4">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold">{headerLabel}</h3>
        <p className="text-[12px] text-white/70">{description}</p>
      </div>
      {onConfirm ? (
        <button
          type="button"
          onClick={onConfirm}
          className={`${CTA_PRIMARY} w-full justify-center px-6 py-3 text-xs active:scale-95`}
        >
          Confirmar e continuar
        </button>
      ) : null}
    </div>
  );
}
