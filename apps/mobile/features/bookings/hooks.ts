import { useQuery } from "@tanstack/react-query";
import { fetchAvailableCourts, fetchMyBookings } from "./api";

export const useMyBookings = (enabled = true) =>
  useQuery({
    queryKey: ["bookings", "me"],
    queryFn: fetchMyBookings,
    enabled,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

export const useAvailableCourts = (
  params: { userId?: string | null; accessToken?: string | null },
  enabled = true,
) =>
  useQuery({
    queryKey: [
      "bookings",
      "courts",
      params.userId ?? "anon",
      params.accessToken ? "auth" : "no-auth",
    ],
    queryFn: () => fetchAvailableCourts(params),
    enabled,
    staleTime: 45_000,
    refetchOnWindowFocus: false,
  });
