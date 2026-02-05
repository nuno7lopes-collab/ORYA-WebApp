import { create } from "zustand";
import { persist } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

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
      getAll: () => Object.values(get().items),
    }),
    {
      name: "orya_favorites",
      storage: {
        getItem: (key) => AsyncStorage.getItem(key),
        setItem: (key, value) => AsyncStorage.setItem(key, value),
        removeItem: (key) => AsyncStorage.removeItem(key),
      },
      version: 1,
    },
  ),
);
