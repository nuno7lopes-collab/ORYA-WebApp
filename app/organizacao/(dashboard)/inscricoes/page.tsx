"use client";

import { resolveCanonicalOrgApiPath } from "@/lib/canonicalOrgApiPath";

import Link from "next/link";
import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import { useUser } from "@/app/hooks/useUser";
import { useAuthModal } from "@/app/components/autenticação/AuthModalContext";
import { CTA_PRIMARY, CTA_SECONDARY } from "@/app/organizacao/dashboardUi";
import { cn } from "@/lib/utils";
import { appendOrganizationIdToHref, parseOrganizationId } from "@/lib/organizationIdUtils";

type FormItem = {
  id: number;
  title: string;
  description: string | null;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  capacity: number | null;
  waitlistEnabled: boolean;
  startAt: string | null;
  endAt: string | null;
  createdAt: string;
  submissionsCount: number;
};

type FormsResponse = { ok: boolean; items: FormItem[]; error?: string };

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const statusLabel: Record<FormItem["status"], string> = {
  DRAFT: "Rascunho",
  PUBLISHED: "Publicado",
  ARCHIVED: "Arquivado",
};

const STATUS_VIEW_OPTIONS: Array<{
  id: "ativos" | "rascunhos" | "arquivados" | "todos";
  label: string;
  statuses: FormItem["status"][];
}> = [
  { id: "ativos", label: "Ativos", statuses: ["PUBLISHED"] },
  { id: "rascunhos", label: "Rascunhos", statuses: ["DRAFT"] },
  { id: "arquivados", label: "Arquivados", statuses: ["ARCHIVED"] },
  { id: "todos", label: "Todos", statuses: ["DRAFT", "PUBLISHED", "ARCHIVED"] },
];

const STATUS_VIEW_HELPER: Record<(typeof STATUS_VIEW_OPTIONS)[number]["id"], string> = {
  ativos: "Formulários publicados e visíveis no perfil.",
  rascunhos: "Formulários em preparação, ainda não visíveis no perfil.",
  arquivados: "Fora do perfil, com histórico preservado.",
  todos: "Visão completa de todos os formulários.",
};

const formatDate = (value: string | null) => {
  if (!value) return "Disponível sempre";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Disponível sempre";
  return parsed.toLocaleDateString("pt-PT", { day: "2-digit", month: "short", year: "numeric" });
};

type InscricoesPageProps = {
  embedded?: boolean;
};

