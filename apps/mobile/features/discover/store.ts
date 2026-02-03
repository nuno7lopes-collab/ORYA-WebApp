import { create } from "zustand";
import { DiscoverDateFilter, DiscoverKind, DiscoverPriceFilter } from "./types";

type DiscoverState = {
  query: string;
  priceFilter: DiscoverPriceFilter;
  kind: DiscoverKind;
  dateFilter: DiscoverDateFilter;
  city: string;
  setQuery: (next: string) => void;
  setPriceFilter: (next: DiscoverPriceFilter) => void;
  setKind: (next: DiscoverKind) => void;
  setDateFilter: (next: DiscoverDateFilter) => void;
  setCity: (next: string) => void;
};

export const useDiscoverStore = create<DiscoverState>((set) => ({
  query: "",
  priceFilter: "all",
  kind: "all",
  dateFilter: "all",
  city: "",
  setQuery: (next) => set({ query: next }),
  setPriceFilter: (next) => set({ priceFilter: next }),
  setKind: (next) => set({ kind: next }),
  setDateFilter: (next) => set({ dateFilter: next }),
  setCity: (next) => set({ city: next }),
}));
