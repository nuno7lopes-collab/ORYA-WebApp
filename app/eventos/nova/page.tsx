"use client";

import { Suspense, useEffect, useState, FormEvent, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useUser } from "@/app/hooks/useUser";
import { useAuthModal } from "@/app/components/autenticação/AuthModalContext";
import { InlineDateTimePicker } from "@/app/components/forms/InlineDateTimePicker";

const TEMPLATE_TYPES = [
  { value: "PARTY", label: "Festa" },
  { value: "PADEL", label: "Padel" },
  { value: "VOLUNTEERING", label: "Voluntariado" },
  { value: "TALK", label: "Palestra / Talk" },
  { value: "OTHER", label: "Outro" },
] as const;

const CATEGORY_OPTIONS = [
  { value: "FESTA", label: "Festa", accent: "from-[#FF00C8] to-[#FF8AD9]" },
  { value: "PADEL", label: "Padel", accent: "from-[#6BFFFF] to-[#4ADE80]" },
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
  date: string;
  endDate: string;
  locationName: string;
  locationCity: string;
  templateType: TemplateType;
  address: string;
  categories: string[];
  coverUrl: string | null;
};

function NovaEventoContent() {
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

  const authGuardChecked = useRef(false);

  useEffect(() => {
    if (isLoading || authGuardChecked.current) return;

    if (!user) {
      openModal({
        mode: "login",
        redirectTo: "/eventos/nova",
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
      setError("Nao foi possivel carregar a imagem de capa.");
    } finally {
      setUploadingCover(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!user) {
      openModal({ mode: "login", redirectTo: "/eventos/nova", showGoogle: true });
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

      const res = await fetch("/api/eventos/simple", {
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
        setError(json.error || "Nao foi possivel criar o evento.");
        setIsSubmitting(false);
        return;
      }

      const slug: string | undefined = json.event?.slug;
      if (slug) {
        router.push(`/eventos/${slug}`);
      } else {
        router.push("/eventos");
      }
    } catch (err) {
      console.error("Erro ao criar evento:", err);
      setError("Erro inesperado ao criar evento.");
      setIsSubmitting(false);
    }
  };

  const redirectFromQuery = searchParams.get("redirectTo");

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-semibold mb-2">Criar evento</h1>
      <p className="text-sm text-neutral-500 mb-6">
        Cria um evento simples: um jogo de padel, um jantar, um cafe, um passeio.
      </p>

      {redirectFromQuery && (
        <p className="text-xs text-neutral-500 mb-4">
          Depois de criar, vamos levar-te para: {redirectFromQuery}
        </p>
      )}

      {!isLoading && !user && (
        <div className="mb-4 rounded-md border border-orange-300 bg-orange-50 px-3 py-2 text-sm text-orange-800">
          Precisas de entrar na tua conta para criares um evento.
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
          <label className="block text-sm font-medium mb-1">Titulo</label>
          <input
            value={form.title}
            onChange={(e) => handleChange("title", e.target.value)}
            className="w-full rounded-lg border border-neutral-700 bg-neutral-900/60 px-3 py-2 text-sm text-white"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Descricao</label>
          <textarea
            value={form.description}
            onChange={(e) => handleChange("description", e.target.value)}
            className="w-full rounded-lg border border-neutral-700 bg-neutral-900/60 px-3 py-2 text-sm text-white"
            rows={3}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium mb-1">Data e hora de inicio</label>
            <InlineDateTimePicker
              value={form.date}
              onChange={(v) => handleChange("date", v)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Data e hora de fim (opcional)</label>
            <InlineDateTimePicker
              value={form.endDate}
              onChange={(v) => handleChange("endDate", v)}
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium mb-1">Nome do local</label>
            <input
              value={form.locationName}
              onChange={(e) => handleChange("locationName", e.target.value)}
              className="w-full rounded-lg border border-neutral-700 bg-neutral-900/60 px-3 py-2 text-sm text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Cidade</label>
            <input
              value={form.locationCity}
              onChange={(e) => handleChange("locationCity", e.target.value)}
              className="w-full rounded-lg border border-neutral-700 bg-neutral-900/60 px-3 py-2 text-sm text-white"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Morada</label>
          <input
            value={form.address}
            onChange={(e) => handleChange("address", e.target.value)}
            className="w-full rounded-lg border border-neutral-700 bg-neutral-900/60 px-3 py-2 text-sm text-white"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Tipo</label>
          <div className="flex flex-wrap gap-2">
            {TEMPLATE_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => handleChange("templateType", t.value)}
                className={`rounded-full border px-3 py-1 text-xs ${
                  form.templateType === t.value
                    ? "border-white bg-white text-black"
                    : "border-neutral-700 text-neutral-300 hover:border-white"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Categorias</label>
          <div className="flex flex-wrap gap-2">
            {CATEGORY_OPTIONS.map((cat) => {
              const isSelected = form.categories.includes(cat.value);
              return (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() =>
                    handleChange(
                      "categories",
                      isSelected
                        ? form.categories.filter((c) => c !== cat.value)
                        : [...form.categories, cat.value],
                    )
                  }
                  className={`rounded-full border px-3 py-1 text-xs ${
                    isSelected
                      ? `border-white bg-gradient-to-r ${cat.accent} text-black`
                      : "border-neutral-700 text-neutral-300 hover:border-white"
                  }`}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>
        </div>

        {error && (
          <div className="rounded-md border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black"
        >
          {isSubmitting ? "A criar..." : "Criar evento"}
        </button>
      </form>
    </div>
  );
}

export default function NovaEventoPage() {
  return (
    <Suspense fallback={<div className="p-6 text-neutral-400">A carregar...</div>}>
      <NovaEventoContent />
    </Suspense>
  );
}