export default function InscricoesPage({ embedded }: InscricoesPageProps) {
  const { user, isLoading } = useUser();
  const { openModal } = useAuthModal();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const organizationId = parseOrganizationId(searchParams?.get("organizationId"));
  const baseHref = appendOrganizationIdToHref("/organizacao/inscricoes", organizationId);
  const { data, mutate, isLoading: loadingForms } = useSWR<FormsResponse>(
    user ? resolveCanonicalOrgApiPath("/api/org/[orgId]/inscricoes") : null,
    fetcher,
  );

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);

  const items = useMemo(() => (data?.ok ? data.items : []), [data]);
  const moduleDisabled = data?.ok === false && data?.error?.includes("Módulo");
  const loadError = data?.ok === false && !moduleDisabled ? data?.error : null;
  const viewParam = searchParams?.get("view") ?? "ativos";
  const activeView =
    STATUS_VIEW_OPTIONS.find((option) => option.id === viewParam)?.id ?? "ativos";
  const activeViewMeta =
    STATUS_VIEW_OPTIONS.find((option) => option.id === activeView) ?? STATUS_VIEW_OPTIONS[0];
  const viewCounts = useMemo(() => {
    const base = {
      ativos: 0,
      rascunhos: 0,
      arquivados: 0,
      todos: items.length,
    };
    items.forEach((form) => {
      if (form.status === "PUBLISHED") base.ativos += 1;
      if (form.status === "DRAFT") base.rascunhos += 1;
      if (form.status === "ARCHIVED") base.arquivados += 1;
    });
    return base;
  }, [items]);
  const filteredItems = useMemo(() => {
    if (activeViewMeta.id === "todos") return items;
    return items.filter((form) => activeViewMeta.statuses.includes(form.status));
  }, [activeViewMeta, items]);

  const handleCreate = async () => {
    if (!user) {
      openModal({
        mode: "login",
        redirectTo: baseHref,
        showGoogle: true,
      });
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const res = await fetch(resolveCanonicalOrgApiPath("/api/org/[orgId]/inscricoes"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        setError(json?.error || "Não foi possível criar o formulário.");
        setCreating(false);
        return;
      }
      setTitle("");
      setDescription("");
      mutate();
      if (json?.form?.id) {
        router.push(appendOrganizationIdToHref(`/organizacao/inscricoes/${json.form.id}`, organizationId));
      }
      setCreating(false);
    } catch (err) {
      console.error("[inscricoes][create] erro", err);
      setError("Erro inesperado ao criar formulário.");
      setCreating(false);
    }
  };

  const updateFormStatus = async (formId: number, nextStatus: FormItem["status"]) => {
    setActionLoadingId(formId);
    setActionError(null);
    try {
      const res = await fetch(resolveCanonicalOrgApiPath(`/api/org/[orgId]/inscricoes/${formId}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        setActionError(json?.error || "Não foi possível atualizar o estado.");
        setActionLoadingId(null);
        return;
      }
      mutate();
      setActionLoadingId(null);
    } catch (err) {
      console.error("[inscricoes][status] erro", err);
      setActionError("Erro inesperado ao atualizar.");
      setActionLoadingId(null);
    }
  };

  const buildViewHref = (view: string) => {
    const params = new URLSearchParams(searchParams?.toString());
    params.set("view", view);
    return `${pathname}?${params.toString()}`;
  };

  if (isLoading) {
    return (
      <div
        className={cn(
          embedded ? "text-sm text-white/70" : "w-full py-10 text-sm text-white/70",
        )}
      >
        A carregar...
      </div>
    );
  }

  const wrapperClass = cn(
    embedded ? "space-y-6 text-white" : "w-full space-y-6 py-8 text-white",
  );

  return (
    <div className={wrapperClass}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-white/60">Formulários</p>
          <h1 className="text-2xl font-semibold">Formulários</h1>
          <p className="text-sm text-white/60">
            Cria formulários para recolher inscrições, dados e preferências.
          </p>
        </div>
      </div>

      <div className="rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1124]/70 to-[#050810]/90 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-2xl space-y-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Criar novo formulário</h2>
          <p className="text-[12px] text-white/60">
            Começa pelo nome e depois ajusta campos, datas e capacidade.
          </p>
        </div>
        {moduleDisabled && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-amber-400/40 bg-amber-400/10 p-3 text-sm text-amber-100">
            <span>O módulo de Formulários está desativado para esta organização.</span>
            <Link href="/organizacao/overview?section=modulos" className={`${CTA_SECONDARY} text-[12px]`}>
              Gerir apps
            </Link>
          </div>
        )}
        <div className="grid gap-3 md:grid-cols-[1.2fr_1.8fr]">
          <input
            className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]"
            placeholder="Título do formulário"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <input
            className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]"
            placeholder="Descrição curta (opcional) · podes usar como formulário simples"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        {error && <p className="text-sm text-red-300">{error}</p>}
        <button
          type="button"
          disabled={creating || !title.trim() || moduleDisabled}
          onClick={handleCreate}
          className={`${CTA_PRIMARY} px-4 py-2 text-sm disabled:opacity-60`}
        >
          {creating ? "A criar..." : "Criar formulário"}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {STATUS_VIEW_OPTIONS.map((option) => {
          const isActive = option.id === activeView;
          return (
            <Link
              key={option.id}
              href={buildViewHref(option.id)}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[12px] font-semibold transition",
                isActive
                  ? "border-white/30 bg-white/15 text-white shadow-[0_12px_30px_rgba(107,255,255,0.2)]"
                  : "border-white/10 text-white/70 hover:bg-white/10",
              )}
            >
              {option.label}
              <span className="rounded-full border border-white/10 bg-white/10 px-2 py-0.5 text-[11px] text-white/70">
                {viewCounts[option.id]}
              </span>
            </Link>
          );
        })}
      </div>
      <p className="text-[12px] text-white/60">{STATUS_VIEW_HELPER[activeView]}</p>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Os teus formulários</h2>
          <span className="text-[12px] text-white/60">
            {activeView === "todos" ? items.length : `${filteredItems.length} de ${items.length}`}
          </span>
        </div>

        {loadingForms && <p className="text-sm text-white/60">A carregar formulários...</p>}
        {loadError && <p className="text-sm text-red-300">{loadError}</p>}
        {actionError && <p className="text-sm text-red-300">{actionError}</p>}

        {!loadingForms && !loadError && filteredItems.length === 0 && (
          <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 p-4 text-sm text-white/70">
            Ainda não tens formulários nesta vista. Usa o botão acima para começar.
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          {filteredItems.map((form) => (
            <div
              key={form.id}
              className="rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1124]/70 to-[#050810]/90 p-5 shadow-[0_22px_70px_rgba(0,0,0,0.5)] backdrop-blur-2xl space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <h3 className="text-lg font-semibold">{form.title}</h3>
                  {form.description && <p className="text-[12px] text-white/70">{form.description}</p>}
                </div>
                <span className="rounded-full border border-white/15 bg-white/10 px-2 py-1 text-[11px] text-white/70">
                  {statusLabel[form.status]}
                </span>
              </div>
              <div className="flex flex-wrap gap-2 text-[11px] text-white/60">
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5">
                  {formatDate(form.startAt)}
                </span>
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5">
                  {form.capacity ? `${form.capacity} vagas` : "Sem limite"}
                </span>
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5">
                  {form.submissionsCount} resposta{form.submissionsCount === 1 ? "" : "s"}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-[12px]">
                <Link
                  href={`/organizacao/inscricoes/${form.id}?tab=construcao`}
                  className="rounded-full bg-white px-3 py-1 text-black"
                >
                  Editar
                </Link>
                <Link
                  href={`/organizacao/inscricoes/${form.id}?tab=respostas&respostas=individual`}
                  className="rounded-full border border-white/20 px-3 py-1 text-white/80 hover:bg-white/10"
                >
                  Respostas
                </Link>
                {form.status !== "ARCHIVED" && (
                  <Link
                    href={`/inscricoes/${form.id}`}
                    className="rounded-full border border-white/20 px-3 py-1 text-white/80 hover:bg-white/10"
                  >
                    {form.status === "PUBLISHED" ? "Ver público" : "Pré-visualizar"}
                  </Link>
                )}
                {form.status === "PUBLISHED" && (
                  <button
                    type="button"
                    disabled={actionLoadingId === form.id}
                    onClick={() => {
                      const confirmed = window.confirm(
                        `Arquivar o formulário "${form.title}"?`,
                      );
                      if (!confirmed) return;
                      updateFormStatus(form.id, "ARCHIVED");
                    }}
                    className="rounded-full border border-white/20 px-3 py-1 text-white/70 hover:bg-white/10 disabled:opacity-60"
                  >
                    Arquivar
                  </button>
                )}
                {form.status === "DRAFT" && (
                  <>
                    <button
                      type="button"
                      disabled={actionLoadingId === form.id}
                      onClick={() => updateFormStatus(form.id, "PUBLISHED")}
                      className="rounded-full border border-white/20 px-3 py-1 text-white/70 hover:bg-white/10 disabled:opacity-60"
                    >
                      Publicar
                    </button>
                    <button
                      type="button"
                      disabled={actionLoadingId === form.id}
                      onClick={() => {
                        const confirmed = window.confirm(
                          `Arquivar o rascunho "${form.title}"?`,
                        );
                        if (!confirmed) return;
                        updateFormStatus(form.id, "ARCHIVED");
                      }}
                      className="rounded-full border border-white/20 px-3 py-1 text-white/70 hover:bg-white/10 disabled:opacity-60"
                    >
                      Arquivar rascunho
                    </button>
                  </>
                )}
                {form.status === "ARCHIVED" && (
                  <button
                    type="button"
                    disabled={actionLoadingId === form.id}
                    onClick={() => updateFormStatus(form.id, "DRAFT")}
                    className="rounded-full border border-white/20 px-3 py-1 text-white/70 hover:bg-white/10 disabled:opacity-60"
                  >
                    Reativar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
