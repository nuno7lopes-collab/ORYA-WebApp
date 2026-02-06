import { create } from "zustand";
import { DiscoverDateFilter, DiscoverKind, DiscoverPriceFilter, DiscoverWorld } from "./types";

type DiscoverState = {
  query: string;
  priceFilter: DiscoverPriceFilter;
  kind: DiscoverKind;
  worlds: DiscoverWorld[];
  dateFilter: DiscoverDateFilter;
  city: string;
  distanceKm: number;
  setQuery: (next: string) => void;
  setPriceFilter: (next: DiscoverPriceFilter) => void;
  setKind: (next: DiscoverKind) => void;
  setWorlds: (next: DiscoverWorld[]) => void;
  setDateFilter: (next: DiscoverDateFilter) => void;
  setCity: (next: string) => void;
  setDistanceKm: (next: number) => void;
  resetFilters: () => void;
};

export const useDiscoverStore = create<DiscoverState>((set) => ({
  query: "",
  priceFilter: "all",
  kind: "all",
  worlds: [],
  dateFilter: "all",
  city: "",
  distanceKm: 5,
  setQuery: (next) => set({ query: next }),
  setPriceFilter: (next) => set({ priceFilter: next }),
  setKind: (next) => set({ kind: next }),
  setWorlds: (next) => set({ worlds: next }),
  setDateFilter: (next) => set({ dateFilter: next }),
  setCity: (next) => set({ city: next }),
  setDistanceKm: (next) => set({ distanceKm: next }),
  resetFilters: () =>
    set({
      query: "",
      priceFilter: "all",
      kind: "all",
      worlds: [],
      dateFilter: "all",
      city: "",
      distanceKm: 5,
    }),
}));
