"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import useSWR from "swr";

type Props = {
  agreementId: number | null;
  organizationId: number | null;
};

type WorkspaceResponse = {
  ok: boolean;
  workspace?: {
    agreement: {
      id: number;
      status: "PENDING" | "APPROVED" | "PAUSED" | "REVOKED" | "EXPIRED";
      ownerOrganizationId: number;
      partnerOrganizationId: number;
      ownerClubId: number;
      partnerClubId: number | null;
      startsAt: string | null;
      endsAt: string | null;
      notes: string | null;
    };
    windows: Array<{
      id: number;
      ownerCourtId: number | null;
      startMinute: number;
      endMinute: number;
      weekdayMask: number;
      timezone: string;
      isActive: boolean;
    }>;
    grants: Array<{
      id: number;
      userId: string;
      role: "DIRETOR_PROVA" | "REFEREE" | "SCOREKEEPER" | "STREAMER";
      startsAt: string;
      expiresAt: string;
      isActive: boolean;
      eventId: number | null;
      revokedAt: string | null;
    }>;
    overrides: Array<{
      id: number;
      reasonCode: string;
      reason: string;
      executionStatus: string | null;
      eventId: number | null;
      courtId: number | null;
      startsAt: string | null;
      endsAt: string | null;
    }>;
    compensationCases: Array<{
      id: number;
      status: "OPEN" | "AUTO_RESOLVED" | "PENDING_COMPENSATION" | "MANUAL_RESOLVED" | "CANCELLED";
      reasonCode: string | null;
      overrideId: number | null;
      windowStart: string | null;
      windowEnd: string | null;
    }>;
    courts: Array<{ id: number; name: string }>;
  };
  calendar?: {
    masterLane: Array<{ id: string; label: string; startAt: string | null; endAt: string | null; courtId: number | null }>;
    partnerLane: Array<{ id: string; label: string; startAt: string | null; endAt: string | null; courtId: number | null }>;
    sharedLane: Array<{ id: string; sourceType?: string; startAt: string | null; endAt: string | null; courtId: number | null }>;
  };
  error?: string;
};

const fetcher = (url: string) => fetch(url).then((res) => res.json());

