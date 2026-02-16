import { useQuery } from "@tanstack/react-query";
import { fetchMyBookings } from "./api";

export const useMyBookings = (enabled = true) =>
  useQuery({
    queryKey: ["bookings", "me"],
    queryFn: fetchMyBookings,
    enabled,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
