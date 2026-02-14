"use client";

import { useEffect } from "react";

export function OrganizationLangSetter({ language }: { language?: string | null }) {
  useEffect(() => {
    if (!language || typeof document === "undefined") return;
    const lang = language.toLowerCase() === "en" ? "en" : "pt";
    const previous = document.documentElement.lang;
    document.documentElement.lang = lang;
    return () => {
      if (previous) document.documentElement.lang = previous;
    };
  }, [language]);

  return null;
}
