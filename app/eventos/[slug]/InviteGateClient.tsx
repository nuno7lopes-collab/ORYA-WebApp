"use client";

import { useState } from "react";
import WavesSectionClient, { type WaveTicket } from "./WavesSectionClient";

const EMAIL_REGEX = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

type InviteGateClientProps = {
  slug: string;
  isFree: boolean;
  isAuthenticated: boolean;
  hasUsername: boolean;
  userEmailNormalized: string | null;
  usernameNormalized: string | null;
  uiTickets: WaveTicket[];
  checkoutUiVariant: "DEFAULT" | "PADEL";
  padelMeta?: {
    eventId: number;
    organizerId: number | null;
    categoryId?: number | null;
    categoryLinkId?: number | null;
  };
};

type CheckResponse = {
  ok?: boolean;
  invited?: boolean;
  type?: "email" | "username";
  normalized?: string;
  error?: string;
};

export default function InviteGateClient({
  slug,
  isFree,
  isAuthenticated,
  hasUsername,
  userEmailNormalized,
  usernameNormalized,
  uiTickets,
  checkoutUiVariant,
  padelMeta,
}: InviteGateClientProps) {
  const [identifier, setIdentifier] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteType, setInviteType] = useState<"email" | "username" | null>(null);
  const [inviteNormalized, setInviteNormalized] = useState<string | null>(null);
  const [validated, setValidated] = useState(false);

  const handleCheck = async () => {
    const trimmed = identifier.trim();
    if (!trimmed) {
      setError("Indica o email ou @username do convite.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/eventos/${encodeURIComponent(slug)}/invites/check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: trimmed, scope: "PUBLIC" }),
      });
      const json = (await res.json().catch(() => null)) as CheckResponse | null;
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Não foi possível validar o convite.");
      }
      if (!json.invited) {
        setValidated(false);
        setInviteType(null);
        setInviteNormalized(null);
        setError("Sem convite válido para este evento.");
        return;
      }
      const type = json.type === "username" ? "username" : "email";
      setInviteType(type);
      setValidated(true);
      setInviteNormalized(json.normalized ?? trimmed);
    } catch (err) {
      setValidated(false);
      setInviteType(null);
      setInviteNormalized(null);
      setError(err instanceof Error ? err.message : "Não foi possível validar o convite.");
    } finally {
      setLoading(false);
    }
  };

  const inviteMatchesAccount =
    validated &&
    isAuthenticated &&
    ((inviteType === "email" &&
      inviteNormalized &&
      userEmailNormalized &&
      inviteNormalized === userEmailNormalized) ||
      (inviteType === "username" &&
        inviteNormalized &&
        usernameNormalized &&
        inviteNormalized === usernameNormalized));

  const paidInviteMatches = inviteMatchesAccount && !isFree;
  const freeInviteMatches = inviteMatchesAccount && isFree && hasUsername;

  const gateMessage = (() => {
    if (!validated) return null;
    if (!isAuthenticated) {
      return "Convite validado. Inicia sessão com a conta convidada para continuar.";
    }
    if (inviteType === "email") {
      if (!inviteNormalized || !userEmailNormalized || inviteNormalized !== userEmailNormalized) {
        return "Este convite não corresponde ao email desta conta.";
      }
      if (isFree && !hasUsername) {
        return "Define um username na tua conta para concluir a inscrição gratuita.";
      }
      return isFree
        ? "Convite validado. Podes continuar a inscrição gratuita."
        : "Convite validado. Podes continuar o checkout.";
    }
    if (inviteType === "username") {
      if (!hasUsername) {
        return "Define um username na tua conta para continuar.";
      }
      if (!inviteNormalized || !usernameNormalized || inviteNormalized !== usernameNormalized) {
        return "Este convite não corresponde ao teu username.";
      }
      return isFree
        ? "Convite validado. Podes continuar a inscrição gratuita."
        : "Convite validado. Podes continuar o checkout.";
    }
    return null;
  })();

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/20 bg-[linear-gradient(135deg,rgba(255,255,255,0.08),rgba(6,10,24,0.9))] px-4 py-4 text-sm text-white/85 shadow-[0_18px_45px_rgba(0,0,0,0.55)]">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-white/60">
          <span>Acesso exclusivo</span>
          <span className="h-1 w-1 rounded-full bg-white/30" />
          <span>Convites ORYA</span>
        </div>
        <p className="mt-2 text-base font-semibold text-white">Este evento é apenas por convite.</p>
        <p className="text-[12px] text-white/65">
          Só convidados podem ver o checkout. Valida o teu convite para desbloquear o acesso.
        </p>
      </div>

      <div className="rounded-2xl border border-white/12 bg-black/50 px-4 py-4 text-sm text-white/80">
        <label className="text-[11px] uppercase tracking-[0.18em] text-white/60">
          Tenho convite
        </label>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="Email do convite ou @username"
            className="w-full rounded-md border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-white/60"
          />
          <button
            type="button"
            onClick={handleCheck}
            disabled={loading}
            className="rounded-full border border-white/20 px-4 py-2 text-[12px] font-semibold text-white hover:bg-white/10 disabled:opacity-60"
          >
            {loading ? "A validar…" : "Validar"}
          </button>
        </div>
        {error && <p className="mt-2 text-[12px] font-semibold text-amber-100">{error}</p>}

        {gateMessage && <p className="mt-2 text-[12px] text-amber-100">{gateMessage}</p>}
        {!validated && !error && (
          <p className="mt-2 text-[12px] text-white/60">
            {isAuthenticated
              ? "Se não tiveres convite, não consegues continuar."
              : "Sem convite válido não consegues aceder ao evento."}
          </p>
        )}
      </div>

      {paidInviteMatches && (
        <WavesSectionClient
          slug={slug}
          tickets={uiTickets}
          checkoutUiVariant={checkoutUiVariant}
          padelMeta={padelMeta}
          inviteEmail={inviteType === "email" ? inviteNormalized ?? undefined : undefined}
        />
      )}

      {freeInviteMatches && (
        <WavesSectionClient
          slug={slug}
          tickets={uiTickets}
          isFreeEvent
          checkoutUiVariant={checkoutUiVariant}
          padelMeta={padelMeta}
        />
      )}

      {!validated && identifier.trim() && EMAIL_REGEX.test(identifier.trim()) && !isFree && (
        <div className="rounded-xl border border-white/12 bg-black/50 px-3.5 py-2.5 text-[11px] text-white/65">
          Usa o mesmo email na tua conta para desbloquear o convite.
        </div>
      )}
    </div>
  );
}
