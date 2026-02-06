import { useQuery } from "@tanstack/react-query";
import { useFavoritesStore } from "./store";
import { fetchFavorites } from "./api";

export const useFavoritesSync = (enabled: boolean) => {
  const setAll = useFavoritesStore((state) => state.setAll);
  return useQuery({
    queryKey: ["favorites"],
    queryFn: fetchFavorites,
    enabled,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 15,
    retry: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    onSuccess: (items) => {
      setAll(items);
    },
  });
};
