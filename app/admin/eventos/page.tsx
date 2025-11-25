

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type AdminEventItem = {
  id: number;
  title: string;
  slug: string;
  status: string;
  type: string;
  startsAt: string | null;
  organizerName?: string | null;
};

type EventsApiResponse =
  | {
      ok: true;
      events: AdminEventItem[];
    }
  | {
      ok: false;
      error?: string;
    };

export default function AdminEventosPage() {
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [events, setEvents] = useState<AdminEventItem[]>([]);
  const [initialized, setInitialized] = useState(false);

  async function loadEvents(params?: { search?: string }) {
    try {
      setLoading(true);
      setErrorMsg(null);

      const searchParam = params?.search?.trim();
      const qs = searchParam ? `?search=${encodeURIComponent(searchParam)}` : "";

      const res = await fetch(`/api/admin/eventos/list${qs}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        cache: "no-store",
      });

      if (res.status === 401 || res.status === 403) {
        setErrorMsg("Não tens permissões para ver esta área (admin only).");
        setEvents([]);
        return;
      }

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        console.error("[admin/eventos] Erro ao carregar:", res.status, text);
        setErrorMsg(
          "Não foi possível carregar os eventos. Tenta novamente dentro de instantes."
        );
        setEvents([]);
        return;
      }

      const json = (await res.json().catch(() => null)) as EventsApiResponse | null;

      if (!json || !json.ok) {
        console.error("[admin/eventos] Resposta inesperada:", json);
        setErrorMsg(
          json?.error ||
            "Resposta inesperada ao tentar carregar a lista de eventos."
        );
        setEvents([]);
        return;
      }

      setEvents(Array.isArray(json.events) ? json.events : []);
      setInitialized(true);
    } catch (err) {
      console.error("[admin/eventos] Erro inesperado:", err);
      setErrorMsg(
        "Ocorreu um erro inesperado ao carregar os eventos. Tenta novamente dentro de instantes."
      );
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadEvents();
     
  }, []);

  function formatDate(dateStr: string | null) {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return "-";
    return new Intl.DateTimeFormat("pt-PT", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  }

  function formatStatus(status: string) {
    switch (status) {
      case "DRAFT":
        return "Rascunho";
      case "PUBLISHED":
        return "Publicado";
      case "CANCELLED":
        return "Cancelado";
      default:
        return status;
    }
  }

  function statusClasses(status: string) {
    switch (status) {
      case "PUBLISHED":
        return "bg-emerald-500/10 text-emerald-200 border-emerald-400/40";
      case "DRAFT":
        return "bg-amber-500/10 text-amber-100 border-amber-400/40";
      case "CANCELLED":
        return "bg-red-500/10 text-red-100 border-red-400/40";
      default:
        return "bg-white/5 text-white/80 border-white/20";
    }
  }

  const isEmpty = initialized && !loading && events.length === 0 && !errorMsg;

  return (
    <main className="min-h-screen w-full bg-black text-white pb-16">
      {/* Top bar */}
      <header className="border-b border-white/10 bg-black/60 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] text-xs font-extrabold tracking-[0.15em]">
              AD
            </span>
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-white/60">
                Admin · ORYA
              </p>
              <p className="text-sm text-white/85">Gestão global de eventos</p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-[11px]">
            <Link
              href="/admin"
              className="rounded-full border border-white/20 px-3 py-1.5 text-white/75 hover:bg-white/10 transition-colors"
            >
              Dashboard
            </Link>
            <Link
              href="/"
              className="rounded-full border border-white/20 px-3 py-1.5 text-white/75 hover:bg-white/10 transition-colors"
            >
              Ver site
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-5 pt-8 space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
              Eventos
            </h1>
            <p className="mt-1 max-w-xl text-sm text-white/70">
              Lista de todos os eventos publicados na plataforma, com acesso
              rápido ao organizador, datas e estado.
            </p>
          </div>

          <div className="flex flex-col items-stretch gap-2 text-[11px] sm:flex-row sm:items-center">
            <div className="flex items-center gap-2 rounded-full border border-white/18 bg-white/5 px-3 py-1.5">
              <span className="text-xs text-white/60">Pesquisar</span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    loadEvents({ search });
                  }
                }}
                placeholder="Nome, slug ou organizador"
                className="w-full bg-transparent text-xs text-white placeholder:text-white/35 focus:outline-none"
              />
            </div>
            <button
              type="button"
              onClick={() => loadEvents({ search })}
              disabled={loading}
              className="rounded-full bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] px-4 py-1.5 text-xs font-semibold text-black shadow-[0_0_18px_rgba(107,255,255,0.6)] hover:scale-[1.02] active:scale-95 transition-transform disabled:opacity-60 disabled:hover:scale-100"
            >
              {loading ? "A carregar..." : "Aplicar filtro"}
            </button>
          </div>
        </div>

        {errorMsg && (
          <div className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-xs text-red-100">
            {errorMsg}
          </div>
        )}

        {!errorMsg && isEmpty && (
          <div className="mt-6 rounded-2xl border border-dashed border-white/20 bg-white/5 px-6 py-8 text-center text-sm text-white/70">
            <p className="font-medium text-white">
              Ainda não existem eventos registados na plataforma.
            </p>
            <p className="mt-1 text-xs text-white/70">
              Assim que os organizadores começarem a criar eventos, eles vão
              aparecer aqui.
            </p>
          </div>
        )}

        {!errorMsg && !isEmpty && (
          <div className="mt-4 overflow-hidden rounded-2xl border border-white/15 bg-white/5">
            <div className="max-h-[70vh] overflow-auto">
              <table className="min-w-full border-separate border-spacing-0 text-left text-[11px]">
                <thead className="bg-white/5 text-white/60">
                  <tr>
                    <th className="sticky top-0 z-10 border-b border-white/10 px-4 py-3 font-medium">
                      Evento
                    </th>
                    <th className="sticky top-0 z-10 border-b border-white/10 px-4 py-3 font-medium">
                      Organizador
                    </th>
                    <th className="sticky top-0 z-10 border-b border-white/10 px-4 py-3 font-medium">
                      Data
                    </th>
                    <th className="sticky top-0 z-10 border-b border-white/10 px-4 py-3 font-medium">
                      Tipo
                    </th>
                    <th className="sticky top-0 z-10 border-b border-white/10 px-4 py-3 font-medium">
                      Estado
                    </th>
                    <th className="sticky top-0 z-10 border-b border-white/10 px-4 py-3 text-right font-medium">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((ev) => (
                    <tr
                      key={ev.id}
                      className="border-b border-white/8 odd:bg-black/40 even:bg-black/20"
                    >
                      <td className="px-4 py-3 align-middle">
                        <div className="flex flex-col">
                          <span className="text-[11px] font-semibold text-white">
                            {ev.title || "Evento sem título"}
                          </span>
                          {ev.slug && (
                            <span className="text-[10px] text-white/45">
                              /eventos/{ev.slug}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 align-middle text-white/80">
                        {ev.organizerName || "-"}
                      </td>
                      <td className="px-4 py-3 align-middle text-white/80">
                        {formatDate(ev.startsAt)}
                      </td>
                      <td className="px-4 py-3 align-middle text-white/80">
                        {ev.type || "-"}
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-[2px] text-[10px] font-medium ${statusClasses(
                            ev.status
                          )}`}
                        >
                          {formatStatus(ev.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-middle text-right">
                        <div className="flex flex-wrap justify-end gap-2">
                          {ev.slug && (
                            <button
                              type="button"
                              onClick={() => router.push(`/eventos/${ev.slug}`)}
                              className="rounded-full border border-white/20 px-3 py-1 text-[10px] text-white/80 hover:bg-white/10 transition-colors"
                            >
                              Ver público
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}