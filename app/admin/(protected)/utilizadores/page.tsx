// app/admin/utilizadores/page.tsx

export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import type { Prisma } from "@prisma/client";
import { UsersTableClient } from "./UsersTableClient";
import { AdminLayout } from "@/app/admin/components/AdminLayout";
import { AdminPageHeader } from "@/app/admin/components/AdminPageHeader";

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
    ];
  }

  const [totalUsers, totalOrganizations, totalAdmins, users] = await Promise.all([
    prisma.profile.count(),
    prisma.profile.count({
      where: {
        roles: {
          has: "organization",
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
        roles: true,
        createdAt: true,
        isDeleted: true,
        deletedAt: true,
      },
    }),
  ]);

  return (
    <AdminLayout title="Utilizadores" subtitle="Gestão de contas e roles da plataforma.">
      <section className="space-y-6">
        {/* Header + search */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <AdminPageHeader
            title="Utilizadores"
            subtitle="Pesquisa e visão rápida dos perfis registados na ORYA. Área interna de gestão."
            eyebrow="Admin • Utilizadores"
          />

          <form className="w-full md:w-72" action="/admin/utilizadores" method="GET">
            <label className="block text-[10px] uppercase tracking-[0.2em] text-white/45 mb-1">
              Pesquisar utilizador (username ou nome)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                name="q"
                defaultValue={search}
                placeholder="ex: joao, porto..."
                className="admin-input"
              />
              <button
                type="submit"
                className="admin-button px-3 py-2 text-[11px] active:scale-95"
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
              Organizações
            </p>
            <p className="mt-1 text-2xl font-semibold">{totalOrganizations}</p>
            <p className="mt-1 text-[11px] text-white/55">
              Perfis com role de organização ativa.
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
    </AdminLayout>
  );
}