function toLocalDateTime(value: string | null | undefined) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  const pad = (num: number) => String(num).padStart(2, "0");
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}T${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`;
}

export default function PartnershipWorkspaceClient({ agreementId, organizationId }: Props) {
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [newWindowCourtId, setNewWindowCourtId] = useState("");
  const [newWindowStartMinute, setNewWindowStartMinute] = useState("540");
  const [newWindowEndMinute, setNewWindowEndMinute] = useState("1380");
  const [newWindowWeekdayMask, setNewWindowWeekdayMask] = useState("127");
  const [grantUserId, setGrantUserId] = useState("");
  const [grantRole, setGrantRole] = useState("REFEREE");
  const [grantStartsAt, setGrantStartsAt] = useState("");
  const [grantExpiresAt, setGrantExpiresAt] = useState("");
  const [overrideEventId, setOverrideEventId] = useState("");
  const [overrideCourtId, setOverrideCourtId] = useState("");
  const [overrideStartsAt, setOverrideStartsAt] = useState("");
  const [overrideEndsAt, setOverrideEndsAt] = useState("");
  const [overrideReasonCode, setOverrideReasonCode] = useState("FORCE_REPLAN");
  const [overrideReason, setOverrideReason] = useState("");

  const workspaceUrl = useMemo(() => {
    if (!agreementId) return null;
    const query = new URLSearchParams();
    if (organizationId) query.set("organizationId", String(organizationId));
    return `/api/padel/partnerships/workspace/${agreementId}/calendar${query.toString() ? `?${query.toString()}` : ""}`;
  }, [agreementId, organizationId]);

  const { data, mutate, isLoading } = useSWR<WorkspaceResponse>(workspaceUrl, fetcher, {
    revalidateOnFocus: false,
  });

  const agreement = data?.workspace?.agreement ?? null;
  const windows = data?.workspace?.windows ?? [];
  const grants = data?.workspace?.grants ?? [];
  const overrides = data?.workspace?.overrides ?? [];
  const cases = data?.workspace?.compensationCases ?? [];
  const courts = data?.workspace?.courts ?? [];
  const calendar = data?.calendar ?? { masterLane: [], partnerLane: [], sharedLane: [] };

  const runAgreementAction = async (action: "approve" | "pause" | "revoke") => {
    if (!agreement || !organizationId) return;
    const key = `agreement:${action}`;
    setActionBusy(key);
    setActionFeedback(null);
    try {
      const res = await fetch(`/api/padel/partnerships/agreements/${agreement.id}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setActionFeedback(typeof json?.error === "string" ? json.error : "Ação falhou.");
        return;
      }
      setActionFeedback(`Acordo ${action} com sucesso.`);
      await mutate();
    } finally {
      setActionBusy(null);
    }
  };

  const createWindow = async () => {
    if (!agreement || !organizationId) return;
    setActionBusy("window:create");
    setActionFeedback(null);
    try {
      const res = await fetch(`/api/padel/partnerships/agreements/${agreement.id}/windows`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId,
          ownerCourtId: newWindowCourtId ? Number(newWindowCourtId) : null,
          startMinute: Number(newWindowStartMinute),
          endMinute: Number(newWindowEndMinute),
          weekdayMask: Number(newWindowWeekdayMask),
          requiresApproval: false,
          capacityParallelSlots: 1,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setActionFeedback(typeof json?.error === "string" ? json.error : "Não foi possível criar janela.");
        return;
      }
      setActionFeedback("Janela criada.");
      await mutate();
    } finally {
      setActionBusy(null);
    }
  };

  const patchWindow = async (windowId: number, payload: Record<string, unknown>) => {
    if (!agreement || !organizationId) return;
    setActionBusy(`window:${windowId}`);
    setActionFeedback(null);
    try {
      const res = await fetch(`/api/padel/partnerships/agreements/${agreement.id}/windows`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId, windowId, ...payload }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setActionFeedback(typeof json?.error === "string" ? json.error : "Não foi possível atualizar janela.");
        return;
      }
      await mutate();
    } finally {
      setActionBusy(null);
    }
  };

  const deleteWindow = async (windowId: number) => {
    if (!agreement || !organizationId) return;
    setActionBusy(`window:delete:${windowId}`);
    setActionFeedback(null);
    try {
      const res = await fetch(
        `/api/padel/partnerships/agreements/${agreement.id}/windows?organizationId=${organizationId}&windowId=${windowId}`,
        { method: "DELETE" },
      );
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setActionFeedback(typeof json?.error === "string" ? json.error : "Não foi possível remover janela.");
        return;
      }
      await mutate();
    } finally {
      setActionBusy(null);
    }
  };

  const createGrant = async () => {
    if (!agreement || !organizationId) return;
    setActionBusy("grant:create");
    setActionFeedback(null);
    try {
      const res = await fetch(`/api/padel/partnerships/agreements/${agreement.id}/grants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId,
          userId: grantUserId,
          role: grantRole,
          startsAt: new Date(grantStartsAt).toISOString(),
          expiresAt: new Date(grantExpiresAt).toISOString(),
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setActionFeedback(typeof json?.error === "string" ? json.error : "Não foi possível criar grant.");
        return;
      }
      setGrantUserId("");
      setActionFeedback("Grant criado.");
      await mutate();
    } finally {
      setActionBusy(null);
    }
  };

  const deleteGrant = async (grantId: number) => {
    if (!agreement || !organizationId) return;
    setActionBusy(`grant:delete:${grantId}`);
    setActionFeedback(null);
    try {
      const res = await fetch(
        `/api/padel/partnerships/agreements/${agreement.id}/grants?organizationId=${organizationId}&grantId=${grantId}`,
        { method: "DELETE" },
      );
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setActionFeedback(typeof json?.error === "string" ? json.error : "Não foi possível revogar grant.");
        return;
      }
      await mutate();
    } finally {
      setActionBusy(null);
    }
  };

  const createOverride = async () => {
    if (!agreement || !organizationId) return;
    setActionBusy("override:create");
    setActionFeedback(null);
    try {
      const body: Record<string, unknown> = {
        organizationId,
        agreementId: agreement.id,
        targetType: "COURT_SLOT",
        reasonCode: overrideReasonCode,
        reason: overrideReason || "Override operacional",
      };
      if (overrideEventId) body.eventId = Number(overrideEventId);
      if (overrideCourtId) body.courtId = Number(overrideCourtId);
      if (overrideStartsAt) body.startsAt = new Date(overrideStartsAt).toISOString();
      if (overrideEndsAt) body.endsAt = new Date(overrideEndsAt).toISOString();
      const res = await fetch("/api/padel/partnerships/overrides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setActionFeedback(typeof json?.error === "string" ? json.error : "Não foi possível criar override.");
        return;
      }
      setActionFeedback("Override criado.");
      await mutate();
    } finally {
      setActionBusy(null);
    }
  };

  const executeOverride = async (overrideId: number) => {
    if (!organizationId) return;
    setActionBusy(`override:execute:${overrideId}`);
    setActionFeedback(null);
    try {
      const res = await fetch(`/api/padel/partnerships/overrides/${overrideId}/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setActionFeedback(typeof json?.error === "string" ? json.error : "Não foi possível executar override.");
        return;
      }
      setActionFeedback("Override executado.");
      await mutate();
    } finally {
      setActionBusy(null);
    }
  };

  const patchCaseStatus = async (caseId: number, status: string) => {
    if (!organizationId) return;
    setActionBusy(`case:${caseId}`);
    setActionFeedback(null);
    try {
      const res = await fetch("/api/padel/partnerships/compensation-cases", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId, caseId, status }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setActionFeedback(typeof json?.error === "string" ? json.error : "Não foi possível atualizar caso.");
        return;
      }
      await mutate();
    } finally {
      setActionBusy(null);
    }
  };

  if (!agreementId) {
    return (
      <div className="mx-auto w-full max-w-5xl p-6 text-white">
        <p>ID de acordo inválido.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 px-4 py-6 text-white">
      <header className="rounded-2xl border border-white/15 bg-white/[0.04] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">Workspace de Parceria #{agreementId}</h1>
            <p className="text-sm text-white/70">Operação partilhada: acordo, janelas, grants, overrides e calendário.</p>
          </div>
          <Link
            href={`/organizacao/padel/parcerias${organizationId ? `?organizationId=${organizationId}` : ""}`}
            className="rounded-full border border-white/20 px-4 py-2 text-sm text-white/85 hover:border-white/40"
          >
            Voltar
          </Link>
        </div>
        {actionFeedback && <p className="mt-2 text-sm text-white/80">{actionFeedback}</p>}
      </header>

      {isLoading || !agreement ? (
        <div className="rounded-2xl border border-white/12 bg-white/[0.03] p-4 text-sm text-white/70">A carregar workspace...</div>
      ) : (
        <>
          <section className="rounded-2xl border border-white/12 bg-white/[0.03] p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-white/20 px-2 py-1 text-xs text-white/80">Estado: {agreement.status}</span>
              <span className="rounded-full border border-white/20 px-2 py-1 text-xs text-white/80">Clube dono #{agreement.ownerClubId}</span>
              <span className="rounded-full border border-white/20 px-2 py-1 text-xs text-white/80">Clube parceiro {agreement.partnerClubId ?? "—"}</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {(["approve", "pause", "revoke"] as const).map((action) => (
                <button
                  key={`action-${action}`}
                  type="button"
                  onClick={() => runAgreementAction(action)}
                  disabled={Boolean(actionBusy)}
                  className="rounded-full border border-white/20 px-3 py-1 text-xs text-white/85 hover:border-white/40 disabled:opacity-60"
                >
                  {actionBusy === `agreement:${action}` ? "A executar..." : action.toUpperCase()}
                </button>
              ))}
            </div>
          </section>

          <section className="grid gap-5 lg:grid-cols-2">
            <article className="rounded-2xl border border-white/12 bg-white/[0.03] p-4">
              <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-white/75">Janelas</h2>
              <div className="mt-3 grid gap-2 md:grid-cols-4">
                <select
                  value={newWindowCourtId}
                  onChange={(event) => setNewWindowCourtId(event.target.value)}
                  className="rounded-xl border border-white/15 bg-black/35 px-3 py-2 text-sm outline-none focus:border-white/40"
                >
                  <option value="">Todos os courts</option>
                  {courts.map((court) => (
                    <option key={`court-option-${court.id}`} value={court.id}>
                      #{court.id} · {court.name}
                    </option>
                  ))}
                </select>
                <input
                  value={newWindowStartMinute}
                  onChange={(event) => setNewWindowStartMinute(event.target.value)}
                  placeholder="startMinute"
                  className="rounded-xl border border-white/15 bg-black/35 px-3 py-2 text-sm outline-none focus:border-white/40"
                />
                <input
                  value={newWindowEndMinute}
                  onChange={(event) => setNewWindowEndMinute(event.target.value)}
                  placeholder="endMinute"
                  className="rounded-xl border border-white/15 bg-black/35 px-3 py-2 text-sm outline-none focus:border-white/40"
                />
                <input
                  value={newWindowWeekdayMask}
                  onChange={(event) => setNewWindowWeekdayMask(event.target.value)}
                  placeholder="weekdayMask"
                  className="rounded-xl border border-white/15 bg-black/35 px-3 py-2 text-sm outline-none focus:border-white/40"
                />
              </div>
              <button
                type="button"
                onClick={createWindow}
                disabled={Boolean(actionBusy)}
                className="mt-3 rounded-full border border-white/20 px-3 py-1 text-xs text-white/85 hover:border-white/40 disabled:opacity-60"
              >
                {actionBusy === "window:create" ? "A criar..." : "Adicionar janela"}
              </button>
              <div className="mt-3 space-y-2">
                {windows.map((windowItem) => (
                  <div key={`window-${windowItem.id}`} className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs">
                    <p>
                      #{windowItem.id} · Court {windowItem.ownerCourtId ?? "ALL"} · {windowItem.startMinute}-{windowItem.endMinute}
                    </p>
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        onClick={() => patchWindow(windowItem.id, { isActive: !windowItem.isActive })}
                        className="rounded-full border border-white/20 px-2 py-1 text-[11px] hover:border-white/40"
                      >
                        {windowItem.isActive ? "Pausar" : "Ativar"}
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteWindow(windowItem.id)}
                        className="rounded-full border border-rose-300/40 px-2 py-1 text-[11px] text-rose-100 hover:border-rose-200/70"
                      >
                        Remover
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </article>

            <article className="rounded-2xl border border-white/12 bg-white/[0.03] p-4">
              <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-white/75">Grants</h2>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                <input
                  value={grantUserId}
                  onChange={(event) => setGrantUserId(event.target.value)}
                  placeholder="userId"
                  className="rounded-xl border border-white/15 bg-black/35 px-3 py-2 text-sm outline-none focus:border-white/40"
                />
                <select
                  value={grantRole}
                  onChange={(event) => setGrantRole(event.target.value)}
                  className="rounded-xl border border-white/15 bg-black/35 px-3 py-2 text-sm outline-none focus:border-white/40"
                >
                  <option value="DIRETOR_PROVA">DIRETOR_PROVA</option>
                  <option value="REFEREE">REFEREE</option>
                  <option value="SCOREKEEPER">SCOREKEEPER</option>
                  <option value="STREAMER">STREAMER</option>
                </select>
                <input
                  type="datetime-local"
                  value={grantStartsAt}
                  onChange={(event) => setGrantStartsAt(event.target.value)}
                  className="rounded-xl border border-white/15 bg-black/35 px-3 py-2 text-sm outline-none focus:border-white/40"
                />
                <input
                  type="datetime-local"
                  value={grantExpiresAt}
                  onChange={(event) => setGrantExpiresAt(event.target.value)}
                  className="rounded-xl border border-white/15 bg-black/35 px-3 py-2 text-sm outline-none focus:border-white/40"
                />
              </div>
              <button
                type="button"
                onClick={createGrant}
                disabled={Boolean(actionBusy) || !grantUserId || !grantStartsAt || !grantExpiresAt}
                className="mt-3 rounded-full border border-white/20 px-3 py-1 text-xs text-white/85 hover:border-white/40 disabled:opacity-60"
              >
                {actionBusy === "grant:create" ? "A criar..." : "Adicionar grant"}
              </button>
              <div className="mt-3 space-y-2">
                {grants.map((grant) => (
                  <div key={`grant-${grant.id}`} className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs">
                    <p>
                      #{grant.id} · {grant.role} · {grant.userId}
                    </p>
                    <p className="text-white/70">
                      {toLocalDateTime(grant.startsAt)} → {toLocalDateTime(grant.expiresAt)}
                    </p>
                    <button
                      type="button"
                      onClick={() => deleteGrant(grant.id)}
                      className="mt-2 rounded-full border border-rose-300/40 px-2 py-1 text-[11px] text-rose-100 hover:border-rose-200/70"
                    >
                      Revogar
                    </button>
                  </div>
                ))}
              </div>
            </article>
          </section>

          <section className="grid gap-5 lg:grid-cols-2">
            <article className="rounded-2xl border border-white/12 bg-white/[0.03] p-4">
              <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-white/75">Overrides</h2>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                <input
                  value={overrideEventId}
                  onChange={(event) => setOverrideEventId(event.target.value)}
                  placeholder="eventId"
                  className="rounded-xl border border-white/15 bg-black/35 px-3 py-2 text-sm outline-none focus:border-white/40"
                />
                <input
                  value={overrideCourtId}
                  onChange={(event) => setOverrideCourtId(event.target.value)}
                  placeholder="courtId"
                  className="rounded-xl border border-white/15 bg-black/35 px-3 py-2 text-sm outline-none focus:border-white/40"
                />
                <input
                  type="datetime-local"
                  value={overrideStartsAt}
                  onChange={(event) => setOverrideStartsAt(event.target.value)}
                  className="rounded-xl border border-white/15 bg-black/35 px-3 py-2 text-sm outline-none focus:border-white/40"
                />
                <input
                  type="datetime-local"
                  value={overrideEndsAt}
                  onChange={(event) => setOverrideEndsAt(event.target.value)}
                  className="rounded-xl border border-white/15 bg-black/35 px-3 py-2 text-sm outline-none focus:border-white/40"
                />
                <input
                  value={overrideReasonCode}
                  onChange={(event) => setOverrideReasonCode(event.target.value)}
                  placeholder="reasonCode"
                  className="rounded-xl border border-white/15 bg-black/35 px-3 py-2 text-sm outline-none focus:border-white/40"
                />
                <input
                  value={overrideReason}
                  onChange={(event) => setOverrideReason(event.target.value)}
                  placeholder="reason"
                  className="rounded-xl border border-white/15 bg-black/35 px-3 py-2 text-sm outline-none focus:border-white/40"
                />
              </div>
              <button
                type="button"
                onClick={createOverride}
                disabled={Boolean(actionBusy) || !overrideReasonCode || !overrideReason}
                className="mt-3 rounded-full border border-white/20 px-3 py-1 text-xs text-white/85 hover:border-white/40 disabled:opacity-60"
              >
                {actionBusy === "override:create" ? "A criar..." : "Criar override"}
              </button>
              <div className="mt-3 space-y-2">
                {overrides.map((item) => (
                  <div key={`override-${item.id}`} className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs">
                    <p>
                      #{item.id} · {item.reasonCode}
                    </p>
                    <p className="text-white/70">{item.reason}</p>
                    <button
                      type="button"
                      onClick={() => executeOverride(item.id)}
                      disabled={Boolean(actionBusy)}
                      className="mt-2 rounded-full border border-white/20 px-2 py-1 text-[11px] hover:border-white/40 disabled:opacity-60"
                    >
                      Executar
                    </button>
                  </div>
                ))}
              </div>
            </article>

            <article className="rounded-2xl border border-white/12 bg-white/[0.03] p-4">
              <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-white/75">Casos de compensação</h2>
              <div className="mt-3 space-y-2">
                {cases.length === 0 ? (
                  <p className="text-sm text-white/65">Sem casos.</p>
                ) : (
                  cases.map((item) => (
                    <div key={`case-${item.id}`} className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs">
                      <p>
                        Caso #{item.id} · {item.status}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {(["OPEN", "PENDING_COMPENSATION", "MANUAL_RESOLVED", "CANCELLED"] as const).map((status) => (
                          <button
                            key={`case-${item.id}-${status}`}
                            type="button"
                            onClick={() => patchCaseStatus(item.id, status)}
                            className="rounded-full border border-white/20 px-2 py-1 text-[11px] hover:border-white/40"
                          >
                            {status}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </article>
          </section>

          <section className="rounded-2xl border border-white/12 bg-white/[0.03] p-4">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-white/75">Calendário partilhado</h2>
            <div className="mt-3 grid gap-4 lg:grid-cols-3">
              <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                <p className="mb-2 text-xs uppercase tracking-[0.14em] text-white/65">Lane Dona</p>
                <div className="space-y-2 text-xs">
                  {calendar.masterLane.map((row) => (
                    <div key={row.id} className="rounded-lg border border-white/10 bg-black/40 px-2 py-1">
                      <p>{row.label}</p>
                      <p className="text-white/70">{toLocalDateTime(row.startAt)} → {toLocalDateTime(row.endAt)}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                <p className="mb-2 text-xs uppercase tracking-[0.14em] text-white/65">Lane Parceira</p>
                <div className="space-y-2 text-xs">
                  {calendar.partnerLane.map((row) => (
                    <div key={row.id} className="rounded-lg border border-white/10 bg-black/40 px-2 py-1">
                      <p>{row.label}</p>
                      <p className="text-white/70">{toLocalDateTime(row.startAt)} → {toLocalDateTime(row.endAt)}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                <p className="mb-2 text-xs uppercase tracking-[0.14em] text-white/65">Lane Partilhada</p>
                <div className="space-y-2 text-xs">
                  {calendar.sharedLane.map((row) => (
                    <div key={row.id} className="rounded-lg border border-white/10 bg-black/40 px-2 py-1">
                      <p>{row.id}</p>
                      <p className="text-white/70">{toLocalDateTime(row.startAt)} → {toLocalDateTime(row.endAt)}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

