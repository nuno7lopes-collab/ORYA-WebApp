"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { useUser } from "@/app/hooks/useUser";
import { useAuthModal } from "@/app/components/autenticação/AuthModalContext";
import { useSearchParams } from "next/navigation";

type Member = {
  userId: string;
  role: string;
  invitedByUserId: string | null;
  createdAt: string;
  fullName: string | null;
  username: string | null;
  email: string | null;
};

type MembersResponse = {
  ok: boolean;
  items: Member[];
  error?: string;
};

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function OrganizerStaffPage() {
  const { user, profile, isLoading: isUserLoading } = useUser();
  const { openModal } = useAuthModal();
  const searchParams = useSearchParams();

  const [targetEmail, setTargetEmail] = useState("");
  const [role, setRole] = useState<"OWNER" | "ADMIN" | "STAFF" | "CHECKIN_ONLY">("STAFF");
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const { data: meData } = useSWR<{ ok: boolean; organizer?: { id: number } | null }>(
    user ? "/api/organizador/me" : null,
    fetcher,
    { revalidateOnFocus: false },
  );
  const organizerIdParam = searchParams?.get("organizerId") ?? meData?.organizer?.id?.toString();

  const { data, isLoading: isMembersLoading, mutate } = useSWR<MembersResponse>(
    user && organizerIdParam ? `/api/organizador/organizations/members?organizerId=${organizerIdParam}` : null,
    fetcher,
    { revalidateOnFocus: false },
  );

  const handleRequireLogin = () => {
    openModal({ mode: "login", redirectTo: "/organizador/(dashboard)/staff", showGoogle: true });
  };

  const isOrganizer = profile?.roles?.includes("organizer") ?? false;
  const members = data?.items ?? [];
  const sortedMembers = useMemo(() => {
    return [...members].sort((a, b) => {
      const order: Record<string, number> = { OWNER: 0, ADMIN: 1, STAFF: 2, CHECKIN_ONLY: 3 };
      return (order[a.role] ?? 99) - (order[b.role] ?? 99);
    });
  }, [members]);

  const handleAddOrUpdate = async () => {
    if (!targetEmail.trim()) {
      setErrorMessage("Indica o email/ID do membro.");
      return;
    }
    if (!organizerIdParam) {
      setErrorMessage("Organização inválida.");
      return;
    }
    setErrorMessage(null);
    setSuccessMessage(null);
    setSaving(true);
    try {
      const res = await fetch("/api/organizador/organizations/members/upsert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizerId: Number(organizerIdParam),
          userId: targetEmail.trim(),
          role,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        setErrorMessage(json?.error || "Não foi possível atualizar o membro.");
      } else {
        setSuccessMessage("Membro atualizado.");
        setTargetEmail("");
        mutate();
      }
    } catch (err) {
      console.error("[staff] add/update error", err);
      setErrorMessage("Erro inesperado ao atualizar membro.");
    } finally {
      setSaving(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    if (!organizerIdParam) return;
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const res = await fetch("/api/organizador/organizations/members", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizerId: Number(organizerIdParam), userId, role: newRole }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        setErrorMessage(json?.error || "Não foi possível alterar o role.");
      } else {
        setSuccessMessage("Role atualizado.");
        mutate();
      }
    } catch (err) {
      console.error("[staff] role change error", err);
      setErrorMessage("Erro inesperado ao alterar role.");
    }
  };

  const handleRemove = async (userId: string) => {
    if (!organizerIdParam) return;
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const res = await fetch(
        `/api/organizador/organizations/members?organizerId=${organizerIdParam}&userId=${userId}`,
        { method: "DELETE" },
      );
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        setErrorMessage(json?.error || "Não foi possível remover o membro.");
      } else {
        setSuccessMessage("Membro removido.");
        mutate();
      }
    } catch (err) {
      console.error("[staff] remove error", err);
      setErrorMessage("Erro inesperado ao remover membro.");
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
        <h1 className="text-2xl font-semibold">Staff</h1>
        <p>Precisas de iniciar sessão para gerir o staff.</p>
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
        <h1 className="text-2xl font-semibold">Staff</h1>
        <p>Ativa primeiro o perfil de organizador.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 space-y-6 md:px-6 lg:px-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-white/60">Staff & equipas</p>
          <h1 className="text-3xl font-semibold">Controla quem tem acesso</h1>
          <p className="text-sm text-white/60">Define roles e remove membros. Owners têm de existir sempre pelo menos um.</p>
        </div>
      </div>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3 shadow-[0_16px_50px_rgba(0,0,0,0.45)]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold">Adicionar / atualizar membro</h2>
            <p className="text-[12px] text-white/60">Usa email ou ID. Apenas Owners podem gerir roles.</p>
          </div>
        </div>

        {errorMessage && <p className="text-sm text-red-400">{errorMessage}</p>}
        {successMessage && <p className="text-sm text-emerald-400">{successMessage}</p>}

        <div className="grid gap-3 md:grid-cols-3">
          <div className="space-y-1">
            <label className="text-xs text-white/70">Email ou ID do membro</label>
            <input
              type="text"
              value={targetEmail}
              onChange={(e) => setTargetEmail(e.target.value)}
              className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none focus:border-white/40"
              placeholder="email@dominio.com"
            />
          </div>
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
              <option value="CHECKIN_ONLY">Check-in</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={handleAddOrUpdate}
              disabled={saving}
              className="inline-flex items-center rounded-full bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] px-5 py-2 text-sm font-semibold text-black shadow hover:opacity-95 disabled:opacity-60"
            >
              {saving ? "A guardar…" : "Guardar membro"}
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-black/30 p-4 space-y-3 shadow-[0_16px_50px_rgba(0,0,0,0.45)]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold">Membros</h2>
            <p className="text-[12px] text-white/60">Altera role ou remove membros existentes.</p>
          </div>
          <div className="text-[11px] text-white/60">
            {isMembersLoading ? "A carregar…" : `${sortedMembers.length} membro${sortedMembers.length === 1 ? "" : "s"}`}
          </div>
        </div>

        {isMembersLoading && <p className="text-sm">A carregar staff…</p>}
        {!isMembersLoading && sortedMembers.length === 0 && (
          <div className="rounded-lg border border-white/10 bg-white/5 p-4 text-sm">
            <p>Ainda não tens membros nesta organização.</p>
          </div>
        )}

        {sortedMembers.length > 0 && (
          <div className="space-y-2">
            {sortedMembers.map((m) => (
              <div
                key={m.userId}
                className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/5 p-3 md:flex-row md:items-center md:justify-between"
              >
                <div className="flex flex-col">
                  <span className="font-semibold text-white">
                    {m.fullName || m.username || "Utilizador"}{" "}
                    <span className="text-[11px] text-white/60">({m.email || m.userId})</span>
                  </span>
                  <span className="text-[11px] text-white/50">
                    Desde {new Date(m.createdAt).toLocaleDateString("pt-PT")}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={m.role}
                    onChange={(e) => handleRoleChange(m.userId, e.target.value)}
                    className="rounded-md border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                  >
                    <option value="OWNER">Owner</option>
                    <option value="ADMIN">Admin</option>
                    <option value="STAFF">Staff</option>
                    <option value="CHECKIN_ONLY">Check-in</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => handleRemove(m.userId)}
                    className="rounded-full border border-red-500/40 bg-red-500/10 px-3 py-1 text-[12px] text-red-200 hover:bg-red-500/20"
                  >
                    Remover
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
