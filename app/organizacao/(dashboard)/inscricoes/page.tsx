"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { useUser } from "@/app/hooks/useUser";
import { useAuthModal } from "@/app/components/autenticação/AuthModalContext";
import ObjectiveSubnav from "@/app/organizacao/ObjectiveSubnav";
import { CTA_PRIMARY } from "@/app/organizacao/dashboardUi";

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
  const { data, mutate, isLoading: loadingForms } = useSWR<FormsResponse>(
    user ? "/api/organizacao/inscricoes" : null,
    fetcher,
  );

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const items = useMemo(() => (data?.ok ? data.items : []), [data]);
  const moduleDisabled = data?.ok === false && data?.error?.includes("Módulo");
  const loadError = data?.ok === false && !moduleDisabled ? data?.error : null;

  const handleCreate = async () => {
    if (!user) {
      openModal({
        mode: "login",
        redirectTo: embedded ? "/organizacao?tab=manage&section=inscricoes" : "/organizacao/inscricoes",
        showGoogle: true,
      });
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/organizacao/inscricoes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        setError(json?.error || "Não foi possível criar a inscrição.");
        setCreating(false);
        return;
      }
      setTitle("");
      setDescription("");
      mutate();
      if (json?.form?.id) {
        router.push(`/organizacao/inscricoes/${json.form.id}`);
      }
      setCreating(false);
    } catch (err) {
      console.error("[inscricoes][create] erro", err);
      setError("Erro inesperado ao criar inscrição.");
      setCreating(false);
    }
  };

  if (isLoading) {
    return (
      <div className={embedded ? "text-sm text-white/70" : "px-6 py-10 text-sm text-white/70"}>
        A carregar...
      </div>
    );
  }

  const wrapperClass = embedded ? "space-y-6 text-white" : "px-6 py-8 space-y-6 text-white";

  return (
    <div className={wrapperClass}>
      {!embedded && <ObjectiveSubnav objective="manage" activeId="inscricoes" />}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-white/60">Inscrições</p>
          <h1 className="text-2xl font-semibold">Inscrições e formulários</h1>
          <p className="text-sm text-white/60">
            Cria inscrições ou formulários simples para recolher informação e vagas.
          </p>
        </div>
      </div>

      <div className="rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1124]/70 to-[#050810]/90 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-2xl space-y-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Criar nova inscrição</h2>
          <p className="text-[12px] text-white/60">
            Começa pelo nome e depois ajusta campos, datas e capacidade.
          </p>
        </div>
        {moduleDisabled && (
          <div className="rounded-2xl border border-amber-400/40 bg-amber-400/10 p-3 text-sm text-amber-100">
            O módulo de Inscrições está desativado para esta organização.
          </div>
        )}
        <div className="grid gap-3 md:grid-cols-[1.2fr_1.8fr]">
          <input
            className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]"
            placeholder="Título da inscrição"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <input
            className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]"
            placeholder="Descrição curta (opcional) · também pode ser só um formulário"
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
          {creating ? "A criar..." : "Criar inscrição"}
        </button>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">As tuas inscrições</h2>
          <span className="text-[12px] text-white/60">{items.length} total</span>
        </div>

        {loadingForms && <p className="text-sm text-white/60">A carregar inscrições...</p>}
        {loadError && <p className="text-sm text-red-300">{loadError}</p>}

        {!loadingForms && !loadError && items.length === 0 && (
          <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 p-4 text-sm text-white/70">
            Ainda não criaste nenhuma inscrição ou formulário. Usa o botão acima para começar.
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          {items.map((form) => (
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
                  {form.submissionsCount} inscrito{form.submissionsCount === 1 ? "" : "s"}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-[12px]">
                <Link
                  href={`/organizacao/inscricoes/${form.id}`}
                  className="rounded-full bg-white px-3 py-1 text-black"
                >
                  Gerir
                </Link>
                <Link
                  href={`/inscricoes/${form.id}`}
                  className="rounded-full border border-white/20 px-3 py-1 text-white/80 hover:bg-white/10"
                >
                  Ver público
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
