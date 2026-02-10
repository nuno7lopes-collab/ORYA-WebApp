import i18next from "i18next";
import ICU from "i18next-icu";
import { initReactI18next } from "react-i18next";
import { DEFAULT_LOCALE, NAMESPACES, SUPPORTED_LOCALES, type Locale, resources } from "./resources";

export const i18n = i18next.createInstance();

export const initI18n = async (locale: Locale) => {
  if (i18n.isInitialized) return i18n;
  await i18n
    .use(ICU)
    .use(initReactI18next)
    .init({
      lng: locale,
      fallbackLng: DEFAULT_LOCALE,
      supportedLngs: SUPPORTED_LOCALES,
      resources,
      defaultNS: "common",
      ns: NAMESPACES,
      interpolation: { escapeValue: false },
      returnNull: false,
    });
  return i18n;
};

export { DEFAULT_LOCALE, SUPPORTED_LOCALES, type Locale, type Namespace } from "./resources";
export { useTranslation } from "react-i18next";
