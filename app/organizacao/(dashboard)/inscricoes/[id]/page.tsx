"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getPublicBaseUrl } from "@/lib/publicBaseUrl";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import { cn } from "@/lib/utils";

type FieldType = "TEXT" | "TEXTAREA" | "EMAIL" | "PHONE" | "NUMBER" | "DATE" | "SELECT" | "CHECKBOX";

type FormField = {
  id: number;
  label: string;
  fieldType: FieldType;
  required: boolean;
  helpText: string | null;
  placeholder: string | null;
  options: string[] | null;
  order: number;
};

type FormStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";
type SubmissionStatus = "SUBMITTED" | "IN_REVIEW" | "ACCEPTED" | "WAITLISTED" | "INVITED" | "REJECTED";

type FormResponse = {
  ok: boolean;
  form?: {
    id: number;
    title: string;
    description: string | null;
    status: FormStatus;
    capacity: number | null;
    waitlistEnabled: boolean;
    startAt: string | null;
    endAt: string | null;
    submissionsCount: number;
    fields: FormField[];
  };
  error?: string;
};

type FieldDraft = {
  key: string;
  label: string;
  fieldType: FieldType;
  required: boolean;
  helpText: string;
  placeholder: string;
  options: string;
};

type SubmissionItem = {
  id: number;
  status: SubmissionStatus;
  createdAt: string;
  guestEmail: string | null;
  user: { id: string; fullName: string | null; username: string | null; avatarUrl: string | null } | null;
  answers: Record<string, unknown>;
};

type SubmissionsResponse = { ok: boolean; items: SubmissionItem[]; error?: string };
type SummaryResponse = {
  ok: boolean;
  totalCount: number;
  last7Days: number;
  statusCounts: Record<SubmissionStatus, number>;
  latestSubmission: SubmissionItem | null;
  error?: string;
};

const fetcher = (url: string) => fetch(url).then((res) => res.json());
const normalizeIntegerInput = (value: string) => {
  const match = value.trim().match(/^\d+/);
  return match ? match[0] : "";
};

const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: "TEXT", label: "Texto curto" },
  { value: "TEXTAREA", label: "Texto longo" },
  { value: "EMAIL", label: "Email" },
  { value: "PHONE", label: "Telefone" },
  { value: "NUMBER", label: "Número" },
  { value: "DATE", label: "Data" },
  { value: "SELECT", label: "Escolha única" },
  { value: "CHECKBOX", label: "Confirmação" },
];

const STATUS_LABEL: Record<FormStatus, string> = {
  DRAFT: "Rascunho",
  PUBLISHED: "Publicado",
  ARCHIVED: "Arquivado",
};

const SUBMISSION_STATUS_LABEL: Record<SubmissionStatus, string> = {
  SUBMITTED: "Submetida",
  IN_REVIEW: "Em análise",
  ACCEPTED: "Aceite",
  WAITLISTED: "Lista de espera",
  INVITED: "Convocado",
  REJECTED: "Recusada",
};

const SUBMISSIONS_PAGE_SIZE = 50;
const STATUS_COUNT_DEFAULT: Record<SubmissionStatus, number> = {
  SUBMITTED: 0,
  IN_REVIEW: 0,
  ACCEPTED: 0,
  WAITLISTED: 0,
  INVITED: 0,
  REJECTED: 0,
};

