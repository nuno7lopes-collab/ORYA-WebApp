export type PadelOnboardingMissing = {
  fullName?: true;
  username?: true;
  email?: true;
};

type PadelOnboardingProfile = {
  fullName?: string | null;
  username?: string | null;
};

export function getPadelOnboardingMissing(params: {
  profile: PadelOnboardingProfile | null;
  email?: string | null;
}): PadelOnboardingMissing {
  const { profile, email } = params;
  const missing: PadelOnboardingMissing = {};

  const fullName = profile?.fullName?.trim() ?? "";
  const username = profile?.username?.trim() ?? "";
  if (!fullName) missing.fullName = true;
  if (!username) missing.username = true;
  if (!email?.trim()) missing.email = true;

  return missing;
}

export function isPadelOnboardingComplete(missing: PadelOnboardingMissing) {
  return Object.keys(missing).length === 0;
}
