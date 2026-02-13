"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Avatar } from "@/components/ui/avatar";

type OrganizationFollowerItem = {
  userId: string;
  username: string | null;
  fullName: string | null;
  avatarUrl: string | null;
};

type OrgProfileFollowersClientProps = {
  orgId: number;
};

function buildFollowerLabel(item: OrganizationFollowerItem) {
  return item.fullName?.trim() || item.username?.trim() || "Utilizador ORYA";
}

export default function OrgProfileFollowersClient({ orgId }: OrgProfileFollowersClientProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<OrganizationFollowerItem[]>([]);

  const loadFollowers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/social/organization-followers?organizationId=${orgId}&limit=100`, {
        cache: "no-store",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok || !Array.isArray(json.items)) {
        throw new Error(json?.error || "Nao foi possivel carregar seguidores.");
      }
      setItems(json.items as OrganizationFollowerItem[]);
    } catch (err) {
      setItems([]);
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    void loadFollowers();
  }, [loadFollowers]);

  const filteredItems = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return items;
    return items.filter((item) => {
      const label = buildFollowerLabel(item).toLowerCase();
      const username = item.username?.toLowerCase() ?? "";
      return label.includes(trimmed) || username.includes(trimmed);
    });
  }, [items, query]);

  return (
    <div className="space-y-5 text-white">
      <section className="rounded-3xl border border-white/12 bg-white/5 p-5 shadow-[0_24px_70px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.24em] text-white/60">Profile Tool</p>
            <h1 className="mt-1 text-2xl font-semibold text-white">Followers</h1>
            <p className="mt-1 text-sm text-white/65">
              Comunidade da organizacao com pesquisa rapida e acesso direto a cada perfil.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadFollowers()}
            disabled={loading}
            className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold text-white/85 transition hover:bg-white/15 disabled:opacity-60"
          >
            {loading ? "A atualizar..." : "Atualizar"}
          </button>
        </div>
      </section>

      <section className="rounded-3xl border border-white/12 bg-white/5 p-5 shadow-[0_24px_70px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-white/70">
            {loading ? "A carregar seguidores..." : `${items.length} seguidores encontrados`}
          </p>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Pesquisar follower..."
            className="w-full rounded-full border border-white/20 bg-black/25 px-4 py-2 text-sm text-white outline-none transition focus:border-[#6BFFFF] sm:w-72"
          />
        </div>

        {error ? (
          <div className="mt-4 rounded-2xl border border-rose-400/35 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {error}
          </div>
        ) : null}

        {!loading && !error && filteredItems.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-white/12 bg-black/20 px-4 py-6 text-center text-sm text-white/65">
            Nenhum follower corresponde a pesquisa.
          </div>
        ) : null}

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {filteredItems.map((item) => {
            const label = buildFollowerLabel(item);
            const href = item.username ? `/${item.username}` : "/social";
            return (
              <Link
                key={item.userId}
                href={href}
                className="group flex items-center justify-between gap-3 rounded-2xl border border-white/12 bg-white/5 px-4 py-3 transition hover:border-white/30 hover:bg-white/10"
              >
                <div className="flex items-center gap-3">
                  <Avatar
                    src={item.avatarUrl}
                    name={label}
                    className="h-11 w-11 border border-white/12"
                    textClassName="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/80"
                    fallbackText="OR"
                  />
                  <div>
                    <p className="text-sm font-semibold text-white">{label}</p>
                    <p className="text-[12px] text-white/60">{item.username ? `@${item.username}` : "Sem username"}</p>
                  </div>
                </div>
                <span className="text-[12px] text-white/45 transition group-hover:text-white/80">Abrir</span>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
