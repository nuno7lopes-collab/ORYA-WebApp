export type ProfileSummary = {
  id: string;
  email: string | null;
  fullName: string | null;
  username: string | null;
  avatarUrl: string | null;
  bio: string | null;
  city: string | null;
  padelLevel: string | null;
  onboardingDone: boolean;
};

export type AgendaItem = {
  id: string;
  type: "EVENTO" | "JOGO" | "INSCRICAO" | "RESERVA";
  title: string;
  startAt: string;
  endAt: string | null;
  status?: string | null;
  label?: string | null;
  ctaHref?: string | null;
  ctaLabel?: string | null;
};

export type ProfileAgendaStats = {
  upcoming: number;
  past: number;
  thisMonth: number;
};
