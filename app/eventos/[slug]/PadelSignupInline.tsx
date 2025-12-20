"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  eventId: number;
  organizerId: number | null;
  ticketTypeId: number | null;
  categoryId?: number | null;
  padelV2Enabled: boolean;
  templateType?: string | null;
  slug: string;
};

export default function PadelSignupInline({
  eventId,
  organizerId,
  ticketTypeId,
  categoryId,
  padelV2Enabled,
  templateType,
  slug,
}: Props) {
  const router = useRouter();
  const [loadingFull, setLoadingFull] = useState(false);
  const [loadingSplit, setLoadingSplit] = useState(false);

  const isPadelV2 = templateType === "PADEL" && padelV2Enabled;
  const canProceed = isPadelV2 && organizerId && ticketTypeId;

  const createPairing = async (mode: "FULL" | "SPLIT") => {
    if (!canProceed) {
      alert("Sem configuração válida para inscrição Padel.");
      return;
    }
    const setLoading = mode === "FULL" ? setLoadingFull : setLoadingSplit;
    setLoading(true);
    try {
      const res = await fetch("/api/padel/pairings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          organizerId,
          categoryId: categoryId ?? undefined,
          paymentMode: mode,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok || !json?.pairing?.id) {
        throw new Error(json?.error || "Não foi possível iniciar inscrição Padel.");
      }
      const pairingId = json.pairing.id as number;
      if (mode === "SPLIT") {
        router.push(`/eventos/${slug}?pairingId=${pairingId}`);
      } else {
        router.push(`/eventos/${slug}?pairingId=${pairingId}&mode=full`);
      }
    } catch (err) {
      console.error("[PadelSignupInline] erro", err);
      alert(err instanceof Error ? err.message : "Erro ao iniciar inscrição.");
    } finally {
      setLoading(false);
    }
  };

  if (!isPadelV2 || !ticketTypeId) return null;

  return (
    <div className="space-y-3 rounded-xl border border-white/15 bg-black/45 p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-white/60">Padel (duplas)</p>
          <h4 className="text-lg font-semibold text-white">Escolhe como queres pagar</h4>
        </div>
      </div>
      <div className="space-y-2">
        <button
          type="button"
          disabled={!canProceed || loadingFull}
          onClick={() => createPairing("FULL")}
          className="w-full rounded-full bg-white text-black px-4 py-2 font-semibold shadow hover:brightness-105 disabled:opacity-60"
        >
          {loadingFull ? "A preparar…" : "Pagar dupla inteira"}
        </button>
        <button
          type="button"
          disabled={!canProceed || loadingSplit}
          onClick={() => createPairing("SPLIT")}
          className="w-full rounded-full border border-white/20 px-4 py-2 font-semibold text-white hover:bg-white/10 disabled:opacity-60"
        >
          {loadingSplit ? "A preparar…" : "Pagar só o meu lugar"}
        </button>
        {!canProceed && (
          <p className="text-[12px] text-amber-200">Bilhetes indisponíveis ou configuração Padel v2 desligada.</p>
        )}
      </div>
    </div>
  );
}
