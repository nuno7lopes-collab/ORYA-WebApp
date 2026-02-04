import { api, unwrapApiResponse } from "../../lib/api";
import { AgendaItem, ProfileAgendaStats, ProfileSummary } from "./types";

type MePayload = {
  user?: {
    id?: string;
    email?: string | null;
  } | null;
  profile?: {
    id?: string;
    full_name?: string | null;
    username?: string | null;
    avatar_url?: string | null;
    bio?: string | null;
    city?: string | null;
    padel_level?: string | null;
    onboardingDone?: boolean | null;
    onboarding_done?: boolean | null;
  } | null;
};

type AgendaPayload = {
  items?: AgendaItem[];
};

const toDate = (value?: string | null): Date | null => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const toAgendaStats = (items: AgendaItem[]): ProfileAgendaStats => {
  const now = Date.now();
  const currentYear = new Date(now).getFullYear();
  const currentMonth = new Date(now).getMonth();
  let upcoming = 0;
  let past = 0;
  let thisMonth = 0;

  items.forEach((item) => {
    const start = toDate(item.startAt);
    if (!start) return;
    if (start.getTime() >= now) upcoming += 1;
    else past += 1;

    if (start.getFullYear() === currentYear && start.getMonth() === currentMonth) {
      thisMonth += 1;
    }
  });

  return { upcoming, past, thisMonth };
};

export const fetchProfileSummary = async (
  accessToken?: string | null,
): Promise<ProfileSummary> => {
  const response = await api.requestWithAccessToken<unknown>("/api/me", accessToken);
  const payload = unwrapApiResponse<MePayload>(response);
  const profile = payload.profile ?? null;
  const user = payload.user ?? null;
  const hasBasicProfile = Boolean(profile?.full_name && profile?.username);
  const onboardingDone =
    typeof profile?.onboardingDone === "boolean"
      ? profile.onboardingDone
      : typeof profile?.onboarding_done === "boolean"
        ? profile.onboarding_done
        : hasBasicProfile;

  return {
    id: user?.id ?? profile?.id ?? "",
    email: user?.email ?? null,
    fullName: profile?.full_name ?? null,
    username: profile?.username ?? null,
    avatarUrl: profile?.avatar_url ?? null,
    bio: profile?.bio ?? null,
    city: profile?.city ?? null,
    padelLevel: profile?.padel_level ?? null,
    onboardingDone,
  };
};

export const fetchProfileAgenda = async (
  accessToken?: string | null,
): Promise<{
  items: AgendaItem[];
  stats: ProfileAgendaStats;
}> => {
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const response = await api.requestWithAccessToken<unknown>(
    `/api/me/agenda?month=${month}`,
    accessToken,
  );
  const payload = unwrapApiResponse<AgendaPayload>(response);
  const items = Array.isArray(payload?.items) ? payload.items : [];

  return {
    items,
    stats: toAgendaStats(items),
  };
};
