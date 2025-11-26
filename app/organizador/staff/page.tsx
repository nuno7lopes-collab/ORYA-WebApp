

"use client";

import { useState, FormEvent } from "react";
import useSWR from "swr";
import { useUser } from "@/app/hooks/useUser";
import { useAuthModal } from "@/app/components/autenticação/AuthModalContext";

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error("Falha ao carregar staff.");
  }
  return res.json();
};

type EventItem = {
  id: number;
  title: string;
  slug: string;
  startsAt: string;
  endsAt: string;
  locationName: string | null;
  status: string;
};

type StaffAssignmentItem = {
  id: number;
  userId: string;
  scope: "GLOBAL" | "EVENT";
  eventId: number | null;
  userName: string | null;
  userEmail: string | null;
  eventTitle: string | null;
  status?: "ACTIVE" | "REVOKED";
  revokedAt?: string | null;
};

export default function OrganizerStaffPage() {
  const { user, profile, isLoading: isUserLoading } = useUser();
  const { openModal } = useAuthModal();

  const [emailOrUsername, setEmailOrUsername] = useState("");
  const [scope, setScope] = useState<"GLOBAL" | "EVENT">("GLOBAL");
  const [eventIdInput, setEventIdInput] = useState<number | "">("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const {
    data,
    error,
    isLoading: isStaffLoading,
    mutate,
  } = useSWR<{ ok: boolean; items: StaffAssignmentItem[] }>(
    user ? "/api/organizador/staff/list" : null,
    fetcher
  );

  const {
    data: eventsData,
    isLoading: isEventsLoading,
  } = useSWR<{ ok: boolean; items: EventItem[] }>(
    user ? "/api/organizador/events/list" : null,
    fetcher
  );

  const handleRequireLogin = () => {
    openModal({ mode: "login", redirectTo: "/organizador/staff" });
  };

  const isOrganizer = profile?.roles?.includes("organizer") ?? false;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!emailOrUsername.trim()) {
      setErrorMessage("Preenche o email ou username do staff.");
      return;
    }

    if (scope === "EVENT" && !eventIdInput) {
      setErrorMessage("Escolhe o evento para este staff.");
      return;
    }

    try {
      setIsSubmitting(true);

      const res = await fetch("/api/organizador/staff/assign", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          emailOrUsername: emailOrUsername.trim(),
          scope,
          eventId: scope === "EVENT" ? Number(eventIdInput) : null,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.ok) {
        setErrorMessage(json.error || "Não foi possível adicionar este staff.");
        return;
      }

      setSuccessMessage("Staff adicionado/atualizado com sucesso.");
      setEmailOrUsername("");
      if (scope === "EVENT") setEventIdInput("");
      mutate();
    } catch (err) {
      console.error("Erro ao adicionar staff:", err);
      setErrorMessage("Ocorreu um erro inesperado ao adicionar staff.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRevoke = async (assignmentId: number) => {
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await fetch("/api/organizador/staff/revoke", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ assignmentId }),
      });

      const json = await res.json();

      if (!res.ok || !json.ok) {
        setErrorMessage(json.error || "Não foi possível revogar este staff.");
        return;
      }

      setSuccessMessage("Staff revogado com sucesso.");
      mutate();
    } catch (err) {
      console.error("Erro ao revogar staff:", err);
      setErrorMessage("Ocorreu um erro inesperado ao revogar staff.");
    }
  };

  if (isUserLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <p>A carregar a tua conta…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-4">
        <h1 className="text-2xl font-semibold">Gestão de staff</h1>
        <p>Precisas de iniciar sessão para gerir o staff dos teus eventos.</p>
        <button
          type="button"
          onClick={handleRequireLogin}
          className="inline-flex items-center rounded-md border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium hover:bg-white/10"
        >
          Entrar
        </button>
      </div>
    );
  }

  if (!isOrganizer) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-4">
        <h1 className="text-2xl font-semibold">Gestão de staff</h1>
        <p>
          A área de staff é exclusiva para organizadores. Primeiro, ativa o teu
          perfil de organizador.
        </p>
      </div>
    );
  }

  const items = data?.items ?? [];
  const activeEvents =
    (eventsData?.items || []).filter((ev) => {
      if (ev.status !== "PUBLISHED") return false;
      const ends = ev.endsAt ? new Date(ev.endsAt) : null;
      return !ends || ends.getTime() >= Date.now();
    }) ?? [];

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Gestão de staff</h1>
        <p className="text-sm text-white/60">
          Define quem pode fazer check-in nos teus eventos, de forma global ou
          por evento.
        </p>
      </div>

      <section className="rounded-lg border border-white/10 bg-white/5 p-4 space-y-4">
        <h2 className="text-sm font-semibold">Adicionar novo staff</h2>

        {errorMessage && (
          <p className="text-sm text-red-400">{errorMessage}</p>
        )}
        {successMessage && (
          <p className="text-sm text-emerald-400">{successMessage}</p>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs text-white/70">
              Email ou username do utilizador
            </label>
            <input
              type="text"
              value={emailOrUsername}
              onChange={(e) => setEmailOrUsername(e.target.value)}
              className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none focus:border-white/40"
              placeholder="ex: joao@email.com ou @joao"
            />
          </div>

          <div className="flex flex-wrap gap-4">
            <div className="space-y-1">
              <label className="text-xs text-white/70">Scope</label>
              <select
                value={scope}
                onChange={(e) => setScope(e.target.value as "GLOBAL" | "EVENT")}
                className="rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none focus:border-white/40"
              >
                <option value="GLOBAL">GLOBAL (todos os teus eventos)</option>
                <option value="EVENT">EVENT (apenas um evento)</option>
              </select>
            </div>

            {scope === "EVENT" && (
              <div className="space-y-1 min-w-[260px]">
                <label className="text-xs text-white/70">Evento ativo</label>
                <select
                  value={eventIdInput === "" ? "" : String(eventIdInput)}
                  onChange={(e) =>
                    setEventIdInput(e.target.value ? Number(e.target.value) : "")
                  }
                  className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none focus:border-white/40"
                >
                  <option value="">
                    {isEventsLoading ? "A carregar eventos..." : "Escolhe um evento"}
                  </option>
                  {(eventsData?.items || [])
                    .filter((ev) => {
                      if (ev.status !== "PUBLISHED") return false;
                      const ends = ev.endsAt ? new Date(ev.endsAt) : null;
                      return !ends || ends.getTime() >= Date.now();
                    })
                    .map((ev) => {
                      const start = ev.startsAt ? new Date(ev.startsAt) : null;
                      const startLabel = start
                        ? start.toLocaleString("pt-PT", {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "Data a confirmar";
                      return (
                        <option key={ev.id} value={ev.id}>
                          #{ev.id} — {ev.title} — {startLabel} — {ev.locationName ?? "Local a anunciar"}
                        </option>
                      );
                    })}
                </select>
                <p className="text-[11px] text-white/50">
                  Só aparecem eventos publicados e ainda não terminados.
                </p>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center rounded-md border border-white/10 bg-white px-4 py-2 text-sm font-medium text-black hover:bg-white/90 disabled:opacity-60"
          >
            {isSubmitting ? "A guardar…" : "Guardar staff"}
          </button>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Staff atual</h2>

        {isStaffLoading && <p className="text-sm">A carregar staff…</p>}
        {error && (
          <p className="text-sm text-red-400">
            Ocorreu um erro ao carregar o staff.
          </p>
        )}

        {!isStaffLoading && !error && items.length === 0 && (
          <div className="rounded-lg border border-white/10 bg-white/5 p-4 text-sm">
            <p>Ainda não tens staff atribuído.</p>
            <p className="mt-1 text-white/60">
              Adiciona alguém usando o formulário acima para poderes delegar o
              check-in dos teus eventos.
            </p>
          </div>
        )}

        {items.length > 0 && (
          <div className="space-y-2">
            {items.map((assignment) => (
              <div
                key={assignment.id}
                className="flex items-center justify-between gap-4 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm"
              >
                <div className="min-w-0">
                  <p className="font-medium">
                    {assignment.userName || "Utilizador sem nome"}
                  </p>
                  <p className="text-xs text-white/60">
                    {assignment.userEmail || assignment.userId}
                  </p>
                  <p className="mt-1 text-xs text-white/60">
                    Scope: {assignment.scope}
                    {assignment.scope === "EVENT" && assignment.eventTitle
                      ? ` • Evento: ${assignment.eventTitle}`
                      : null}
                  </p>
                  <p className="text-[11px] text-white/50">
                    Estado:{" "}
                    <span
                      className={
                        assignment.status === "REVOKED"
                          ? "text-red-300"
                          : "text-emerald-300"
                      }
                    >
                      {assignment.status === "REVOKED" ? "Revogado" : "Ativo"}
                    </span>
                    {assignment.revokedAt && (
                      <span className="text-white/40">
                        {" "}
                        (revogado em {new Date(assignment.revokedAt).toLocaleDateString("pt-PT")})
                      </span>
                    )}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleRevoke(assignment.id)}
                  disabled={assignment.status === "REVOKED"}
                  className="shrink-0 rounded-md border border-red-500/40 px-3 py-1.5 text-xs font-medium text-red-300 hover:bg-red-500/10 disabled:opacity-50 disabled:hover:bg-transparent"
                >
                  Revogar
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
