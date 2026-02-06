import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { safeAsyncStorage } from "../../lib/storage";

type FavoriteEntry = {
  eventId: number;
  notify: boolean;
  updatedAt: string;
};

type FavoritesState = {
  items: Record<number, FavoriteEntry>;
  isFavorite: (eventId: number) => boolean;
  toggleFavorite: (eventId: number, notify?: boolean) => boolean;
  setFavorite: (eventId: number, next: boolean, notify?: boolean) => void;
  setAll: (items: FavoriteEntry[]) => void;
  getAll: () => FavoriteEntry[];
};

const buildEntry = (eventId: number, notify = true): FavoriteEntry => ({
  eventId,
  notify,
  updatedAt: new Date().toISOString(),
});

export const useFavoritesStore = create<FavoritesState>()(
  persist(
    (set, get) => ({
      items: {},
      isFavorite: (eventId) => Boolean(get().items[eventId]),
      toggleFavorite: (eventId, notify = true) => {
        const items = { ...get().items };
        if (items[eventId]) {
          delete items[eventId];
          set({ items });
          return false;
        }
        items[eventId] = buildEntry(eventId, notify);
        set({ items });
        return true;
      },
      setFavorite: (eventId, next, notify = true) => {
        const items = { ...get().items };
        if (!next) {
          delete items[eventId];
          set({ items });
          return;
        }
        items[eventId] = buildEntry(eventId, notify);
        set({ items });
      },
      setAll: (entries) => {
        const next: Record<number, FavoriteEntry> = {};
        entries.forEach((entry) => {
          if (typeof entry?.eventId === "number") {
            next[entry.eventId] = entry;
          }
        });
        set({ items: next });
      },
      getAll: () => Object.values(get().items),
    }),
    {
      name: "orya_favorites",
      storage: createJSONStorage(() => safeAsyncStorage),
      version: 1,
    },
  ),
);
