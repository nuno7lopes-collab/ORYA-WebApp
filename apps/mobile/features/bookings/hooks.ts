import { useQuery } from "@tanstack/react-query";
import {
  fetchAvailableCourts,
  fetchMyBookings,
  fetchMyClassEnrollments,
  fetchReservableClubs,
  fetchReservationHub,
  mapHubToCourtCards,
} from "./api";

export const useMyBookings = (enabled = true) =>
  useQuery({
    queryKey: ["bookings", "me"],
    queryFn: fetchMyBookings,
    enabled,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

export const useMyClassEnrollments = (enabled = true) =>
  useQuery({
    queryKey: ["bookings", "classes", "me"],
    queryFn: fetchMyClassEnrollments,
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

export const useReservableClubs = (
  params: { userId?: string | null; accessToken?: string | null },
  enabled = true,
) =>
  useQuery({
    queryKey: [
      "bookings",
      "clubs",
      params.userId ?? "anon",
      params.accessToken ? "auth" : "no-auth",
    ],
    queryFn: () => fetchReservableClubs(params),
    enabled,
    staleTime: 45_000,
    refetchOnWindowFocus: false,
  });

export const useClubCourts = (orgUsername: string | null | undefined, enabled = true) =>
  useQuery({
    queryKey: ["bookings", "club-courts", orgUsername ?? "none"],
    queryFn: async () => {
      if (!orgUsername) return [];
      const hub = await fetchReservationHub(orgUsername);
      return mapHubToCourtCards(hub, "FOLLOWING");
    },
    enabled: Boolean(orgUsername) && enabled,
    staleTime: 45_000,
    refetchOnWindowFocus: false,
  });
