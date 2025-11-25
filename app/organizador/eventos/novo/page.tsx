"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useUser } from "@/app/hooks/useUser";
import { useAuthModal } from "@/app/components/autenticação/AuthModalContext";

type TicketTypeRow = {
  name: string;
  price: string;
  totalQuantity: string;
};

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
  const [templateType, setTemplateType] = useState("PARTY");
  const [ticketTypes, setTicketTypes] = useState<TicketTypeRow[]>([
    { name: "Normal", price: "", totalQuantity: "" },
  ]);

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
        ticketTypes: preparedTickets,
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
            <div className="space-y-1">
              <label className="text-sm font-medium">
                Data/hora início *
              </label>
              <input
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className="w-full rounded-md border border-white/15 bg-black/20 px-3 py-2 text-sm outline-none focus:border-white/60"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">
                Data/hora fim (opcional)
              </label>
              <input
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                className="w-full rounded-md border border-white/15 bg-black/20 px-3 py-2 text-sm outline-none focus:border-white/60"
              />
            </div>
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
