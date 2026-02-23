import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useIsFocused, useNavigation } from "@react-navigation/native";
import { tokens } from "@orya/shared";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LiquidBackground } from "../../components/liquid/LiquidBackground";
import { TopAppHeader } from "../../components/navigation/TopAppHeader";
import { useTopHeaderPadding } from "../../components/navigation/useTopHeaderPadding";
import { useTopBarScroll } from "../../components/navigation/useTopBarScroll";
import { SectionHeader } from "../../components/liquid/SectionHeader";
import { GlassCard } from "../../components/liquid/GlassCard";
import { GlassSkeleton } from "../../components/glass/GlassSkeleton";
import { Ionicons } from "../../components/icons/Ionicons";
import { useDiscoverFeed } from "../../features/discover/hooks";
import type { DiscoverOfferCard, DiscoverServiceCard } from "../../features/discover/types";
import { usePadelSummary } from "../../features/tournaments/hooks";
import { useAuth } from "../../lib/auth";
import { useAgoraFeed } from "../../features/agora/hooks";
import { EventCardSquare } from "../../components/events/EventCardSquare";
import { useIpLocation } from "../../features/onboarding/hooks";
import { safeBack, safePush } from "../../lib/navigation";
import { TAB_PATHNAMES } from "../../lib/tabRoutes";

type ClubCard = {
  key: string;
  name: string;
  username: string | null;
  subtitle: string | null;
};

type PadelSectionKey = "tournaments" | "courts" | "lessons" | "open-games";
type ServiceAssignmentMode = "PROFESSIONAL_ONLY" | "RESOURCE_ONLY" | "PROFESSIONAL_AND_RESOURCE";
type PadelCardVariant = "tournament" | "court" | "lesson" | "club" | "soon";

const SECTION_OPTIONS: Array<{
  key: PadelSectionKey;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}> = [
  { key: "tournaments", label: "Torneios", icon: "trophy-outline" },
  { key: "courts", label: "Reservar campo", icon: "grid-outline" },
  { key: "lessons", label: "Descobrir aulas", icon: "school-outline" },
  { key: "open-games", label: "Jogos abertos", icon: "tennisball-outline" },
];

const LESSON_KEYWORDS = [
  "aula",
  "treino",
  "coach",
  "coaching",
  "lesson",
  "class",
  "clinic",
  "personal",
  "academia",
];
const COURT_KEYWORDS = ["campo", "court", "reserva", "aluguer", "alquiler", "booking"];
const TOURNAMENT_KEYWORDS = ["torneio", "tournament", "liga", "open", "cup", "masters"];
const PADEL_KEYWORDS = ["padel"];

const CARD_ACCENT: Record<
  PadelCardVariant,
  {
    badgeBorder: string;
    badgeFill: string;
    badgeText: string;
    gradient: [string, string, string];
  }
> = {
  tournament: {
    badgeBorder: "rgba(120, 232, 255, 0.58)",
    badgeFill: "rgba(56, 189, 248, 0.2)",
    badgeText: "rgba(226, 250, 255, 0.97)",
    gradient: ["rgba(22, 124, 162, 0.22)", "rgba(18, 26, 45, 0.16)", "rgba(12, 20, 36, 0.08)"],
  },
  court: {
    badgeBorder: "rgba(128, 234, 202, 0.56)",
    badgeFill: "rgba(45, 212, 191, 0.2)",
    badgeText: "rgba(220, 252, 245, 0.98)",
    gradient: ["rgba(18, 117, 102, 0.22)", "rgba(20, 28, 44, 0.16)", "rgba(12, 20, 36, 0.08)"],
  },
  lesson: {
    badgeBorder: "rgba(255, 214, 128, 0.56)",
    badgeFill: "rgba(251, 191, 36, 0.2)",
    badgeText: "rgba(254, 252, 232, 0.98)",
    gradient: ["rgba(125, 94, 24, 0.2)", "rgba(22, 28, 40, 0.16)", "rgba(12, 20, 36, 0.08)"],
  },
  club: {
    badgeBorder: "rgba(182, 190, 214, 0.54)",
    badgeFill: "rgba(148, 163, 184, 0.2)",
    badgeText: "rgba(241, 245, 249, 0.96)",
    gradient: ["rgba(64, 82, 113, 0.2)", "rgba(22, 28, 40, 0.14)", "rgba(12, 20, 36, 0.08)"],
  },
  soon: {
    badgeBorder: "rgba(204, 194, 255, 0.58)",
    badgeFill: "rgba(167, 139, 250, 0.2)",
    badgeText: "rgba(243, 232, 255, 0.98)",
    gradient: ["rgba(91, 67, 172, 0.24)", "rgba(22, 28, 40, 0.14)", "rgba(12, 20, 36, 0.08)"],
  },
};

