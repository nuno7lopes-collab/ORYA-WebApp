import type { ProfileSummary } from "../features/profile/types";
import type { CachedProfile } from "./profileCache";

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

export const resolveOnboardingGate = ({
  session,
  localOnboardingDone,
  profileQuery,
  hasDraft,
  cachedProfile,
}: {
  session: any | null;
  localOnboardingDone: boolean | null;
  profileQuery: ProfileQueryState;
  hasDraft: boolean | null;
  cachedProfile?: CachedProfile | null;
}): OnboardingGateStatus => {
  if (!session) return "sign-in";
  if (localOnboardingDone === null || hasDraft === null) return "loading";

  if (localOnboardingDone === true && hasDraft !== true) {
    return "ready";
  }

  const hasRemoteData = Boolean(profileQuery.data);
  const hasCached = Boolean(cachedProfile);
  const isLoading =
    profileQuery.isLoading || (profileQuery.isFetching && !hasRemoteData);
  if (isLoading && !hasCached) return "loading";

  if (profileQuery.isError && !hasRemoteData && !hasCached) {
    return localOnboardingDone ? "ready" : "offline";
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
