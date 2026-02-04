import { resolveLocale } from "@/lib/i18n";

type TicketCopy = {
  isPadel: boolean;
  singular: string;
  plural: string;
  singularCap: string;
  pluralCap: string;
  articleSingular: string;
  articlePlural: string;
  freeLabel: string;
  buyLabel: string;
  viewLabel: string;
};

const normalizeVariant = (variant?: string) => (variant ?? "").trim().toUpperCase();

type TicketCopyLocale = {
  singular: string;
  plural: string;
  singularCap: string;
  pluralCap: string;
  articleSingular: string;
  articlePlural: string;
  freeLabel: string;
  buyLabel: string;
  viewLabel: string;
};

const COPY_BY_LOCALE: Record<string, { padel: TicketCopyLocale; ticket: TicketCopyLocale }> = {
  "pt-PT": {
    padel: {
      singular: "inscrição",
      plural: "inscrições",
      singularCap: "Inscrição",
      pluralCap: "Inscrições",
      articleSingular: "a",
      articlePlural: "as",
      freeLabel: "Inscrição gratuita",
      buyLabel: "Inscrever agora",
      viewLabel: "Ver inscrições",
    },
    ticket: {
      singular: "bilhete",
      plural: "bilhetes",
      singularCap: "Bilhete",
      pluralCap: "Bilhetes",
      articleSingular: "o",
      articlePlural: "os",
      freeLabel: "Entrada gratuita",
      buyLabel: "Comprar agora",
      viewLabel: "Ver bilhetes",
    },
  },
  "en-US": {
    padel: {
      singular: "registration",
      plural: "registrations",
      singularCap: "Registration",
      pluralCap: "Registrations",
      articleSingular: "a",
      articlePlural: "the",
      freeLabel: "Free registration",
      buyLabel: "Register now",
      viewLabel: "View registrations",
    },
    ticket: {
      singular: "ticket",
      plural: "tickets",
      singularCap: "Ticket",
      pluralCap: "Tickets",
      articleSingular: "a",
      articlePlural: "the",
      freeLabel: "Free entry",
      buyLabel: "Buy now",
      viewLabel: "View tickets",
    },
  },
  "es-ES": {
    padel: {
      singular: "inscripción",
      plural: "inscripciones",
      singularCap: "Inscripción",
      pluralCap: "Inscripciones",
      articleSingular: "la",
      articlePlural: "las",
      freeLabel: "Inscripción gratuita",
      buyLabel: "Inscribirme ahora",
      viewLabel: "Ver inscripciones",
    },
    ticket: {
      singular: "entrada",
      plural: "entradas",
      singularCap: "Entrada",
      pluralCap: "Entradas",
      articleSingular: "la",
      articlePlural: "las",
      freeLabel: "Entrada gratuita",
      buyLabel: "Comprar ahora",
      viewLabel: "Ver entradas",
    },
  },
};

export const getTicketCopy = (variant?: string, locale?: string | null): TicketCopy => {
  const isPadel = normalizeVariant(variant) === "PADEL";
  const resolved = resolveLocale(locale);
  const localeCopy = COPY_BY_LOCALE[resolved] ?? COPY_BY_LOCALE["pt-PT"];
  const base = isPadel ? localeCopy.padel : localeCopy.ticket;
  return {
    isPadel,
    singular: base.singular,
    plural: base.plural,
    singularCap: base.singularCap,
    pluralCap: base.pluralCap,
    articleSingular: base.articleSingular,
    articlePlural: base.articlePlural,
    freeLabel: base.freeLabel,
    buyLabel: base.buyLabel,
    viewLabel: base.viewLabel,
  };
};
