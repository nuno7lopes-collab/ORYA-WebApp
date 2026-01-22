export type CatalogBackground = {
  id: string;
  labelKey: string;
  descriptionKey: string;
  category: "global" | "landing" | "admin" | "fallback" | "event";
  color: string;
  image: string;
  overlay: string;
  overlayOpacity: number;
};

export type CatalogSurface = {
  id: string;
  labelKey: string;
  descriptionKey: string;
  className: string;
};

export type CatalogButton = {
  id: string;
  labelKey: string;
  descriptionKey: string;
  kind: "primary" | "secondary" | "ghost" | "neutral" | "danger" | "success";
  className: string;
};

export type CatalogBadge = {
  id: string;
  labelKey: string;
  descriptionKey: string;
  tone: "neutral" | "info" | "success" | "warning" | "danger" | "accent";
  className: string;
};

export const BACKGROUND_CATALOG: CatalogBackground[] = [
  {
    id: "orya-user",
    labelKey: "oryaDark",
    descriptionKey: "oryaDark",
    category: "global",
    color: "#0b1020",
    image:
      "radial-gradient(circle at 18% 18%, rgba(110, 140, 255, 0.28), transparent 55%), radial-gradient(circle at 78% 22%, rgba(255, 122, 205, 0.2), transparent 55%), radial-gradient(circle at 35% 85%, rgba(72, 255, 229, 0.12), transparent 60%), linear-gradient(160deg, #0a0f1e 0%, #0f1428 48%, #0b1020 100%)",
    overlay:
      "linear-gradient(180deg, rgba(10, 12, 24, 0.15) 0%, rgba(6, 8, 18, 0.6) 58%, rgba(4, 6, 14, 0.92) 100%)",
    overlayOpacity: 0.92,
  },
  {
    id: "orya-light",
    labelKey: "oryaLight",
    descriptionKey: "oryaLight",
    category: "global",
    color: "#f4f5fb",
    image:
      "radial-gradient(circle at 16% 20%, rgba(255, 203, 232, 0.45), transparent 58%), radial-gradient(circle at 82% 16%, rgba(176, 210, 255, 0.45), transparent 58%), radial-gradient(circle at 40% 88%, rgba(255, 225, 196, 0.35), transparent 60%), linear-gradient(160deg, #f8f9fd 0%, #f2f4fb 55%, #eef1f9 100%)",
    overlay:
      "linear-gradient(180deg, rgba(255, 255, 255, 0.75) 0%, rgba(246, 248, 252, 0.92) 60%, rgba(236, 240, 248, 0.98) 100%)",
    overlayOpacity: 1,
  },
  {
    id: "landing-flow",
    labelKey: "landingFlow",
    descriptionKey: "landingFlow",
    category: "landing",
    color: "#010103",
    image:
      "linear-gradient(90deg, rgba(255, 95, 215, 0.38) 0%, rgba(122, 77, 255, 0.48) 35%, rgba(76, 109, 255, 0.42) 70%, rgba(255, 95, 215, 0.38) 100%)",
    overlay:
      "radial-gradient(circle at 20% 50%, rgba(255, 95, 215, 0.22), transparent 60%), radial-gradient(circle at 80% 50%, rgba(76, 109, 255, 0.22), transparent 60%), radial-gradient(circle at 50% 20%, rgba(94, 246, 255, 0.16), transparent 55%), radial-gradient(circle at 50% 50%, rgba(0, 0, 0, 0) 0%, rgba(1, 1, 3, 0.82) 60%, rgba(0, 0, 0, 0.98) 100%)",
    overlayOpacity: 1,
  },
  {
    id: "event-cover-blur",
    labelKey: "eventCoverBlur",
    descriptionKey: "eventCoverBlur",
    category: "event",
    color: "#05060a",
    image: "linear-gradient(160deg, rgba(6, 12, 24, 0.9), rgba(2, 4, 8, 0.95))",
    overlay:
      "linear-gradient(180deg, rgba(7, 9, 14, 0.35) 0%, rgba(4, 6, 10, 0.7) 55%, rgba(2, 3, 6, 0.92) 100%)",
    overlayOpacity: 1,
  },
];

