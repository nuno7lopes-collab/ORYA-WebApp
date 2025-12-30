"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { SidebarRail } from "@/components/ui/sidebar";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { cn } from "@/lib/utils";
import { CTA_PRIMARY, CTA_SECONDARY } from "@/app/organizador/dashboardUi";

type EventSidebarData = {
  id: number;
  slug: string;
  title: string;
  status: string;
  startsAt?: string | Date | null;
  endsAt?: string | Date | null;
  locationName?: string | null;
  locationCity?: string | null;
  coverImageUrl?: string | null;
  tournamentId?: number | null;
};

type UserInfo = {
  id: string;
  name?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
};

type Props = {
  event: EventSidebarData;
  user: UserInfo | null;
};

const formatDate = (value?: string | Date | null) => {
  if (!value) return "A definir";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "A definir";
  return date.toLocaleString("pt-PT", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const resolveStatus = (status: string) => {
  const key = status?.toUpperCase?.() ?? "";
  if (key === "CANCELLED") {
    return { label: "Cancelado", tone: "border-red-400/60 bg-red-500/10 text-red-100" };
  }
  if (key === "ARCHIVED") {
    return { label: "Arquivado", tone: "border-amber-400/60 bg-amber-500/10 text-amber-100" };
  }
  if (key === "DRAFT") {
    return { label: "Rascunho", tone: "border-white/20 bg-white/5 text-white/70" };
  }
  if (key === "FINISHED") {
    return { label: "Terminado", tone: "border-purple-400/60 bg-purple-500/10 text-purple-100" };
  }
  return { label: "Publicado", tone: "border-sky-400/60 bg-sky-500/10 text-sky-100" };
};

export function EventSidebar({ event, user }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [userOpen, setUserOpen] = useState(false);

  const status = resolveStatus(event.status);
  const dateLabel = useMemo(
    () => formatDate(event.startsAt) + (event.endsAt ? ` · ${formatDate(event.endsAt)}` : ""),
    [event.endsAt, event.startsAt],
  );
  const locationLabel = event.locationCity || event.locationName || "Local a confirmar";

  const isBase = pathname === `/organizador/eventos/${event.id}`;
  const isEdit = pathname.endsWith("/edit");
  const isLive = pathname.endsWith("/live");
  const isCheckin = pathname.endsWith("/checkin");

  const linkClass = (active: boolean) =>
    cn(
      "flex items-center justify-between rounded-xl px-3 py-2 transition border border-transparent text-sm",
      active
        ? "bg-white/10 text-white font-semibold border-white/20 shadow-[0_10px_40px_rgba(0,0,0,0.35)]"
        : "text-white/75 hover:bg-white/10 hover:text-white",
    );

  const userLabel = user?.name || user?.email || "Utilizador";
  const userInitial = (userLabel || "U").charAt(0).toUpperCase();

  const signOut = async () => {
    try {
      await supabaseBrowser.auth.signOut();
    } catch (err) {
      console.error("Erro no signOut", err);
    } finally {
      router.push("/login");
    }
  };

  return (
    <SidebarRail>
      <div className="px-3">
        <div className="rounded-2xl border border-white/12 bg-white/5 px-3 py-3 text-white/80 backdrop-blur-xl">
          <div className="flex items-start gap-3">
            {event.coverImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={event.coverImageUrl}
                alt={event.title}
                className="h-12 w-12 rounded-xl border border-white/10 object-cover"
              />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-xs font-semibold text-white/70">
                {event.title?.[0] ?? "E"}
              </div>
            )}
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/50">Evento</p>
              <p className="truncate text-sm font-semibold text-white">{event.title}</p>
              <p className="text-[11px] text-white/60">{dateLabel}</p>
              <p className="text-[11px] text-white/45">{locationLabel}</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
            <span className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-1", status.tone)}>
              {status.label}
            </span>
            {event.tournamentId && (
              <span className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-white/70">
                Live Ops
              </span>
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
            <Link
              href={`/organizador/eventos/${event.id}/live`}
              className={cn(CTA_PRIMARY, "px-3 py-1", isLive && "ring-2 ring-white/30")}
            >
              Preparar Live
            </Link>
            <Link
              href={`/organizador/eventos/${event.id}/edit`}
              className={cn(CTA_SECONDARY, "px-3 py-1", isEdit && "ring-2 ring-white/25")}
            >
              Editar evento
            </Link>
            <Link
              href={`/eventos/${event.slug}`}
              className={cn(CTA_SECONDARY, "px-3 py-1")}
            >
              Página pública
            </Link>
          </div>
        </div>
      </div>

      <nav className="mt-6 flex-1 space-y-3 px-3 text-sm">
        <p className="px-2 text-[10px] uppercase tracking-[0.24em] text-white/45">Gerir evento</p>
        <Link href={`/organizador/eventos/${event.id}#resumo`} className={linkClass(isBase)}>
          <span>Resumo</span>
        </Link>
        <Link href={`/organizador/eventos/${event.id}#bilhetes`} className={linkClass(false)}>
          <span>Bilhetes</span>
        </Link>
        <Link href={`/organizador/eventos/${event.id}/checkin`} className={linkClass(isCheckin)}>
          <span>Check-in</span>
        </Link>
        <Link href={`/organizador/eventos/${event.id}/live`} className={linkClass(isLive)}>
          <span>Live</span>
        </Link>
        {event.tournamentId ? (
          <Link
            href={`/organizador/eventos/${event.id}/live?tab=preview&edit=1`}
            className={linkClass(false)}
          >
            <span>Live Ops</span>
          </Link>
        ) : null}
        <Link
          href={`/organizador?tab=analyze&section=vendas&eventId=${event.id}`}
          className={linkClass(false)}
        >
          <span>Vendas</span>
        </Link>

        <div className="pt-2">
          <Link href="/organizador" className={linkClass(false)}>
            <span>← Voltar a eventos</span>
          </Link>
        </div>
      </nav>

      <div className="space-y-2 px-3 pb-4 pt-3">
        <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 backdrop-blur-xl">
          <button
            type="button"
            onClick={() => setUserOpen((v) => !v)}
            aria-expanded={userOpen}
            className="flex w-full cursor-pointer items-center justify-between gap-2"
          >
            <div className="flex items-center gap-2">
              {user?.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.avatarUrl} alt={userLabel} className="h-8 w-8 rounded-lg border border-white/10 object-cover" />
              ) : (
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-[11px] font-semibold">
                  {userInitial}
                </span>
              )}
              <div className="text-left">
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/50">Utilizador</p>
                <p className="text-sm font-semibold text-white">{userLabel}</p>
              </div>
            </div>
            <span className={cn("text-white/60 transition-transform", userOpen ? "rotate-180" : "")}>▾</span>
          </button>
          {userOpen && (
            <div className="mt-2 space-y-1">
              <Link
                href="/me/settings"
                className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm text-white transition hover:bg-white/10"
                onClick={() => setUserOpen(false)}
              >
                <span>Settings</span>
                <span className="text-[10px] text-white/60">↗</span>
              </Link>
              <button
                type="button"
                onClick={signOut}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm text-rose-100 transition hover:bg-rose-500/15"
              >
                <span>Terminar sessão</span>
                <span className="text-[10px] text-rose-200">×</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </SidebarRail>
  );
}
