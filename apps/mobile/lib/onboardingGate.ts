import type { ProfileSummary } from "../features/profile/types";

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
}: {
  session: any | null;
  localOnboardingDone: boolean | null;
  profileQuery: ProfileQueryState;
  hasDraft: boolean | null;
}): OnboardingGateStatus => {
  if (!session) return "sign-in";
  if (localOnboardingDone === null || hasDraft === null) return "loading";

  const hasRemoteData = Boolean(profileQuery.data);
  const isLoading =
    profileQuery.isLoading || (profileQuery.isFetching && !hasRemoteData);
  if (isLoading) return "loading";

  if (profileQuery.isError && !hasRemoteData) {
    return localOnboardingDone ? "ready" : "offline";
  }

  const hasProfileBasics = Boolean(
    profileQuery.data?.fullName && profileQuery.data?.username,
  );
  const remoteDone = Boolean(
    profileQuery.data?.onboardingDone ?? hasProfileBasics,
  );
  const onboardingDone = Boolean(localOnboardingDone || remoteDone);

  if (!localOnboardingDone && hasDraft) {
    return "onboarding";
  }

  return onboardingDone ? "ready" : "onboarding";
};
