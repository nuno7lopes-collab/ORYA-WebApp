export const PORTUGAL_CITIES = [
  "Lisboa",
  "Porto",
  "Braga",
  "Coimbra",
  "Faro",
  "Aveiro",
  "Setúbal",
  "Viana do Castelo",
  "Vila Real",
  "Bragança",
  "Guarda",
  "Castelo Branco",
  "Leiria",
  "Santarém",
  "Beja",
  "Évora",
  "Viseu",
  "Ponta Delgada",
  "Funchal",
] as const;

export type CityOption = (typeof PORTUGAL_CITIES)[number];
