import { api, unwrapApiResponse } from "../../lib/api";
import type { BookingCancelPreview, BookingChangeResponse, BookingItem } from "./types";

type BookingListPayload = {
  items?: BookingItem[];
};

export const fetchMyBookings = async (): Promise<BookingItem[]> => {
  const response = await api.request<unknown>("/api/me/reservas");
  const payload = unwrapApiResponse<BookingListPayload>(response);
  return Array.isArray(payload?.items) ? payload.items : [];
};

export const previewBookingCancellation = async (
  bookingId: number,
): Promise<BookingCancelPreview> => {
  const response = await api.request<unknown>(`/api/me/reservas/${bookingId}/cancel/preview`, {
    method: "POST",
  });
  return unwrapApiResponse<BookingCancelPreview>(response);
};

export const cancelBooking = async (bookingId: number, reason?: string | null) => {
  const body = reason?.trim()
    ? JSON.stringify({
        reason: reason.trim(),
      })
    : undefined;
  const response = await api.request<unknown>(`/api/me/reservas/${bookingId}/cancel`, {
    method: "POST",
    ...(body ? { body } : {}),
  });
  return unwrapApiResponse(response);
};

export const respondBookingChangeRequest = async (params: {
  bookingId: number;
  requestId: number;
  action: "ACCEPT" | "DECLINE";
}): Promise<BookingChangeResponse> => {
  const response = await api.request<unknown>(`/api/me/reservas/${params.bookingId}/reschedule/respond`, {
    method: "POST",
    body: JSON.stringify({
      requestId: params.requestId,
      action: params.action,
    }),
  });
  return unwrapApiResponse<BookingChangeResponse>(response);
};
