// data/events.ts

export type Event = {
  id: string;
  slug: string;

  name: string;
  description: string;

  startDate: string; // ISO: "2025-12-20T09:00:00"
  endDate: string;   // ISO: "2025-12-20T19:00:00"
  timezone: string;  // "Europe/Lisbon"

  locationName: string;
  address?: string;
  city: string;
  country: string;

  coverImage: string;

  isFree: boolean;
  priceFrom?: number; // em euros
  currency: "EUR";

  capacity?: number;
  spotsLeft?: number;

  organizerName: string;
  minAge?: number;

  tags: string[];
  interestedCount: number;
};

export const events: Event[] = [
  {
    id: "1",
    slug: "orya-open-fly-padel",
    name: "ORYA Open Fly Padel",
    description:
      "O torneio que junta competição, música, marcas e energia à volta de um dia inteiro de padel no Fly Padel.",
    startDate: "2025-12-20T09:00:00",
    endDate: "2025-12-20T19:00:00",
    timezone: "Europe/Lisbon",
    locationName: "Fly Padel",
    address: "Rua qualquer, Porto",
    city: "Porto",
    country: "Portugal",
    coverImage:
      "https://images.orya.pt/placeholder-orya-open.jpg", // mete aqui uma imagem real quando tiveres
    isFree: false,
    priceFrom: 49.9,
    currency: "EUR",
    capacity: 80,
    spotsLeft: 40,
    organizerName: "ORYA",
    minAge: 16,
    tags: ["padel", "torneio", "porto", "social"],
    interestedCount: 32,
  },
  {
    id: "2",
    slug: "orya-fest-porto",
    name: "ORYA Fest · Porto",
    description:
      "Uma noite para ligar pessoas, música e experiências. O primeiro grande evento da comunidade ORYA.",
    startDate: "2026-03-14T22:00:00",
    endDate: "2026-03-15T04:00:00",
    timezone: "Europe/Lisbon",
    locationName: "Casa & Ala",
    address: "Rua Bernardino Machado 886, Maia",
    city: "Maia",
    country: "Portugal",
    coverImage:
      "https://images.orya.pt/placeholder-orya-fest.jpg",
    isFree: false,
    priceFrom: 15,
    currency: "EUR",
    capacity: 300,
    spotsLeft: 120,
    organizerName: "ORYA",
    minAge: 18,
    tags: ["festa", "noite", "dj", "porto"],
    interestedCount: 120,
  },
];

export function getEventBySlug(slug: string) {
  return events.find((e) => e.slug === slug);
}