"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { formatDateTime } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { DASHBOARD_CARD, CTA_NEUTRAL, CTA_SECONDARY } from "@/app/org/_internal/core/dashboardUi";

type MarketingEvent = {
  id: number;
  title: string;
  slug: string;
  startsAt?: string | null;
  locationFormattedAddress?: string | null;
  templateType?: string | null;
};

type PromoCodeLite = {
  id: number;
  code: string;
  eventId: number | null;
};

type MarketingContentKitProps = {
  events: MarketingEvent[];
  promoCodes: PromoCodeLite[];
};

const COPY_VARIANTS = [
  {
    id: "invite",
    label: "Convite",
    build: (data: {
      title: string;
      when: string;
      location: string;
      link: string;
      promoCode?: string | null;
    }) =>
      `Ja tens plano? ${data.title} em ${data.when} ${data.location ? `(${data.location})` : ""}.` +
      `${data.promoCode ? ` Usa o codigo ${data.promoCode}.` : ""} ${data.link}`,
  },
  {
    id: "last-call",
    label: "Ultimas vagas",
    build: (data: {
      title: string;
      when: string;
      link: string;
      promoCode?: string | null;
    }) =>
      `Ultimas vagas para ${data.title} (${data.when}).` +
      `${data.promoCode ? ` Codigo ${data.promoCode} ativo.` : ""} ${data.link}`,
  },
  {
    id: "promo",
    label: "Promocao",
    build: (data: {
      title: string;
      when: string;
      link: string;
      promoCode?: string | null;
    }) =>
      `${data.title} esta a chegar (${data.when}).` +
      `${data.promoCode ? ` Promo: ${data.promoCode}.` : ""} ${data.link}`,
  },
] as const;