const normalize = (value: string | null | undefined) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
const includesAny = (text: string, keywords: string[]) => keywords.some((token) => text.includes(token));

const isEventOffer = (offer: DiscoverOfferCard): offer is Extract<DiscoverOfferCard, { type: "event" }> =>
  offer.type === "event";
const isServiceOffer = (offer: DiscoverOfferCard): offer is Extract<DiscoverOfferCard, { type: "service" }> =>
  offer.type === "service";

const buildEventText = (event: Extract<DiscoverOfferCard, { type: "event" }>["event"]) =>
  [
    normalize(event.title),
    normalize(event.description),
    normalize(event.shortDescription),
    normalize(event.templateType),
    ...(event.categories ?? []).map((category) => normalize(category)),
    ...(event.interestTags ?? []).map((tag) => normalize(tag)),
  ].join(" ");

const isPadelEvent = (event: Extract<DiscoverOfferCard, { type: "event" }>["event"]) => {
  const text = buildEventText(event);
  const hasPadelSignal =
    normalize(event.templateType) === "padel" ||
    Boolean(event.padel) ||
    (event.categories ?? []).some((category) => normalize(category) === "padel") ||
    includesAny(text, PADEL_KEYWORDS);
  if (!hasPadelSignal) return false;
  return true;
};

const isTournamentEvent = (event: Extract<DiscoverOfferCard, { type: "event" }>["event"]) => {
  const text = buildEventText(event);
  return (
    Boolean(event.tournament) ||
    Boolean(event.padel?.snapshot) ||
    includesAny(text, TOURNAMENT_KEYWORDS)
  );
};

const isPadelTournamentEvent = (event: Extract<DiscoverOfferCard, { type: "event" }>["event"]) => {
  if (!isPadelEvent(event)) return false;
  return isTournamentEvent(event);
};

const getServiceAssignmentMode = (service: DiscoverServiceCard): ServiceAssignmentMode | null => {
  const rawMode = normalize((service as DiscoverServiceCard & { assignmentMode?: string | null }).assignmentMode);
  if (rawMode === "professional_only") return "PROFESSIONAL_ONLY";
  if (rawMode === "resource_only") return "RESOURCE_ONLY";
  if (rawMode === "professional_and_resource") return "PROFESSIONAL_AND_RESOURCE";
  return null;
};

const buildServiceText = (service: DiscoverServiceCard) =>
  `${normalize(service.title)} ${normalize(service.description)} ${normalize(service.categoryTag)}`;

const resolveServiceSignals = (service: DiscoverServiceCard) => {
  const text = buildServiceText(service);
  const kind = normalize(service.kind);
  const assignmentMode = getServiceAssignmentMode(service);
  const hasLessonKeywords = includesAny(text, LESSON_KEYWORDS);
  const hasCourtKeywords = includesAny(text, COURT_KEYWORDS);
  const isClassKind = kind === "class";
  const isCourtKind = kind === "court";
  const usesProfessional =
    assignmentMode === "PROFESSIONAL_ONLY" || assignmentMode === "PROFESSIONAL_AND_RESOURCE";
  const usesResource = assignmentMode === "RESOURCE_ONLY" || assignmentMode === "PROFESSIONAL_AND_RESOURCE";

  return {
    text,
    isClassKind,
    isCourtKind,
    hasLessonKeywords,
    hasCourtKeywords,
    usesProfessional,
    usesResource,
  };
};

const isLessonLikeService = (service: DiscoverServiceCard) => {
  const signals = resolveServiceSignals(service);
  return signals.isClassKind || signals.hasLessonKeywords || signals.usesProfessional;
};

const isCourtLikeService = (service: DiscoverServiceCard) => {
  const signals = resolveServiceSignals(service);
  const hasCourtSignal = signals.isCourtKind || signals.hasCourtKeywords || signals.usesResource;
  if (!hasCourtSignal) return false;
  if (signals.isClassKind || signals.usesProfessional || signals.hasLessonKeywords) return false;
  return true;
};

