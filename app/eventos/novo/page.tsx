"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type TicketForm = {
  id: number;         // id só para React
  price: string;      // string no input
  available: boolean;
};

export default function NovoEventoPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFree, setIsFree] = useState(false);
  const [tickets, setTickets] = useState<TicketForm[]>([
    { id: 1, price: "", available: true },
  ]);

  function handleAddTicket() {
    setTickets((prev) => [
      ...prev,
      { id: Date.now(), price: "", available: true },
    ]);
  }

  function handleRemoveTicket(id: number) {
    setTickets((prev) => prev.filter((t) => t.id !== id));
  }

  function handleTicketChange(id: number, value: string) {
    setTickets((prev) =>
      prev.map((t) => (t.id === id ? { ...t, price: value } : t)),
    );
  }

  function handleTicketAvailableChange(id: number, value: boolean) {
    setTickets((prev) =>
      prev.map((t) => (t.id === id ? { ...t, available: value } : t)),
    );
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      const formData = new FormData(e.currentTarget);

      const title = String(formData.get("title") || "").trim();
      const description = String(formData.get("description") || "").trim();
      const startDate = String(formData.get("startDate") || "");
      const endDate = String(formData.get("endDate") || "");
      const locationName = String(formData.get("locationName") || "").trim();
      const address = String(formData.get("address") || "").trim();
      const timezone =
        String(formData.get("timezone") || "") || "Europe/Lisbon";
      const coverImageUrl = String(formData.get("coverImageUrl") || "");
      const organizerName = String(formData.get("organizerName") || "");
      const isFreeValue = formData.get("isFree") === "on";

      let basePriceNumber: number | undefined = undefined;
      const basePriceRaw = String(formData.get("basePrice") || "").trim();
      if (basePriceRaw) {
        const parsed = Number(basePriceRaw.replace(",", "."));
        if (!Number.isNaN(parsed)) {
          basePriceNumber = parsed;
        }
      }

      const ticketsPayload =
        !isFreeValue
          ? tickets
              .filter((t) => t.price.trim() !== "")
              .map((t) => {
                const priceNumber = Number(t.price.replace(",", "."));
                return {
                  price: Number.isNaN(priceNumber) ? 0 : priceNumber,
                  available: t.available,
                };
              })
          : [];

      const res = await fetch("/api/eventos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          startDate,
          endDate,
          timezone,
          isFree: isFreeValue,
          locationName,
          address,
          basePrice: basePriceNumber,
          coverImageUrl,
          organizerName,
          tickets: ticketsPayload,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        console.error("Erro ao criar evento:", text);
        alert("Erro ao criar evento. Vê a consola para mais detalhes.");
        return;
      }

      const data = await res.json();
      const slug: string | undefined = data.slug ?? data.event?.slug;

      if (!slug) {
        console.error("Resposta sem slug:", data);
        alert("Evento criado mas não foi possível obter o link.");
        return;
      }

      router.push(`/eventos/${slug}`);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen w-full bg-[radial-gradient(circle_at_top,_#1a1030_0,_#050509_45%,_#02020a_100%)] text-white">
      <section className="max-w-4xl mx-auto px-6 md:px-10 py-16">
        <h1 className="text-3xl md:text-4xl font-bold mb-6">
          Criar novo evento
        </h1>

        <form
          onSubmit={handleSubmit}
          className="space-y-8 bg-white/5 border border-white/10 rounded-2xl p-6 md:p-8 backdrop-blur-xl"
        >
          {/* Dados principais */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm mb-1">Título</label>
              <input
                name="title"
                required
                className="w-full rounded-lg bg-black/40 border border-white/20 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]"
                placeholder="ORYA Open Fly Padel"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm mb-1">Descrição</label>
              <textarea
                name="description"
                required
                rows={4}
                className="w-full rounded-lg bg-black/40 border border-white/20 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]"
                placeholder="Explica em que consiste o evento..."
              />
            </div>

            <div>
              <label className="block text-sm mb-1">Data início</label>
              <input
                type="datetime-local"
                name="startDate"
                required
                className="w-full rounded-lg bg-black/40 border border-white/20 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]"
              />
            </div>

            <div>
              <label className="block text-sm mb-1">Data fim</label>
              <input
                type="datetime-local"
                name="endDate"
                required
                className="w-full rounded-lg bg-black/40 border border-white/20 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]"
              />
            </div>

            <div>
              <label className="block text-sm mb-1">Local</label>
              <input
                name="locationName"
                required
                className="w-full rounded-lg bg-black/40 border border-white/20 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]"
                placeholder="Ex: Fly Padel Porto"
              />
            </div>

            <div>
              <label className="block text-sm mb-1">Morada (opcional)</label>
              <input
                name="address"
                className="w-full rounded-lg bg-black/40 border border-white/20 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]"
                placeholder="Rua, cidade..."
              />
            </div>

            <div>
              <label className="block text-sm mb-1">Fuso horário</label>
              <input
                name="timezone"
                defaultValue="Europe/Lisbon"
                className="w-full rounded-lg bg-black/40 border border-white/20 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]"
              />
            </div>

            <div>
              <label className="block text-sm mb-1">
                Organizador (opcional)
              </label>
              <input
                name="organizerName"
                className="w-full rounded-lg bg-black/40 border border-white/20 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]"
                placeholder="ORYA, parceiro, etc."
              />
            </div>

            <div>
              <label className="block text-sm mb-1">
                URL imagem de capa (opcional)
              </label>
              <input
                name="coverImageUrl"
                className="w-full rounded-lg bg-black/40 border border-white/20 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]"
                placeholder="https://..."
              />
            </div>
          </div>

          {/* Preços / Waves */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <input
                id="isFree"
                name="isFree"
                type="checkbox"
                checked={isFree}
                onChange={(e) => setIsFree(e.target.checked)}
                className="h-4 w-4"
              />
              <label htmlFor="isFree" className="text-sm">
                Evento gratuito
              </label>
            </div>

            {!isFree && (
              <>
                <div>
                  <label className="block text-sm mb-1">
                    Preço base (opcional)
                  </label>
                  <input
                    name="basePrice"
                    className="w-full md:w-64 rounded-lg bg-black/40 border border-white/20 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]"
                    placeholder="Ex: 10 (euros)"
                  />
                  <p className="mt-1 text-xs text-white/60">
                    Se deixares vazio, usamos o preço do primeiro bilhete.
                  </p>
                </div>

                <div className="mt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">Bilhetes / Waves</h3>
                    <button
                      type="button"
                      onClick={handleAddTicket}
                      className="text-xs px-3 py-1 rounded-full bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] text-black font-semibold hover:scale-105 transition-transform"
                    >
                      + Adicionar wave
                    </button>
                  </div>

                  <div className="space-y-3">
                    {tickets.map((t, index) => (
                      <div
                        key={t.id}
                        className="flex items-center gap-3 bg-black/30 border border-white/15 rounded-xl px-3 py-2"
                      >
                        <span className="text-xs text-white/60 w-16">
                          Wave {index + 1}
                        </span>
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          value={t.price}
                          onChange={(e) =>
                            handleTicketChange(t.id, e.target.value)
                          }
                          className="flex-1 rounded-lg bg-black/40 border border-white/20 px-3 py-1.5 text-sm outline-none focus:border-[#6BFFFF]"
                          placeholder="Preço em euros"
                        />
                        <label className="flex items-center gap-1 text-xs">
                          <input
                            type="checkbox"
                            checked={t.available}
                            onChange={(e) =>
                              handleTicketAvailableChange(
                                t.id,
                                e.target.checked,
                              )
                            }
                            className="h-3 w-3"
                          />
                          Disponível
                        </label>
                        {tickets.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveTicket(t.id)}
                            className="text-xs text-red-400 hover:text-red-300"
                          >
                            Remover
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="pt-4 border-t border-white/10 flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] text-black font-semibold hover:scale-105 transition-transform disabled:opacity-60 disabled:hover:scale-100"
            >
              {isSubmitting ? "A criar..." : "Criar evento"}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}