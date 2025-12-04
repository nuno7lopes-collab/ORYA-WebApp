

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
  status?: "PENDING" | "ACTIVE" | "REVOKED";
  revokedAt?: string | null;
  role?: "OWNER" | "ADMIN" | "STAFF" | "CHECKIN";
};

export default function OrganizerStaffPage() {
  const { user, profile, isLoading: isUserLoading } = useUser();
  const { openModal } = useAuthModal();

  const [emailOrUsername, setEmailOrUsername] = useState("");
  const [scope, setScope] = useState<"GLOBAL" | "EVENT">("GLOBAL");
  const [role, setRole] = useState<"OWNER" | "ADMIN" | "STAFF" | "CHECKIN">("STAFF");
  const [eventIdInput, setEventIdInput] = useState<number | "">("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [search, setSearch] = useState("");

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
    openModal({ mode: "login", redirectTo: "/organizador/staff", showGoogle: true });
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
          role,
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
      <div className="mx-auto max-w-5xl px-4 py-10 md:px-6 lg:px-8">
        <p>A carregar a tua conta…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10 space-y-4 md:px-6 lg:px-8">
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
      <div className="mx-auto max-w-5xl px-4 py-10 space-y-4 md:px-6 lg:px-8">
        <h1 className="text-2xl font-semibold">Gestão de staff</h1>
        <p>
          A área de staff é exclusiva para organizadores. Primeiro, ativa o teu
          perfil de organizador.
        </p>
      </div>
    );
  }

  const items = (data?.items ?? []).filter((item) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return (
      (item.userName ?? "").toLowerCase().includes(term) ||
      (item.userEmail ?? "").toLowerCase().includes(term)
    );
  });
  const activeEvents =
    (eventsData?.items || []).filter((ev) => {
      if (ev.status !== "PUBLISHED") return false;
      const ends = ev.endsAt ? new Date(ev.endsAt) : null;
      return !ends || ends.getTime() >= Date.now();
    }) ?? [];

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 space-y-6 md:px-6 lg:px-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-white/60">Staff &amp; equipas</p>
          <h1 className="text-3xl font-semibold">Controla quem entra e quem gere</h1>
          <p className="text-sm text-white/60">
            Convida equipas para check-in, gestão ou administração. Scope global ou por evento.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Procurar por nome ou email"
            className="rounded-full border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-[#6BFFFF]"
          />
        </div>
      </div>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-4 shadow-[0_16px_50px_rgba(0,0,0,0.45)]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold">Adicionar membro</h2>
            <p className="text-[12px] text-white/60">Define role e alcance antes de enviar o convite.</p>
          </div>
          <div className="flex flex-wrap gap-2 text-[11px] text-white/60">
            <span>Roles recomendados:</span>
            <span className="rounded-full bg-white/10 px-2 py-0.5">Admin</span>
            <span className="rounded-full bg-white/10 px-2 py-0.5">Staff</span>
            <span className="rounded-full bg-white/10 px-2 py-0.5">Check-in</span>
          </div>
        </div>

        {errorMessage && <p className="text-sm text-red-400">{errorMessage}</p>}
        {successMessage && <p className="text-sm text-emerald-400">{successMessage}</p>}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs text-white/70">Email ou username</label>
              <input
                type="text"
                value={emailOrUsername}
                onChange={(e) => setEmailOrUsername(e.target.value)}
                className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none focus:border-white/40"
                placeholder="ex: joao@email.com ou @joao"
              />
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs text-white/70">Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as typeof role)}
                  className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none focus:border-white/40"
                >
                  <option value="OWNER">Owner</option>
                  <option value="ADMIN">Admin</option>
                  <option value="STAFF">Staff</option>
                  <option value="CHECKIN">Check-in</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-white/70">Scope</label>
                <select
                  value={scope}
                  onChange={(e) => setScope(e.target.value as "GLOBAL" | "EVENT")}
                  className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none focus:border-white/40"
                >
                  <option value="GLOBAL">Global (todos os eventos)</option>
                  <option value="EVENT">Evento específico</option>
                </select>
              </div>
            </div>
          </div>

          {scope === "EVENT" && (
            <div className="space-y-1">
              <label className="text-xs text-white/70">Evento ativo</label>
              <select
                value={eventIdInput === "" ? "" : String(eventIdInput)}
                onChange={(e) => setEventIdInput(e.target.value ? Number(e.target.value) : "")}
                className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none focus:border-white/40"
              >
                <option value="">{isEventsLoading ? "A carregar eventos..." : "Escolhe um evento"}</option>
                {activeEvents.map((ev) => {
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
              <p className="text-[11px] text-white/50">Mostramos apenas eventos publicados e ainda não terminados.</p>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center rounded-full bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] px-5 py-2 text-sm font-semibold text-black shadow hover:opacity-95 disabled:opacity-60"
          >
            {isSubmitting ? "A convidar…" : "Convidar"}
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-white/10 bg-black/30 p-4 space-y-3 shadow-[0_16px_50px_rgba(0,0,0,0.45)]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold">Staff atual</h2>
            <p className="text-[12px] text-white/60">Roles, scope e estado de cada membro.</p>
          </div>
          <div className="text-[11px] text-white/60">
            {items.length} membro{items.length === 1 ? "" : "s"}
          </div>
        </div>

        {isStaffLoading && <p className="text-sm">A carregar staff…</p>}
        {error && <p className="text-sm text-red-400">Ocorreu um erro ao carregar o staff.</p>}

        {!isStaffLoading && !error && items.length === 0 && (
          <div className="rounded-lg border border-white/10 bg-white/5 p-4 text-sm">
            <p>Ainda não tens staff atribuído.</p>
            <p className="mt-1 text-white/60">
              Adiciona alguém usando o formulário acima para poderes delegar o check-in dos teus eventos.
            </p>
          </div>
        )}

        {items.length > 0 && (
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-[11px] uppercase tracking-wide text-white/60">
                <tr>
                  <th className="px-3 py-2">Utilizador</th>
                  <th className="px-3 py-2">Role</th>
                  <th className="px-3 py-2">Scope</th>
                  <th className="px-3 py-2">Evento</th>
                  <th className="px-3 py-2">Estado</th>
                  <th className="px-3 py-2 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {items.map((assignment) => {
                  const statusTone =
                    assignment.status === "REVOKED"
                      ? "border-red-400/40 bg-red-500/10 text-red-100"
                      : assignment.status === "PENDING"
                        ? "border-amber-300/40 bg-amber-400/10 text-amber-100"
                        : "border-emerald-400/40 bg-emerald-500/10 text-emerald-100";

                  const derivedRole =
                    assignment.role === "OWNER"
                      ? "Owner"
                      : assignment.role === "ADMIN"
                        ? "Admin"
                        : assignment.role === "CHECKIN"
                          ? "Check-in"
                          : "Staff";

                  return (
                    <tr key={assignment.id} className="hover:bg-white/5 transition">
                      <td className="px-3 py-2">
                        <div className="flex flex-col">
                          <span className="font-semibold text-white">{assignment.userName || "Utilizador"}</span>
                          <span className="text-[11px] text-white/60">{assignment.userEmail || assignment.userId}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <span className="rounded-full border border-white/20 px-2 py-0.5 text-[11px] text-white/80">
                          {derivedRole}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-[12px]">{assignment.scope === "GLOBAL" ? "Global" : "Evento"}</td>
                      <td className="px-3 py-2 text-[12px]">{assignment.eventTitle ?? (assignment.scope === "GLOBAL" ? "—" : "Evento revogado")}</td>
                      <td className="px-3 py-2 text-[11px]">
                        <span className={`rounded-full border px-2 py-0.5 ${statusTone}`}>
                          {assignment.status === "REVOKED"
                            ? "Revogado"
                            : assignment.status === "PENDING"
                              ? "Pendente"
                              : "Ativo"}
                        </span>
                        {assignment.revokedAt && (
                          <span className="ml-2 text-[11px] text-white/50">
                            {new Date(assignment.revokedAt).toLocaleDateString("pt-PT")}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => handleRevoke(assignment.id)}
                          disabled={assignment.status === "REVOKED"}
                          className="rounded-full border border-red-500/40 px-3 py-1 text-[11px] text-red-300 hover:bg-red-500/10 disabled:opacity-50"
                        >
                          Revogar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
