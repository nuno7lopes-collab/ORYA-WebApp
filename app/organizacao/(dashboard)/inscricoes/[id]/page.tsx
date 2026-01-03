"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import useSWR from "swr";
import ObjectiveSubnav from "@/app/organizacao/ObjectiveSubnav";

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

export default function InscricaoDetailPage() {
  const params = useParams<{ id: string }>();
  const formId = params?.id ?? "";
  const { data, mutate, isLoading } = useSWR<FormResponse>(
    formId ? `/api/organizacao/inscricoes/${formId}` : null,
    fetcher,
  );
  const {
    data: submissionsData,
    mutate: mutateSubmissions,
    isLoading: loadingSubmissions,
  } = useSWR<SubmissionsResponse>(
    formId ? `/api/organizacao/inscricoes/${formId}/submissions` : null,
    fetcher,
  );

  const form = data?.form ?? null;
  const canEditFields = (form?.submissionsCount ?? 0) === 0;
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

  const formFieldsById = useMemo(() => {
    const map = new Map<string, FormField>();
    form?.fields?.forEach((field) => {
      map.set(String(field.id), field);
    });
    return map;
  }, [form?.fields]);

  const submissions = submissionsData?.ok ? submissionsData.items : [];
  const submissionsError = submissionsData?.ok === false ? submissionsData.error : null;

  const getAnswer = (submission: SubmissionItem, fieldType: FieldType) => {
    const field = form?.fields.find((f) => f.fieldType === fieldType) ?? null;
    if (!field) return null;
    const raw = submission.answers?.[String(field.id)];
    if (typeof raw === "string") return raw.trim();
    if (typeof raw === "number") return String(raw);
    if (typeof raw === "boolean") return raw ? "Sim" : "Não";
    return null;
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
      mutateSubmissions();
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
    return <div className="px-6 py-10 text-sm text-white/70">A carregar...</div>;
  }

  if (!form) {
    return (
      <div className="px-6 py-10 text-sm text-white/70">
        {formError || "Inscrição não encontrada."}
      </div>
    );
  }

  return (
    <div className="px-6 py-8 space-y-6 text-white">
      <ObjectiveSubnav objective="manage" activeId="inscricoes" />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-white/60">Inscrição</p>
          <h1 className="text-2xl font-semibold">{form.title}</h1>
          <p className="text-sm text-white/60">
            {form.submissionsCount} inscrição{form.submissionsCount === 1 ? "" : "s"} · formulário público
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[12px]">
          <Link
            href="/organizacao?tab=manage&section=inscricoes"
            className="rounded-full border border-white/20 px-3 py-1 text-white/80 hover:bg-white/10"
          >
            Voltar
          </Link>
          <Link
            href={`/inscricoes/${form.id}`}
            className="rounded-full border border-white/20 px-3 py-1 text-white/80 hover:bg-white/10"
          >
            Ver página pública
          </Link>
        </div>
      </div>

      <div className="rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1124]/70 to-[#050810]/90 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-2xl space-y-5">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-[12px] text-white/70">Título</label>
            <input
              className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
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
        </div>

        <div className="space-y-2">
          <label className="text-[12px] text-white/70">Descrição</label>
          <textarea
            className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF] min-h-[96px]"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

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

      <div className="rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1124]/70 to-[#050810]/90 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-2xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Campos do formulário</h2>
            <p className="text-[12px] text-white/60">Edita o que cada pessoa tem de preencher.</p>
          </div>
          <button
            type="button"
            onClick={addField}
            disabled={!canEditFields}
            className="rounded-full border border-white/20 px-3 py-1 text-[12px] text-white/80 hover:bg-white/10"
          >
            Adicionar campo
          </button>
        </div>
        {!canEditFields && (
          <p className="text-[12px] text-white/60">
            Já existem inscrições. Para proteger os dados, os campos não podem ser alterados.
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
            {saving ? "A guardar..." : "Guardar alterações"}
          </button>
          {message && <span className="text-[12px] text-white/70">{message}</span>}
        </div>
      </div>

      <div className="rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1124]/70 to-[#050810]/90 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-2xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Inscrições recebidas</h2>
            <p className="text-[12px] text-white/60">Lista de participantes e estados atuais.</p>
          </div>
          <span className="text-[12px] text-white/60">{submissions.length} total</span>
        </div>

        {loadingSubmissions && <p className="text-sm text-white/60">A carregar inscrições...</p>}

        {submissionsError && (
          <div className="rounded-2xl border border-amber-400/40 bg-amber-400/10 p-3 text-sm text-amber-100">
            {submissionsError}
          </div>
        )}

        {!loadingSubmissions && !submissionsError && submissions.length === 0 && (
          <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 p-4 text-sm text-white/70">
            Ainda não há inscrições neste formulário.
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
                <div className="flex flex-wrap gap-2 text-[11px] text-white/60">
                  {Object.entries(submission.answers || {}).slice(0, 3).map(([key, value]) => {
                    const meta = formFieldsById.get(key);
                    if (!meta) return null;
                    const display =
                      typeof value === "string" || typeof value === "number"
                        ? String(value)
                        : typeof value === "boolean"
                          ? value
                            ? "Sim"
                            : "Não"
                          : null;
                    if (!display) return null;
                    return (
                      <span
                        key={`${submission.id}-${key}`}
                        className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5"
                      >
                        {meta.label}: {display}
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
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
