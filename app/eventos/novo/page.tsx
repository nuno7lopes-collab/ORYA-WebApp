"use client";

import { FormEvent, useState, ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import ReactDatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

// Estado interno para cada wave/bilhete
type TicketForm = {
  id: number; // id apenas para o React
  name: string; // nome da wave (ex: "Wave 1")
  price: string; // valor em string para o input
  available: boolean;

  // Versão 2.0 – controlo de stock e janelas de venda
  hasLimitedStock: boolean;
  totalQuantity: string; // string para input; convertemos para número no payload

  hasSchedule: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
};

export default function NovoEventoPage() {
  const router = useRouter();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFree, setIsFree] = useState(false);
  const [tickets, setTickets] = useState<TicketForm[]>([
    {
      id: 1,
      name: "Wave 1",
      price: "",
      available: true,
      hasLimitedStock: false,
      totalQuantity: "",
      hasSchedule: false,
      startsAt: null,
      endsAt: null,
    },
  ]);

  // Imagem de capa (upload de ficheiro + preview)
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);

  // Datas do evento (usadas pelo ReactDatePicker)
  const [startDateValue, setStartDateValue] = useState<Date | null>(null);
  const [endDateValue, setEndDateValue] = useState<Date | null>(null);

  // Erro do formulário
  const [formError, setFormError] = useState<string | null>(null);

  function handleAddTicket() {
    setTickets((prev) => [
      ...prev,
      {
        id: Date.now(),
        name: `Wave ${prev.length + 1}`,
        price: "",
        available: true,
        hasLimitedStock: false,
        totalQuantity: "",
        hasSchedule: false,
        startsAt: null,
        endsAt: null,
      },
    ]);
  }

  function handleRemoveTicket(id: number) {
    setTickets((prev) => prev.filter((t) => t.id !== id));
  }

  function handleTicketFieldChange<T extends keyof TicketForm>(
    id: number,
    field: T,
    value: TicketForm[T],
  ) {
    setTickets((prev) =>
      prev.map((t) => (t.id === id ? { ...t, [field]: value } : t)),
    );
  }

  function handleCoverFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setCoverFile(file);

    if (file) {
      const url = URL.createObjectURL(file);
      setCoverPreview(url);
    } else {
      setCoverPreview(null);
    }
  }

  async function uploadCoverIfNeeded(existingUrlFromInput: string) {
    // Se o utilizador não escolheu ficheiro, devolvemos o que vier do input (ou vazio)
    if (!coverFile) {
      return existingUrlFromInput || "";
    }

    try {
      const formData = new FormData();
      formData.append("file", coverFile);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        console.error("Falha no upload da imagem de capa");
        return existingUrlFromInput || "";
      }

      const data = await res.json();
      const uploadedUrl: string | undefined = data.url;

      return uploadedUrl || existingUrlFromInput || "";
    } catch (err) {
      console.error("Erro inesperado no upload da capa", err);
      return existingUrlFromInput || "";
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isSubmitting) return;

    setFormError(null);
    setIsSubmitting(true);

    try {
      const formData = new FormData(e.currentTarget);

      const title = String(formData.get("title") || "").trim();
      const description = String(formData.get("description") || "").trim();
      const locationName = String(formData.get("locationName") || "").trim();
      const address = String(formData.get("address") || "").trim();
      const timezone =
        String(formData.get("timezone") || "") || "Europe/Lisbon";
      const organizerName = String(formData.get("organizerName") || "").trim();
      const isFreeValue = formData.get("isFree") === "on";

      const coverImageUrlInput = String(
        formData.get("coverImageUrl") || "",
      ).trim();

      // Validações base
      if (!title) {
        setFormError("Dá um nome ao teu evento.");
        return;
      }

      if (!description) {
        setFormError("Adiciona uma descrição para o evento.");
        return;
      }

      if (!locationName) {
        setFormError("Indica o local do evento.");
        return;
      }

      // Datas obrigatórias via DatePicker
      if (!startDateValue || !endDateValue) {
        setFormError("Define a data de início e de fim do evento.");
        return;
      }

      if (startDateValue >= endDateValue) {
        setFormError("A data de fim tem de ser depois da data de início.");
        return;
      }

      const startDate = startDateValue.toISOString();
      const endDate = endDateValue.toISOString();

      // Validar waves: pelo menos 1 com preço válido se não for evento grátis
      const ticketsPayload = !isFreeValue
        ? tickets
            .filter((t) => {
              if (!t) return false;
              const cleaned = t.price.trim().replace(",", ".");
              if (!cleaned) return false;
              const numEuros = Number(cleaned);
              return !Number.isNaN(numEuros);
            })
            .map((t, index) => {
              const cleaned = t.price.trim().replace(",", ".");
              const numEuros = Number(cleaned);

              // Converter para cêntimos (inteiro) para guardar no DB
              const priceCents = Number.isNaN(numEuros)
                ? 0
                : Math.round(numEuros * 100);

              // Stock máximo
              let totalQuantity: number | null = null;
              if (t.hasLimitedStock) {
                const qtyCleaned = t.totalQuantity.trim();
                if (qtyCleaned) {
                  const qtyNum = Number.parseInt(qtyCleaned, 10);
                  if (Number.isFinite(qtyNum) && qtyNum > 0) {
                    totalQuantity = qtyNum;
                  }
                }
              }

              // Janelas de venda da wave
              const startsAt =
                t.hasSchedule && t.startsAt
                  ? t.startsAt.toISOString()
                  : null;
              const endsAt =
                t.hasSchedule && t.endsAt ? t.endsAt.toISOString() : null;

              return {
                name: t.name?.trim() || `Wave ${index + 1}`,
                price: priceCents,
                available: t.available,
                isVisible: t.available,
                totalQuantity,
                startsAt,
                endsAt,
                sortOrder: index,
                currency: "EUR",
              };
            })
        : [];

      if (!isFreeValue && ticketsPayload.length === 0) {
        setFormError("Adiciona pelo menos uma wave/bilhete com preço válido.");
        return;
      }

      // Preço base: mínimo das waves em cêntimos (se não for grátis)
      let basePriceNumber: number | undefined = undefined;
      if (!isFreeValue && ticketsPayload.length > 0) {
        basePriceNumber = ticketsPayload.reduce(
          (min, t) => (t.price < min ? t.price : min),
          ticketsPayload[0].price,
        );
      }

      // Upload da capa (se existir ficheiro)
      const finalCoverImageUrl = await uploadCoverIfNeeded(coverImageUrlInput);

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
          coverImageUrl: finalCoverImageUrl,
          organizerName,
          tickets: ticketsPayload,
        }),
      });

      // 🔐 Se não estiver autenticado, mandar para login
      if (res.status === 401) {
        setFormError("Precisas de entrar na tua conta para criar eventos.");
        router.push("/login?redirect=/eventos/novo");
        return;
      }

      if (!res.ok) {
        const text = await res.text();
        console.error("Erro ao criar evento:", text);
        setFormError(
          "Não foi possível criar o evento neste momento. Tenta novamente em alguns segundos.",
        );
        return;
      }

      const data = await res.json();
      const slug: string | undefined = data.slug ?? data.event?.slug;

      if (!slug) {
        console.error("Resposta sem slug:", data);
        setFormError("Evento criado mas não foi possível obter o link.");
        return;
      }

      router.push(`/eventos/${slug}`);
    } catch (err) {
      console.error("Erro inesperado ao criar evento:", err);
      setFormError("Ocorreu um erro inesperado. Tenta novamente.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="orya-body-bg min-h-screen w-full text-white">
      {/* Barra de topo simples */}
      <header className="border-b border-white/10 bg-black/30 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 md:px-10 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] text-xs font-extrabold tracking-[0.15em]">
              OR
            </span>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-white/60">
                Criador de eventos
              </p>
              <p className="text-sm text-white/80">
                Constrói a próxima experiência épica em poucos minutos.
              </p>
            </div>
          </div>
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-6 md:px-10 py-10 md:py-14">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
              Criar novo evento
            </h1>
            <p className="mt-2 text-sm text-white/70 max-w-xl">
              Define os detalhes, organiza as waves e deixa que a ORYA trate do
              resto. Pensado para criadores que levam a sério a experiência das
              pessoas.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="px-3 py-1 rounded-full border border-white/15 bg-white/5 text-white/80">
              Autosave em breve
            </span>
            <span className="px-3 py-1 rounded-full border border-[#6BFFFF]/40 bg-[#6BFFFF]/10 text-[#6BFFFF]">
              Waves &amp; bilhética inteligente
            </span>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-8 rounded-2xl border border-white/15 bg-gradient-to-br from-[#FF8AD910] via-[#9BE7FF1F] to-[#020617f2] p-6 md:p-8 backdrop-blur-2xl shadow-[0_18px_60px_rgba(0,0,0,0.55)]"
        >
          {formError && (
            <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-xs text-red-100 flex items-start gap-2">
              <span className="mt-[2px] text-sm">⚠️</span>
              <div className="space-y-1">
                <p className="font-medium text-red-100">Algo não está certo</p>
                <p className="text-[11px] text-red-100/80">{formError}</p>
              </div>
            </div>
          )}

          {/* Bloco 1: Informação geral + capa */}
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)] gap-8">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium tracking-wide text-white/70 mb-1">
                  Título do evento
                </label>
                <input
                  name="title"
                  required
                  className="w-full rounded-xl bg-black/40 border border-white/15 px-3.5 py-2.5 text-sm outline-none focus:border-[#6BFFFF] focus:ring-1 focus:ring-[#6BFFFF]/70 transition"
                  placeholder="ORYA Open Fly Padel"
                />
              </div>

              <div>
                <label className="block text-xs font-medium tracking-wide text-white/70 mb-1">
                  Descrição
                </label>
                <textarea
                  name="description"
                  required
                  rows={4}
                  className="w-full rounded-xl bg-black/40 border border-white/15 px-3.5 py-2.5 text-sm outline-none focus:border-[#6BFFFF] focus:ring-1 focus:ring-[#6BFFFF]/70 transition resize-none"
                  placeholder="Conta a história do evento, vibe, line-up, dress code, etc."
                />
                <p className="mt-1 text-[11px] text-white/50">
                  Sê claro, mas mantém o tom autêntico. Este texto vai aparecer
                  na página pública do evento.
                </p>
              </div>
            </div>

            <aside className="space-y-4">
              <div className="rounded-2xl border border-white/12 bg-black/40 p-3.5 flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium text-white/80">
                    Capa do evento
                  </p>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white/60">
                    Recom. 1600×900
                  </span>
                </div>

                <div className="relative aspect-[16/9] w-full overflow-hidden rounded-xl border border-dashed border-white/15 bg-gradient-to-br from-white/5 via-white/0 to-white/5 flex items-center justify-center">
                  {coverPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={coverPreview}
                      alt="Pré-visualização da capa"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex flex-col items-center text-center text-[11px] text-white/55 gap-1 px-6">
                      <span className="text-lg">📸</span>
                      <p>
                        Arrasta uma imagem para aqui ou escolhe um ficheiro.
                      </p>
                      <p className="text-white/35">
                        Se preferires, podes colar um URL de imagem abaixo.
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-[11px] text-white/65">
                    Upload de ficheiro
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleCoverFileChange}
                    className="block w-full text-[11px] text-white/70 file:mr-3 file:rounded-lg file:border-0 file:bg-[#6BFFFF]/10 file:px-3 file:py-1.5 file:text-[11px] file:font-medium file:text-[#6BFFFF] hover:file:bg-[#6BFFFF]/20 cursor-pointer"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[11px] text-white/65">
                    Ou URL da imagem (opcional)
                  </label>
                  <input
                    name="coverImageUrl"
                    className="w-full rounded-lg bg-black/50 border border-white/15 px-3 py-1.5 text-xs outline-none focus:border-[#6BFFFF] focus:ring-1 focus:ring-[#6BFFFF]/70"
                    placeholder="https://..."
                  />
                </div>
              </div>
            </aside>
          </div>

          {/* Bloco 2: Datas, local e info extra */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-white/10 pt-6">
            <div className="space-y-4">
              <h2 className="text-sm font-semibold text-white/90">
                Datas &amp; localização
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-xl border border-white/15 bg-black/40 px-3.5 py-3 flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-medium text-white/80 flex items-center gap-1.5">
                        <span className="text-[13px]">🕒</span>
                        Início do evento
                      </p>
                      <p className="text-[11px] text-white/55">
                        Escolhe a data e hora a que a experiência começa.
                      </p>
                    </div>
                  </div>
                  <ReactDatePicker
                    selected={startDateValue}
                    onChange={(date) => setStartDateValue(date as Date | null)}
                    showTimeSelect
                    timeFormat="HH:mm"
                    timeIntervals={15}
                    dateFormat="dd/MM/yyyy HH:mm"
                    placeholderText="Seleciona data e hora"
                    className="orya-datepicker-input mt-2 w-full rounded-lg bg-black/70 border border-white/20 px-3 py-2 text-xs outline-none focus:border-[#6BFFFF] focus:ring-1 focus:ring-[#6BFFFF]/70"
                    calendarClassName="orya-datepicker-calendar"
                    popperClassName="orya-datepicker-popper"
                  />
                </div>

                <div className="rounded-xl border border-white/15 bg-black/40 px-3.5 py-3 flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-medium text-white/80 flex items-center gap-1.5">
                        <span className="text-[13px]">🌙</span>
                        Fim do evento
                      </p>
                      <p className="text-[11px] text-white/55">
                        Quando é que o evento oficialmente termina.
                      </p>
                    </div>
                  </div>
                  <ReactDatePicker
                    selected={endDateValue}
                    onChange={(date) => setEndDateValue(date as Date | null)}
                    showTimeSelect
                    timeFormat="HH:mm"
                    timeIntervals={15}
                    dateFormat="dd/MM/yyyy HH:mm"
                    placeholderText="Seleciona data e hora"
                    className="orya-datepicker-input mt-2 w-full rounded-lg bg-black/70 border border-white/20 px-3 py-2 text-xs outline-none focus:border-[#6BFFFF] focus:ring-1 focus:ring-[#6BFFFF]/70"
                    calendarClassName="orya-datepicker-calendar"
                    popperClassName="orya-datepicker-popper"
                    minDate={startDateValue ?? undefined}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-white/70 mb-1">
                  Local
                </label>
                <input
                  name="locationName"
                  required
                  className="w-full rounded-lg bg-black/40 border border-white/15 px-3 py-2 text-xs outline-none focus:border-[#6BFFFF] focus:ring-1 focus:ring-[#6BFFFF]/70"
                  placeholder="Ex: Fly Padel Porto"
                />
              </div>

              <div>
                <label className="block text-xs text-white/70 mb-1">
                  Morada (opcional)
                </label>
                <input
                  name="address"
                  className="w-full rounded-lg bg-black/40 border border-white/15 px-3 py-2 text-xs outline-none focus:border-[#6BFFFF] focus:ring-1 focus:ring-[#6BFFFF]/70"
                  placeholder="Rua, cidade..."
                />
              </div>
            </div>

            <div className="space-y-4">
              <h2 className="text-sm font-semibold text-white/90">
                Configurações do evento
              </h2>

              <div>
                <label className="block text-xs text-white/70 mb-1">
                  Fuso horário
                </label>
                <input
                  name="timezone"
                  defaultValue="Europe/Lisbon"
                  className="w-full rounded-lg bg-black/40 border border-white/15 px-3 py-2 text-xs outline-none focus:border-[#6BFFFF] focus:ring-1 focus:ring-[#6BFFFF]/70"
                />
                <p className="mt-1 text-[11px] text-white/45">
                  Normalmente não precisas de mexer aqui se o evento é em
                  Portugal.
                </p>
              </div>

              <div>
                <label className="block text-xs text-white/70 mb-1">
                  Organizador (opcional)
                </label>
                <input
                  name="organizerName"
                  className="w-full rounded-lg bg-black/40 border border-white/15 px-3 py-2 text-xs outline-none focus:border-[#6BFFFF] focus:ring-1 focus:ring-[#6BFFFF]/70"
                  placeholder="ORYA, parceiro, etc."
                />
              </div>

              <div className="mt-2 flex items-center gap-3 rounded-xl border border-white/15 bg-black/40 px-3.5 py-2.5">
                <input
                  id="isFree"
                  name="isFree"
                  type="checkbox"
                  checked={isFree}
                  onChange={(e) => setIsFree(e.target.checked)}
                  className="h-4 w-4 rounded border-white/40 bg-black/60"
                />
                <div className="text-xs">
                  <label htmlFor="isFree" className="font-medium text-white/80">
                    Evento gratuito
                  </label>
                  <p className="text-[11px] text-white/55">
                    Se marcado, não são necessárias waves pagas e o evento será
                    promovido como free entry.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Bloco 3: Bilhetes / Waves */}
          {!isFree && (
            <div className="border-t border-white/10 pt-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-white/90">
                    Bilhetes &amp; waves
                  </h2>
                  <p className="text-[11px] text-white/60 max-w-md">
                    Cria diferentes waves com preços, stock e janelas de venda
                    diferentes. Pensa em Early Bird, Regular e Last Call.
                  </p>
                  <p className="text-[11px] text-white/45 mt-1">
                    A wave mais barata define o preço &quot;a partir de&quot;
                    que aparece no feed da ORYA.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleAddTicket}
                  className="text-xs px-4 py-2 rounded-full bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] text-black font-semibold hover:scale-105 active:scale-95 transition-transform shadow-[0_0_20px_rgba(107,255,255,0.3)]"
                >
                  + Adicionar wave
                </button>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {tickets.map((t, index) => (
                  <div
                    key={t.id}
                    className="rounded-xl border border-white/14 bg-gradient-to-br from-white/4 via-black/60 to-black/80 px-3.5 py-3 flex flex-col gap-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex flex-col gap-1">
                        <div className="inline-flex items-center gap-2">
                          <span className="inline-flex h-5 rounded-full border border-white/15 px-2 text-[10px] uppercase tracking-[0.15em] text-white/50">
                            Wave {index + 1}
                          </span>
                          <input
                            value={t.name}
                            onChange={(e) =>
                              handleTicketFieldChange(
                                t.id,
                                "name",
                                e.target.value,
                              )
                            }
                            className="bg-transparent border-0 text-sm font-medium text-white/90 px-0 py-0 outline-none focus:ring-0 focus:outline-none"
                            placeholder={
                              index === 0
                                ? "Early Bird"
                                : index === 1
                                  ? "Regular"
                                  : "Last Call / Extra"
                            }
                          />
                        </div>
                        <p className="text-[11px] text-white/50">
                          Define nomes que façam sentido para a estratégia de
                          preço (Early, Regular, Last Call, VIP…).
                        </p>
                      </div>

                      <div className="flex flex-col items-end gap-1">
                        <label className="flex items-center gap-1.5 text-[11px] text-white/70">
                          <input
                            type="checkbox"
                            checked={t.available}
                            onChange={(e) =>
                              handleTicketFieldChange(
                                t.id,
                                "available",
                                e.target.checked,
                              )
                            }
                            className="h-3.5 w-3.5 rounded border-white/50 bg-black/70"
                          />
                          Disponível
                        </label>

                        {tickets.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveTicket(t.id)}
                            className="text-[11px] text-red-400 hover:text-red-300"
                          >
                            Remover
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Preço */}
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-white/60">
                          Preço por bilhete
                        </span>
                        <div className="flex items-center gap-1 rounded-lg bg-black/60 border border-white/15 px-2 py-1">
                          <span className="text-[11px] text-white/50">EUR</span>
                          <input
                            type="number"
                            min={0}
                            step={0.01}
                            value={t.price}
                            onChange={(e) =>
                              handleTicketFieldChange(
                                t.id,
                                "price",
                                e.target.value,
                              )
                            }
                            className="w-24 bg-transparent border-0 text-xs outline-none focus:ring-0"
                            placeholder="0.00"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Stock + janelas de venda */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px]">
                      {/* Stock */}
                      <div className="rounded-lg border border-white/12 bg-black/40 px-3 py-2.5 flex flex-col gap-2">
                        <label className="flex items-center gap-2 text-white/75">
                          <input
                            type="checkbox"
                            checked={t.hasLimitedStock}
                            onChange={(e) =>
                              handleTicketFieldChange(
                                t.id,
                                "hasLimitedStock",
                                e.target.checked,
                              )
                            }
                            className="h-3.5 w-3.5 rounded border-white/50 bg-black/70"
                          />
                          Stock máximo para esta wave
                        </label>

                        {t.hasLimitedStock && (
                          <div className="flex items-center gap-2 mt-1">
                            <input
                              type="number"
                              min={1}
                              value={t.totalQuantity}
                              onChange={(e) =>
                                handleTicketFieldChange(
                                  t.id,
                                  "totalQuantity",
                                  e.target.value,
                                )
                              }
                              className="w-24 bg-black/70 border border-white/20 rounded-lg px-2 py-1 text-xs outline-none focus:border-[#6BFFFF] focus:ring-1 focus:ring-[#6BFFFF]/60"
                              placeholder="Ex: 150"
                            />
                            <span className="text-white/50">
                              lugares nesta wave
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Janelas de venda */}
                      <div className="rounded-lg border border-white/12 bg-black/40 px-3 py-2.5 flex flex-col gap-2">
                        <label className="flex items-center gap-2 text-white/75">
                          <input
                            type="checkbox"
                            checked={t.hasSchedule}
                            onChange={(e) =>
                              handleTicketFieldChange(
                                t.id,
                                "hasSchedule",
                                e.target.checked,
                              )
                            }
                            className="h-3.5 w-3.5 rounded border-white/50 bg-black/70"
                          />
                          Agendar esta wave
                        </label>

                        {t.hasSchedule && (
                          <div className="flex flex-col gap-2 mt-1">
                            <div className="flex items-center gap-2">
                              <span className="text-white/55 shrink-0">
                                Abre:
                              </span>
                              <ReactDatePicker
                                selected={t.startsAt}
                                onChange={(date) =>
                                  handleTicketFieldChange(
                                    t.id,
                                    "startsAt",
                                    date as Date | null,
                                  )
                                }
                                showTimeSelect
                                timeFormat="HH:mm"
                                timeIntervals={15}
                                dateFormat="dd/MM HH:mm"
                                placeholderText="Data/hora de abertura"
                                className="w-full rounded-lg bg-black/70 border border-white/20 px-2 py-1 text-[11px] outline-none focus:border-[#6BFFFF] focus:ring-1 focus:ring-[#6BFFFF]/60"
                                calendarClassName="orya-datepicker-calendar"
                                popperClassName="orya-datepicker-popper"
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-white/55 shrink-0">
                                Fecha:
                              </span>
                              <ReactDatePicker
                                selected={t.endsAt}
                                onChange={(date) =>
                                  handleTicketFieldChange(
                                    t.id,
                                    "endsAt",
                                    date as Date | null,
                                  )
                                }
                                showTimeSelect
                                timeFormat="HH:mm"
                                timeIntervals={15}
                                dateFormat="dd/MM HH:mm"
                                placeholderText="Data/hora de fecho"
                                className="w-full rounded-lg bg-black/70 border border-white/20 px-2 py-1 text-[11px] outline-none focus:border-[#6BFFFF] focus:ring-1 focus:ring-[#6BFFFF]/60"
                                calendarClassName="orya-datepicker-calendar"
                                popperClassName="orya-datepicker-popper"
                                minDate={t.startsAt ?? undefined}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CTA final */}
          <div className="pt-5 border-t border-white/10 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="text-[11px] text-white/55 max-w-sm">
              Ao criar este evento, estás a preparar a base para bilhetes,
              revenda, guestlists e experiências ORYA conectadas.
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] text-black font-semibold hover:scale-105 active:scale-95 transition-transform disabled:opacity-60 disabled:hover:scale-100 shadow-[0_0_35px_rgba(107,255,255,0.45)]"
            >
              {isSubmitting ? "A criar evento..." : "Publicar evento"}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}