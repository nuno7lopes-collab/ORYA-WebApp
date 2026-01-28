"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useUser } from "@/app/hooks/useUser";

type FieldType = "TEXT" | "TEXTAREA" | "EMAIL" | "PHONE" | "NUMBER" | "DATE" | "SELECT" | "CHECKBOX";

type FormField = {
  id: number;
  label: string;
  fieldType: FieldType;
  required: boolean;
  helpText?: string | null;
  placeholder?: string | null;
  options?: string[] | null;
};

type FormPayload = {
  id: number;
  title: string;
  description?: string | null;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  organizationName: string;
  organizationUsername?: string | null;
  capacity?: number | null;
  waitlistEnabled: boolean;
  startAt?: string | null;
  endAt?: string | null;
  fields: FormField[];
};

const formatDateTime = (value: string | null | undefined) => {
  if (!value) return "Disponível sempre";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Data a anunciar";
  return parsed.toLocaleString("pt-PT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export function FormSubmissionClient({ form }: { form: FormPayload }) {
  const { isLoggedIn } = useUser();
  const [answers, setAnswers] = useState<Record<string, string | number | boolean>>({});
  const [guestEmail, setGuestEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState<number | null>(null);

  useEffect(() => {
    setNowMs(Date.now());
  }, []);

  const hasEmailField = useMemo(
    () => form.fields.some((field) => field.fieldType === "EMAIL"),
    [form.fields],
  );
  const needsGuestEmail = !isLoggedIn && !hasEmailField;

  const capacityLabel = useMemo(() => {
    if (typeof form.capacity !== "number") return "Sem limite de vagas";
    if (form.capacity <= 0) return "Sem vagas disponíveis";
    return `${form.capacity} vaga${form.capacity === 1 ? "" : "s"} disponíveis`;
  }, [form.capacity]);

  const hasStart = Boolean(form.startAt);
  const hasEnd = Boolean(form.endAt);
  const startMs = form.startAt ? new Date(form.startAt).getTime() : null;
  const endMs = form.endAt ? new Date(form.endAt).getTime() : null;
  const isBeforeStart =
    nowMs !== null && typeof startMs === "number" && Number.isFinite(startMs) ? nowMs < startMs : false;
  const isAfterEnd =
    nowMs !== null && typeof endMs === "number" && Number.isFinite(endMs) ? nowMs > endMs : false;
  const isWithinWindow = nowMs === null ? true : !isBeforeStart && !isAfterEnd;
  const isOpen = form.status === "PUBLISHED" && isWithinWindow;
  const statusLabel =
    form.status === "DRAFT"
      ? "Pré-visualização"
      : form.status === "ARCHIVED"
        ? "Respostas encerradas"
        : isBeforeStart
          ? "Respostas ainda não abriram"
          : isAfterEnd
            ? "Respostas encerradas"
            : "Respostas abertas";
  const statusTone =
    form.status === "PUBLISHED" && isWithinWindow
      ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-50"
      : form.status === "DRAFT"
        ? "border-sky-400/40 bg-sky-500/10 text-sky-50"
        : isBeforeStart
          ? "border-amber-400/40 bg-amber-500/10 text-amber-50"
          : "border-white/20 bg-white/10 text-white/70";
  const closedReason =
    form.status !== "PUBLISHED"
      ? form.status === "DRAFT"
        ? "Formulário em rascunho. Pré-visualização ativa."
        : "As respostas estão encerradas para este formulário."
      : isBeforeStart
        ? "As respostas ainda não abriram."
        : isAfterEnd
          ? "As respostas já fecharam."
          : null;

  const startLabel = hasStart ? formatDateTime(form.startAt) : null;
  const endLabel = hasEnd ? formatDateTime(form.endAt) : null;
  const dateLabel =
    !hasStart && !hasEnd ? "Disponível sempre" : startLabel ?? (endLabel ? `Disponível até ${endLabel}` : null);

  const updateAnswer = (fieldId: number, value: string | number | boolean) => {
    setAnswers((prev) => ({ ...prev, [String(fieldId)]: value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    if (!isOpen) {
      setError(closedReason ?? "Este formulário ainda não está a aceitar respostas.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/inscricoes/${form.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers, guestEmail: needsGuestEmail ? guestEmail : undefined }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || data?.ok === false) {
        setError(data?.error || "Não foi possível enviar a resposta.");
        setSubmitting(false);
        return;
      }
      const status =
        data?.status === "WAITLISTED" ? "Ficaste em lista de espera." : "Resposta enviada com sucesso.";
      setSuccess(status);
      setSubmitting(false);
    } catch (err) {
      console.error("[inscricoes][submit] erro", err);
      setError("Erro inesperado ao enviar.");
      setSubmitting(false);
    }
  };

  return (
    <main className="relative min-h-screen w-full overflow-hidden text-white">
      <section className="relative orya-page-width px-4 pb-16 pt-10 space-y-6">
        <header className="space-y-4 rounded-3xl border border-white/12 bg-gradient-to-br from-white/10 via-[#0b1124]/80 to-[#050912]/90 p-6 shadow-[0_30px_120px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-2">
              <p className="text-[11px] uppercase tracking-[0.3em] text-white/60">Formulários ORYA</p>
              <h1 className="text-3xl font-semibold">{form.title}</h1>
              {form.description && <p className="text-white/70">{form.description}</p>}
            </div>
            <span className={`rounded-full border px-3 py-1 text-[12px] ${statusTone}`}>{statusLabel}</span>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-[12px] text-white/70">
            <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1">{capacityLabel}</span>
            {dateLabel && (
              <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1">{dateLabel}</span>
            )}
            {hasStart && endLabel && (
              <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1">
                Até {endLabel}
              </span>
            )}
            <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1">
              {form.waitlistEnabled ? "Espera ativa" : "Sem espera"}
            </span>
          </div>
          <div className="text-[12px] text-white/60">
            Organização:{" "}
            {form.organizationUsername ? (
              <Link href={`/${form.organizationUsername}`} className="text-white hover:text-white/80">
                {form.organizationName}
              </Link>
            ) : (
              <span className="text-white">{form.organizationName}</span>
            )}
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-2">
          <div className="rounded-3xl border border-white/12 bg-white/5 p-5 text-sm text-white/75 shadow-[0_24px_70px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">O que precisas de saber</p>
            <h2 className="mt-2 text-lg font-semibold text-white">Detalhes essenciais</h2>
            <p className="mt-2 text-[12px] text-white/60">
              {form.description ||
                "Preenche com atenção. A organização usa estes dados para gerir vagas."}
            </p>
          </div>
          <div className="rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1124]/70 to-[#050912]/90 p-5 text-sm text-white/75 shadow-[0_24px_70px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">O que acontece agora</p>
            <h2 className="mt-2 text-lg font-semibold text-white">Próximos passos</h2>
            <div className="mt-3 space-y-2 text-[12px] text-white/70">
              <p>1. Preenche e envia.</p>
              <p>2. Confirmação imediata.</p>
              <p>3. Organização atualiza o estado.</p>
            </div>
          </div>
        </section>

        {!isLoggedIn && (
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-[12px] text-white/70">
            Submissão como convidado. Inicia sessão para ligar ao perfil.
          </div>
        )}

        {!isOpen && (
          <div className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-[12px] text-white/70">
            {closedReason ?? "As respostas estão encerradas para este formulário."}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5 rounded-3xl border border-white/10 bg-white/5 p-6">
          {needsGuestEmail && (
            <div className="space-y-2">
              <label className="text-[12px] text-white/80">
                Email de contacto <span className="text-emerald-300">*</span>
              </label>
              <input
                className="w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none transition focus:border-[#6BFFFF]"
                type="email"
                placeholder="nome@email.com"
                value={guestEmail}
                onChange={(e) => setGuestEmail(e.target.value)}
              />
              <p className="text-[11px] text-white/50">Email para confirmação e contacto.</p>
            </div>
          )}
          {form.fields.map((field) => {
            const fieldKey = String(field.id);
            const value = answers[fieldKey];
            const baseClass =
              "w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none transition focus:border-[#6BFFFF]";

            return (
              <div key={fieldKey} className="space-y-2">
                <label className="text-[12px] text-white/80">
                  {field.label}
                  {field.required && <span className="text-emerald-300"> *</span>}
                </label>
                {field.helpText && <p className="text-[11px] text-white/50">{field.helpText}</p>}
                {field.fieldType === "TEXTAREA" ? (
                  <textarea
                    className={`${baseClass} min-h-[96px]`}
                    placeholder={field.placeholder ?? ""}
                    value={typeof value === "string" ? value : ""}
                    onChange={(e) => updateAnswer(field.id, e.target.value)}
                  />
                ) : field.fieldType === "SELECT" ? (
                  <select
                    className={baseClass}
                    value={typeof value === "string" ? value : ""}
                    onChange={(e) => updateAnswer(field.id, e.target.value)}
                  >
                    <option value="">Seleciona</option>
                    {(field.options ?? []).map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                ) : field.fieldType === "CHECKBOX" ? (
                  <label className="flex items-center gap-2 text-sm text-white/80">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-white/30 bg-black/40 text-[#6BFFFF]"
                      checked={Boolean(value)}
                      onChange={(e) => updateAnswer(field.id, e.target.checked)}
                    />
                    {field.placeholder || "Confirmo"}
                  </label>
                ) : (
                  <input
                    className={baseClass}
                    type={
                      field.fieldType === "EMAIL"
                        ? "email"
                        : field.fieldType === "PHONE"
                          ? "tel"
                          : field.fieldType === "NUMBER"
                            ? "number"
                            : field.fieldType === "DATE"
                              ? "date"
                              : "text"
                    }
                    placeholder={field.placeholder ?? ""}
                    value={typeof value === "string" || typeof value === "number" ? value : ""}
                    onChange={(e) => updateAnswer(field.id, e.target.value)}
                  />
                )}
              </div>
            );
          })}

          {error && <p className="text-sm text-red-300">{error}</p>}
          {success && <p className="text-sm text-emerald-300">{success}</p>}

          <button
            type="submit"
            disabled={submitting || !isOpen}
            className="w-full rounded-full bg-white px-4 py-2 text-sm font-semibold text-black transition hover:scale-[1.01] disabled:opacity-60"
          >
            {submitting ? "A enviar..." : isOpen ? "Enviar resposta" : "Formulário fechado"}
          </button>
        </form>
      </section>
    </main>
  );
}
