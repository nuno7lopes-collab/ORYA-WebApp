import type { PropsWithChildren, ReactNode } from "react";
import { I18nextProvider } from "react-i18next";
import { i18n } from "@orya/shared";
import { useI18n } from "../../lib/i18n";

type I18nProviderProps = PropsWithChildren<{
  fallback?: ReactNode;
}>;

export function I18nProvider({ children, fallback = null }: I18nProviderProps) {
  const { ready } = useI18n();
  if (!ready) return <>{fallback}</>;
  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
