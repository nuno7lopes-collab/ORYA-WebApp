"use client";
export const dynamic = "force-dynamic";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";

type TicketTypeLite = { id: number; name: string; price: number; currency: string };
type PadelEventSummary = {
  eventId: number;
  title: string;
  status: string;
  startsAt: string | null;
  endsAt: string | null;
  clubName: string | null;
  clubCity: string | null;
  partnerClubs?: Array<{ id: number; name: string | null; city: string | null }>;
  courts?: Array<{ name: string; clubName: string | null; indoor?: boolean | null }>;
  timeline?: Array<{ key: string; label: string; state: "done" | "active" | "pending"; cancelled?: boolean; date: string | null }>;
};

function formatDay(dateIso?: string | null) {
  if (!dateIso) return "Data a anunciar";
  const date = new Date(dateIso);
  return new Intl.DateTimeFormat("pt-PT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(date);
}

function formatPrice(cents: number, currency: string) {
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: currency || "EUR",
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

function PadelCheckoutContent() {
  const params = useSearchParams();
  const token = params.get("token");
  const pairingIdParam = params.get("pairingId");
  const pairingId = pairingIdParam ? Number(pairingIdParam) : null;
  const modeParam = params.get("mode"); // "full" => capitão pagou dupla inteira

  const [ticketTypes, setTicketTypes] = useState<TicketTypeLite[]>([]);
  const [ticketTypeId, setTicketTypeId] = useState<number | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resolvedPairingId, setResolvedPairingId] = useState<number | null>(pairingId);
  const [pairingMode, setPairingMode] = useState<"FULL" | "SPLIT" | null>(null);
  const [organizerId, setOrganizerId] = useState<number | null>(null);
  const [padelEvent, setPadelEvent] = useState<PadelEventSummary | null>(null);

  const [playerName, setPlayerName] = useState("");
  const [playerLevel, setPlayerLevel] = useState("");
  const [playerSide, setPlayerSide] = useState("QUALQUER");
  const [playerClub, setPlayerClub] = useState("");

  const stripePromise = useMemo(() => {
    const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    return key ? loadStripe(key) : null;
  }, []);

  const selectedTicket = ticketTypes.find((t) => t.id === ticketTypeId) ?? null;
  const quantity = pairingMode === "FULL" || modeParam === "full" ? 2 : 1;
  // subtotal calculado apenas para exibir (imediato no UI)

  useEffect(() => {
    async function fetchPreview() {
      if (!token && !pairingId) return;
      setLoading(true);
      setError(null);
      try {
        // Se tivermos token de convite, usar endpoint de claim preview
        if (token) {
          const res = await fetch(`/api/padel/pairings/claim/${token}`, { method: "GET" });
          const json = await res.json();
          if (!res.ok || !json?.ok) {
            throw new Error(json?.error || "Erro a carregar convite");
          }
          setResolvedPairingId(json.pairing?.id ?? null);
          setOrganizerId(json.organizerId ?? null);
          setPairingMode(json.pairing?.paymentMode ?? null);
          setTicketTypes(json.ticketTypes ?? []);
          setPadelEvent(json.padelEvent ?? null);
          if (json.ticketTypes?.[0]) setTicketTypeId(json.ticketTypes[0].id);
        } else if (pairingId) {
          const res = await fetch(`/api/padel/pairings?id=${pairingId}`);
          const json = await res.json();
          if (!res.ok || !json?.ok) {
            throw new Error(json?.error || "Erro a carregar pairing");
          }
          setResolvedPairingId(pairingId);
          setOrganizerId(json.pairing?.organizerId ?? null);
          setPairingMode(json.pairing?.paymentMode ?? null);
          setTicketTypes(json.ticketTypes ?? []);
          setPadelEvent(json.padelEvent ?? null);
          if (json.ticketTypes?.[0]) setTicketTypeId(json.ticketTypes[0].id);
        }
      } catch (err) {
        console.error("[PadelCheckout] preview error", err);
        setError(err instanceof Error ? err.message : "Erro ao carregar");
      } finally {
        setLoading(false);
      }
    }
    fetchPreview();
  }, [token, pairingId]);

  useEffect(() => {
    async function createIntent() {
      if (!ticketTypeId || (!token && !resolvedPairingId)) return;
      if (organizerId) {
        try {
          const nameToUse = playerName.trim() || "Jogador Padel";
          await fetch("/api/padel/players", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              organizerId,
              fullName: nameToUse,
              displayName: nameToUse,
              level: playerLevel || undefined,
              preferredSide: playerSide || undefined,
              clubName: playerClub || undefined,
            }),
          });
        } catch (err) {
          console.warn("[PadelCheckout] player profile save falhou", err);
        }
      }
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/padel/pairings/${resolvedPairingId ?? ""}/checkout`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ticketTypeId,
            inviteToken: token ?? undefined,
          }),
        });
        const json = await res.json();
        if (!res.ok || !json?.ok || !json?.clientSecret) {
          throw new Error(json?.error || "Erro ao criar pagamento");
        }
        setClientSecret(json.clientSecret);
      } catch (err) {
        console.error("[PadelCheckout] intent error", err);
        setError(err instanceof Error ? err.message : "Erro ao criar pagamento");
      } finally {
        setLoading(false);
      }
    }
    createIntent();
  }, [ticketTypeId, token, resolvedPairingId, organizerId, playerName, playerLevel, playerSide, playerClub]);

  if (!stripePromise) {
    return <div className="p-6 text-white">Configuração Stripe em falta.</div>;
  }

  return (
    <div className="min-h-screen orya-body-bg text-white px-4 py-10 flex justify-center">
      <div className="w-full max-w-xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Pagamento Padel</h1>
          <p className="text-white/70 text-sm">Completa o pagamento do teu lugar ou dupla.</p>
        </div>

        {padelEvent && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/60">Torneio</p>
                <h2 className="text-lg font-semibold text-white">{padelEvent.title}</h2>
                <p className="text-sm text-white/70">
                  {padelEvent.clubName || "Clube a anunciar"} · {padelEvent.clubCity || "Cidade em breve"}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[12px] text-white/60">Estado</p>
                <p className="text-sm font-semibold text-white">{padelEvent.status}</p>
                <p className="text-[12px] text-white/70">{formatDay(padelEvent.startsAt)}</p>
              </div>
            </div>

            {padelEvent.timeline && (
              <div className="flex flex-wrap gap-3">
                {padelEvent.timeline.map((t) => (
                  <div
                    key={t.key}
                    className={`flex-1 min-w-[120px] rounded-xl border px-3 py-2 text-[12px] ${
                      t.state === "done"
                        ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-50"
                        : t.state === "active"
                          ? "border-[#6BFFFF]/60 bg-[#0b1224] text-white"
                          : "border-white/15 bg-white/5 text-white/70"
                    }`}
                  >
                    <p className="font-semibold text-sm">{t.label}</p>
                    <p className="text-[11px] opacity-80">{t.cancelled ? "Cancelado" : formatDay(t.date)}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="grid gap-2 md:grid-cols-2">
              <div className="rounded-xl border border-white/10 bg-black/30 p-3 space-y-1">
                <p className="text-[11px] uppercase tracking-[0.12em] text-white/60">Clubes</p>
                <p className="text-sm text-white/80">
                  Principal: <span className="font-semibold text-white">{padelEvent.clubName || "A anunciar"}</span>
                </p>
                <p className="text-[12px] text-white/65">
                  Parceiros:{" "}
                  {padelEvent.partnerClubs && padelEvent.partnerClubs.length > 0
                    ? padelEvent.partnerClubs.map((c) => c.name || `Clube ${c.id}`).join(" · ")
                    : "—"}
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/30 p-3 space-y-1">
                <p className="text-[11px] uppercase tracking-[0.12em] text-white/60">Courts</p>
                {padelEvent.courts && padelEvent.courts.length > 0 ? (
                  <div className="flex flex-wrap gap-2 text-[12px] text-white/80">
                    {padelEvent.courts.map((c, idx) => (
                      <span key={`${c.name}-${idx}`} className="rounded-full border border-white/15 bg-white/10 px-2 py-1">
                        {c.name} {c.clubName ? `· ${c.clubName}` : ""} {c.indoor ? "· Indoor" : ""}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-[12px] text-white/65">Courts a definir.</p>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Perfil de jogador</p>
            <span className="text-[11px] text-white/60">Guardamos para futuros torneios</span>
          </div>
          <label className="space-y-1 text-sm text-white/80">
            Nome a mostrar
            <input
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              className="w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none"
              placeholder="Ex.: João Silva"
            />
          </label>
          <div className="grid gap-2 md:grid-cols-3">
            <label className="space-y-1 text-sm text-white/80">
              Nível
              <input
                value={playerLevel}
                onChange={(e) => setPlayerLevel(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none"
                placeholder="Ex.: 4/5"
              />
            </label>
            <label className="space-y-1 text-sm text-white/80">
              Lado preferido
              <select
                value={playerSide}
                onChange={(e) => setPlayerSide(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none"
              >
                <option value="QUALQUER">Qualquer</option>
                <option value="ESQUERDA">Esquerda</option>
                <option value="DIREITA">Direita</option>
              </select>
            </label>
            <label className="space-y-1 text-sm text-white/80">
              Clube (opcional)
              <input
                value={playerClub}
                onChange={(e) => setPlayerClub(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none"
                placeholder="Ex.: Clube XPTO"
              />
            </label>
          </div>
        </div>

        {error && <p className="rounded-xl border border-red-400/40 bg-red-900/30 p-3 text-sm text-red-100">{error}</p>}

        {selectedTicket && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-2">
            <p className="text-sm font-semibold">Resumo</p>
            <div className="flex justify-between text-sm">
              <span>{selectedTicket.name} × {quantity}</span>
              <span>{formatPrice(selectedTicket.price * quantity, selectedTicket.currency)}</span>
            </div>
            <div className="flex justify-between text-sm text-white/70">
              <span>Taxas de serviço</span>
              <span>Incluídas no preço</span>
            </div>
            <div className="flex justify-between text-base font-semibold pt-1 border-t border-white/10">
              <span>Total</span>
              <span>{formatPrice(selectedTicket.price * quantity, selectedTicket.currency)}</span>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <label className="text-sm text-white/70">Bilhete</label>
          <select
            value={ticketTypeId ?? ""}
            onChange={(e) => setTicketTypeId(e.target.value ? Number(e.target.value) : null)}
            className="w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-white"
            disabled={loading}
          >
            {ticketTypes.map((tt) => (
              <option key={tt.id} value={tt.id}>
                {tt.name} — {formatPrice(tt.price, tt.currency)}
              </option>
            ))}
          </select>
        </div>

        {clientSecret ? (
          <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: "night" } }}>
            <PaymentForm />
          </Elements>
        ) : (
          <p className="text-sm text-white/60">A preparar checkout…</p>
        )}
      </div>
    </div>
  );
}

export default function PadelCheckoutPage() {
  return (
    <Suspense fallback={<div className="min-h-screen orya-body-bg text-white p-6">A carregar checkout…</div>}>
      <PadelCheckoutContent />
    </Suspense>
  );
}

function PaymentForm() {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {},
      redirect: "if_required",
    });
    if (error) {
      alert(error.message || "Pagamento falhou");
      setSubmitting(false);
      return;
    }
    alert("Pagamento concluído");
    router.replace("/organizador?tab=overview");
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      <button
        type="submit"
        disabled={submitting || !stripe}
        className="w-full rounded-full bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] px-4 py-2 font-semibold text-black shadow hover:brightness-110 disabled:opacity-60"
      >
        {submitting ? "A processar..." : "Pagar"}
      </button>
    </form>
  );
}