const formatPriceLabel = (cents?: number | null, currency = "EUR") => {
  if (typeof cents !== "number" || !Number.isFinite(cents)) return "Preço sob consulta";
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency }).format(cents / 100);
};

function PadelCard({
  title,
  badge,
  subtitle,
  meta,
  disabled,
  variant,
  onPress,
}: {
  title: string;
  badge: string;
  subtitle?: string | null;
  meta?: string | null;
  disabled?: boolean;
  variant?: PadelCardVariant;
  onPress?: () => void;
}) {
  const accent = CARD_ACCENT[variant ?? "club"];
  const trailingIcon: keyof typeof Ionicons.glyphMap = disabled
    ? variant === "soon"
      ? "time-outline"
      : "lock-closed-outline"
    : "chevron-forward";

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className="mb-3 overflow-hidden rounded-3xl px-4 py-4"
      style={({ pressed }) => [
        styles.cardRoot,
        pressed && !disabled ? styles.cardPressed : null,
        disabled ? styles.cardDisabled : null,
      ]}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={disabled ? { disabled: true } : undefined}
    >
      <LinearGradient
        pointerEvents="none"
        colors={accent.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.cardGradient}
      />
      <View className="flex-row items-start justify-between gap-3">
        <View
          className="rounded-full px-2.5 py-1"
          style={{ borderWidth: 1, borderColor: accent.badgeBorder, backgroundColor: accent.badgeFill }}
        >
          <Text className="text-[11px] font-semibold uppercase tracking-[0.06em]" style={{ color: accent.badgeText }}>
            {badge}
          </Text>
        </View>
        <Ionicons
          name={trailingIcon}
          size={16}
          color={disabled ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.55)"}
        />
      </View>
      <Text className="mt-2 text-white text-base font-semibold" numberOfLines={2}>
        {title}
      </Text>
      {subtitle ? (
        <Text className="mt-1 text-white/75 text-xs" numberOfLines={2}>
          {subtitle}
        </Text>
      ) : null}
      {meta ? (
        <Text className="mt-2 text-white/60 text-xs" numberOfLines={1}>
          {meta}
        </Text>
      ) : null}
    </Pressable>
  );
}

const dedupeEvents = (events: Array<Extract<DiscoverOfferCard, { type: "event" }>["event"]>) => {
  const map = new Map<number, Extract<DiscoverOfferCard, { type: "event" }>["event"]>();
  for (const event of events) {
    if (!map.has(event.id)) {
      map.set(event.id, event);
    }
  }
  return Array.from(map.values());
};

const dedupeServices = (items: DiscoverServiceCard[]) => {
  const map = new Map<number, DiscoverServiceCard>();
  for (const item of items) {
    if (!map.has(item.id)) map.set(item.id, item);
  }
  return Array.from(map.values());
};

