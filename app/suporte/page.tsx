"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";

const CATEGORIES = [
  { value: "ORGANIZACOES", label: "Organizações" },
  { value: "BILHETES", label: "Bilhetes" },
  { value: "PAGAMENTOS_REEMBOLSOS", label: "Pagamentos e reembolsos" },
  { value: "CONTA_ACESSO", label: "Conta e acesso" },
  { value: "RESERVAS", label: "Reservas" },
  { value: "OUTRO", label: "Outro" },
] as const;

export default function SupportPage() {
  const [email, setEmail] = useState("");
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]["value"]>("ORGANIZACOES");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ticketNumber, setTicketNumber] = useState<string | null>(null);

  const canSubmit = useMemo(
    () => email.trim().length > 4 && subject.trim().length >= 4 && description.trim().length >= 10,
    [email, subject, description],
  );

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit || loading) return;
    setLoading(true);
    setError(null);
    setTicketNumber(null);

    try {
      const response = await fetch("/api/support/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          category,
          subject: subject.trim(),
          description: description.trim(),
        }),
      });

      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok) {
        setError(json?.message ?? json?.error ?? "Não foi possível abrir o ticket.");
        return;
      }

      setTicketNumber(String(json.data?.ticket?.ticketNumber ?? ""));
      setSubject("");
      setDescription("");
    } catch (err) {
      console.error("[suporte] submit", err);
      setError("Erro inesperado ao abrir ticket.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-black px-4 py-12 text-white">
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-white/55">Suporte</p>
          <h1 className="text-3xl font-semibold">Abrir Ticket</h1>
          <p className="text-sm text-white/70">
            Abre um ticket para a equipa da plataforma. O email é obrigatório para seguimento.
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur">
          <label className="block space-y-1">
            <span className="text-xs uppercase tracking-[0.14em] text-white/60">Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              className="w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none focus:border-cyan-300"
              placeholder="email@dominio.pt"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-xs uppercase tracking-[0.14em] text-white/60">Categoria</span>
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value as (typeof CATEGORIES)[number]["value"])}
              className="w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none focus:border-cyan-300"
            >
              {CATEGORIES.map((item) => (
                <option key={item.value} value={item.value} className="bg-slate-900 text-white">
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-1">
            <span className="text-xs uppercase tracking-[0.14em] text-white/60">Assunto</span>
            <input
              type="text"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              required
              maxLength={160}
              className="w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none focus:border-cyan-300"
              placeholder="Resumo rápido do problema"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-xs uppercase tracking-[0.14em] text-white/60">Descrição</span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              required
              minLength={10}
              rows={7}
              className="w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none focus:border-cyan-300"
              placeholder="Descreve o contexto, passos e resultado esperado."
            />
          </label>

          {error ? (
            <p className="rounded-lg border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">{error}</p>
          ) : null}

          {ticketNumber ? (
            <p className="rounded-lg border border-emerald-400/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
              Ticket criado com sucesso: <strong>#{ticketNumber}</strong>
            </p>
          ) : null}

          <div className="flex items-center justify-between gap-3">
            <Link href="/" className="text-xs text-white/70 underline underline-offset-2 hover:text-white">
              Voltar
            </Link>
            <button
              type="submit"
              disabled={!canSubmit || loading}
              className="rounded-xl border border-cyan-300/50 bg-cyan-300/15 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:bg-cyan-300/25 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "A abrir ticket..." : "Abrir ticket"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
