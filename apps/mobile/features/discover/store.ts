import { create } from "zustand";
import { DiscoverDateFilter, DiscoverKind, DiscoverPriceFilter, DiscoverWorld } from "./types";

type DiscoverState = {
  query: string;
  priceFilter: DiscoverPriceFilter;
  kind: DiscoverKind;
  worlds: DiscoverWorld[];
  dateFilter: DiscoverDateFilter;
  city: string;
  locationLabel: string;
  locationAddressId: string | null;
  locationLat: number | null;
  locationLng: number | null;
  locationSource: "APPLE_MAPS" | "IP" | "NONE";
  distanceKm: number;
  setQuery: (next: string) => void;
  setPriceFilter: (next: DiscoverPriceFilter) => void;
  setKind: (next: DiscoverKind) => void;
  setWorlds: (next: DiscoverWorld[]) => void;
  setDateFilter: (next: DiscoverDateFilter) => void;
  setLocation: (payload: {
    city?: string;
    label?: string;
    addressId?: string | null;
    lat?: number | null;
    lng?: number | null;
    source?: "APPLE_MAPS" | "IP" | "NONE";
  }) => void;
  clearLocation: () => void;
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
  locationLabel: "",
  locationAddressId: null,
  locationLat: null,
  locationLng: null,
  locationSource: "NONE",
  distanceKm: 5,
  setQuery: (next) => set({ query: next }),
  setPriceFilter: (next) => set({ priceFilter: next }),
  setKind: (next) => set({ kind: next }),
  setWorlds: (next) => set({ worlds: next }),
  setDateFilter: (next) => set({ dateFilter: next }),
  setLocation: (payload) =>
    set((state) => ({
      city: payload.city ?? state.city,
      locationLabel: payload.label ?? state.locationLabel,
      locationAddressId:
        payload.addressId !== undefined ? payload.addressId : state.locationAddressId,
      locationLat: payload.lat !== undefined ? payload.lat : state.locationLat,
      locationLng: payload.lng !== undefined ? payload.lng : state.locationLng,
      locationSource: payload.source ?? state.locationSource,
    })),
  clearLocation: () =>
    set({
      city: "",
      locationLabel: "",
      locationAddressId: null,
      locationLat: null,
      locationLng: null,
      locationSource: "NONE",
    }),
  setDistanceKm: (next) => set({ distanceKm: next }),
  resetFilters: () =>
    set({
      query: "",
      priceFilter: "all",
      kind: "all",
      worlds: [],
      dateFilter: "all",
      city: "",
      locationLabel: "",
      locationAddressId: null,
      locationLat: null,
      locationLng: null,
      locationSource: "NONE",
      distanceKm: 5,
    }),
}));
