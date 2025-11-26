"use client";

import { useEffect, useState, FormEvent, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useUser } from "@/app/hooks/useUser";
import { useAuthModal } from "@/app/components/autenticação/AuthModalContext";
import { InlineDateTimePicker } from "@/app/components/forms/InlineDateTimePicker";

const TEMPLATE_TYPES = [
  { value: "PARTY", label: "Festa" },
  { value: "SPORT", label: "Desporto" },
  { value: "VOLUNTEERING", label: "Voluntariado" },
  { value: "TALK", label: "Palestra / Talk" },
  { value: "OTHER", label: "Outro" },
] as const;

const CATEGORY_OPTIONS = [
  { value: "FESTA", label: "Festa", accent: "from-[#FF00C8] to-[#FF8AD9]" },
  { value: "DESPORTO", label: "Desporto", accent: "from-[#6BFFFF] to-[#4ADE80]" },
  { value: "CONCERTO", label: "Concerto", accent: "from-[#9B8CFF] to-[#6BFFFF]" },
  { value: "PALESTRA", label: "Palestra", accent: "from-[#FDE68A] to-[#F472B6]" },
  { value: "ARTE", label: "Arte", accent: "from-[#F472B6] to-[#A855F7]" },
  { value: "COMIDA", label: "Comida", accent: "from-[#F97316] to-[#FACC15]" },
  { value: "DRINKS", label: "Drinks", accent: "from-[#34D399] to-[#6BFFFF]" },
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
  address: string;
  categories: string[];
  coverUrl: string | null;
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
    address: "",
    categories: [],
    coverUrl: null,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);

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

  function handleChange<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  const handleCoverUpload = async (file: File | null) => {
    if (!file) return;
    setUploadingCover(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (!res.ok || !json?.url) {
        throw new Error(json?.error || "Erro ao carregar imagem.");
      }
      setForm((prev) => ({ ...prev, coverUrl: json.url as string }));
    } catch (err) {
      console.error("Erro no upload de capa:", err);
      setError("Não foi possível carregar a imagem de capa.");
    } finally {
      setUploadingCover(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!user) {
      openModal({ mode: "login", redirectTo: "/experiencias/nova" });
      return;
    }

    setIsSubmitting(true);
    setError(null);

    if (!form.categories.length) {
      setError("Escolhe pelo menos uma categoria.");
      setIsSubmitting(false);
      return;
    }

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
        address: form.address,
        categories: form.categories,
        coverImageUrl: form.coverUrl,
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
          <label className="block text-sm font-medium mb-1">Imagem de capa</label>
          <div className="flex gap-3 items-start">
            <div className="h-28 w-40 rounded-xl border border-neutral-700 bg-neutral-900/40 overflow-hidden flex items-center justify-center text-[11px] text-neutral-400">
              {form.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.coverUrl} alt="Capa" className="h-full w-full object-cover" />
              ) : (
                "Sem imagem"
              )}
            </div>
            <div className="space-y-2 text-[12px] text-neutral-300">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleCoverUpload(e.target.files?.[0] ?? null)}
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleChange("coverUrl", null)}
                  className="rounded-full border border-neutral-600 px-3 py-1 text-xs hover:border-white"
                >
                  Remover
                </button>
                {uploadingCover && <span className="text-xs text-neutral-400">A carregar…</span>}
              </div>
            </div>
          </div>
        </div>

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
          <InlineDateTimePicker
            label="Data e hora de início *"
            value={form.date}
            onChange={(v) => handleChange("date", v)}
            minDateTime={new Date()}
            required
          />
          <InlineDateTimePicker
            label="Data e hora de fim (opcional)"
            value={form.endDate}
            onChange={(v) => handleChange("endDate", v)}
            minDateTime={form.date ? new Date(form.date) : new Date()}
          />
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
          <label className="block text-sm font-medium mb-1">
            Rua / morada (opcional)
          </label>
          <input
            type="text"
            className="w-full rounded-md border border-neutral-300 bg-neutral-900/20 px-3 py-2 text-sm outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500"
            placeholder="Ex.: Rua de exemplo, 123 (TODO: ligar a Mapbox Search)"
            value={form.address}
            onChange={(e) => handleChange("address", e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Tipo de experiência</label>
          <select
            className="w-full rounded-md border border-neutral-300 bg-neutral-900/20 px-3 py-2 text-sm outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500"
            value={form.templateType}
            onChange={(e) => handleChange("templateType", e.target.value as TemplateType)}
          >
            {TEMPLATE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Categorias (obrigatório)
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {CATEGORY_OPTIONS.map((cat) => {
              const checked = form.categories.includes(cat.value);
              return (
                <label
                  key={cat.value}
                  className={`inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm transition ${
                    checked
                      ? "bg-white text-black border-white shadow-[0_0_18px_rgba(255,255,255,0.35)]"
                      : "bg-black/30 border-white/15 text-white"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={checked}
                    onChange={(e) => {
                      const next = e.target.checked
                        ? [...form.categories, cat.value]
                        : form.categories.filter((c) => c !== cat.value);
                      handleChange("categories", next);
                    }}
                  />
                  <span className="flex items-center gap-2">
                    <span
                      className={`h-2 w-2 rounded-full bg-gradient-to-r ${cat.accent} shadow-[0_0_10px_rgba(255,255,255,0.4)]`}
                    />
                    {cat.label}
                  </span>
                </label>
              );
            })}
          </div>
          <p className="mt-1 text-xs text-neutral-400">
            Escolhe pelo menos uma categoria para ajudar na descoberta.
          </p>
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
