import {
  CTA_DANGER as CTA_DANGER_LEGACY,
  CTA_DANGER_CLEAN,
  CTA_GHOST as CTA_GHOST_LEGACY,
  CTA_NEUTRAL as CTA_NEUTRAL_LEGACY,
  CTA_PRIMARY as CTA_PRIMARY_LEGACY,
  CTA_PRIMARY_CLEAN,
  CTA_SECONDARY as CTA_SECONDARY_LEGACY,
  CTA_SECONDARY_CLEAN,
  CTA_SUCCESS as CTA_SUCCESS_LEGACY,
  DASHBOARD_CARD,
  DASHBOARD_HEADING,
  DASHBOARD_LABEL,
  DASHBOARD_MUTED,
  DASHBOARD_SHELL_PADDING,
  DASHBOARD_SKELETON,
  DASHBOARD_SUBHEADING,
  DASHBOARD_TITLE,
} from "@/app/org/_shared/dashboardUi";

// No contexto do dashboard interno, as CTAs base passam a clean-v1 por defeito
// para rollout transversal sem refactor manual em todas as páginas.
export const CTA_PRIMARY = CTA_PRIMARY_CLEAN;
export const CTA_SECONDARY = CTA_SECONDARY_CLEAN;
export const CTA_GHOST = CTA_SECONDARY_CLEAN;
export const CTA_DANGER = CTA_DANGER_CLEAN;
export const CTA_NEUTRAL =
  "inline-flex items-center gap-2 rounded-full border border-white/24 bg-white/[0.05] px-3 py-1.5 text-[12px] font-medium text-white/92 transition-colors hover:bg-white/[0.1] focus:outline-none focus:ring-2 focus:ring-white/30";
export const CTA_SUCCESS =
  "inline-flex items-center gap-2 rounded-full border border-emerald-300/60 bg-emerald-500/14 px-4 py-2 text-sm font-semibold text-emerald-100 transition-colors hover:bg-emerald-500/20 focus:outline-none focus:ring-2 focus:ring-emerald-300/55";

export {
  CTA_DANGER_CLEAN,
  CTA_PRIMARY_CLEAN,
  CTA_SECONDARY_CLEAN,
  CTA_DANGER_LEGACY,
  CTA_GHOST_LEGACY,
  CTA_NEUTRAL_LEGACY,
  CTA_PRIMARY_LEGACY,
  CTA_SECONDARY_LEGACY,
  CTA_SUCCESS_LEGACY,
  DASHBOARD_CARD,
  DASHBOARD_HEADING,
  DASHBOARD_LABEL,
  DASHBOARD_MUTED,
  DASHBOARD_SHELL_PADDING,
  DASHBOARD_SKELETON,
  DASHBOARD_SUBHEADING,
  DASHBOARD_TITLE,
};