export default function MarketingContentKit({ events, promoCodes }: MarketingContentKitProps) {
  const [origin, setOrigin] = useState("");
  const [selectedEventId, setSelectedEventId] = useState<string>(events[0]?.id ? String(events[0].id) : "");
  const [selectedPromoId, setSelectedPromoId] = useState<string>("none");
  const [utmSource, setUtmSource] = useState("instagram");
  const [utmMedium, setUtmMedium] = useState("social");
  const [utmCampaign, setUtmCampaign] = useState("");
  const [utmContent, setUtmContent] = useState("");
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!origin && typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
  }, [origin]);

  useEffect(() => {
    if (!events.length) return;
    const exists = events.some((ev) => String(ev.id) === selectedEventId);
    if (!exists) {
      setSelectedEventId(String(events[0].id));
    }
  }, [events, selectedEventId]);

  const selectedEvent = useMemo(
    () => events.find((ev) => String(ev.id) === selectedEventId) ?? null,
    [events, selectedEventId],
  );

  const availablePromos = useMemo(() => {
    if (!selectedEvent) return promoCodes;
    return promoCodes.filter((promo) => promo.eventId === null || promo.eventId === selectedEvent.id);
  }, [promoCodes, selectedEvent]);

  useEffect(() => {
    if (selectedPromoId === "none") return;
    const exists = availablePromos.some((promo) => String(promo.id) === selectedPromoId);
    if (!exists) {
      setSelectedPromoId("none");
    }
  }, [availablePromos, selectedPromoId]);

  const selectedPromo = useMemo(
    () => availablePromos.find((promo) => String(promo.id) === selectedPromoId) ?? null,
    [availablePromos, selectedPromoId],
  );

  const shareLink = useMemo(() => {
    if (!selectedEvent) return "";
    const params = new URLSearchParams();
    if (selectedPromo?.code) {
      params.set("promo", selectedPromo.code);
      params.set("checkout", "1");
    }
    if (utmSource.trim()) params.set("utm_source", utmSource.trim());
    if (utmMedium.trim()) params.set("utm_medium", utmMedium.trim());
    if (utmCampaign.trim()) params.set("utm_campaign", utmCampaign.trim());
    if (utmContent.trim()) params.set("utm_content", utmContent.trim());
    const path = `/eventos/${selectedEvent.slug}`;
    const base = origin ? `${origin}${path}` : path;
    const query = params.toString();
    return query ? `${base}?${query}` : base;
  }, [origin, selectedEvent, selectedPromo, utmSource, utmMedium, utmCampaign, utmContent]);

  const formattedWhen = useMemo(() => {
    if (!selectedEvent?.startsAt) return "data a anunciar";
    const date = new Date(selectedEvent.startsAt);
    if (Number.isNaN(date.getTime())) return "data a anunciar";
    return formatDateTime(date);
  }, [selectedEvent?.startsAt]);
  const locationLabel = selectedEvent
    ? selectedEvent.locationFormattedAddress || "local a anunciar"
    : "local a anunciar";

  const shareTemplates = useMemo(() => {
    if (!selectedEvent) return [];
    return COPY_VARIANTS.map((variant) => {
      const text = variant.build({
        title: selectedEvent.title,
        when: formattedWhen,
        location: locationLabel,
        link: shareLink,
        promoCode: selectedPromo?.code ?? null,
      });
      return { ...variant, text };
    });
  }, [formattedWhen, locationLabel, selectedEvent, selectedPromo, shareLink]);

  const handleCopy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopyStatus(`Copiado: ${label}`);
      window.setTimeout(() => setCopyStatus(null), 2000);
    } catch (err) {
      setCopyStatus("Falha a copiar");
      window.setTimeout(() => setCopyStatus(null), 2000);
    }
  };

  if (!events.length) {
    return (
      <div className={cn(DASHBOARD_CARD, "p-4 text-sm text-white/70")}>
        Sem eventos para gerar conteudos.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className={cn(DASHBOARD_CARD, "p-4 space-y-3")}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-lg font-semibold text-white">Gerador de links</h3>
            <p className="text-[12px] text-white/65">UTM + promo para partilhas rapidas.</p>
          </div>
          <Link href="/org/crm/campanhas" className={cn(CTA_SECONDARY, "px-3 py-1 text-[11px]")}>
            Ir para campanhas
          </Link>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-[12px] text-white/70">
            Evento
            <select
              className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              value={selectedEventId}
              onChange={(event) => setSelectedEventId(event.target.value)}
            >
              {events.map((ev) => (
                <option key={ev.id} value={String(ev.id)}>
                  {ev.title}
                </option>
              ))}
            </select>
          </label>
          <label className="text-[12px] text-white/70">
            Codigo promocional (opcional)
            <select
              className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              value={selectedPromoId}
              onChange={(event) => setSelectedPromoId(event.target.value)}
            >
              <option value="none">Sem codigo</option>
              {availablePromos.map((promo) => (
                <option key={promo.id} value={String(promo.id)}>
                  {promo.code}
                </option>
              ))}
            </select>
          </label>
          <label className="text-[12px] text-white/70">
            UTM source
            <input
              className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              value={utmSource}
              onChange={(event) => setUtmSource(event.target.value)}
            />
          </label>
          <label className="text-[12px] text-white/70">
            UTM medium
            <input
              className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              value={utmMedium}
              onChange={(event) => setUtmMedium(event.target.value)}
            />
          </label>
          <label className="text-[12px] text-white/70">
            UTM campaign
            <input
              className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              placeholder={selectedEvent?.slug || "campanha"}
              value={utmCampaign}
              onChange={(event) => setUtmCampaign(event.target.value)}
            />
          </label>
          <label className="text-[12px] text-white/70">
            UTM content
            <input
              className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              placeholder="story, feed, parceiro"
              value={utmContent}
              onChange={(event) => setUtmContent(event.target.value)}
            />
          </label>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
          <p className="text-[11px] uppercase tracking-[0.2em] text-white/50">Link pronto</p>
          <p className="mt-2 break-all text-[12px] text-white/80">{shareLink || "-"}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={CTA_NEUTRAL}
              onClick={() => shareLink && handleCopy(shareLink, "Link")}
              disabled={!shareLink}
            >
              Copiar link
            </button>
            {copyStatus ? <span className="text-[11px] text-white/60">{copyStatus}</span> : null}
          </div>
        </div>
      </div>

      <div className={cn(DASHBOARD_CARD, "p-4 space-y-3")}>
        <div>
          <h3 className="text-lg font-semibold text-white">Textos rapidos</h3>
          <p className="text-[12px] text-white/65">Copias prontas com o link e promo.</p>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {shareTemplates.map((template) => (
            <div key={template.id} className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <p className="text-[11px] uppercase tracking-[0.2em] text-white/50">{template.label}</p>
              <p className="mt-2 text-[12px] text-white/75">{template.text}</p>
              <button
                type="button"
                className={cn(CTA_SECONDARY, "mt-3 w-full justify-center text-[11px]")}
                onClick={() => handleCopy(template.text, template.label)}
              >
                Copiar texto
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