export const SURFACE_CATALOG: CatalogSurface[] = [
  {
    id: "dashboard-card",
    labelKey: "dashboardCard",
    descriptionKey: "dashboardCard",
    className:
      "rounded-2xl border border-white/10 bg-white/5 shadow-[0_16px_60px_rgba(0,0,0,0.35)]",
  },
  {
    id: "light-card",
    labelKey: "lightCard",
    descriptionKey: "lightCard",
    className:
      "rounded-3xl border border-white/70 bg-white/80 shadow-[0_20px_60px_rgba(120,130,160,0.22)] backdrop-blur-xl",
  },
  {
    id: "glass-panel",
    labelKey: "glassPanel",
    descriptionKey: "glassPanel",
    className:
      "rounded-3xl border border-white/12 bg-white/5 p-4 shadow-[0_18px_50px_rgba(0,0,0,0.55)] backdrop-blur-2xl",
  },
  {
    id: "glass-strong",
    labelKey: "glassStrong",
    descriptionKey: "glassStrong",
    className:
      "rounded-3xl border border-white/12 bg-black/45 p-6 shadow-[0_24px_60px_rgba(0,0,0,0.6)] backdrop-blur-2xl",
  },
  {
    id: "gradient-panel",
    labelKey: "gradientPanel",
    descriptionKey: "gradientPanel",
    className:
      "rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1124]/70 to-[#050810]/90 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-2xl",
  },
  {
    id: "admin-card",
    labelKey: "adminCard",
    descriptionKey: "adminCard",
    className: "admin-card",
  },
  {
    id: "admin-card-soft",
    labelKey: "adminCardSoft",
    descriptionKey: "adminCardSoft",
    className: "admin-card-soft",
  },
  {
    id: "admin-section",
    labelKey: "adminSection",
    descriptionKey: "adminSection",
    className: "admin-section",
  },
  {
    id: "mobile-surface",
    labelKey: "mobileSurface",
    descriptionKey: "mobileSurface",
    className: "orya-mobile-surface",
  },
  {
    id: "mobile-surface-soft",
    labelKey: "mobileSurfaceSoft",
    descriptionKey: "mobileSurfaceSoft",
    className: "orya-mobile-surface-soft",
  },
];

