import type { ProfileSummary } from "../features/profile/types";
import type { CachedProfile } from "./profileCache";
import type { Session } from "@supabase/supabase-js";

type ProfileQueryState = {
  data?: ProfileSummary;
  isLoading: boolean;
  isFetching?: boolean;
  isError: boolean;
  error?: unknown;
};

export type OnboardingGateStatus =
  | "loading"
  | "sign-in"
  | "onboarding"
  | "ready"
  | "offline";

export const isAuthError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return message.includes("API 401") || message.includes("UNAUTHENTICATED");
};

const isConnectivityError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const lower = message.toLowerCase();
  return (
    lower.includes("network request failed") ||
    lower.includes("failed to fetch") ||
    lower.includes("networkerror") ||
    lower.includes("api timeout") ||
    lower.includes("api offline") ||
    lower.includes("aborterror") ||
    lower.includes("aborted")
  );
};

export const resolveOnboardingGate = ({
  session,
  localOnboardingDone,
  profileQuery,
  hasDraft,
  cachedProfile,
}: {
  session: Session | null;
  localOnboardingDone: boolean | null;
  profileQuery: ProfileQueryState;
  hasDraft: boolean | null;
  cachedProfile?: CachedProfile | null;
}): OnboardingGateStatus => {
  if (!session) return "sign-in";
  if (localOnboardingDone === null) return "loading";

  if (localOnboardingDone === true && hasDraft !== true) {
    return "ready";
  }

  if (hasDraft === null) return "loading";

  const hasRemoteData = Boolean(profileQuery.data);
  const hasCached = Boolean(cachedProfile);
  const isLoading =
    profileQuery.isLoading || (profileQuery.isFetching && !hasRemoteData);
  if (isLoading && !hasCached) return "loading";

  if (profileQuery.isError && !hasRemoteData && !hasCached) {
    if (isAuthError(profileQuery.error)) return "sign-in";
    if (isConnectivityError(profileQuery.error)) {
      return localOnboardingDone ? "ready" : "offline";
    }
    return localOnboardingDone ? "ready" : "onboarding";
  }

  const cachedHasBasics = Boolean(
    cachedProfile?.fullName && cachedProfile?.username,
  );
  const cachedDone =
    typeof cachedProfile?.onboardingDone === "boolean"
      ? cachedProfile.onboardingDone
      : cachedHasBasics;
  const effectiveProfile = profileQuery.data ?? cachedProfile ?? null;

  const hasProfileBasics = Boolean(
    effectiveProfile?.fullName && effectiveProfile?.username,
  );
  const remoteDone = Boolean(
    effectiveProfile?.onboardingDone ?? hasProfileBasics,
  );
  const onboardingDone = Boolean(localOnboardingDone || remoteDone);

  if (!localOnboardingDone && hasDraft) {
    return "onboarding";
  }

  return onboardingDone ? "ready" : "onboarding";
};
