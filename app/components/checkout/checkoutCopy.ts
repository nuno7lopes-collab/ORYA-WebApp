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

export const getTicketCopy = (variant?: string): TicketCopy => {
  const isPadel = normalizeVariant(variant) === "PADEL";
  return {
    isPadel,
    singular: isPadel ? "inscrição" : "bilhete",
    plural: isPadel ? "inscrições" : "bilhetes",
    singularCap: isPadel ? "Inscrição" : "Bilhete",
    pluralCap: isPadel ? "Inscrições" : "Bilhetes",
    articleSingular: isPadel ? "a" : "o",
    articlePlural: isPadel ? "as" : "os",
    freeLabel: isPadel ? "Inscrição gratuita" : "Entrada gratuita",
    buyLabel: isPadel ? "Inscrever agora" : "Comprar agora",
    viewLabel: isPadel ? "Ver inscrições" : "Ver bilhetes",
  };
};
