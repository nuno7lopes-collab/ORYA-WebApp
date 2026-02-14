"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { CTA_PRIMARY, CTA_SECONDARY } from "@/app/org/_internal/core/dashboardUi";
import { Avatar } from "@/components/ui/avatar";
import { sanitizeUiErrorMessage } from "@/lib/uiErrorMessage";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

type Assignment = {
  id: number;
  role: string;
  userId: string;
  createdAt: string;
  user?: { id: string; fullName: string | null; username: string | null; avatarUrl: string | null } | null;
};

type RolesResponse = {
  ok: boolean;
  items?: Assignment[];
  roles?: string[];
  canManage?: boolean;
  error?: string;
};

const ROLE_LABELS: Record<string, string> = {
  DIRETOR_PROVA: "Diretor de prova",
  REFEREE: "Árbitro",
  SCOREKEEPER: "Marcador",
  STREAMER: "Streaming",
};

export default function PadelTournamentRolesPanel({ eventId }: { eventId: number }) {
  const [role, setRole] = useState("DIRETOR_PROVA");
  const [identifier, setIdentifier] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState<number | null>(null);

  const { data, mutate } = useSWR<RolesResponse>(
    eventId ? `/api/padel/tournaments/roles?eventId=${eventId}` : null,
    fetcher,
  );

  const roles = useMemo(
    () => data?.roles ?? ["DIRETOR_PROVA", "REFEREE", "SCOREKEEPER", "STREAMER"],
    [data],
  );
  const items = Array.isArray(data?.items) ? data?.items ?? [] : [];
  const canManage = Boolean(data?.canManage);

  const handleAdd = async () => {
    setError(null);
    setMessage(null);
    if (!identifier.trim()) {
      setError("Indica email ou username.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/padel/tournaments/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          role,
          identifier: identifier.trim().replace(/^@/, ""),
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        const code = typeof json?.error === "string" ? json.error : null;
        const msg =
          code === "USER_NOT_MEMBER"
            ? "Utilizador não é membro da organização."
            : code === "ROLE_ALREADY_ASSIGNED"
              ? "Role já atribuída."
              : code === "USER_NOT_FOUND"
                ? "Utilizador não encontrado."
                : sanitizeUiErrorMessage(code, "Erro ao atribuir role.");
        setError(msg);
        return;
      }
      setIdentifier("");
      setMessage("Role atribuída.");
      mutate();
      setTimeout(() => setMessage(null), 2500);
    } catch (err) {
      console.error("[padel/roles] add", err);
      setError("Erro ao atribuir role.");
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (id: number) => {
    setError(null);
    setMessage(null);
    setRemovingId(id);
    try {
      const res = await fetch(`/api/padel/tournaments/roles?id=${id}`, { method: "DELETE" });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        setError(sanitizeUiErrorMessage(json?.error, "Erro ao remover role."));
        return;
      }
      setMessage("Role removida.");
      mutate();
      setTimeout(() => setMessage(null), 2500);
    } catch (err) {
      console.error("[padel/roles] remove", err);
      setError("Erro ao remover role.");
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div className="rounded-2xl border border-white/12 bg-white/5 p-4 shadow-[0_16px_50px_rgba(0,0,0,0.45)]">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Roles do torneio</p>
          <p className="text-sm text-white/70">Define árbitros, diretores e operações por evento.</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="rounded-full border border-white/20 bg-black/30 px-3 py-2 text-[12px] text-white/80 outline-none"
          disabled={!canManage}
        >
          {roles.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r] ?? r}
            </option>
          ))}
        </select>
        <input
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          placeholder="email ou @username"
          className="min-w-[220px] flex-1 rounded-full border border-white/20 bg-black/30 px-3 py-2 text-[12px] text-white/80 outline-none"
          disabled={!canManage}
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={!canManage || saving}
          className={CTA_PRIMARY}
        >
          {saving ? "A guardar…" : "Adicionar"}
        </button>
      </div>

      {error && (
        <div className="mt-3 rounded-xl border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-100">
          {error}
        </div>
      )}
      {message && (
        <div className="mt-3 rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-100">
          {message}
        </div>
      )}

      <div className="mt-4 space-y-2">
        {items.length === 0 && (
          <p className="text-[12px] text-white/60">Sem roles atribuídas.</p>
        )}
        {items.map((item) => {
          const name = item.user?.fullName || item.user?.username || "Utilizador";
          return (
            <div
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2"
            >
              <div className="flex items-center gap-3">
                <Avatar
                  src={item.user?.avatarUrl}
                  name={name}
                  className="h-8 w-8 rounded-full border border-white/10"
                  textClassName="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/80"
                />
                <div>
                  <p className="text-sm font-semibold text-white">{name}</p>
                  {item.user?.username && (
                    <p className="text-[11px] text-white/60">@{item.user.username}</p>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] text-white/80">
                  {ROLE_LABELS[item.role] ?? item.role}
                </span>
                {canManage && (
                  <button
                    type="button"
                    onClick={() => handleRemove(item.id)}
                    disabled={removingId === item.id}
                    className={CTA_SECONDARY}
                  >
                    {removingId === item.id ? "A remover…" : "Remover"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
