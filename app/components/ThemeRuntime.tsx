"use client";

import { useEffect } from "react";
import { useUser } from "@/app/hooks/useUser";
import {
  applyThemeToRoot,
  getThemeDraftForMode,
  getThemeStorageKey,
  loadThemeDraft,
} from "@/lib/theme/runtime";

export function ThemeRuntime() {
  const { user } = useUser();

  useEffect(() => {
    const storageKey = getThemeStorageKey(user?.id);
    const initial = loadThemeDraft(user?.id) ?? getThemeDraftForMode("dark");
    applyThemeToRoot(initial);

    const handleThemeUpdate = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (!detail) return;
      applyThemeToRoot(detail);
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== storageKey) return;
      const next = loadThemeDraft(user?.id);
      if (next) applyThemeToRoot(next);
    };

    window.addEventListener("orya-theme-updated", handleThemeUpdate as EventListener);
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener("orya-theme-updated", handleThemeUpdate as EventListener);
      window.removeEventListener("storage", handleStorage);
    };
  }, [user?.id]);

  return null;
}
