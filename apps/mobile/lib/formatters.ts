import { i18n, type Locale } from "@orya/shared";

const resolveLocale = (): Locale => (i18n.language as Locale) || "pt-PT";

export const formatDate = (value: Date | string, options?: Intl.DateTimeFormatOptions): string => {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat(resolveLocale(), options).format(date);
};

export const formatTime = (value: Date | string, options?: Intl.DateTimeFormatOptions): string => {
  return formatDate(value, { hour: "2-digit", minute: "2-digit", ...options });
};

export const formatDateTime = (
  value: Date | string,
  options?: Intl.DateTimeFormatOptions,
): string => {
  return formatDate(value, { dateStyle: "medium", timeStyle: "short", ...options });
};

export const formatCurrency = (
  amount: number,
  currency: string,
  options?: Intl.NumberFormatOptions,
): string => {
  const formatter = new Intl.NumberFormat(resolveLocale(), {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
    ...options,
  });
  return formatter.format(amount);
};

export const formatRelativeDay = (value?: string): string | null => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const now = new Date();
  const startDay = new Date(date);
  startDay.setHours(0, 0, 0, 0);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((startDay.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
  if (diffDays === 0) return i18n.t("common.time.today");
  if (diffDays === 1) return i18n.t("common.time.tomorrow");
  if (diffDays > 1 && diffDays <= 6) return i18n.t("common.time.inDays", { count: diffDays });
  if (diffDays < 0) return i18n.t("common.time.ended");
  return null;
};

export const formatRelativeHours = (value?: string | null): string | null => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  if (diffMs <= 0) return i18n.t("common.time.available");
  const diffHours = Math.floor(diffMs / (60 * 60 * 1000));
  if (diffHours < 1) return i18n.t("common.time.today");
  if (diffHours < 24) return i18n.t("common.time.inHours", { count: diffHours });
  return formatRelativeDay(value);
};

export const formatDistanceKmValue = (distance: number): string => {
  const locale = resolveLocale();
  if (distance < 1) return i18n.t("common.units.kmShort");
  if (distance < 10) {
    const value = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(distance);
    return i18n.t("common.units.km", { value });
  }
  const value = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(Math.round(distance));
  return i18n.t("common.units.km", { value });
};
