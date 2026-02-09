"use client";

import Link from "next/link";
import useSWR from "swr";
import { useMemo, useState } from "react";
import { useUser } from "@/app/hooks/useUser";
import { Avatar } from "@/components/ui/avatar";

type AgendaItem = {
  id: string;
  type: "EVENTO" | "JOGO" | "INSCRICAO" | "RESERVA";
  title: string;
  startAt: string;
  endAt: string | null;
  label?: string | null;
  ctaHref?: string | null;
  ctaLabel?: string | null;
};

type AgendaResponse = { ok: boolean; items?: AgendaItem[]; error?: string };
type FollowResponse = {
  ok: boolean;
  items?: Array<{ userId: string; username: string | null; fullName: string | null; avatarUrl: string | null }>;
};

type PlansTab = "EVENTOS" | "RESERVAS";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function formatAgendaDate(value?: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleString("pt-PT", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCountdown(value?: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  const diffMs = parsed.getTime() - Date.now();
  if (diffMs <= 0) return "A acontecer";
  const diffMin = Math.ceil(diffMs / 60000);
  if (diffMin < 60) return `Começa em ${diffMin} min`;
  const diffHours = Math.ceil(diffMin / 60);
  if (diffHours < 24) return `Começa em ${diffHours}h`;
  const diffDays = Math.ceil(diffHours / 24);
  return `Começa em ${diffDays}d`;
}

function formatPersonLabel(item: { fullName: string | null; username: string | null }) {
  return item.fullName || (item.username ? `@${item.username}` : "Utilizador ORYA");
}

export default function HomePersonalized() {
  const { user, isLoggedIn } = useUser();
  const [activeTab, setActiveTab] = useState<PlansTab>("EVENTOS");
  const { startIso, endIso } = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 30);
    end.setHours(23, 59, 59, 999);
    return { startIso: start.toISOString(), endIso: end.toISOString() };
  }, []);

  const agendaUrl = user ? `/api/me/agenda?start=${encodeURIComponent(startIso)}&end=${encodeURIComponent(endIso)}` : null;
  const { data: agendaData } = useSWR<AgendaResponse>(agendaUrl, fetcher);
  const { data: followingData } = useSWR<FollowResponse>(
    user ? `/api/social/following?userId=${user.id}&limit=4` : null,
    fetcher,
  );

  const agendaItems = agendaData?.items ?? [];
  const upcomingEvents = agendaItems.filter((i) => i.type === "EVENTO").slice(0, 3);
  const upcomingBookings = agendaItems.filter((i) => i.type === "RESERVA").slice(0, 3);
  const nextEvent = upcomingEvents[0] ?? null;
  const nextBooking = upcomingBookings[0] ?? null;
  const following = followingData?.items ?? [];

  const panelBase =
    "rounded-3xl border border-white/15 bg-[linear-gradient(150deg,rgba(255,255,255,0.12),rgba(6,10,20,0.92))] p-4 shadow-[0_22px_60px_rgba(0,0,0,0.6)] backdrop-blur-2xl";

  return (
    <aside className="space-y-4">
      {!isLoggedIn && (
        <div className="rounded-2xl border border-white/15 bg-white/5 p-3 text-[12px] text-white/70 shadow-[0_18px_40px_rgba(0,0,0,0.5)] backdrop-blur-2xl">
          <p className="font-semibold text-white/90">Personaliza a tua home</p>
          <p className="mt-1 text-[11px] text-white/60">
            Entra para veres agenda, pessoas que segues e recomendações.
          </p>
          <Link
            href="/login"
            className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-[11px] text-white hover:bg-white/20"
          >
            Entrar
            <span className="text-[10px]">→</span>
          </Link>
        </div>
      )}

      <div className={panelBase}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Os teus planos</p>
            <p className="text-sm text-white/75">Eventos e reservas confirmadas.</p>
          </div>
          <div className="flex rounded-full border border-white/15 bg-black/40 p-1 text-[10px]">
            <button
              type="button"
              onClick={() => setActiveTab("EVENTOS")}
              className={`rounded-full px-3 py-1 font-semibold transition ${
                activeTab === "EVENTOS"
                  ? "bg-white text-black shadow-[0_0_18px_rgba(255,255,255,0.25)]"
                  : "text-white/70 hover:text-white"
              }`}
            >
              Eventos
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("RESERVAS")}
              className={`rounded-full px-3 py-1 font-semibold transition ${
                activeTab === "RESERVAS"
                  ? "bg-white text-black shadow-[0_0_18px_rgba(255,255,255,0.25)]"
                  : "text-white/70 hover:text-white"
              }`}
            >
              Reservas
            </button>
          </div>
        </div>

        {activeTab === "EVENTOS" ? (
          nextEvent ? (
            <div className="mt-4 rounded-2xl border border-white/15 bg-[linear-gradient(160deg,rgba(255,255,255,0.08),rgba(4,8,16,0.9))] p-3">
              <div className="flex items-center gap-3">
                <Avatar
                  name={nextEvent.title}
                  className="h-11 w-11 border border-white/15"
                  textClassName="text-[10px] tracking-[0.16em]"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-white line-clamp-1">{nextEvent.title}</p>
                  {(() => {
                    const dateLabel = formatAgendaDate(nextEvent.startAt);
                    const parts = [dateLabel, nextEvent.label].filter(Boolean);
                    if (parts.length === 0) return null;
                    return <p className="text-[11px] text-white/60">{parts.join(" · ")}</p>;
                  })()}
                </div>
                {formatCountdown(nextEvent.startAt) ? (
                  <p className="text-[10px] text-white/70">{formatCountdown(nextEvent.startAt)}</p>
                ) : null}
              </div>
              <div className="mt-3 flex items-center justify-between">
                <p className="text-[10px] text-white/50">Presenças a confirmar.</p>
                <Link
                  href={nextEvent.ctaHref ?? "/me"}
                  className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[10px] text-white/85 hover:bg-white/20"
                >
                  Ver agenda
                </Link>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-white/12 bg-black/30 px-3 py-4 text-[12px] text-white/60">
              Ainda não tens eventos marcados.
              <Link href="/descobrir/eventos" className="ml-2 text-white/85 hover:text-white">
                Explorar eventos
              </Link>
            </div>
          )
        ) : nextBooking ? (
          <div className="mt-4 rounded-2xl border border-white/15 bg-[linear-gradient(160deg,rgba(255,255,255,0.08),rgba(4,8,16,0.9))] p-3">
            <div className="flex items-center gap-3">
              <Avatar
                name={nextBooking.title}
                className="h-11 w-11 border border-white/15"
                textClassName="text-[10px] tracking-[0.16em]"
              />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold text-white line-clamp-1">{nextBooking.title}</p>
                {(() => {
                  const dateLabel = formatAgendaDate(nextBooking.startAt);
                  const parts = [dateLabel, nextBooking.label].filter(Boolean);
                  if (parts.length === 0) return null;
                  return <p className="text-[11px] text-white/60">{parts.join(" · ")}</p>;
                })()}
              </div>
              {formatCountdown(nextBooking.startAt) ? (
                <p className="text-[10px] text-white/70">{formatCountdown(nextBooking.startAt)}</p>
              ) : null}
            </div>
            <div className="mt-3 flex items-center justify-between">
              <p className="text-[10px] text-white/50">Detalhes da reserva.</p>
              <Link
                href={nextBooking.ctaHref ?? "/me"}
                className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[10px] text-white/85 hover:bg-white/20"
              >
                Ver agenda
              </Link>
            </div>
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-white/12 bg-black/30 px-3 py-4 text-[12px] text-white/60">
            Ainda não tens reservas confirmadas.
            <Link href="/descobrir/reservas" className="ml-2 text-white/85 hover:text-white">
              Explorar reservas
            </Link>
          </div>
        )}
      </div>

      <div className={panelBase}>
        <div className="flex items-center justify-between">
          <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Atividade de quem segues</p>
          <Link href="/social" className="text-[10px] text-white/70 hover:text-white">
            Ver social
          </Link>
        </div>
        {following.length === 0 ? (
          <p className="mt-3 text-[12px] text-white/60">
            Segue pessoas para veres o que estão a planear.
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {following.slice(0, 3).map((person) => (
              <div
                key={person.userId}
                className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/30 px-3 py-2"
              >
                <Avatar
                  src={person.avatarUrl}
                  name={person.fullName ?? person.username ?? "Utilizador"}
                  className="h-9 w-9 border border-white/15"
                  textClassName="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/80"
                />
                <div className="min-w-0">
                  <p className="text-[12px] font-semibold text-white line-clamp-1">
                    {formatPersonLabel(person)}
                  </p>
                  <p className="text-[10px] text-white/60">Atividade a chegar.</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className={panelBase}>
        <div className="flex items-center justify-between">
          <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Ranking de padel</p>
          <span className="text-[10px] text-white/50">Em breve</span>
        </div>
          <div className="mt-3 rounded-2xl border border-white/15 bg-[linear-gradient(160deg,rgba(255,255,255,0.08),rgba(4,8,16,0.9))] p-3">
          <p className="text-[12px] text-white/70">
            Ainda não tens o teu perfil de padel completo para veres o ranking.
          </p>
          <Link
            href="/onboarding/padel"
            className="mt-3 inline-flex items-center rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[10px] text-white/80 hover:bg-white/20"
          >
            Ativa já
          </Link>
        </div>
      </div>
    </aside>
  );
}
