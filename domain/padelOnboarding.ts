import { Gender, PadelPreferredSide } from "@prisma/client";

export type PadelOnboardingMissing = {
  fullName?: true;
  username?: true;
  email?: true;
  phone?: true;
  gender?: true;
  level?: true;
  preferredSide?: true;
};

type PadelOnboardingProfile = {
  fullName?: string | null;
  username?: string | null;
  contactPhone?: string | null;
  gender?: Gender | null;
  padelLevel?: string | null;
  padelPreferredSide?: PadelPreferredSide | null;
};

export function getPadelOnboardingMissing(params: {
  profile: PadelOnboardingProfile | null;
  email?: string | null;
}): PadelOnboardingMissing {
  const { profile, email } = params;
  const missing: PadelOnboardingMissing = {};

  const fullName = profile?.fullName?.trim() ?? "";
  const username = profile?.username?.trim() ?? "";
  const phone = profile?.contactPhone?.trim() ?? "";
  const level = profile?.padelLevel?.trim() ?? "";

  if (!fullName) missing.fullName = true;
  if (!username) missing.username = true;
  if (!email?.trim()) missing.email = true;
  if (!phone) missing.phone = true;
  if (!profile?.gender) missing.gender = true;
  if (!level) missing.level = true;
  if (!profile?.padelPreferredSide) missing.preferredSide = true;

  return missing;
}

export function isPadelOnboardingComplete(missing: PadelOnboardingMissing) {
  return Object.keys(missing).length === 0;
}