export default function InscricaoDetailPage() {
  const params = useParams<{ id: string }>();
  const formId = params?.id ?? "";
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParamRaw = searchParams?.get("tab") ?? "construcao";
  const normalizedTab = tabParamRaw === "editar" ? "construcao" : tabParamRaw;
  const activeTab =
    normalizedTab === "construcao" ||
    normalizedTab === "respostas" ||
    normalizedTab === "definicoes" ||
    normalizedTab === "partilha"
      ? normalizedTab
      : "construcao";
  const respostasParam = searchParams?.get("respostas") ?? "resumo";
  const definicoesParam = searchParams?.get("definicoes") ?? "geral";
  const { data, mutate, isLoading } = useSWR<FormResponse>(
    formId ? `/api/organizacao/inscricoes/${formId}` : null,
    fetcher,
  );
  const {
    data: summaryData,
    mutate: mutateSummary,
    isLoading: loadingSummary,
  } = useSWR<SummaryResponse>(
    formId ? `/api/organizacao/inscricoes/${formId}/summary` : null,
    fetcher,
  );
  const submissionsKey = formId
    ? `/api/organizacao/inscricoes/${formId}/submissions?take=${SUBMISSIONS_PAGE_SIZE}&skip=0`
    : null;
  const {
    data: submissionsData,
    mutate: mutateSubmissions,
    isLoading: loadingSubmissions,
  } = useSWR<SubmissionsResponse>(submissionsKey, fetcher);

  const form = data?.form ?? null;
  const canEditFields =
    (summaryData?.ok ? summaryData.totalCount : form?.submissionsCount ?? 0) === 0;
  const formError = data?.ok === false ? data?.error : null;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<FormStatus>("DRAFT");
  const [capacity, setCapacity] = useState<string>("");
  const [capacityEnabled, setCapacityEnabled] = useState(false);
  const [waitlistEnabled, setWaitlistEnabled] = useState(true);
  const [dateEnabled, setDateEnabled] = useState(false);
  const [endDateEnabled, setEndDateEnabled] = useState(false);
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [fields, setFields] = useState<FieldDraft[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [statusUpdatingId, setStatusUpdatingId] = useState<number | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [publicUrl, setPublicUrl] = useState("");
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [submissionItems, setSubmissionItems] = useState<SubmissionItem[]>([]);
  const [nowMs, setNowMs] = useState<number | null>(null);
  const [hasLoadedMore, setHasLoadedMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);

  useEffect(() => {
    if (!form) return;
    const hasCapacity = form.capacity !== null && form.capacity !== undefined;
    const hasStartDate = Boolean(form.startAt);
    const hasEndDate = Boolean(form.endAt);

    setTitle(form.title);
    setDescription(form.description ?? "");
    setStatus(form.status);
    setCapacityEnabled(hasCapacity);
    setCapacity(hasCapacity ? String(form.capacity) : "");
    setWaitlistEnabled(hasCapacity ? form.waitlistEnabled : false);
    setDateEnabled(hasStartDate || hasEndDate);
    setEndDateEnabled(hasEndDate);
    setStartAt(hasStartDate ? form.startAt!.slice(0, 16) : "");
    setEndAt(hasEndDate ? form.endAt!.slice(0, 16) : "");
    setFields(
      form.fields.map((field) => ({
        key: String(field.id),
        label: field.label,
        fieldType: field.fieldType,
        required: field.required,
        helpText: field.helpText ?? "",
        placeholder: field.placeholder ?? "",
        options: field.options ? field.options.join(", ") : "",
      })),
    );
  }, [form]);

  useEffect(() => {
    setNowMs(Date.now());
  }, []);

  useEffect(() => {
    if (!form) return;
    const baseUrl = getPublicBaseUrl();
    if (!baseUrl) return;
    setPublicUrl(`${baseUrl.replace(/\/+$/, "")}/inscricoes/${form.id}`);
  }, [form]);

  useEffect(() => {
    setSubmissionItems([]);
    setHasLoadedMore(false);
    setLoadingMore(false);
    setLoadMoreError(null);
  }, [formId]);

  useEffect(() => {
    if (!submissionsData) return;
    if (!submissionsData.ok) {
      if (!hasLoadedMore) setSubmissionItems([]);
      return;
    }
    if (!hasLoadedMore) {
      setSubmissionItems(submissionsData.items);
      return;
    }
    setSubmissionItems((prev) => {
      if (prev.length === 0) return submissionsData.items;
      const updates = new Map(submissionsData.items.map((item) => [item.id, item]));
      const updated = prev.map((item) => updates.get(item.id) ?? item);
      const existingIds = new Set(updated.map((item) => item.id));
      const newItems = submissionsData.items.filter((item) => !existingIds.has(item.id));
      return newItems.length > 0 ? [...newItems, ...updated] : updated;
    });
  }, [submissionsData, hasLoadedMore]);

  const addField = () => {
    setFields((prev) => [
      ...prev,
      {
        key: `new-${Date.now()}`,
        label: "Novo campo",
        fieldType: "TEXT",
        required: false,
        helpText: "",
        placeholder: "",
        options: "",
      },
    ]);
  };

  const removeField = (key: string) => {
    setFields((prev) => prev.filter((field) => field.key !== key));
  };

  const updateField = (key: string, patch: Partial<FieldDraft>) => {
    setFields((prev) => prev.map((field) => (field.key === key ? { ...field, ...patch } : field)));
  };

  const payload = useMemo(() => {
    const base: Record<string, unknown> = {
      title,
      description,
      status,
      capacity: (() => {
        if (!capacityEnabled || !capacity) return null;
        const capacityValue = Number(capacity);
        return Number.isFinite(capacityValue) ? Math.max(0, Math.floor(capacityValue)) : null;
      })(),
      waitlistEnabled: capacityEnabled ? waitlistEnabled : false,
      startAt: dateEnabled && startAt ? startAt : null,
      endAt: dateEnabled && endDateEnabled && endAt ? endAt : null,
    };
    if (canEditFields) {
      base.fields = fields.map((field) => ({
        label: field.label,
        fieldType: field.fieldType,
        required: field.required,
        helpText: field.helpText,
        placeholder: field.placeholder,
        options:
          field.fieldType === "SELECT"
            ? field.options
                .split(",")
                .map((opt) => opt.trim())
                .filter((opt) => opt.length > 0)
            : null,
      }));
    }
    return base;
  }, [title, description, status, capacity, waitlistEnabled, startAt, endAt, fields, canEditFields]);

  const submissions = submissionItems;
  const submissionsError = submissionsData?.ok === false ? submissionsData.error : null;
  const summaryError = summaryData?.ok === false ? summaryData.error : null;
  const responsesCount = summaryData?.ok
    ? summaryData.totalCount
    : form?.submissionsCount ?? submissions.length;
  const summaryStatusCounts = summaryData?.ok
    ? { ...STATUS_COUNT_DEFAULT, ...summaryData.statusCounts }
    : null;
  const submissionStatusCounts = useMemo(() => {
    const base: Record<SubmissionStatus, number> = {
      SUBMITTED: 0,
      IN_REVIEW: 0,
      ACCEPTED: 0,
      WAITLISTED: 0,
      INVITED: 0,
      REJECTED: 0,
    };
    submissions.forEach((submission) => {
      base[submission.status] = (base[submission.status] ?? 0) + 1;
    });
    return base;
  }, [submissions]);
  const statusCounts = summaryStatusCounts ?? submissionStatusCounts;
  const responsesLast7Days = useMemo(() => {
    if (summaryData?.ok) return summaryData.last7Days;
    if (nowMs === null) return 0;
    const windowMs = 7 * 24 * 60 * 60 * 1000;
    return submissions.filter((submission) => {
      const createdAt = new Date(submission.createdAt).getTime();
      return Number.isFinite(createdAt) && nowMs - createdAt <= windowMs;
    }).length;
  }, [summaryData?.ok, summaryData?.last7Days, submissions, nowMs]);
  const latestSubmission = summaryData?.ok
    ? summaryData.latestSubmission
    : (submissions
        .slice()
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] ?? null);
  const initialLoadingSubmissions = loadingSubmissions && submissions.length === 0;
  const isPartialSummary = !summaryData?.ok && !loadingSummary && responsesCount > submissions.length;
  const hasMore = submissions.length < responsesCount;

  const getAnswer = (submission: SubmissionItem, fieldType: FieldType) => {
    const field = form?.fields.find((f) => f.fieldType === fieldType) ?? null;
    if (!field) return null;
    const raw = submission.answers?.[String(field.id)];
    if (typeof raw === "string") return raw.trim();
    if (typeof raw === "number") return String(raw);
    if (typeof raw === "boolean") return raw ? "Sim" : "Não";
    return null;
  };

  const formatAnswerValue = (value: unknown) => {
    if (typeof value === "string") return value.trim() ? value.trim() : "—";
    if (typeof value === "number") return String(value);
    if (typeof value === "boolean") return value ? "Sim" : "Não";
    if (Array.isArray(value)) return value.map((entry) => String(entry)).join(", ");
    return "—";
  };

  const getNameAnswer = (submission: SubmissionItem) => {
    const field =
      form?.fields.find((f) => f.label.toLowerCase().includes("nome")) ??
      form?.fields.find((f) => f.fieldType === "TEXT") ??
      null;
    if (!field) return null;
    const raw = submission.answers?.[String(field.id)];
    return typeof raw === "string" && raw.trim() ? raw.trim() : null;
  };

  const handleStatusChange = async (submissionId: number, nextStatus: SubmissionStatus) => {
    setStatusUpdatingId(submissionId);
    setStatusMessage(null);
    try {
      const res = await fetch(`/api/organizacao/inscricoes/${formId}/submissions`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionId, status: nextStatus }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        setStatusMessage(json?.error || "Não foi possível atualizar o estado.");
        setStatusUpdatingId(null);
        return;
      }
      mutateSubmissions((current) => {
        if (!current?.ok) return current;
        return {
          ...current,
          items: current.items.map((item) =>
            item.id === submissionId ? { ...item, status: nextStatus } : item,
          ),
        };
      }, false);
      setSubmissionItems((prev) =>
        prev.map((item) => (item.id === submissionId ? { ...item, status: nextStatus } : item)),
      );
      mutateSummary();
      setStatusUpdatingId(null);
    } catch (err) {
      console.error("[inscricoes][status] erro", err);
      setStatusMessage("Erro inesperado ao atualizar.");
      setStatusUpdatingId(null);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/organizacao/inscricoes/${formId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        setMessage(json?.error || "Não foi possível guardar.");
        setSaving(false);
        return;
      }
      setMessage("Alterações guardadas.");
      mutate();
      setSaving(false);
    } catch (err) {
      console.error("[inscricoes][save] erro", err);
      setMessage("Erro inesperado ao guardar.");
      setSaving(false);
    }
  };

  if (isLoading) {
    return <div className={cn("w-full py-10 text-sm text-white/70")}>A carregar...</div>;
  }

  if (!form) {
    return (
      <div className={cn("w-full py-10 text-sm text-white/70")}>
        {formError || "Formulário não encontrado."}
      </div>
    );
  }

  const formBasePath = `/organizacao/inscricoes/${form.id}`;
  const buildHref = (patch: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams?.toString());
    Object.entries(patch).forEach(([key, value]) => {
      if (value === null) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    });
    const query = params.toString();
    return query ? `${formBasePath}?${query}` : formBasePath;
  };
  const buildTabHref = (tab: "construcao" | "respostas" | "definicoes" | "partilha") => {
    if (tab === "respostas") {
      return buildHref({ tab, respostas: "resumo", definicoes: null });
    }
    if (tab === "definicoes") {
      return buildHref({ tab, definicoes: "geral", respostas: null });
    }
    if (tab === "partilha") {
      return buildHref({ tab, respostas: null, definicoes: null });
    }
    return buildHref({ tab: "construcao", respostas: null, definicoes: null });
  };
  const buildRespostasHref = (respostas: "resumo" | "individual" | "exportar") =>
    buildHref({ tab: "respostas", respostas, definicoes: null });
  const buildDefinicoesHref = (definicoes: "geral" | "disponibilidade") =>
    buildHref({ tab: "definicoes", definicoes, respostas: null });

  const activeRespostasTab =
    respostasParam === "individual" || respostasParam === "exportar" ? respostasParam : "resumo";
  const activeDefinicoesTab =
    definicoesParam === "disponibilidade" ? definicoesParam : "geral";

  const formTabs = [
    { id: "construcao", label: "Construção", href: buildTabHref("construcao") },
    { id: "respostas", label: "Respostas", href: buildTabHref("respostas") },
    { id: "definicoes", label: "Definições", href: buildTabHref("definicoes") },
    { id: "partilha", label: "Partilha", href: buildTabHref("partilha") },
  ] as const;

  const respostasTabs = [
    { id: "resumo", label: "Resumo", href: buildRespostasHref("resumo") },
    { id: "individual", label: "Individual", href: buildRespostasHref("individual") },
    { id: "exportar", label: "Exportar", href: buildRespostasHref("exportar") },
  ] as const;

  const definicoesTabs = [
    { id: "geral", label: "Geral", href: buildDefinicoesHref("geral") },
    { id: "disponibilidade", label: "Disponibilidade", href: buildDefinicoesHref("disponibilidade") },
  ] as const;

  const statusTone =
    status === "PUBLISHED"
      ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-100"
      : status === "ARCHIVED"
        ? "border-amber-400/40 bg-amber-400/10 text-amber-100"
        : "border-white/20 bg-white/10 text-white/70";
  const statusHint =
    status === "PUBLISHED"
      ? "Visível no perfil e pronto a receber respostas."
      : status === "ARCHIVED"
        ? "Arquivado e removido do perfil."
        : "Rascunho privado enquanto editas.";

  const embedCode = publicUrl
    ? `<iframe src="${publicUrl}" width="100%" height="900" style="border:0;"></iframe>`
    : "";
  const publicLabel = status === "PUBLISHED" ? "Ver página pública" : "Pré-visualizar";
  const canDelete = responsesCount === 0 && status !== "PUBLISHED";
  const exportUrl = form ? `/api/organizacao/inscricoes/${form.id}/export` : "";

  const handleCopy = async (value: string, label: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setShareMessage(`${label} copiado.`);
    } catch (err) {
      console.error("[inscricoes][partilha] erro ao copiar", err);
      setShareMessage("Não foi possível copiar.");
    }
    window.setTimeout(() => setShareMessage(null), 2400);
  };

  const handleLoadMore = async () => {
    if (!formId || loadingMore || !hasMore) return;
    setLoadingMore(true);
    setLoadMoreError(null);
    try {
      const skip = submissionItems.length;
      const res = await fetch(
        `/api/organizacao/inscricoes/${formId}/submissions?take=${SUBMISSIONS_PAGE_SIZE}&skip=${skip}`,
      );
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        setLoadMoreError(json?.error || "Não foi possível carregar mais respostas.");
        setLoadingMore(false);
        return;
      }
      const items = Array.isArray(json?.items) ? json.items : [];
      setSubmissionItems((prev) => {
        const existing = new Set(prev.map((item) => item.id));
        const merged = [...prev];
        items.forEach((item: SubmissionItem) => {
          if (!existing.has(item.id)) merged.push(item);
        });
        return merged;
      });
      setHasLoadedMore(true);
      setLoadingMore(false);
    } catch (err) {
      console.error("[inscricoes][load-more] erro", err);
      setLoadMoreError("Erro inesperado ao carregar mais respostas.");
      setLoadingMore(false);
    }
  };

  const handleDeleteForm = async () => {
    if (!form || !canDelete) return;
    const confirmed = window.confirm(
      `Apagar o formulário "${form.title}"? Esta ação é irreversível.`,
    );
    if (!confirmed) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/organizacao/inscricoes/${form.id}`, {
        method: "DELETE",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        setDeleteError(json?.error || "Não foi possível apagar o formulário.");
        setDeleting(false);
        return;
      }
      router.push("/organizacao/inscricoes");
      router.refresh();
    } catch (err) {
      console.error("[inscricoes][delete] erro", err);
      setDeleteError("Erro inesperado ao apagar.");
      setDeleting(false);
    }
  };

  return (
    <div className={cn("w-full space-y-6 py-8 text-white")}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-white/60">Formulário</p>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold">{form.title}</h1>
            <span
              className={cn(
                "rounded-full border px-2.5 py-1 text-[11px] uppercase tracking-[0.2em]",
                statusTone,
              )}
            >
              {STATUS_LABEL[status]}
            </span>
          </div>
          <p className="text-sm text-white/60">
            {responsesCount} resposta{responsesCount === 1 ? "" : "s"} · {STATUS_LABEL[status].toLowerCase()}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[12px]">
          <Link
            href="/organizacao/inscricoes"
            className="rounded-full border border-white/20 px-3 py-1 text-white/80 hover:bg-white/10"
          >
            Voltar
          </Link>
          {status !== "ARCHIVED" && (
            <Link
              href={`/inscricoes/${form.id}`}
              className="rounded-full border border-white/20 px-3 py-1 text-white/80 hover:bg-white/10"
            >
              {publicLabel}
            </Link>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {formTabs.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <Link
              key={tab.id}
              href={tab.href}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition",
                isActive
                  ? "border-white/30 bg-white/15 text-white shadow-[0_12px_30px_rgba(107,255,255,0.2)]"
                  : "border-white/10 text-white/70 hover:bg-white/10",
              )}
            >
              {tab.label}
              {tab.id === "respostas" && (
                <span className="rounded-full border border-white/10 bg-white/10 px-2 py-0.5 text-[11px] text-white/70">
                  {responsesCount}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      {activeTab === "construcao" && (
        <>
          <div className="rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1124]/70 to-[#050810]/90 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-2xl space-y-5">
            <div className="space-y-2">
              <label className="text-[12px] text-white/70">Título</label>
              <input
                className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-[12px] text-white/70">Descrição</label>
              <textarea
                className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF] min-h-[96px]"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>

          <div className="rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1124]/70 to-[#050810]/90 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Campos do formulário</h2>
                <p className="text-[12px] text-white/60">Edita os campos.</p>
              </div>
              <button
                type="button"
                onClick={addField}
                disabled={!canEditFields}
                className="rounded-full border border-white/20 px-3 py-1 text-[12px] text-white/80 hover:bg-white/10"
              >
                Adicionar
              </button>
            </div>
            {!canEditFields && (
              <p className="text-[12px] text-white/60">
                Já há respostas. Campos bloqueados.
              </p>
            )}

            <div className="space-y-4">
              {fields.map((field) => (
                <div key={field.key} className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
                  <div className="flex flex-wrap gap-3">
                    <input
                      className="flex-1 rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]"
                      value={field.label}
                      disabled={!canEditFields}
                      onChange={(e) => updateField(field.key, { label: e.target.value })}
                    />
                    <select
                      className="rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]"
                      value={field.fieldType}
                      disabled={!canEditFields}
                      onChange={(e) => updateField(field.key, { fieldType: e.target.value as FieldType })}
                    >
                      {FIELD_TYPES.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <label className="flex items-center gap-2 text-sm text-white/70">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-white/30 bg-black/40 text-[#6BFFFF]"
                        checked={field.required}
                        disabled={!canEditFields}
                        onChange={(e) => updateField(field.key, { required: e.target.checked })}
                      />
                      Obrigatório
                    </label>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <input
                      className="rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]"
                      placeholder="Placeholder"
                      value={field.placeholder}
                      disabled={!canEditFields}
                      onChange={(e) => updateField(field.key, { placeholder: e.target.value })}
                    />
                    <input
                      className="rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]"
                      placeholder="Texto de ajuda"
                      value={field.helpText}
                      disabled={!canEditFields}
                      onChange={(e) => updateField(field.key, { helpText: e.target.value })}
                    />
                  </div>
                  {field.fieldType === "SELECT" && (
                    <input
                      className="w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]"
                      placeholder="Opções separadas por vírgula"
                      value={field.options}
                      disabled={!canEditFields}
                      onChange={(e) => updateField(field.key, { options: e.target.value })}
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => removeField(field.key)}
                    disabled={!canEditFields}
                    className="text-[12px] text-red-300 hover:text-red-200 disabled:opacity-50"
                  >
                    Remover campo
                  </button>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black transition hover:scale-[1.01] disabled:opacity-60"
              >
                {saving ? "A guardar..." : "Guardar"}
              </button>
              {message && <span className="text-[12px] text-white/70">{message}</span>}
            </div>
          </div>
        </>
      )}

      {activeTab === "respostas" && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {respostasTabs.map((tab) => {
              const isActive = tab.id === activeRespostasTab;
              return (
                <Link
                  key={tab.id}
                  href={tab.href}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition",
                    isActive
                      ? "border-white/30 bg-white/15 text-white shadow-[0_12px_30px_rgba(107,255,255,0.2)]"
                      : "border-white/10 text-white/70 hover:bg-white/10",
                  )}
                >
                  {tab.label}
                </Link>
              );
            })}
          </div>

          {activeRespostasTab === "resumo" && (
            <div className="rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1124]/70 to-[#050810]/90 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-2xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Resumo</h2>
                  <p className="text-[12px] text-white/60">Indicadores rápidos das respostas.</p>
                </div>
                <span className="text-[12px] text-white/60">{responsesCount} total</span>
              </div>

              {(loadingSummary || initialLoadingSubmissions) && (
                <p className="text-sm text-white/60">A carregar...</p>
              )}

              {summaryError && (
                <div className="rounded-2xl border border-amber-400/40 bg-amber-400/10 p-3 text-sm text-amber-100">
                  {summaryError}
                </div>
              )}

              {submissionsError && (
                <div className="rounded-2xl border border-amber-400/40 bg-amber-400/10 p-3 text-sm text-amber-100">
                  {submissionsError}
                </div>
              )}

              {!initialLoadingSubmissions && responsesCount === 0 && (
                <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 p-4 text-sm text-white/70">
                  Sem respostas.
                </div>
              )}

              {!initialLoadingSubmissions && responsesCount > 0 && (
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-white/50">Respostas</p>
                    <p className="text-2xl font-semibold text-white">{responsesCount}</p>
                    <p className="text-[12px] text-white/60">Últimos 7 dias: {responsesLast7Days}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-white/50">Estados</p>
                    <div className="mt-2 space-y-1 text-[12px] text-white/70">
                      {Object.entries(SUBMISSION_STATUS_LABEL)
                        .filter(([value]) => statusCounts[value as SubmissionStatus] > 0)
                        .map(([value, label]) => (
                          <div key={value} className="flex items-center justify-between">
                            <span>{label}</span>
                            <span className="text-white">{statusCounts[value as SubmissionStatus]}</span>
                          </div>
                        ))}
                      {Object.values(statusCounts).every((count) => count === 0) && (
                        <p className="text-white/60">Sem estados registados.</p>
                      )}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-white/50">Última resposta</p>
                    {latestSubmission ? (
                      <>
                        <p className="text-sm font-semibold text-white">
                          {latestSubmission.user?.fullName ||
                            latestSubmission.user?.username ||
                            getNameAnswer(latestSubmission) ||
                            "Participante"}
                        </p>
                        <p className="text-[12px] text-white/60">
                          {new Date(latestSubmission.createdAt).toLocaleString("pt-PT", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </>
                    ) : (
                      <p className="text-[12px] text-white/60">Ainda sem respostas.</p>
                    )}
                  </div>
                </div>
              )}

              {isPartialSummary && (
                <p className="text-[11px] text-white/50">
                  Resumo parcial: mostra apenas as respostas carregadas.
                </p>
              )}
            </div>
          )}

          {activeRespostasTab === "individual" && (
            <div className="rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1124]/70 to-[#050810]/90 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-2xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Respostas individuais</h2>
                  <p className="text-[12px] text-white/60">Histórico de respostas e estados.</p>
                </div>
                <span className="text-[12px] text-white/60">
                  A mostrar {submissions.length} de {responsesCount}
                </span>
              </div>

              {initialLoadingSubmissions && <p className="text-sm text-white/60">A carregar...</p>}

              {submissionsError && (
                <div className="rounded-2xl border border-amber-400/40 bg-amber-400/10 p-3 text-sm text-amber-100">
                  {submissionsError}
                </div>
              )}

              {!initialLoadingSubmissions && !submissionsError && responsesCount === 0 && (
                <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 p-4 text-sm text-white/70">
                  Sem respostas.
                </div>
              )}

              {statusMessage && <p className="text-sm text-red-300">{statusMessage}</p>}

              <div className="space-y-3">
                {submissions.map((submission) => {
                  const name =
                    submission.user?.fullName ||
                    submission.user?.username ||
                    getNameAnswer(submission) ||
                    "Participante";
                  const email =
                    getAnswer(submission, "EMAIL") ||
                    submission.guestEmail ||
                    submission.user?.username ||
                    "—";
                  const createdAt = new Date(submission.createdAt).toLocaleString("pt-PT", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  });

                  return (
                    <div key={submission.id} className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="space-y-1">
                          <p className="text-sm font-semibold">{name}</p>
                          <p className="text-[12px] text-white/60">{email}</p>
                        </div>
                        <div className="flex items-center gap-2 text-[12px] text-white/70">
                          <span>{createdAt}</span>
                          <select
                            className="rounded-full border border-white/15 bg-black/30 px-3 py-1 text-[12px] text-white"
                            value={submission.status}
                            disabled={statusUpdatingId === submission.id}
                            onChange={(e) =>
                              handleStatusChange(submission.id, e.target.value as SubmissionStatus)
                            }
                          >
                            {Object.entries(SUBMISSION_STATUS_LABEL).map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="grid gap-2 text-[12px] text-white/70">
                        {form.fields.map((field) => {
                          const raw = submission.answers?.[String(field.id)];
                          const display = formatAnswerValue(raw);
                          return (
                            <div
                              key={`${submission.id}-${field.id}`}
                              className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2"
                            >
                              <span className="text-white/60">{field.label}</span>
                              <span className="text-white">{display}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {loadMoreError && <p className="text-sm text-red-300">{loadMoreError}</p>}

              {hasMore && (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                    className="rounded-full border border-white/20 px-4 py-2 text-[12px] text-white/80 hover:bg-white/10 disabled:opacity-60"
                  >
                    {loadingMore ? "A carregar..." : "Carregar mais"}
                  </button>
                  <span className="text-[12px] text-white/60">
                    A mostrar {submissions.length} de {responsesCount}
                  </span>
                </div>
              )}
            </div>
          )}

          {activeRespostasTab === "exportar" && (
            <div className="rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1124]/70 to-[#050810]/90 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-2xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Exportar respostas</h2>
                  <p className="text-[12px] text-white/60">CSV pronto para Excel ou Sheets.</p>
                </div>
                <span className="text-[12px] text-white/60">{responsesCount} registos</span>
              </div>

              {summaryError && (
                <div className="rounded-2xl border border-amber-400/40 bg-amber-400/10 p-3 text-sm text-amber-100">
                  {summaryError}
                </div>
              )}

              {responsesCount === 0 && (
                <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 p-4 text-sm text-white/70">
                  Sem respostas para exportar.
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3">
                {responsesCount > 0 ? (
                  <a
                    href={exportUrl}
                    className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black transition hover:scale-[1.01]"
                  >
                    Exportar CSV
                  </a>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black opacity-60"
                  >
                    Exportar CSV
                  </button>
                )}
                <span className="text-[12px] text-white/60">
                  Inclui estado, data e todas as respostas.
                </span>
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === "definicoes" && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {definicoesTabs.map((tab) => {
              const isActive = tab.id === activeDefinicoesTab;
              return (
                <Link
                  key={tab.id}
                  href={tab.href}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition",
                    isActive
                      ? "border-white/30 bg-white/15 text-white shadow-[0_12px_30px_rgba(107,255,255,0.2)]"
                      : "border-white/10 text-white/70 hover:bg-white/10",
                  )}
                >
                  {tab.label}
                </Link>
              );
            })}
          </div>

          {activeDefinicoesTab === "geral" && (
            <div className="rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1124]/70 to-[#050810]/90 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-2xl space-y-4">
              <div className="grid gap-3 md:grid-cols-[1.2fr_1fr]">
                <div className="space-y-2">
                  <label className="text-[12px] text-white/70">Estado</label>
                  <select
                    className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as FormStatus)}
                  >
                    {Object.entries(STATUS_LABEL).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-white/50">Visibilidade</p>
                  <p className="text-sm font-semibold text-white">{STATUS_LABEL[status]}</p>
                  <p className="text-[12px] text-white/60">{statusHint}</p>
                </div>
              </div>
            </div>
          )}

          {activeDefinicoesTab === "disponibilidade" && (
            <div className="rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1124]/70 to-[#050810]/90 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-2xl space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-3 rounded-2xl border border-white/12 bg-white/5 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">Capacidade</p>
                      <p className="text-[12px] text-white/60">
                        Ativa vagas limitadas e lista de espera opcional.
                      </p>
                    </div>
                    <Toggle
                      enabled={capacityEnabled}
                      onChange={(next) => {
                        setCapacityEnabled(next);
                        if (!next) {
                          setCapacity("");
                          setWaitlistEnabled(false);
                        }
                      }}
                      label="Ativar capacidade"
                    />
                  </div>

                  {capacityEnabled ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-[12px] text-white/70">Número de vagas</label>
                        <input
                          className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]"
                          type="number"
                          min={0}
                          step="1"
                          inputMode="numeric"
                          value={capacity}
                          onChange={(e) => setCapacity(normalizeIntegerInput(e.target.value))}
                        />
                      </div>
                      <div className="flex items-center justify-between gap-3 rounded-xl border border-white/12 bg-black/30 px-3 py-2">
                        <span className="text-[12px] text-white/70">Lista de espera</span>
                        <Toggle
                          enabled={waitlistEnabled}
                          onChange={(next) => setWaitlistEnabled(next)}
                          label="Ativar lista de espera"
                        />
                      </div>
                    </div>
                  ) : (
                    <p className="text-[12px] text-white/60">Sem limite de vagas.</p>
                  )}
                </div>

                <div className="space-y-3 rounded-2xl border border-white/12 bg-white/5 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">Datas</p>
                      <p className="text-[12px] text-white/60">
                        Define início e, se quiseres, uma data limite.
                      </p>
                    </div>
                    <Toggle
                      enabled={dateEnabled}
                      onChange={(next) => {
                        setDateEnabled(next);
                        if (!next) {
                          setStartAt("");
                          setEndAt("");
                          setEndDateEnabled(false);
                        }
                      }}
                      label="Ativar datas"
                    />
                  </div>

                  {dateEnabled ? (
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <label className="text-[12px] text-white/70">Início</label>
                        <input
                          className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]"
                          type="datetime-local"
                          value={startAt}
                          onChange={(e) => setStartAt(e.target.value)}
                        />
                      </div>
                      <div className="flex items-center justify-between gap-3 rounded-xl border border-white/12 bg-black/30 px-3 py-2">
                        <span className="text-[12px] text-white/70">Data limite</span>
                        <Toggle
                          enabled={endDateEnabled}
                          onChange={(next) => {
                            setEndDateEnabled(next);
                            if (!next) setEndAt("");
                          }}
                          label="Ativar data limite"
                        />
                      </div>
                      {endDateEnabled && (
                        <div className="space-y-2">
                          <label className="text-[12px] text-white/70">Fim</label>
                          <input
                            className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]"
                            type="datetime-local"
                            value={endAt}
                            onChange={(e) => setEndAt(e.target.value)}
                          />
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-[12px] text-white/60">Sem datas configuradas.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black transition hover:scale-[1.01] disabled:opacity-60"
            >
              {saving ? "A guardar..." : "Guardar"}
            </button>
            {message && <span className="text-[12px] text-white/70">{message}</span>}
          </div>

          <div className="rounded-3xl border border-red-400/30 bg-red-500/5 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-2xl space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.2em] text-red-200/70">Zona de perigo</p>
                <h3 className="text-lg font-semibold text-white">Eliminar formulário</h3>
                <p className="text-[12px] text-white/60">
                  Remove campos e respostas. Só é possível quando não existem respostas.
                </p>
              </div>
              <button
                type="button"
                onClick={handleDeleteForm}
                disabled={!canDelete || deleting}
                className="rounded-full border border-red-300/40 px-4 py-2 text-[12px] text-red-100/90 hover:bg-red-500/10 disabled:opacity-60"
              >
                {deleting ? "A apagar..." : "Eliminar formulário"}
              </button>
            </div>
            {!canDelete && (
              <p className="text-[12px] text-white/60">
                {responsesCount > 0
                  ? "Este formulário tem respostas. Arquiva para preservar histórico."
                  : "Despublica ou arquiva o formulário antes de eliminar."}
              </p>
            )}
            {deleteError && <p className="text-sm text-red-200">{deleteError}</p>}
          </div>
        </>
      )}

      {activeTab === "partilha" && (
        <div className="space-y-4">
          {status === "ARCHIVED" && (
            <div className="rounded-2xl border border-amber-400/40 bg-amber-400/10 p-3 text-sm text-amber-100">
              Este formulário está arquivado. Reativa-o para poderes partilhar.
            </div>
          )}
          {status === "DRAFT" && (
            <div className="rounded-2xl border border-white/15 bg-white/5 p-3 text-sm text-white/70">
              Este formulário está em rascunho. Só quem tiver o link consegue pré-visualizar.
            </div>
          )}
          {shareMessage && <p className="text-[12px] text-white/70">{shareMessage}</p>}

          <div className="rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1124]/70 to-[#050810]/90 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-2xl space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Link público</h2>
                <p className="text-[12px] text-white/60">Partilha o formulário com a tua comunidade.</p>
              </div>
              <button
                type="button"
                onClick={() => handleCopy(publicUrl, "Link")}
                disabled={!publicUrl || status === "ARCHIVED"}
                className="rounded-full border border-white/20 px-4 py-2 text-[12px] text-white/80 hover:bg-white/10 disabled:opacity-60"
              >
                Copiar link
              </button>
            </div>
            <div className="grid gap-3 md:grid-cols-[1fr_auto]">
              <input
                className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white/80 outline-none"
                value={publicUrl || "A gerar link..."}
                readOnly
              />
              {publicUrl && status !== "ARCHIVED" && (
                <Link
                  href={`/inscricoes/${form.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-white/20 px-4 py-2 text-[12px] text-white/80 hover:bg-white/10 text-center"
                >
                  Abrir
                </Link>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1124]/70 to-[#050810]/90 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-2xl space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Embed</h2>
                <p className="text-[12px] text-white/60">Insere o formulário no teu site.</p>
              </div>
              <button
                type="button"
                onClick={() => handleCopy(embedCode, "Embed")}
                disabled={!embedCode || status === "ARCHIVED"}
                className="rounded-full border border-white/20 px-4 py-2 text-[12px] text-white/80 hover:bg-white/10 disabled:opacity-60"
              >
                Copiar embed
              </button>
            </div>
            <textarea
              className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white/80 outline-none min-h-[120px]"
              value={embedCode || "A gerar embed..."}
              readOnly
            />
          </div>
        </div>
      )}
    </div>
  );
}

function Toggle({
  enabled,
  onChange,
  label,
}: {
  enabled: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={enabled}
      aria-label={label}
      onClick={() => onChange(!enabled)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full border transition ${
        enabled
          ? "border-[#6BFFFF]/60 bg-gradient-to-r from-[#6BFFFF]/40 via-[#7FE0FF]/20 to-[#1646F5]/40 shadow-[0_0_12px_rgba(107,255,255,0.35)]"
          : "border-white/20 bg-white/10"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 rounded-full bg-white transition ${
          enabled ? "translate-x-5" : "translate-x-1"
        }`}
      />
    </button>
  );
}
