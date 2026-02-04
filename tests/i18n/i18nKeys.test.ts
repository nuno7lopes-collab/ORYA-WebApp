import { describe, expect, it } from "vitest";
import { I18N_DICT } from "@/lib/i18n";

describe("i18n dictionary", () => {
  const locales = Object.keys(I18N_DICT) as Array<keyof typeof I18N_DICT>;
  const baseLocale = "pt-PT" as const;
  const baseKeys = new Set(Object.keys(I18N_DICT[baseLocale]));

  it("keeps locales aligned", () => {
    locales.forEach((locale) => {
      const keys = Object.keys(I18N_DICT[locale]);
      const missing = Array.from(baseKeys).filter((key) => !(key in I18N_DICT[locale]));
      const extra = keys.filter((key) => !baseKeys.has(key));
      expect(missing).toEqual([]);
      expect(extra).toEqual([]);
    });
  });

  it("avoids empty translations", () => {
    locales.forEach((locale) => {
      Object.entries(I18N_DICT[locale]).forEach(([key, value]) => {
        const trimmed = value.trim();
        expect(trimmed.length, `${locale}:${key}`).toBeGreaterThan(0);
      });
    });
  });
});
