import { QueryClient } from "@tanstack/react-query";

const retryDelay = (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 8000);

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      retryDelay,
      staleTime: 30 * 1000,
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
  },
});