export const BUTTON_CATALOG: CatalogButton[] = [
  {
    id: "cta-primary",
    labelKey: "ctaPrimary",
    descriptionKey: "ctaPrimary",
    kind: "primary",
    className:
      "inline-flex items-center gap-2 rounded-full border border-white/25 bg-gradient-to-r from-[#FF7AD1]/35 via-[#7FE0FF]/22 to-[#6A7BFF]/35 px-6 py-2.5 text-sm font-semibold text-white shadow-[0_18px_60px_rgba(107,255,255,0.45)] backdrop-blur-xl transition hover:scale-[1.02] hover:shadow-[0_22px_70px_rgba(107,255,255,0.55)] focus:outline-none focus:ring-2 focus:ring-[#6BFFFF]/60",
  },
  {
    id: "cta-secondary",
    labelKey: "ctaSecondary",
    descriptionKey: "ctaSecondary",
    kind: "secondary",
    className:
      "inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm text-white shadow-[0_12px_38px_rgba(0,0,0,0.35)] backdrop-blur hover:border-white/35 hover:bg-white/10 transition focus:outline-none focus:ring-2 focus:ring-white/30",
  },
  {
    id: "cta-ghost",
    labelKey: "ctaGhost",
    descriptionKey: "ctaGhost",
    kind: "ghost",
    className:
      "inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/0 px-4 py-2 text-sm text-white/80 hover:bg-white/5 transition focus:outline-none focus:ring-2 focus:ring-white/20",
  },
  {
    id: "cta-neutral",
    labelKey: "ctaNeutral",
    descriptionKey: "ctaNeutral",
    kind: "neutral",
    className:
      "inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[12px] text-white/85 shadow-[0_10px_30px_rgba(0,0,0,0.35)] hover:bg-white/10 transition",
  },
  {
    id: "cta-danger",
    labelKey: "ctaDanger",
    descriptionKey: "ctaDanger",
    kind: "danger",
    className:
      "inline-flex items-center gap-2 rounded-full border border-red-400/60 bg-gradient-to-r from-red-600/30 via-red-500/25 to-red-700/35 px-3 py-1.5 text-[12px] font-semibold text-red-50 shadow-[0_12px_38px_rgba(239,68,68,0.35)] hover:brightness-110 transition",
  },
  {
    id: "cta-success",
    labelKey: "ctaSuccess",
    descriptionKey: "ctaSuccess",
    kind: "success",
    className:
      "inline-flex items-center gap-2 rounded-full border border-emerald-300/60 bg-gradient-to-r from-emerald-500/30 via-emerald-400/25 to-emerald-600/35 px-4 py-1.5 text-[12px] font-semibold text-emerald-50 shadow-[0_14px_36px_rgba(16,185,129,0.35)] hover:brightness-110 transition",
  },
  {
    id: "event-primary",
    labelKey: "eventPrimary",
    descriptionKey: "eventPrimary",
    kind: "primary",
    className:
      "inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-semibold text-black shadow-[0_0_30px_rgba(255,255,255,0.3)] transition-transform hover:scale-105 active:scale-95 md:text-sm",
  },
  {
    id: "event-secondary",
    labelKey: "eventSecondary",
    descriptionKey: "eventSecondary",
    kind: "secondary",
    className:
      "inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-4 py-2 text-xs text-white/80 transition hover:border-white/30 hover:bg-white/10 md:text-sm",
  },
];

export const BADGE_CATALOG: CatalogBadge[] = [
  {
    id: "badge-neutral",
    labelKey: "badgeNeutral",
    descriptionKey: "badgeNeutral",
    tone: "neutral",
    className: "rounded-full border border-white/20 bg-white/5 px-3 py-1 text-[11px] text-white/70",
  },
  {
    id: "badge-info",
    labelKey: "badgeInfo",
    descriptionKey: "badgeInfo",
    tone: "info",
    className: "rounded-full border border-sky-400/60 bg-sky-500/15 px-3 py-1 text-[11px] text-sky-100",
  },
  {
    id: "badge-success",
    labelKey: "badgeSuccess",
    descriptionKey: "badgeSuccess",
    tone: "success",
    className: "rounded-full border border-emerald-400/60 bg-emerald-500/15 px-3 py-1 text-[11px] text-emerald-100",
  },
  {
    id: "badge-warning",
    labelKey: "badgeWarning",
    descriptionKey: "badgeWarning",
    tone: "warning",
    className: "rounded-full border border-amber-400/60 bg-amber-500/15 px-3 py-1 text-[11px] text-amber-100",
  },
  {
    id: "badge-danger",
    labelKey: "badgeDanger",
    descriptionKey: "badgeDanger",
    tone: "danger",
    className: "rounded-full border border-red-400/60 bg-red-500/15 px-3 py-1 text-[11px] text-red-100",
  },
  {
    id: "badge-accent",
    labelKey: "badgeAccent",
    descriptionKey: "badgeAccent",
    tone: "accent",
    className: "rounded-full border border-fuchsia-400/60 bg-fuchsia-500/15 px-3 py-1 text-[11px] text-fuchsia-100",
  },
  {
    id: "badge-sun",
    labelKey: "badgeSun",
    descriptionKey: "badgeSun",
    tone: "warning",
    className: "rounded-full border border-orange-400/60 bg-orange-500/15 px-3 py-1 text-[11px] text-orange-100",
  },
  {
    id: "badge-gold",
    labelKey: "badgeGold",
    descriptionKey: "badgeGold",
    tone: "warning",
    className: "rounded-full border border-yellow-400/60 bg-yellow-500/15 px-3 py-1 text-[11px] text-yellow-100",
  },
];
