"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useUser } from "@/app/hooks/useUser";
import { useAuthModal } from "@/app/components/autenticação/AuthModalContext";
import { InlineDateTimePicker } from "@/app/components/forms/InlineDateTimePicker";

type TicketTypeRow = {
  name: string;
  price: string;
  totalQuantity: string;
};

const CATEGORY_OPTIONS = [
  { value: "FESTA", label: "Festa", accent: "from-[#FF00C8] to-[#FF8AD9]" },
  { value: "DESPORTO", label: "Desporto", accent: "from-[#6BFFFF] to-[#4ADE80]" },
  { value: "CONCERTO", label: "Concerto", accent: "from-[#9B8CFF] to-[#6BFFFF]" },
  { value: "PALESTRA", label: "Palestra", accent: "from-[#FDE68A] to-[#F472B6]" },
  { value: "ARTE", label: "Arte", accent: "from-[#F472B6] to-[#A855F7]" },
  { value: "COMIDA", label: "Comida", accent: "from-[#F97316] to-[#FACC15]" },
  { value: "DRINKS", label: "Drinks", accent: "from-[#34D399] to-[#6BFFFF]" },
] as const;

export default function NewOrganizerEventPage() {
  const router = useRouter();
  const { user, profile, isLoading: isUserLoading } = useUser();
  const { openModal } = useAuthModal();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [locationName, setLocationName] = useState("");
  const [locationCity, setLocationCity] = useState("");
  const [address, setAddress] = useState("");
  const [templateType, setTemplateType] = useState("PARTY");
  const [categories, setCategories] = useState<string[]>([]);
  const [ticketTypes, setTicketTypes] = useState<TicketTypeRow[]>([
    { name: "Normal", price: "", totalQuantity: "" },
  ]);
  const [feeMode, setFeeMode] = useState<"INHERIT" | "ADDED" | "INCLUDED">("INHERIT");
  const [feeBps, setFeeBps] = useState("");
  const [feeFixedCents, setFeeFixedCents] = useState("");
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isOrganizer = profile?.roles?.includes("organizer");

  const handleRequireLogin = () => {
    openModal({
      mode: "login",
      redirectTo: "/organizador/eventos/novo",
    });
  };

  const handleAddTicketType = () => {
    setTicketTypes((prev) => [
      ...prev,
      { name: "", price: "", totalQuantity: "" },
    ]);
  };

  const handleRemoveTicketType = (index: number) => {
    setTicketTypes((prev) => prev.filter((_, i) => i !== index));
  };

  const handleTicketChange = (
    index: number,
    field: keyof TicketTypeRow,
    value: string
  ) => {
    setTicketTypes((prev) =>
      prev.map((row, i) =>
        i === index ? { ...row, [field]: value } : row
      )
    );
  };

  const handleCoverUpload = async (file: File | null) => {
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    setUploadingCover(true);
    setErrorMessage(null);
    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (!res.ok || !json?.url) {
        throw new Error(json?.error || "Falha no upload da imagem.");
      }
      setCoverUrl(json.url as string);
    } catch (err) {
      console.error("Erro no upload de capa", err);
      setErrorMessage("Não foi possível carregar a imagem de capa.");
    } finally {
      setUploadingCover(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!user) {
      handleRequireLogin();
      return;
    }

    if (!isOrganizer) {
      setErrorMessage(
        "Ainda não és organizador. Vai à área de organizador para ativares essa função."
      );
      return;
    }

    // Validar campos mínimos no front
    if (!title.trim()) {
      setErrorMessage("O título é obrigatório.");
      return;
    }

    if (!startsAt) {
      setErrorMessage("A data/hora de início é obrigatória.");
      return;
    }

    if (!locationCity.trim()) {
      setErrorMessage("A cidade é obrigatória.");
      return;
    }

    if (categories.length === 0) {
      setErrorMessage("Escolhe pelo menos uma categoria.");
      return;
    }

    const preparedTickets = ticketTypes
      .map((row) => ({
        name: row.name.trim(),
        price: Number(row.price.replace(",", ".")) || 0,
        totalQuantity: row.totalQuantity
          ? Number(row.totalQuantity)
          : null,
      }))
      .filter((t) => t.name); // só envia linhas com nome preenchido

    if (preparedTickets.length === 0) {
      setErrorMessage("Precisas de ter pelo menos um tipo de bilhete.");
      return;
    }

    const normalizedFeeMode = feeMode === "INHERIT" ? null : feeMode;
    const feeBpsNumber = feeBps.trim() ? Number(feeBps.replace(",", ".")) : null;
    const feeFixedNumber = feeFixedCents.trim() ? Number(feeFixedCents.replace(",", ".")) : null;

    if (feeBpsNumber !== null && (!Number.isFinite(feeBpsNumber) || feeBpsNumber < 0)) {
      setErrorMessage("Fee (%) inválida.");
      return;
    }
    if (feeFixedNumber !== null && (!Number.isFinite(feeFixedNumber) || feeFixedNumber < 0)) {
      setErrorMessage("Fee fixa inválida.");
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        startsAt, // "datetime-local" string, API converte para Date
        endsAt: endsAt || null,
        locationName: locationName.trim() || null,
        locationCity: locationCity.trim() || null,
        templateType,
        address: address.trim() || null,
        categories,
        ticketTypes: preparedTickets,
        coverImageUrl: coverUrl,
        feeMode: normalizedFeeMode,
        platformFeeBps: feeBpsNumber === null ? null : Math.floor(feeBpsNumber),
        platformFeeFixedCents: feeFixedNumber === null ? null : Math.floor(feeFixedNumber),
      };

      const res = await fetch("/api/organizador/events/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Erro ao criar evento.");
      }

      const event = data.event;
      if (event?.id) {
        router.push(`/organizador/eventos/${event.id}`);
      } else if (event?.slug) {
        router.push(`/eventos/${event.slug}`);
      } else {
        router.push("/organizador/eventos");
      }
    } catch (err) {
      console.error("Erro ao criar evento de organizador:", err);
      const message = err instanceof Error ? err.message : null;
      setErrorMessage(message || "Ocorreu um erro ao criar o evento.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Loading estado do user
  if (isUserLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <p>A carregar a tua conta…</p>
      </div>
    );
  }

  // Não autenticado
  if (!user) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-4">
        <h1 className="text-2xl font-semibold">Criar novo evento</h1>
        <p>Precisas de iniciar sessão para criar eventos como organizador.</p>
        <button
          type="button"
          onClick={handleRequireLogin}
          className="inline-flex items-center rounded-md border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium hover:bg-white/10"
        >
          Entrar
        </button>
      </div>
    );
  }

  if (!user.emailConfirmedAt) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-4">
        <h1 className="text-2xl font-semibold">Confirma o teu e-mail</h1>
        <p className="text-sm text-white/70">
          Precisamos do teu e-mail verificado antes de poderes criar eventos pagos. Verifica a caixa de entrada e clica
          no link de confirmação.
        </p>
        <Link
          href="/me"
          className="inline-flex items-center rounded-md border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium hover:bg-white/10"
        >
          Ir ao perfil
        </Link>
      </div>
    );
  }

  // Autenticado mas sem role organizer
  if (!isOrganizer) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-4">
        <h1 className="text-2xl font-semibold">Criar novo evento</h1>
        <p>
          Ainda não és organizador. Vai à área de organizador para ativar
          essa função.
        </p>
        <Link
          href="/organizador"
          className="inline-flex items-center rounded-md border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium hover:bg-white/10"
        >
          Ir para área de organizador
        </Link>
      </div>
    );
  }

  // Form principal
  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Criar novo evento</h1>
        <p className="text-sm text-white/60">
          Define os detalhes do teu evento e os tipos de bilhete disponíveis.
        </p>
      </div>

      {errorMessage && (
        <div className="rounded-md border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {errorMessage}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Secção Evento */}
        <div className="space-y-4 rounded-lg border border-white/10 bg-white/5 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-white/70">
            Detalhes do evento
          </h2>

          <div className="space-y-2">
            <label className="text-sm font-medium">Imagem de capa</label>
            <div className="flex flex-col sm:flex-row gap-3 items-start">
              <div className="h-32 w-48 rounded-xl border border-white/15 bg-black/30 overflow-hidden flex items-center justify-center text-[11px] text-white/60">
                {coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={coverUrl} alt="Capa" className="h-full w-full object-cover" />
                ) : (
                  <span>Sem imagem</span>
                )}
              </div>
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2 text-[11px] text-white/60">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-white/20 px-3 py-1 hover:bg-white/10">
                    <span>{coverUrl ? "Substituir imagem" : "Adicionar imagem de capa"}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleCoverUpload(e.target.files?.[0] ?? null)}
                      className="hidden"
                    />
                  </label>
                  <button
                    type="button"
                    disabled={uploadingCover || !coverUrl}
                    onClick={() => setCoverUrl(null)}
                    className="inline-flex items-center rounded-full border border-white/20 px-3 py-1 hover:bg-white/10 disabled:opacity-60"
                  >
                    Remover imagem
                  </button>
                </div>
                {uploadingCover && <span className="text-[11px] text-white/60">A carregar imagem…</span>}
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Título *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-md border border-white/15 bg-black/20 px-3 py-2 text-sm outline-none focus:border-white/60"
              placeholder="Ex.: Festa de abertura ORYA"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Descrição</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full rounded-md border border-white/15 bg-black/20 px-3 py-2 text-sm outline-none focus:border-white/60"
              placeholder="Conta às pessoas o que podem esperar deste evento."
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <InlineDateTimePicker
              label="Data/hora início *"
              value={startsAt}
              onChange={(v) => setStartsAt(v)}
              minDateTime={new Date()}
              required
            />
            <InlineDateTimePicker
              label="Data/hora fim (opcional)"
              value={endsAt}
              onChange={(v) => setEndsAt(v)}
              minDateTime={startsAt ? new Date(startsAt) : new Date()}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-sm font-medium">Local</label>
              <input
                type="text"
                value={locationName}
                onChange={(e) => setLocationName(e.target.value)}
                className="w-full rounded-md border border-white/15 bg-black/20 px-3 py-2 text-sm outline-none focus:border-white/60"
                placeholder="Ex.: Casa &amp; Ala, Coliseu, Parque da Cidade…"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Cidade</label>
              <input
                type="text"
                value={locationCity}
                onChange={(e) => setLocationCity(e.target.value)}
                className="w-full rounded-md border border-white/15 bg-black/20 px-3 py-2 text-sm outline-none focus:border-white/60"
                placeholder="Porto, Braga, Lisboa…"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Rua / morada (opcional)</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full rounded-md border border-white/15 bg-black/20 px-3 py-2 text-sm outline-none focus:border-white/60"
              placeholder="Ex.: Rua de exemplo, 123 (TODO: ligar a Mapbox Search)"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Tipo de evento</label>
            <select
              value={templateType}
              onChange={(e) => setTemplateType(e.target.value)}
              className="w-full rounded-md border border-white/15 bg-black/20 px-3 py-2 text-sm outline-none focus:border-white/60"
            >
              <option value="PARTY">Festa</option>
              <option value="SPORT">Desporto</option>
              <option value="VOLUNTEERING">Voluntariado</option>
              <option value="TALK">Palestra / Talk</option>
              <option value="OTHER">Outro</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Categorias (obrigatório)</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {CATEGORY_OPTIONS.map((cat) => {
                const checked = categories.includes(cat.value);
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
                          ? [...categories, cat.value]
                          : categories.filter((c) => c !== cat.value);
                        setCategories(next);
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
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Modo de fee</label>
              <select
                value={feeMode}
                onChange={(e) => setFeeMode(e.target.value as typeof feeMode)}
                className="w-full rounded-md border border-white/15 bg-black/20 px-3 py-2 text-sm outline-none focus:border-white/60"
              >
                <option value="INHERIT">Usar padrão do organizador</option>
                <option value="ADDED">Taxa adicionada ao preço</option>
                <option value="INCLUDED">Taxa incluída no preço</option>
              </select>
              <p className="text-[11px] text-white/60">
                Define se a comissão é adicionada em cima do bilhete ou incluída no preço.
              </p>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Fee % (basis points)</label>
              <input
                type="number"
                min="0"
                max="5000"
                value={feeBps}
                onChange={(e) => setFeeBps(e.target.value)}
                className="w-full rounded-md border border-white/15 bg-black/20 px-3 py-2 text-sm outline-none focus:border-white/60"
                placeholder="ex.: 200"
              />
              <p className="text-[11px] text-white/60">200 bps = 2%. Deixa vazio para usar o padrão.</p>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Fee fixa (cêntimos)</label>
              <input
                type="number"
                min="0"
                max="5000"
                value={feeFixedCents}
                onChange={(e) => setFeeFixedCents(e.target.value)}
                className="w-full rounded-md border border-white/15 bg-black/20 px-3 py-2 text-sm outline-none focus:border-white/60"
                placeholder="ex.: 0"
              />
              <p className="text-[11px] text-white/60">Cêntimos adicionados/retidos. Vazio = padrão.</p>
            </div>
          </div>
        </div>

        {/* Secção Bilhetes */}
        <div className="space-y-4 rounded-lg border border-white/10 bg-white/5 p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-white/70">
              Tipos de bilhete
            </h2>
            <button
              type="button"
              onClick={handleAddTicketType}
              className="text-xs font-medium text-white/80 hover:text-white"
            >
              + Adicionar tipo de bilhete
            </button>
          </div>

          <div className="space-y-3">
            {ticketTypes.map((row, index) => (
              <div
                key={index}
                className="grid grid-cols-1 gap-3 rounded-md border border-white/10 bg-black/20 p-3 sm:grid-cols-12"
              >
                <div className="sm:col-span-4 space-y-1">
                  <label className="text-xs font-medium">Nome</label>
                  <input
                    type="text"
                    value={row.name}
                    onChange={(e) =>
                      handleTicketChange(index, "name", e.target.value)
                    }
                    className="w-full rounded-md border border-white/15 bg-black/40 px-2 py-1.5 text-xs outline-none focus:border-white/60"
                    placeholder="Normal, VIP, Early Bird…"
                  />
                </div>

                <div className="sm:col-span-3 space-y-1">
                  <label className="text-xs font-medium">Preço (€)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={row.price}
                    onChange={(e) =>
                      handleTicketChange(index, "price", e.target.value)
                    }
                    className="w-full rounded-md border border-white/15 bg-black/40 px-2 py-1.5 text-xs outline-none focus:border-white/60"
                    placeholder="0,00"
                  />
                </div>

                <div className="sm:col-span-3 space-y-1">
                  <label className="text-xs font-medium">
                    Quantidade total
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={row.totalQuantity}
                    onChange={(e) =>
                      handleTicketChange(index, "totalQuantity", e.target.value)
                    }
                    className="w-full rounded-md border border-white/15 bg-black/40 px-2 py-1.5 text-xs outline-none focus:border-white/60"
                    placeholder="Ex.: 100"
                  />
                </div>

                <div className="sm:col-span-2 flex items-end justify-end">
                  {ticketTypes.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveTicketType(index)}
                      className="rounded-md border border-white/15 px-2 py-1 text-xs text-white/70 hover:bg-white/10"
                    >
                      Remover
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Ações */}
        <div className="flex items-center justify-between gap-4">
          <Link
            href="/organizador/eventos"
            className="text-sm text-white/60 hover:text-white"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center rounded-md border border-white/10 bg-white px-4 py-2 text-sm font-medium text-black hover:bg-white/90 disabled:opacity-60"
          >
            {isSubmitting ? "A criar…" : "Criar evento"}
          </button>
        </div>
      </form>
    </div>
  );
}
