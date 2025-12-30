// types/event.ts

export type EventVisibility = 'public' | 'unlisted';

export type TicketType = {
  id: string;
  name: string;          // ex: "Wave 1", "Geral", "VIP"
  price: number;         // 0 = grátis
  currency: 'EUR';
  quantity?: number;     // stock opcional
  waveOrder?: number;    // 1, 2, 3...
};

export type Event = {
  id: string;
  slug: string;

  title: string;
  description: string;

  coverImage: string;
  galleryImages?: string[];

  locationName: string;  // "Fly Padel"
  address: string;       // "Rua X, Porto"
  latitude?: number;
  longitude?: number;

  // Datas em ISO + timezone para no futuro tratar bem os fusos
  startDate: string;     // "2025-12-20T09:00:00.000Z"
  endDate: string;       // "2025-12-20T19:00:00.000Z"
  timezone: string;      // ex: "Europe/Lisbon"

  visibility: EventVisibility; // public ou unlisted (só link)

  isFree: boolean;
  tickets: TicketType[];

  capacity?: number;
  remainingSpots?: number;

  minAge?: number;       // ex: 18
  tags: string[];        // ["padel", "torneio"]

  organizerName: string;
  organizerAvatarUrl?: string;

  interestedCount: number; // likes / interessados
  goingCount: number;      // pessoas que marcaram "vou"
};
