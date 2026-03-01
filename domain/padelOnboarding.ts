export type PadelOnboardingMissing = {
  fullName?: true;
  username?: true;
  email?: true;
  gender?: true;
  level?: true;
  preferredSide?: true;
};

type PadelOnboardingProfile = {
  fullName?: string | null;
  username?: string | null;
  contactPhone?: string | null;
  gender?: string | null;
  padelLevel?: string | null;
  padelPreferredSide?: string | null;
};

export function getPadelOnboardingMissing(params: {
  profile: PadelOnboardingProfile | null;
  email?: string | null;
}): PadelOnboardingMissing {
  const { profile, email } = params;
  const missing: PadelOnboardingMissing = {};

  const fullName = profile?.fullName?.trim() ?? "";
  const username = profile?.username?.trim() ?? "";
  const gender = profile?.gender?.trim() ?? "";
  const level = profile?.padelLevel?.trim() ?? "";
  const preferredSide = profile?.padelPreferredSide?.trim() ?? "";
  if (!fullName) missing.fullName = true;
  if (!username) missing.username = true;
  if (!email?.trim()) missing.email = true;
  if (!gender) missing.gender = true;
  if (!level) missing.level = true;
  if (!preferredSide) missing.preferredSide = true;

  return missing;
}

export function isPadelOnboardingComplete(missing: PadelOnboardingMissing) {
  return Object.keys(missing).length === 0;
}