export default function PadelTabScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const [dataReady, setDataReady] = useState(false);
  const [activeSection, setActiveSection] = useState<PadelSectionKey>("tournaments");
  const topPadding = useTopHeaderPadding(12);
  const contentBottomPadding = Math.max(insets.bottom, 12) + 22;
  const topBar = useTopBarScroll({ hideOnScroll: false });
  const { data: ipLocation } = useIpLocation(dataReady);
  const userLat = ipLocation?.approxLatLon?.lat ?? null;
  const userLon = ipLocation?.approxLatLon?.lon ?? null;

  useEffect(() => {
    setDataReady(isFocused);
  }, [isFocused]);

  const padelFeed = useDiscoverFeed(
    {
      q: "",
      type: "all",
      kind: "padel",
      date: "upcoming",
      city: "",
    },
    dataReady,
  );

  const lessonsFeed = useDiscoverFeed(
    {
      q: "padel treino aula",
      type: "all",
      kind: "services",
      date: "upcoming",
      city: "",
    },
    dataReady,
  );
  const tournamentsFeed = useDiscoverFeed(
    {
      q: "padel torneio open liga",
      type: "all",
      kind: "events",
      date: "upcoming",
      city: "",
    },
    dataReady,
  );

  const agoraFeed = useAgoraFeed(dataReady);

  const padelSummary = usePadelSummary(Boolean(session?.user?.id) && dataReady);
  const needsPadelProfile = Boolean(
    session?.user?.id &&
      padelSummary.data &&
      padelSummary.data.onboarding &&
      !padelSummary.data.onboarding.completed,
  );

  const missingProfileFields = useMemo(() => {
    const missing = padelSummary.data?.onboarding?.missing ?? {};
    const labels: string[] = [];
    if (missing.gender) labels.push("género competitivo");
    if (missing.preferredSide) labels.push("lado preferido");
    if (missing.level) labels.push("nível");
    if (missing.padelClub) labels.push("clube");
    return labels;
  }, [padelSummary.data?.onboarding?.missing]);

  const padelOffers = useMemo(
    () => padelFeed.data?.pages.flatMap((page) => page.items) ?? [],
    [padelFeed.data?.pages],
  );
  const lessonsOffers = useMemo(
    () => lessonsFeed.data?.pages.flatMap((page) => page.items) ?? [],
    [lessonsFeed.data?.pages],
  );
  const tournamentsOffers = useMemo(
    () => tournamentsFeed.data?.pages.flatMap((page) => page.items) ?? [],
    [tournamentsFeed.data?.pages],
  );

  const padelEventsFromDiscover = useMemo(
    () =>
      padelOffers
        .filter(isEventOffer)
        .map((offer) => offer.event)
        .filter((event) => isPadelTournamentEvent(event)),
    [padelOffers],
  );
  const padelEventsFromTournamentFeed = useMemo(
    () =>
      tournamentsOffers
        .filter(isEventOffer)
        .map((offer) => offer.event)
        .filter((event) => isPadelTournamentEvent(event)),
    [tournamentsOffers],
  );

  const padelEventsFromAgora = useMemo(
    () => agoraFeed.items.filter((event) => isPadelTournamentEvent(event)),
    [agoraFeed.items],
  );

  const tournamentEvents = useMemo(
    () =>
      dedupeEvents([...padelEventsFromDiscover, ...padelEventsFromTournamentFeed, ...padelEventsFromAgora]).sort(
        (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
      ),
    [padelEventsFromAgora, padelEventsFromDiscover, padelEventsFromTournamentFeed],
  );

  const rawServicesFromPadelFeed = useMemo(
    () => padelOffers.filter(isServiceOffer).map((offer) => offer.service),
    [padelOffers],
  );
  const rawServicesFromLessonsFeed = useMemo(
    () => lessonsOffers.filter(isServiceOffer).map((offer) => offer.service),
    [lessonsOffers],
  );

  const courtServices = useMemo(
    () => dedupeServices(rawServicesFromPadelFeed.filter((service) => isCourtLikeService(service))),
    [rawServicesFromPadelFeed],
  );

  const lessonServices = useMemo(
    () =>
      dedupeServices(
        [...rawServicesFromLessonsFeed, ...rawServicesFromPadelFeed]
          .filter((service) => isLessonLikeService(service))
          .filter((service) => Boolean(service.organization?.id)),
      ),
    [rawServicesFromLessonsFeed, rawServicesFromPadelFeed],
  );

  const clubs = useMemo<ClubCard[]>(() => {
    const map = new Map<string, ClubCard>();

    for (const court of courtServices) {
      const org = court.organization;
      const key = `org-${org.id}`;
      if (map.has(key)) continue;
      map.set(key, {
        key,
        name: org.publicName ?? org.businessName ?? org.username ?? "Clube de Padel",
        username: org.username ?? null,
        subtitle: org.addressRef?.formattedAddress ?? court.addressRef?.formattedAddress ?? null,
      });
    }

    for (const lesson of lessonServices) {
      const org = lesson.organization;
      const key = `org-${org.id}`;
      if (map.has(key)) continue;
      map.set(key, {
        key,
        name: org.publicName ?? org.businessName ?? org.username ?? "Clube de Padel",
        username: org.username ?? null,
        subtitle: org.addressRef?.formattedAddress ?? lesson.addressRef?.formattedAddress ?? null,
      });
    }

    for (const event of tournamentEvents) {
      const username = event.hostUsername ?? null;
      const name = event.hostName ?? event.hostUsername ?? null;
      if (!name) continue;
      const key = username ? `host-${username}` : `host-name-${name}`;
      if (map.has(key)) continue;
      map.set(key, {
        key,
        name,
        username,
        subtitle: event.location?.formattedAddress ?? null,
      });
    }

    return Array.from(map.values()).slice(0, 8);
  }, [courtServices, lessonServices, tournamentEvents]);

  const guardedAction = useCallback(
    (action: () => void) => {
      if (!session?.user?.id) {
        safePush(router, { pathname: "/auth", params: { next: TAB_PATHNAMES.padel } });
        return;
      }
      if (needsPadelProfile) {
        const missingLabel = missingProfileFields.length > 0 ? missingProfileFields.join(", ") : "dados de perfil";
        Alert.alert(
          "Completa o teu perfil de Padel",
          `Para avançares, completa ${missingLabel}.`,
          [
            { text: "Agora não", style: "cancel" },
            { text: "Completar perfil", onPress: () => safePush(router, TAB_PATHNAMES.profile) },
          ],
        );
        return;
      }
      action();
    },
    [missingProfileFields, needsPadelProfile, router, session?.user?.id],
  );

  const sectionMeta = useMemo(() => {
    switch (activeSection) {
      case "tournaments":
        return {
          title: "Torneios",
          subtitle: "Compete e sobe de nível",
          emptyLabel: "Sem torneios de padel disponíveis por agora.",
        };
      case "courts":
        return {
          title: "Reservar campos",
          subtitle: "Marca já o teu próximo jogo",
          emptyLabel: "Ainda não há campos visíveis nesta zona.",
        };
      case "lessons":
        return {
          title: "Descobrir aulas",
          subtitle: "Aulas sempre ligadas ao clube da organização",
          emptyLabel: "Sem aulas de padel disponíveis neste momento.",
        };
      case "open-games":
        return {
          title: "Jogos abertos",
          subtitle: "Em breve",
          emptyLabel: "Estamos a finalizar os jogos abertos. Em breve vais poder entrar diretamente.",
        };
      default:
        return {
          title: "Padel",
          subtitle: "",
          emptyLabel: "Sem resultados.",
        };
    }
  }, [activeSection]);

  const tournamentsLoading =
    tournamentEvents.length === 0 &&
    (padelFeed.isLoading || tournamentsFeed.isLoading || agoraFeed.isLoading);
  const courtsLoading = courtServices.length === 0 && padelFeed.isLoading;
  const lessonsLoading = lessonServices.length === 0 && (padelFeed.isLoading || lessonsFeed.isLoading);

  const activeLoading =
    activeSection === "tournaments"
      ? tournamentsLoading
      : activeSection === "courts"
        ? courtsLoading
        : activeSection === "lessons"
          ? lessonsLoading
          : false;

  const tournamentsHasNextPage = Boolean(padelFeed.hasNextPage || tournamentsFeed.hasNextPage);
  const tournamentsFetchingNextPage = Boolean(
    padelFeed.isFetchingNextPage || tournamentsFeed.isFetchingNextPage,
  );
  const lessonsHasNextPage = Boolean(lessonsFeed.hasNextPage || padelFeed.hasNextPage);
  const lessonsFetchingNextPage = Boolean(
    lessonsFeed.isFetchingNextPage || padelFeed.isFetchingNextPage,
  );

  const activeHasNextPage =
    activeSection === "lessons"
      ? lessonsHasNextPage
      : activeSection === "tournaments"
        ? tournamentsHasNextPage
        : activeSection === "courts"
          ? Boolean(padelFeed.hasNextPage)
          : false;

  const activeFetchingNextPage =
    activeSection === "lessons"
      ? lessonsFetchingNextPage
      : activeSection === "tournaments"
        ? tournamentsFetchingNextPage
        : activeSection === "courts"
          ? Boolean(padelFeed.isFetchingNextPage)
          : false;

  const activeCount =
    activeSection === "tournaments"
      ? tournamentEvents.length
      : activeSection === "courts"
        ? courtServices.length
        : activeSection === "lessons"
          ? lessonServices.length
          : 0;

  const showLoadMore = Boolean(
    activeSection !== "open-games" &&
      activeHasNextPage &&
      activeCount > 0,
  );

  const handleClosePadel = useCallback(() => {
    safeBack(router, navigation, TAB_PATHNAMES.agora);
  }, [navigation, router]);

  const fetchMoreActive = () => {
    if (activeSection === "tournaments") {
      if (tournamentsFeed.hasNextPage && !tournamentsFeed.isFetchingNextPage) tournamentsFeed.fetchNextPage();
      if (padelFeed.hasNextPage && !padelFeed.isFetchingNextPage) padelFeed.fetchNextPage();
      return;
    }
    if (activeSection === "lessons") {
      if (lessonsFeed.hasNextPage && !lessonsFeed.isFetchingNextPage) lessonsFeed.fetchNextPage();
      if (padelFeed.hasNextPage && !padelFeed.isFetchingNextPage) padelFeed.fetchNextPage();
      return;
    }
    if (activeSection === "courts" && padelFeed.hasNextPage && !padelFeed.isFetchingNextPage) {
      padelFeed.fetchNextPage();
    }
  };

  const renderActiveContent = () => {
    if (activeLoading) {
      return (
        <View className="mb-3 gap-3">
          <GlassSkeleton height={120} />
          <GlassSkeleton height={120} />
          <GlassSkeleton height={120} />
        </View>
      );
    }

    if (activeSection === "tournaments") {
      if (tournamentEvents.length === 0) {
        return (
          <GlassCard intensity={48} className="mb-3">
            <Text className="text-white/70 text-sm">{sectionMeta.emptyLabel}</Text>
            <Pressable
              onPress={() => safePush(router, TAB_PATHNAMES.agora)}
              className="mt-3 self-start rounded-full border border-white/20 bg-white/10 px-3 py-2"
              style={{ minHeight: tokens.layout.touchTarget }}
              accessibilityRole="button"
              accessibilityLabel="Ver eventos no Agora"
            >
              <Text className="text-white text-xs font-semibold">Ver eventos no Agora</Text>
            </Pressable>
          </GlassCard>
        );
      }
      return tournamentEvents.map((event, index) => (
        <View key={`tournament-${event.id}`} className="mb-3">
          <EventCardSquare
            event={event}
            index={index}
            source="padel-hub"
            userLat={userLat}
            userLon={userLon}
            showCountdown
          />
        </View>
      ));
    }

    if (activeSection === "courts") {
      if (courtServices.length === 0) {
        return (
          <GlassCard intensity={48} className="mb-3">
            <Text className="text-white/70 text-sm">{sectionMeta.emptyLabel}</Text>
          </GlassCard>
        );
      }
      return courtServices.map((service) => (
        <PadelCard
          key={`court-${service.id}`}
          title={service.title}
          badge="CAMPO"
          variant="court"
          subtitle={service.organization.publicName ?? service.organization.businessName ?? "Clube"}
          meta={`${formatPriceLabel(service.unitPriceCents, service.currency)} · ${
            service.addressRef?.formattedAddress ?? "Morada por definir"
          }`}
          onPress={() =>
            guardedAction(() =>
              safePush(router, { pathname: "/service/[id]", params: { id: String(service.id) } }),
            )
          }
        />
      ));
    }

    if (activeSection === "lessons") {
      if (lessonServices.length === 0) {
        return (
          <GlassCard intensity={48} className="mb-3">
            <Text className="text-white/70 text-sm">{sectionMeta.emptyLabel}</Text>
          </GlassCard>
        );
      }
      return lessonServices.map((service) => (
        <PadelCard
          key={`lesson-${service.id}`}
          title={service.title}
          badge="AULA"
          variant="lesson"
          subtitle={service.organization.publicName ?? service.organization.businessName ?? "Clube"}
          meta={`${formatPriceLabel(service.unitPriceCents, service.currency)} · ${service.durationMinutes} min`}
          onPress={() =>
            guardedAction(() =>
              safePush(router, { pathname: "/service/[id]", params: { id: String(service.id) } }),
            )
          }
        />
      ));
    }

    return (
      <View className="gap-3">
        <PadelCard
          title="Jogos abertos em breve"
          badge="EM BREVE"
          variant="soon"
          subtitle={sectionMeta.emptyLabel}
          meta="Estamos a preparar matchmaking e convites por nível."
          disabled
        />
        <View>
          <Text className="mb-2 text-white/70 text-xs uppercase tracking-[0.08em]">Sugestões de clubes</Text>
          {clubs.length === 0 ? (
            <GlassCard intensity={42}>
              <Text className="text-white/70 text-sm">Sem sugestões de clubes para já.</Text>
            </GlassCard>
          ) : (
            clubs.slice(0, 3).map((club) => (
              <PadelCard
                key={`open-club-${club.key}`}
                title={club.name}
                badge="CLUBE"
                variant="club"
                subtitle={club.subtitle ?? "Sem localização definida"}
                meta={club.username ? `@${club.username}` : "Perfil de clube indisponível"}
                disabled={!club.username}
                onPress={
                  club.username
                    ? () =>
                        safePush(router, {
                          pathname: "/[username]",
                          params: { username: club.username as string },
                        })
                    : undefined
                }
              />
            ))
          )}
        </View>
      </View>
    );
  };

  return (
    <LiquidBackground>
      <TopAppHeader
        scrollState={topBar}
        variant="title"
        title="Padel"
        titleAlign="center"
        rightSlot={
          <Pressable
            onPress={handleClosePadel}
            accessibilityRole="button"
            accessibilityLabel="Fechar Padel"
            hitSlop={10}
            style={({ pressed }) => [styles.closeButtonSmall, pressed ? styles.closeButtonPressed : null]}
          >
            <View pointerEvents="none" style={styles.closePlateSmall}>
              {Platform.OS === "ios" ? (
                <BlurView intensity={40} tint="dark" style={styles.closePlateBlurSmall} />
              ) : null}
              <View style={styles.closePlateTintSmall} />
              <View style={styles.closeGlyphSmall}>
                <View style={[styles.closeGlyphLineSmall, styles.closeGlyphLineASmall]} />
                <View style={[styles.closeGlyphLineSmall, styles.closeGlyphLineBSmall]} />
              </View>
            </View>
          </Pressable>
        }
        showNotifications={false}
        showMessages={false}
      />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: topPadding, paddingBottom: contentBottomPadding }}
        onScroll={topBar.onScroll}
        onScrollEndDrag={topBar.onScrollEndDrag}
        onMomentumScrollEnd={topBar.onMomentumScrollEnd}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
        {needsPadelProfile ? (
          <GlassCard intensity={56} className="mb-4">
            <View className="flex-row items-start gap-3">
              <View className="h-9 w-9 items-center justify-center rounded-full border border-amber-200/45 bg-amber-300/15">
                <Ionicons name="alert-circle-outline" size={18} color="rgba(254,243,199,0.95)" />
              </View>
              <View style={{ flex: 1 }}>
                <Text className="text-white text-sm font-semibold">Melhora o teu perfil de Padel</Text>
                <Text className="mt-1 text-white/75 text-xs">
                  Completa o perfil para entrar em torneios, reservar campos e abrir jogos.
                </Text>
                {missingProfileFields.length > 0 ? (
                  <Text className="mt-1 text-amber-100/90 text-xs">
                    Em falta: {missingProfileFields.join(", ")}.
                  </Text>
                ) : null}
                <Pressable
                  onPress={() => safePush(router, TAB_PATHNAMES.profile)}
                  className="mt-3 self-start rounded-full border border-white/20 bg-white/10 px-3 py-2"
                  style={{ minHeight: tokens.layout.touchTarget }}
                  accessibilityRole="button"
                  accessibilityLabel="Completar perfil de Padel"
                >
                  <Text className="text-white text-xs font-semibold">Completar perfil</Text>
                </Pressable>
              </View>
            </View>
          </GlassCard>
        ) : null}

        <View style={styles.sectionPanel}>
          <LinearGradient
            pointerEvents="none"
            colors={["rgba(64, 118, 171, 0.24)", "rgba(16, 27, 44, 0.1)"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.sectionPanelHeader}>
            <Ionicons name="options-outline" size={14} color="rgba(196, 234, 255, 0.9)" />
            <Text style={styles.sectionPanelHeaderText}>Escolhe o modo de Padel</Text>
          </View>
          <View className="flex-row flex-wrap gap-2">
            {SECTION_OPTIONS.map((option) => {
              const active = activeSection === option.key;
              return (
                <Pressable
                  key={option.key}
                  onPress={() => setActiveSection(option.key)}
                  className="flex-row items-center justify-center gap-2 rounded-2xl px-3 py-3"
                  style={[styles.sectionChip, active ? styles.sectionChipActive : styles.sectionChipIdle]}
                  accessibilityRole="button"
                  accessibilityLabel={option.label}
                  accessibilityState={{ selected: active }}
                >
                  <Ionicons
                    name={option.icon}
                    size={16}
                    color={active ? "rgba(236,254,255,0.98)" : "rgba(255,255,255,0.76)"}
                  />
                  <Text
                    className="text-sm font-semibold"
                    style={active ? styles.sectionChipTextActive : styles.sectionChipTextIdle}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <SectionHeader title={sectionMeta.title} subtitle={sectionMeta.subtitle} />
        {activeSection === "lessons" ? (
          <Text className="mb-2 text-white/60 text-xs">
            Mostramos apenas aulas de padel associadas ao clube da organização.
          </Text>
        ) : null}

        {renderActiveContent()}

        {activeFetchingNextPage ? (
          <View className="py-3">
            <ActivityIndicator color="rgba(255,255,255,0.75)" />
          </View>
        ) : null}

        {showLoadMore ? (
          <Pressable
            onPress={fetchMoreActive}
            disabled={activeFetchingNextPage}
            className="mt-1 rounded-xl border border-white/16 bg-white/8 px-4 py-3"
            style={{ minHeight: tokens.layout.touchTarget }}
            accessibilityRole="button"
            accessibilityLabel="Carregar mais opções de padel"
          >
            <Text className="text-white text-sm font-semibold text-center">Carregar mais</Text>
          </Pressable>
        ) : null}

        <View className="mt-5">
          <SectionHeader title="Os teus clubes" subtitle="Clubes ligados à tua atividade de padel" />
          {clubs.length === 0 ? (
            <GlassCard intensity={48} className="mb-1">
              <Text className="text-white/70 text-sm">
                Ainda não encontrámos clubes para o teu perfil.
              </Text>
            </GlassCard>
          ) : (
            clubs.map((club) => (
              <PadelCard
                key={club.key}
                title={club.name}
                badge="CLUBE"
                variant="club"
                subtitle={club.subtitle ?? "Sem localização definida"}
                meta={club.username ? `@${club.username}` : "Perfil de clube indisponível"}
                disabled={!club.username}
                onPress={
                  club.username
                    ? () =>
                        safePush(router, {
                          pathname: "/[username]",
                          params: { username: club.username as string },
                        })
                    : undefined
                }
              />
            ))
          )}
        </View>
      </ScrollView>
    </LiquidBackground>
  );
}

const styles = StyleSheet.create({
  closeButtonSmall: {
    width: 36,
    height: 36,
    minWidth: 36,
    maxWidth: 36,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  closePlateSmall: {
    width: 36,
    height: 36,
    borderRadius: 999,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "rgba(0,0,0,0.74)",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 6,
  },
  closePlateBlurSmall: {
    ...StyleSheet.absoluteFillObject,
  },
  closePlateTintSmall: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(226,241,255,0.34)",
    backgroundColor: "rgba(8,12,20,0.46)",
  },
  closeGlyphSmall: {
    width: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  closeGlyphLineSmall: {
    position: "absolute",
    width: 14,
    height: 1.9,
    borderRadius: 999,
    backgroundColor: "rgba(248,252,255,0.98)",
  },
  closeGlyphLineASmall: {
    transform: [{ rotate: "45deg" }],
  },
  closeGlyphLineBSmall: {
    transform: [{ rotate: "-45deg" }],
  },
  closeButtonPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.97 }],
  },
  sectionPanel: {
    marginBottom: 16,
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(194, 227, 255, 0.2)",
    backgroundColor: "rgba(5, 14, 30, 0.7)",
    padding: 10,
  },
  sectionPanelHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  sectionPanelHeaderText: {
    color: "rgba(210, 239, 255, 0.9)",
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  sectionChip: {
    flexBasis: "48.5%",
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 140,
    minHeight: 52,
  },
  sectionChipActive: {
    borderWidth: 1,
    borderColor: "rgba(140, 236, 255, 0.62)",
    backgroundColor: "rgba(34, 211, 238, 0.26)",
    shadowColor: "rgba(56, 189, 248, 0.7)",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 5,
  },
  sectionChipIdle: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  sectionChipTextActive: {
    color: "rgba(236,254,255,0.98)",
  },
  sectionChipTextIdle: {
    color: "rgba(255,255,255,0.82)",
  },
  cardRoot: {
    borderWidth: 1,
    borderColor: "rgba(188, 219, 255, 0.18)",
    backgroundColor: "rgba(7, 15, 33, 0.48)",
  },
  cardPressed: {
    transform: [{ scale: 0.992 }],
    opacity: 0.94,
  },
  cardDisabled: {
    opacity: 0.64,
  },
  cardGradient: {
    ...StyleSheet.absoluteFillObject,
  },
});
