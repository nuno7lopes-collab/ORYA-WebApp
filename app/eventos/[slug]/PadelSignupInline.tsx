"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type Props = {
  eventId: number;
  organizationId: number | null;
  ticketTypeId: number | null;
  categoryId?: number | null;
  padelV2Enabled: boolean;
  templateType?: string | null;
  slug: string;
};

export default function PadelSignupInline({
  eventId,
  organizationId,
  ticketTypeId,
  categoryId,
  padelV2Enabled,
  templateType,
  slug,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [loadingFull, setLoadingFull] = useState(false);
  const [loadingSplit, setLoadingSplit] = useState(false);

  const isPadelV2 = templateType === "PADEL" && padelV2Enabled;
  const canProceed = isPadelV2 && organizationId && ticketTypeId;

  const redirectToPadelOnboarding = () => {
    const params = new URLSearchParams();
    const current =
      pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : "");
    params.set("redirectTo", current);
    router.push(`/onboarding/padel?${params.toString()}`);
  };

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
          organizationId,
          categoryId: categoryId ?? undefined,
          paymentMode: mode,
        }),
      });
      const json = await res.json();
      const resolvePadelError = (code?: string | null) => {
        switch (code) {
          case "CATEGORY_FULL":
          case "CATEGORY_PLAYERS_FULL":
            return "Categoria cheia. Tenta outra ou aguarda vaga.";
          case "ALREADY_IN_CATEGORY":
            return "Já estás inscrito nesta categoria.";
          case "MAX_CATEGORIES":
            return "Já atingiste o limite de categorias neste torneio.";
          case "EVENT_FULL":
            return "Torneio cheio. Aguarda vaga na lista de espera.";
          case "EVENT_NOT_PUBLISHED":
            return "As inscrições ainda não estão abertas.";
          case "INSCRIPTIONS_NOT_OPEN":
            return "As inscrições ainda não abriram.";
          case "INSCRIPTIONS_CLOSED":
            return "As inscrições já fecharam.";
          case "TOURNAMENT_STARTED":
            return "O torneio já começou. Inscrições encerradas.";
          case "SPLIT_DEADLINE_PASSED":
            return "Já passou o prazo para pagamento dividido.";
          case "CATEGORY_GENDER_MISMATCH":
            return "Esta categoria exige uma dupla compatível com o género definido.";
          case "CATEGORY_LEVEL_MISMATCH":
            return "O teu nível não é compatível com esta categoria.";
          case "GENDER_REQUIRED_FOR_TOURNAMENT":
            return "Define o teu género para validar a elegibilidade.";
          default:
            return "Não foi possível iniciar inscrição Padel.";
        }
      };
      if (!res.ok || !json?.ok) {
        if (json?.error === "PADEL_ONBOARDING_REQUIRED") {
          redirectToPadelOnboarding();
          return;
        }
        throw new Error(resolvePadelError(json?.error));
      }
      if (json?.waitlist) {
        alert("Ficaste na lista de espera. Avisamos assim que houver vaga.");
        return;
      }
      if (!json?.pairing?.id) {
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
          <h4 className="text-lg font-semibold text-white">Escolhe pagamento</h4>
        </div>
      </div>
      <div className="space-y-2">
        <button
          type="button"
          disabled={!canProceed || loadingFull}
          onClick={() => createPairing("FULL")}
          className="w-full rounded-full bg-white text-black px-4 py-2 font-semibold shadow hover:brightness-105 disabled:opacity-60"
        >
          {loadingFull ? "A preparar…" : "Pagar dupla"}
        </button>
        <button
          type="button"
          disabled={!canProceed || loadingSplit}
          onClick={() => createPairing("SPLIT")}
          className="w-full rounded-full border border-white/20 px-4 py-2 font-semibold text-white hover:bg-white/10 disabled:opacity-60"
        >
          {loadingSplit ? "A preparar…" : "Pagar lugar"}
        </button>
        {!canProceed && (
          <p className="text-[12px] text-amber-200">Inscrições indisponíveis.</p>
        )}
      </div>
    </div>
  );
}
