"use client";

import React from "react";

type UserItem = {
  id: string;
  username: string | null;
  fullName: string | null;
  city: string | null;
  roles: string[] | null;
  createdAt: string;
  isDeleted: boolean;
  deletedAt: string | null;
};

type Props = {
  users: UserItem[];
};

export function UsersTableClient({ users }: Props) {
  const [loadingId, setLoadingId] = React.useState<string | null>(null);
  const [loadingAction, setLoadingAction] = React.useState<string | null>(null);

  async function runAction(userId: string, action: "ban" | "unban" | "hard_delete") {
    setLoadingId(userId);
    setLoadingAction(action);
    try {
      const res = await fetch("/api/admin/utilizadores/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data?.error || "Erro ao executar ação.");
      } else {
        alert(data?.message || "Ação concluída.");
        window.location.reload();
      }
    } catch (err) {
      console.error("[UsersTableClient] action error:", err);
      alert("Erro inesperado.");
    } finally {
      setLoadingId(null);
      setLoadingAction(null);
    }
  }

  return (
    <div className="admin-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="admin-table text-left">
          <thead>
            <tr>
              <th className="px-4 py-3">Username</th>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">Cidade</th>
              <th className="px-4 py-3">Roles</th>
              <th className="px-4 py-3">Criado</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-3 whitespace-nowrap text-white/90">
                  {u.username ? `@${u.username}` : "—"}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-white/80">
                  {u.fullName || "—"}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-white/70">
                  {u.city || "—"}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="flex flex-wrap gap-2">
                    {(u.roles || []).map((r) => (
                      <span key={r} className="admin-chip">
                        {r}
                      </span>
                    ))}
                    {(!u.roles || u.roles.length === 0) && (
                      <span className="text-white/45 text-[10px] uppercase tracking-[0.18em]">sem roles</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-white/60">
                  {new Date(u.createdAt).toLocaleDateString("pt-PT", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {u.isDeleted ? (
                    <span className="inline-flex items-center rounded-full border border-rose-500/40 bg-rose-500/15 px-2 py-1 text-[10px] font-semibold text-rose-100">
                      Banido
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full border border-emerald-400/40 bg-emerald-500/15 px-2 py-1 text-[10px] font-semibold text-emerald-100">
                      Ativo
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="flex flex-wrap gap-2">
                    {u.isDeleted ? (
                      <button
                        onClick={() => runAction(u.id, "unban")}
                        disabled={loadingId === u.id}
                        className="admin-button-secondary px-3 py-1 text-[11px] text-emerald-100 border-emerald-400/40 disabled:opacity-40"
                      >
                        {loadingId === u.id && loadingAction === "unban"
                          ? "A reativar..."
                          : "Reativar"}
                      </button>
                    ) : (
                      <button
                        onClick={() => runAction(u.id, "ban")}
                        disabled={loadingId === u.id}
                        className="admin-button-secondary px-3 py-1 text-[11px] text-amber-100 border-amber-400/40 disabled:opacity-40"
                      >
                        {loadingId === u.id && loadingAction === "ban"
                          ? "A banir..."
                          : "Banir"}
                      </button>
                    )}
                    <button
                      onClick={() => {
                        const ok = confirm(
                          "Eliminar em definitivo este utilizador? Esta ação remove do Auth e do perfil.",
                        );
                        if (ok) runAction(u.id, "hard_delete");
                      }}
                      disabled={loadingId === u.id}
                      className="admin-button-secondary px-3 py-1 text-[11px] text-rose-100 border-rose-500/50 disabled:opacity-40"
                    >
                      {loadingId === u.id && loadingAction === "hard_delete"
                        ? "A apagar..."
                        : "Hard delete"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
