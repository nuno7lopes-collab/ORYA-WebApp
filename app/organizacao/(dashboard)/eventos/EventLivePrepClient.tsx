"use client";

import { useState } from "react";
import { CTA_PRIMARY } from "@/app/organizacao/dashboardUi";

type LiveVisibility = "PUBLIC" | "PRIVATE" | "DISABLED";

type EventLivePrepClientProps = {
  event: {
    id: number;
    slug: string;
    title: string;
    liveVisibility: LiveVisibility;
    liveStreamUrl: string | null;
  };
  tournamentId?: number | null;
};

export default function EventLivePrepClient({
  event,
  tournamentId,
}: EventLivePrepClientProps) {
  const [currentTournamentId, setCurrentTournamentId] = useState<number | null>(tournamentId ?? null);

  const [liveVisibility, setLiveVisibility] = useState<LiveVisibility>(
    event.liveVisibility ?? "PUBLIC",
  );
  const [liveStreamUrl, setLiveStreamUrl] = useState(event.liveStreamUrl ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [creatingTournament, setCreatingTournament] = useState(false);
  const [tournamentMessage, setTournamentMessage] = useState<string | null>(null);
  const [bracketSize, setBracketSize] = useState(16);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/organizacao/events/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: event.id,
          liveVisibility,
          liveStreamUrl: liveStreamUrl.trim() || null,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setMessage(json?.error || "Erro ao guardar Live.");
        return;
      }
      setMessage("Live atualizado.");
    } catch {
      setMessage("Erro inesperado ao guardar Live.");
    } finally {
      setSaving(false);
    }
  };

  const handleCreateTournament = async () => {
    setCreatingTournament(true);
    setTournamentMessage(null);
    try {
      const res = await fetch("/api/organizacao/tournaments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: event.id, bracketSize }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setTournamentMessage(json?.error || "Erro ao criar torneio.");
        return;
      }
      setCurrentTournamentId(json.tournamentId);
      setTournamentMessage("Torneio criado.");
    } catch {
      setTournamentMessage("Erro inesperado ao criar torneio.");
    } finally {
      setCreatingTournament(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1226]/75 to-[#050912]/90 p-5 space-y-4 shadow-[0_26px_90px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
        <div className="space-y-1">
          <p className="text-[11px] uppercase tracking-[0.24em] text-white/60">Live</p>
          <p className="text-sm text-white/70">Define visibilidade e livestream.</p>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <label className="text-sm font-medium">Visibilidade</label>
            <select
              value={liveVisibility}
              onChange={(e) => setLiveVisibility(e.target.value as LiveVisibility)}
              className="w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-white/60"
            >
              <option value="PUBLIC">Público</option>
              <option value="PRIVATE">Privado (só participantes)</option>
              <option value="DISABLED">Desativado</option>
            </select>
            <p className="text-[11px] text-white/55">
              Público = visível. Privado = participantes. Desativado = oculto.
            </p>
          </div>

          <div className="space-y-1 md:col-span-2">
            <label className="text-sm font-medium">URL da livestream</label>
            <input
              value={liveStreamUrl}
              onChange={(e) => setLiveStreamUrl(e.target.value)}
              placeholder="https://youtu.be/..."
              className="w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-white/60"
            />
            <p className="text-[11px] text-white/55">
              Vazio = sem vídeo.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className={`${CTA_PRIMARY} disabled:opacity-60`}
          >
            {saving ? "A guardar…" : "Guardar"}
          </button>
          {message && <span className="text-[12px] text-white/70">{message}</span>}
        </div>
      </section>

      <section className="rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1226]/75 to-[#050912]/90 p-5 space-y-4 shadow-[0_26px_90px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
        <div className="space-y-1">
          <p className="text-[11px] uppercase tracking-[0.24em] text-white/60">Torneio</p>
          <p className="text-sm text-white/70">Cria a bracket quando quiseres.</p>
        </div>

        {!currentTournamentId ? (
          <div className="grid gap-3 md:grid-cols-[240px_1fr] md:items-end">
            <div className="space-y-1">
              <label className="text-sm font-medium">Tamanho da bracket</label>
              <select
                value={bracketSize}
                onChange={(e) => setBracketSize(Number(e.target.value))}
                className="w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-white/60"
              >
                {[2, 4, 8, 16, 32, 64].map((size) => (
                  <option key={size} value={size}>
                    {size} jogadores
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleCreateTournament}
                disabled={creatingTournament}
                className={`${CTA_PRIMARY} disabled:opacity-60`}
              >
                {creatingTournament ? "A criar…" : "Criar torneio KO"}
              </button>
              {tournamentMessage && <span className="text-[12px] text-white/70">{tournamentMessage}</span>}
            </div>
          </div>
        ) : (
          <p className="text-[12px] text-white/60">
            Torneio pronto. Gere participantes e jogos no separador Bracket.
          </p>
        )}
      </section>
    </div>
  );
}
