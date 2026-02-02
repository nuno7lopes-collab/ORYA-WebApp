import { create } from "zustand";

type PriceFilter = "all" | "free" | "paid";

type DiscoverState = {
  query: string;
  priceFilter: PriceFilter;
  setQuery: (next: string) => void;
  setPriceFilter: (next: PriceFilter) => void;
};

export const useDiscoverStore = create<DiscoverState>((set) => ({
  query: "",
  priceFilter: "all",
  setQuery: (next) => set({ query: next }),
  setPriceFilter: (next) => set({ priceFilter: next }),
}));
