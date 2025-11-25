"use client";

import { useEffect, useState, FormEvent, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useUser } from "@/app/hooks/useUser";
import { useAuthModal } from "@/app/components/autenticação/AuthModalContext";

const TEMPLATE_TYPES = [
  { value: "PARTY", label: "Festa" },
  { value: "SPORT", label: "Desporto" },
  { value: "VOLUNTEERING", label: "Voluntariado" },
  { value: "TALK", label: "Palestra / Talk" },
  { value: "OTHER", label: "Outro" },
] as const;

type TemplateType = (typeof TEMPLATE_TYPES)[number]["value"];

type FormState = {
  title: string;
  description: string;
  date: string; // datetime-local
  endDate: string; // datetime-local opcional
  locationName: string;
  locationCity: string;
  templateType: TemplateType;
};

export default function NovaExperienciaPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading } = useUser();
  const { openModal } = useAuthModal();

  const [form, setForm] = useState<FormState>({
    title: "",
    description: "",
    date: "",
    endDate: "",
    locationName: "",
    locationCity: "",
    templateType: "OTHER",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Evitar abrir o modal em loop
  const authGuardChecked = useRef(false);

  useEffect(() => {
    if (isLoading || authGuardChecked.current) return;

    if (!user) {
      openModal({
        mode: "login",
        redirectTo: "/experiencias/nova",
      });
    }

    authGuardChecked.current = true;
  }, [isLoading, user, openModal]);

  const handleChange = (
    field: keyof FormState,
    value: string,
  ) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!user) {
      openModal({ mode: "login", redirectTo: "/experiencias/nova" });
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const startsAt = form.date;
      const endsAt = form.endDate || undefined;

      const res = await fetch("/api/experiencias/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          startsAt,
          endsAt,
          locationName: form.locationName,
          locationCity: form.locationCity,
          templateType: form.templateType,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.ok) {
        setError(json.error || "Não foi possível criar a experiência.");
        setIsSubmitting(false);
        return;
      }

      const slug: string | undefined = json.event?.slug;
      if (slug) {
        router.push(`/experiencias/${slug}`);
      } else {
        router.push("/experiencias");
      }
    } catch (err) {
      console.error("Erro ao criar experiência:", err);
      setError("Erro inesperado ao criar experiência.");
      setIsSubmitting(false);
    }
  };

  const redirectFromQuery = searchParams.get("redirectTo");

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-semibold mb-2">Criar experiência</h1>
      <p className="text-sm text-neutral-500 mb-6">
        Cria um momento simples: um jogo de padel, um jantar, um café, uma
        caminhada, o que quiseres.
      </p>

      {redirectFromQuery && (
        <p className="text-xs text-neutral-500 mb-4">
          Depois de criar, vamos levar-te para: {redirectFromQuery}
        </p>
      )}

      {!isLoading && !user && (
        <div className="mb-4 rounded-md border border-orange-300 bg-orange-50 px-3 py-2 text-sm text-orange-800">
          Precisas de entrar na tua conta para criares uma experiência.
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Título *</label>
          <input
            type="text"
            className="w-full rounded-md border border-neutral-300 bg-neutral-900/20 px-3 py-2 text-sm outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500"
            placeholder="Jogo de padel às 18h, Café e conversa, etc."
            value={form.title}
            onChange={(e) => handleChange("title", e.target.value)}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Descrição</label>
          <textarea
            className="w-full rounded-md border border-neutral-300 bg-neutral-900/20 px-3 py-2 text-sm outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500"
            rows={4}
            placeholder="Explica rapidamente o que vai acontecer, para quem é, nível, etc."
            value={form.description}
            onChange={(e) => handleChange("description", e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Data e hora de início *
            </label>
            <input
              type="datetime-local"
              className="w-full rounded-md border border-neutral-300 bg-neutral-900/20 px-3 py-2 text-sm outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500"
              value={form.date}
              onChange={(e) => handleChange("date", e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Data e hora de fim (opcional)
            </label>
            <input
              type="datetime-local"
              className="w-full rounded-md border border-neutral-300 bg-neutral-900/20 px-3 py-2 text-sm outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500"
              value={form.endDate}
              onChange={(e) => handleChange("endDate", e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Local *</label>
            <input
              type="text"
              className="w-full rounded-md border border-neutral-300 bg-neutral-900/20 px-3 py-2 text-sm outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500"
              placeholder="Nome do sítio (ex.: Parque da Cidade)"
              value={form.locationName}
              onChange={(e) => handleChange("locationName", e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Cidade *</label>
            <input
              type="text"
              className="w-full rounded-md border border-neutral-300 bg-neutral-900/20 px-3 py-2 text-sm outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500"
              placeholder="Porto, Lisboa, Braga..."
              value={form.locationCity}
              onChange={(e) => handleChange("locationCity", e.target.value)}
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Tipo de experiência</label>
          <select
            className="w-full rounded-md border border-neutral-300 bg-neutral-900/20 px-3 py-2 text-sm outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500"
            value={form.templateType}
            onChange={(e) => handleChange("templateType", e.target.value)}
          >
            {TEMPLATE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <p className="text-sm text-red-500 mt-1">{error}</p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="mt-4 inline-flex items-center justify-center rounded-md bg-pink-600 px-4 py-2 text-sm font-medium text-white hover:bg-pink-700 disabled:opacity-60"
        >
          {isSubmitting ? "A criar…" : "Criar experiência"}
        </button>
      </form>
    </div>
  );
}
