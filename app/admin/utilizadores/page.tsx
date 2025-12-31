// app/admin/utilizadores/page.tsx

export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import type { Prisma } from "@prisma/client";
import { UsersTableClient } from "./UsersTableClient";

type AdminUsersPageProps = {
  searchParams?: {
    q?: string;
  };
};

export default async function AdminUsersPage({ searchParams }: AdminUsersPageProps) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  // Confirmar se o user é admin
  const me = await prisma.profile.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      username: true,
      roles: true,
    },
  });

  if (!me || !Array.isArray(me.roles) || !me.roles.includes("admin")) {
    redirect("/");
  }

  const resolvedSearchParams = await Promise.resolve(searchParams);
  const search = (resolvedSearchParams?.q || "").trim();

  const where: Prisma.ProfileWhereInput = {};
  if (search.length > 0) {
    where.OR = [
      { username: { contains: search, mode: "insensitive" } },
      { fullName: { contains: search, mode: "insensitive" } },
      { city: { contains: search, mode: "insensitive" } },
    ];
  }

  const [totalUsers, totalOrganizers, totalAdmins, users] = await Promise.all([
    prisma.profile.count(),
    prisma.profile.count({
      where: {
        roles: {
          has: "organizer",
        },
      },
    }),
    prisma.profile.count({
      where: {
        roles: {
          has: "admin",
        },
      },
    }),
    prisma.profile.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        username: true,
        fullName: true,
        city: true,
        roles: true,
        createdAt: true,
        isDeleted: true,
        deletedAt: true,
      },
    }),
  ]);

  return (
    <main className="min-h-screen text-white pb-16">
      {/* Top bar */}
      <header className="border-b border-white/10 bg-black/50 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-5 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] text-[10px] font-extrabold tracking-[0.16em]">
              ADM
            </span>
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/60">
                Painel · Admin
              </p>
              <p className="text-sm text-white/85">Gestão de utilizadores da plataforma.</p>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-2 text-[11px] text-white/70">
            <span className="px-2 py-1 rounded-full border border-white/15">
              {me.username ? `@${me.username}` : "Admin"}
            </span>
          </div>
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-5 pt-6 space-y-6">
        {/* Header + search */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
              Utilizadores
            </h1>
            <p className="text-sm text-white/70 max-w-xl">
              Pesquisa e visão rápida dos perfis registados na ORYA. Esta área é apenas
              para debugging e gestão interna.
            </p>
          </div>

          <form className="w-full md:w-72" action="/admin/utilizadores" method="GET">
            <label className="block text-[11px] text-white/65 mb-1">
              Pesquisar utilizador (username, nome, cidade)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                name="q"
                defaultValue={search}
                placeholder="ex: joao, porto..."
                className="flex-1 rounded-xl border border-white/20 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-[#6BFFFF]/80"
              />
              <button
                type="submit"
                className="px-3 py-2 rounded-xl bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] text-[11px] font-semibold text-black shadow-[0_0_14px_rgba(107,255,255,0.6)] hover:scale-[1.02] active:scale-95 transition-transform"
              >
                Buscar
              </button>
            </div>
          </form>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-white/12 bg-black/60 px-4 py-3">
            <p className="text-[11px] text-white/55 uppercase tracking-[0.14em]">
              Utilizadores totais
            </p>
            <p className="mt-1 text-2xl font-semibold">{totalUsers}</p>
            <p className="mt-1 text-[11px] text-white/55">
              Perfis com conta criada na ORYA.
            </p>
          </div>
          <div className="rounded-2xl border border-white/12 bg-black/60 px-4 py-3">
            <p className="text-[11px] text-white/55 uppercase tracking-[0.14em]">
              Organizadores
            </p>
            <p className="mt-1 text-2xl font-semibold">{totalOrganizers}</p>
            <p className="mt-1 text-[11px] text-white/55">
              Perfis com role de organizador ativa.
            </p>
          </div>
          <div className="rounded-2xl border border-white/12 bg-black/60 px-4 py-3">
            <p className="text-[11px] text-white/55 uppercase tracking-[0.14em]">
              Admins
            </p>
            <p className="mt-1 text-2xl font-semibold">{totalAdmins}</p>
            <p className="mt-1 text-[11px] text-white/55">
              Contas com acesso ao painel de admin.
            </p>
          </div>
        </div>

        {/* Lista de utilizadores */}
        <div className="mt-4 rounded-2xl border border-white/12 bg-black/70 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <p className="text-[11px] text-white/65 uppercase tracking-[0.16em]">
              Resultados
            </p>
            <p className="text-[11px] text-white/50">
              A mostrar até 50 perfis {search ? "filtrados" : "mais recentes"}.
            </p>
          </div>

          {users.length === 0 ? (
            <div className="px-4 py-6 text-sm text-white/65">
              Nenhum utilizador encontrado para este filtro.
            </div>
          ) : (
            <UsersTableClient
              users={users.map((u) => ({
                ...u,
                createdAt: u.createdAt.toISOString(),
                deletedAt: u.deletedAt ? u.deletedAt.toISOString() : null,
              }))}
            />
          )}
        </div>
      </section>
    </main>
  );
}
