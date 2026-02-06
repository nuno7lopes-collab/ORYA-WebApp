import { QueryClient } from "@tanstack/react-query";

const retryDelay = (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 8000);

const formatError = (err: unknown) => {
  if (err instanceof Error) return err.message;
  return String(err ?? "");
};

const isNetworkishError = (message: string) => {
  const lower = message.toLowerCase();
  return (
    lower.includes("api offline") ||
    lower.includes("api timeout") ||
    lower.includes("network request failed") ||
    lower.includes("failed to fetch") ||
    lower.includes("aborterror") ||
    lower.includes("aborted")
  );
};

const shouldRetry = (failureCount: number, error: unknown) => {
  const message = formatError(error);
  if (isNetworkishError(message)) return false;
  return failureCount < 2;
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: shouldRetry,
      retryDelay,
      staleTime: 30 * 1000,
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
  },
});
