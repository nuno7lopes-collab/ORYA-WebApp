"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import ObjectiveSubnav from "@/app/organizador/ObjectiveSubnav";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const CATEGORY_LABELS: Record<string, string> = {
  TODAY: "Hoje",
  CHANGES: "Alterações",
  RESULTS: "Resultados",
  CALL_UPS: "Convocatórias",
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Rascunho",
  PUBLISHED: "Publicado",
  ARCHIVED: "Arquivado",
};

type UpdateItem = {
  id: number;
  title: string;
  body: string | null;
  category: string;
  status: string;
  isPinned: boolean;
  event: { id: number; title: string } | null;
  publishedAt: string | null;
  createdAt: string;
};

type UpdatesPageProps = {
  embedded?: boolean;
};

export default function UpdatesPage({ embedded }: UpdatesPageProps) {
  const { data, mutate, isLoading } = useSWR<{ ok: boolean; items: UpdateItem[] }>(
    "/api/organizador/updates",
    fetcher,
  );
  const { data: eventsData } = useSWR<{ ok: boolean; items: { id: number; title: string }[] }>(
    "/api/organizador/events/list?limit=80",
    fetcher,
  );

  const updates = data?.items ?? [];
  const events = eventsData?.items ?? [];

  const [editingId, setEditingId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState("TODAY");
  const [status, setStatus] = useState("DRAFT");
  const [isPinned, setIsPinned] = useState(false);
  const [eventId, setEventId] = useState<number | "">("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const resetForm = () => {
    setEditingId(null);
    setTitle("");
    setBody("");
    setCategory("TODAY");
    setStatus("DRAFT");
    setIsPinned(false);
    setEventId("");
  };

  const handleEdit = (update: UpdateItem) => {
    setEditingId(update.id);
    setTitle(update.title);
    setBody(update.body ?? "");
    setCategory(update.category);
    setStatus(update.status);
    setIsPinned(update.isPinned);
    setEventId(update.event?.id ?? "");
  };

  const handleSave = async () => {
    setError(null);
    setSuccess(null);
    if (!title.trim()) {
      setError("Indica um título curto para o update.");
      return;
    }

    setSaving(true);
    const payload = {
      title: title.trim(),
      body: body.trim(),
      category,
      status,
      isPinned,
      eventId: eventId === "" ? null : eventId,
    };

    try {
      const res = await fetch(
        editingId ? `/api/organizador/updates/${editingId}` : "/api/organizador/updates",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        setError(json?.error || "Erro ao guardar update.");
        setSaving(false);
        return;
      }
      setSuccess(editingId ? "Update atualizado." : "Update criado.");
      resetForm();
      mutate();
    } catch (err) {
      console.error("[updates][save]", err);
      setError("Erro inesperado ao guardar.");
    } finally {
      setSaving(false);
    }
  };

  const togglePin = async (update: UpdateItem) => {
    await fetch(`/api/organizador/updates/${update.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPinned: !update.isPinned }),
    });
    mutate();
  };

  const archiveUpdate = async (update: UpdateItem) => {
    await fetch(`/api/organizador/updates/${update.id}`, {
      method: "DELETE",
    });
    mutate();
  };

  const publishQuick = async (update: UpdateItem) => {
    await fetch(`/api/organizador/updates/${update.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "PUBLISHED" }),
    });
    mutate();
  };

  const formattedUpdates = useMemo(() => {
    return updates.map((update) => {
      const date = update.publishedAt || update.createdAt;
      const dateLabel = date
        ? new Date(date).toLocaleString("pt-PT", {
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          })
        : "A definir";
      return { ...update, dateLabel };
    });
  }, [updates]);

  return (
    <main className="relative w-full overflow-hidden text-white">

      <section
        className={
          embedded ? "relative flex flex-col gap-6" : "relative w-full flex flex-col gap-6 px-4 py-8 md:px-6 lg:px-8"
        }
      >
        {!embedded && <ObjectiveSubnav objective="promote" activeId="updates" />}
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1124]/70 to-[#050810]/90 px-6 py-5 shadow-[0_24px_60px_rgba(0,0,0,0.65)] backdrop-blur-2xl">
          <div>
            <p className="text-[11px] uppercase tracking-[0.3em] text-white/60">Canal oficial</p>
            <h1 className="text-2xl font-semibold">Atualizações da organização</h1>
            <p className="text-sm text-white/65">
              Comunicados curtos, objetivos e sempre com estado claro.
            </p>
          </div>
        </header>

        <section className="rounded-3xl border border-white/12 bg-white/5 p-5 shadow-[0_24px_60px_rgba(0,0,0,0.65)] backdrop-blur-2xl">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">{editingId ? "Editar update" : "Novo update"}</h2>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="text-[12px] text-white/60 hover:text-white"
              >
                Cancelar edição
              </button>
            )}
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-[12px] text-white/70">Título</label>
              <input
                className="w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Alteração de horários"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[12px] text-white/70">Categoria</label>
              <select
                className="w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[12px] text-white/70">Estado</label>
              <select
                className="w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                {Object.entries(STATUS_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[12px] text-white/70">Evento (opcional)</label>
              <select
                className="w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]"
                value={eventId}
                onChange={(e) => setEventId(e.target.value ? Number(e.target.value) : "")}
              >
                <option value="">Sem evento</option>
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <label className="text-[12px] text-white/70">Mensagem</label>
            <textarea
              className="w-full min-h-[120px] rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Mensagem curta, direta e objetiva."
            />
          </div>

          <label className="mt-4 flex items-center gap-2 text-sm text-white/80">
            <input
              type="checkbox"
              checked={isPinned}
              onChange={(e) => setIsPinned(e.target.checked)}
              className="h-4 w-4 rounded border-white/30 bg-black/40 text-[#6BFFFF]"
            />
            Fixar no topo
          </label>

          {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
          {success && <p className="mt-3 text-sm text-emerald-300">{success}</p>}

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="mt-4 w-full rounded-full bg-white px-4 py-2 text-sm font-semibold text-black transition hover:scale-[1.01] disabled:opacity-60"
          >
            {saving ? "A guardar..." : editingId ? "Guardar alterações" : "Publicar update"}
          </button>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Atualizações recentes</h2>
            <span className="text-[12px] text-white/60">{updates.length} total</span>
          </div>

          {isLoading && (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
              A carregar atualizações…
            </div>
          )}

          {!isLoading && formattedUpdates.length === 0 && (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-white/70">
              Ainda não publicaste nenhuma atualização.
            </div>
          )}

          <div className="grid gap-3">
            {formattedUpdates.map((update) => (
              <div
                key={update.id}
                className="rounded-2xl border border-white/12 bg-white/5 p-4 text-sm text-white/80"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">
                      {CATEGORY_LABELS[update.category] || update.category}
                      {update.isPinned ? " · Fixado" : ""}
                    </p>
                    <h3 className="text-base font-semibold text-white">{update.title}</h3>
                    {update.event && (
                      <p className="text-[12px] text-white/60">Evento: {update.event.title}</p>
                    )}
                  </div>
                  <div className="text-[11px] text-white/50">{update.dateLabel}</div>
                </div>
                {update.body && <p className="mt-2 text-[12px] text-white/70">{update.body}</p>}
                <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                  <span className="rounded-full border border-white/20 bg-white/10 px-2 py-1">
                    {STATUS_LABELS[update.status] || update.status}
                  </span>
                  {update.status !== "PUBLISHED" && (
                    <button
                      type="button"
                      onClick={() => publishQuick(update)}
                      className="rounded-full border border-emerald-400/40 bg-emerald-500/10 px-2 py-1 text-emerald-100"
                    >
                      Publicar
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => togglePin(update)}
                    className="rounded-full border border-white/20 bg-white/10 px-2 py-1"
                  >
                    {update.isPinned ? "Desafixar" : "Fixar"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleEdit(update)}
                    className="rounded-full border border-white/20 bg-white/10 px-2 py-1"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => archiveUpdate(update)}
                    className="rounded-full border border-white/20 bg-white/10 px-2 py-1"
                  >
                    Arquivar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
