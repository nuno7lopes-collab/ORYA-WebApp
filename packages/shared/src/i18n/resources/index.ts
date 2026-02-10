import ptPT from "./pt-PT.json";
import enUS from "./en-US.json";
import esES from "./es-ES.json";

export const resources = {
  "pt-PT": ptPT,
  "en-US": enUS,
  "es-ES": esES,
} as const;

export type Locale = keyof typeof resources;

export const SUPPORTED_LOCALES = Object.keys(resources) as Locale[];

export const DEFAULT_LOCALE: Locale = "pt-PT";

export const NAMESPACES = [
  "common",
  "auth",
  "discover",
  "agora",
  "messages",
  "settings",
  "onboarding",
  "events",
  "services",
  "errors",
] as const;

export type Namespace = (typeof NAMESPACES)[number];
