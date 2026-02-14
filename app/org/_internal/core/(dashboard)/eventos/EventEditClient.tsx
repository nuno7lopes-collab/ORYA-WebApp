"use client";

import { resolveCanonicalOrgApiPath } from "@/lib/canonicalOrgApiPath";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { InlineDateTimePicker } from "@/app/components/forms/InlineDateTimePicker";
import { EventCoverCropModal } from "@/app/components/forms/EventCoverCropModal";
import { useUser } from "@/app/hooks/useUser";
import { CTA_PRIMARY } from "@/app/org/_internal/core/dashboardUi";
import { getEventCoverSuggestionIds, getEventCoverUrl, parseEventCoverToken } from "@/lib/eventCover";
import { fetchGeoAutocompleteWithMeta, fetchGeoDetails } from "@/lib/geo/client";
import { AppleMapsLoader } from "@/app/components/maps/AppleMapsLoader";
import { AppleLocationMapPreview } from "@/app/components/maps/AppleLocationMapPreview";
import { FilterChip } from "@/app/components/mobile/MobileFilters";
import InterestIcon from "@/app/components/interests/InterestIcon";
import { useToast } from "@/components/ui/toast-provider";
import { partitionSuggestionsByCountry } from "@/lib/geo/autocompletePolicy";
import { trackEvent } from "@/lib/analytics";
import { INTEREST_OPTIONS, type InterestId } from "@/lib/interests";
import type { GeoAutocompleteItem, GeoDetailsItem } from "@/lib/geo/provider";
import {
  MAX_RECENT_LOCATIONS,
  RECENT_LOCATION_KEY,
  distanceKm,
  formatDistanceLabel,
  isFiniteCoordinate,
  sanitizeRecentLocation,
} from "@/lib/geo/locationUx";
import type { Prisma } from "@prisma/client";

const TicketTypeStatus = {
  ON_SALE: "ON_SALE",
  UPCOMING: "UPCOMING",
  CLOSED: "CLOSED",
  SOLD_OUT: "SOLD_OUT",
} as const;

type TicketTypeStatus = (typeof TicketTypeStatus)[keyof typeof TicketTypeStatus];

type LiveVisibility = "PUBLIC" | "PRIVATE" | "DISABLED";

type TicketTypeUI = {
  id: number;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  totalQuantity: number | null;
  soldQuantity: number;
  status: TicketTypeStatus;
  startsAt: string | null;
  endsAt: string | null;
  padelEventCategoryLinkId?: number | null;
  padelCategoryLabel?: string | null;
};

type PadelCategoryLink = {
  id: number;
  padelCategoryId: number;
  format?: string | null;
  capacityTeams?: number | null;
  capacityPlayers?: number | null;
  liveStreamUrl?: string | null;
  isEnabled: boolean;
  isHidden: boolean;
  category?: {
    id: number;
    label: string | null;
  } | null;
};

type PadelCategoryOption = {
  id: number;
  label: string | null;
  minLevel?: string | null;
  maxLevel?: string | null;
};

type PadelCategoryDraft = {
  isEnabled: boolean;
  isHidden: boolean;
  capacityTeams: string;
};

const arePadelDraftsEqual = (
  a: Record<number, PadelCategoryDraft>,
  b: Record<number, PadelCategoryDraft>,
) => {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (const key of aKeys) {
    const aDraft = a[Number(key)];
    const bDraft = b[Number(key)];
    if (!bDraft) return false;
    if (
      aDraft.isEnabled !== bDraft.isEnabled ||
      aDraft.isHidden !== bDraft.isHidden ||
      aDraft.capacityTeams !== bDraft.capacityTeams
    ) {
      return false;
    }
  }
  return true;
};

type EventEditClientProps = {
  event: {
    id: number;
    organizationId: number | null;
    slug: string;
    title: string;
    description: string | null;
    startsAt: string;
    endsAt: string;
    interestTags?: string[] | null;
    address?: string | null;
    addressId?: string | null;
    addressRef?: {
      formattedAddress: string;
      canonical: Prisma.JsonValue | null;
      latitude: number;
      longitude: number;
      sourceProvider: string | null;
      sourceProviderPlaceId: string | null;
      confidenceScore: number | null;
      validationStatus: string | null;
    } | null;
    templateType: string | null;
    isGratis: boolean;
    coverImageUrl: string | null;
    liveVisibility: LiveVisibility;
    liveStreamUrl: string | null;
    accessPolicy?: {
      mode?: string | null;
      guestCheckoutAllowed?: boolean | null;
      inviteTokenAllowed?: boolean | null;
      inviteIdentityMatch?: string | null;
      inviteTokenTtlSeconds?: number | null;
      requiresEntitlementForEntry?: boolean | null;
      checkinMethods?: string[] | null;
    } | null;
    payoutMode?: string | null;
  };
  tickets: TicketTypeUI[];
  eventHasTickets?: boolean;
};

type EventInvite = {
  id: number;
  targetIdentifier: string;
  targetUserId?: string | null;
  scope?: "PUBLIC" | "PARTICIPANT";
  createdAt?: string;
  targetUser?: {
    id: string;
    username: string | null;
    fullName: string | null;
    avatarUrl: string | null;
  } | null;
};

const fetcher = (url: string) => fetch(url).then((res) => res.json());
const normalizeIntegerInput = (value: string) => {
  const match = value.trim().match(/^\d+/);
  return match ? match[0] : "";
};

export function EventEditClient({ event, tickets }: EventEditClientProps) {
  const { pushToast: publishToast } = useToast();
  const { user, profile } = useUser();
  const organizationId = event.organizationId ?? null;
  const orgMeUrl =
    organizationId ? `/api/org/${organizationId}/me` : null;
  const { data: organizationStatus } = useSWR<{
    paymentsStatus?: string;
    paymentsMode?: "PLATFORM" | "CONNECT";
    organization?: {
      orgType?: string | null;
    } | null;
  }>(
    orgMeUrl,
    fetcher,
    { revalidateOnFocus: false }
  );
  const [title, setTitle] = useState(event.title);
  const [description, setDescription] = useState(event.description ?? "");
  const [startsAt, setStartsAt] = useState(event.startsAt);
  const [endsAt, setEndsAt] = useState(event.endsAt);
  const [interestTags, setInterestTags] = useState<InterestId[]>(
    (Array.isArray(event.interestTags) ? event.interestTags : []) as InterestId[],
  );
  const initialAddress = event.addressRef?.formattedAddress ?? "";
  const [locationAddressId, setLocationAddressId] = useState<string | null>(event.addressId ?? null);
  const [locationQuery, setLocationQuery] = useState(initialAddress);
  const [locationSuggestions, setLocationSuggestions] = useState<GeoAutocompleteItem[]>([]);
  const [showLocationSuggestions, setShowLocationSuggestions] = useState(false);
  const [locationSearchLoading, setLocationSearchLoading] = useState(false);
  const [locationSearchError, setLocationSearchError] = useState<string | null>(null);
  const [locationBiasError, setLocationBiasError] = useState<string | null>(null);
  const [locationDetailsLoading, setLocationDetailsLoading] = useState(false);
  const [locationProviderId, setLocationProviderId] = useState<string | null>(
    event.addressRef?.sourceProviderPlaceId ?? null,
  );
  const [locationFormattedAddress, setLocationFormattedAddress] = useState<string | null>(
    event.addressRef?.formattedAddress ?? null,
  );
  const [locationLat, setLocationLat] = useState<number | null>(event.addressRef?.latitude ?? null);
  const [locationLng, setLocationLng] = useState<number | null>(event.addressRef?.longitude ?? null);
  const [locationBias, setLocationBias] = useState<{ lat: number; lng: number } | null>(null);
  const [requestingLocationBias, setRequestingLocationBias] = useState(false);
  const [recentLocationItems, setRecentLocationItems] = useState<GeoAutocompleteItem[]>([]);
  const [expectedCountryCode, setExpectedCountryCode] = useState<string | null>(null);
  const [effectiveCountryCode, setEffectiveCountryCode] = useState<string | null>(null);
  const [queryCountryIntentCode, setQueryCountryIntentCode] = useState<string | null>(null);
  const [showForeignSuggestions, setShowForeignSuggestions] = useState(false);
  const [templateType] = useState(event.templateType ?? "OTHER");
  const isPadel = templateType === "PADEL";
  const ticketLabel = isPadel ? "inscrição" : "bilhete";
  const ticketLabelPlural = isPadel ? "inscrições" : "bilhetes";
  const ticketLabelPluralCap = isPadel ? "Inscrições" : "Bilhetes";
  const ticketLabelArticle = isPadel ? "da" : "do";
  const ticketLabelThis = isPadel ? "esta inscrição" : "este bilhete";
  const ticketLabelNew = isPadel ? "nova inscrição" : "novo bilhete";
  const eventRouteBase = isPadel ? "/org/padel/torneios" : "/org/eventos";
  const organizationPrimaryModule =
    (organizationStatus as { organization?: { primaryModule?: string | null } } | null)?.organization
      ?.primaryModule ?? null;
  const coverSuggestions = useMemo(
    () => getEventCoverSuggestionIds({ templateType, primaryModule: organizationPrimaryModule }),
    [templateType, organizationPrimaryModule],
  );
  const [isGratis] = useState(event.isGratis);
  const [coverUrl, setCoverUrl] = useState<string | null>(event.coverImageUrl);
  const [coverCropFile, setCoverCropFile] = useState<File | null>(null);
  const [showCoverCropModal, setShowCoverCropModal] = useState(false);
  const selectedCoverToken = parseEventCoverToken(coverUrl);
  const coverPreviewUrl = coverUrl
    ? getEventCoverUrl(coverUrl, {
        seed: event.slug ?? event.id,
        suggestedIds: coverSuggestions,
        width: 1200,
        quality: 72,
        format: "webp",
      })
    : null;
  const [liveVisibility, setLiveVisibility] = useState<LiveVisibility>(
    event.liveVisibility ?? "PUBLIC",
  );
  const [liveStreamUrl, setLiveStreamUrl] = useState(event.liveStreamUrl ?? "");
  const accessMode =
    typeof event.accessPolicy?.mode === "string"
      ? event.accessPolicy.mode.trim().toUpperCase()
      : "INVITE_ONLY";
  const isInviteRestricted = accessMode === "INVITE_ONLY";
  const { data: padelEventCategories, mutate: mutatePadelEventCategories } = useSWR<{ ok?: boolean; items?: PadelCategoryLink[] }>(
    isPadel ? `/api/padel/event-categories?eventId=${event.id}` : null,
    fetcher,
  );
  const { data: padelCategoriesData } = useSWR<{ ok?: boolean; items?: PadelCategoryOption[] }>(
    isPadel && organizationId ? `/api/padel/categories/my?organizationId=${organizationId}` : null,
    fetcher,
  );
  const padelCategoryLinks = Array.isArray(padelEventCategories?.items) ? padelEventCategories?.items ?? [] : [];
  const activePadelCategoryLinks = padelCategoryLinks.filter((link) => link.isEnabled);
  const padelCategories = Array.isArray(padelCategoriesData?.items) ? padelCategoriesData?.items ?? [] : [];
  const [padelCategoryDrafts, setPadelCategoryDrafts] = useState<Record<number, PadelCategoryDraft>>({});
  const [padelCategoryAddId, setPadelCategoryAddId] = useState("");
  const [padelCategorySaving, setPadelCategorySaving] = useState(false);
  const [padelCategoryError, setPadelCategoryError] = useState<string | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [ticketList, setTicketList] = useState<TicketTypeUI[]>(tickets);
  const [currentStep, setCurrentStep] = useState(0);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<"title" | "startsAt" | "endsAt" | "location", string>>
  >({});
  const [errorSummary, setErrorSummary] = useState<{ field: string; message: string }[]>([]);
  const [publicInviteInput, setPublicInviteInput] = useState("");
  const [publicInviteError, setPublicInviteError] = useState<string | null>(null);
  const [publicInviteSaving, setPublicInviteSaving] = useState(false);
  const [inviteRemovingId, setInviteRemovingId] = useState<number | null>(null);
  const { data: publicInvitesData, mutate: mutatePublicInvites, isLoading: publicInvitesLoading } = useSWR<{
    ok?: boolean;
    items?: EventInvite[];
  }>(user ? resolveCanonicalOrgApiPath(`/api/org/[orgId]/events/${event.id}/invites?scope=PUBLIC`) : null, fetcher, {
    revalidateOnFocus: false,
  });
  const publicInvites = useMemo(
    () => (Array.isArray(publicInvitesData?.items) ? publicInvitesData.items : []),
    [publicInvitesData?.items],
  );
  const steps = useMemo(
    () =>
      isGratis || isPadel
        ? [
            { key: "base", label: "Essenciais", desc: "Imagem e localização" },
            { key: "dates", label: "Datas & Local", desc: "Início e fim" },
            { key: "summary", label: "Revisão", desc: "Confirmar e guardar" },
          ]
        : [
            { key: "base", label: "Essenciais", desc: "Imagem e localização" },
            { key: "dates", label: "Datas & Local", desc: "Início e fim" },
            { key: "tickets", label: ticketLabelPluralCap, desc: "Gestão e vendas" },
          ],
    [isGratis, isPadel, ticketLabelPluralCap],
  );
  const freeCapacity = useMemo(() => {
    if (!isGratis) return null;
    const total = ticketList.reduce((sum, t) => {
      if (t.totalQuantity == null) return sum;
      return sum + t.totalQuantity;
    }, 0);
    return total > 0 ? total : null;
  }, [isGratis, ticketList]);

  const [newTicket, setNewTicket] = useState({
    name: "",
    description: "",
    priceEuro: "",
    totalQuantity: "",
    startsAt: "",
    endsAt: "",
    padelEventCategoryLinkId: "",
  });

  const [endingIds, setEndingIds] = useState<number[]>([]);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stripeAlert, setStripeAlert] = useState<string | null>(null);
  const [validationAlert, setValidationAlert] = useState<string | null>(null);
  const [backendAlert, setBackendAlert] = useState<string | null>(null);
  const ctaRef = useRef<HTMLDivElement | null>(null);
  const titleRef = useRef<HTMLInputElement | null>(null);
  const startsRef = useRef<HTMLDivElement | null>(null);
  const endsRef = useRef<HTMLDivElement | null>(null);
  const locationSearchRef = useRef<HTMLInputElement | null>(null);
  const locationSearchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suggestionBlurTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const locationSearchSeq = useRef(0);
  const locationDetailsSeq = useRef(0);
  const activeProviderRef = useRef<string | null>(null);
  const locationBypassAnalyticsRef = useRef<string | null>(null);
  const errorSummaryRef = useRef<HTMLDivElement | null>(null);
  const pushToast = (message: string, tone: "success" | "error" = "error") => {
    publishToast(message, { variant: tone === "success" ? "success" : "error" });
  };
  const roles = Array.isArray(profile?.roles) ? (profile?.roles as string[]) : [];
  const isAdmin = roles.some((r) => r?.toLowerCase() === "admin");
  const organizationOrgType =
    organizationStatus?.organization?.orgType ??
    (organizationStatus?.paymentsMode === "PLATFORM" ? "PLATFORM" : "EXTERNAL");
  const isPlatformPayout = organizationOrgType === "PLATFORM";
  const paymentsStatusRaw = isAdmin ? "READY" : organizationStatus?.paymentsStatus ?? "NO_STRIPE";
  const paymentsStatus = isPlatformPayout ? "READY" : paymentsStatusRaw;
  const hasPaidTicket = useMemo(
    () =>
      ticketList.some((t) => t.price > 0 && t.status !== TicketTypeStatus.CLOSED) ||
      (newTicket.priceEuro && Number(newTicket.priceEuro.replace(",", ".")) > 0),
    [ticketList, newTicket.priceEuro],
  );
  const primaryLabel = isPadel ? "torneio" : "evento";
  const primaryLabelTitle = isPadel ? "Torneio" : "Evento";
  const primaryLabelPlural = isPadel ? "Torneios" : "Eventos";
  const templateLabel = isPadel ? "Padel" : "Evento padrão";
  const livePreviewUrl = `/eventos/${event.slug}/live`;
  const inputClass = (invalid: boolean) =>
    `w-full rounded-md border ${invalid ? "border-amber-400/60 focus:border-amber-300" : "border-white/15 focus:border-white/60"} bg-black/20 px-3 py-2 text-sm outline-none`;
  const locationError = fieldErrors.location ?? null;
  const locationSummary = useMemo(() => {
    if (locationFormattedAddress) return locationFormattedAddress;
    const trimmed = locationQuery.trim();
    return trimmed || "Local a definir";
  }, [locationFormattedAddress, locationQuery]);

  useEffect(() => {
    if (!isPadel) return;
    const nextDrafts: Record<number, PadelCategoryDraft> = {};
    padelCategoryLinks.forEach((link) => {
      nextDrafts[link.padelCategoryId] = {
        isEnabled: link.isEnabled,
        isHidden: link.isHidden ?? false,
        capacityTeams: typeof link.capacityTeams === "number" ? String(link.capacityTeams) : "",
      };
    });
    setPadelCategoryDrafts((prev) => (arePadelDraftsEqual(prev, nextDrafts) ? prev : nextDrafts));
  }, [isPadel, padelCategoryLinks]);

  const availablePadelCategories = useMemo(() => {
    const linkedIds = new Set(padelCategoryLinks.map((link) => link.padelCategoryId));
    return padelCategories.filter((cat) => !linkedIds.has(cat.id));
  }, [padelCategories, padelCategoryLinks]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(RECENT_LOCATION_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      const safe = parsed
        .map((entry) => sanitizeRecentLocation(entry))
        .filter((entry): entry is GeoAutocompleteItem => Boolean(entry))
        .slice(0, MAX_RECENT_LOCATIONS);
      setRecentLocationItems(safe);
    } catch {
      // ignore parse/storage failures
    }
  }, []);

  useEffect(() => {
    const query = locationQuery.trim();
    if (query.length < 2) {
      setLocationSuggestions([]);
      setLocationSearchError(null);
      setExpectedCountryCode(null);
      setEffectiveCountryCode(null);
      setQueryCountryIntentCode(null);
      setShowForeignSuggestions(false);
      return;
    }
    if (locationSearchTimeout.current) {
      clearTimeout(locationSearchTimeout.current);
    }
    setLocationSearchError(null);
    const seq = ++locationSearchSeq.current;
    locationSearchTimeout.current = setTimeout(async () => {
      setLocationSearchLoading(true);
      try {
        const result = await fetchGeoAutocompleteWithMeta(query, locationBias ?? undefined);
        if (locationSearchSeq.current === seq) {
          setLocationSuggestions(result.items);
          setExpectedCountryCode(result.expectedCountryCode);
          setEffectiveCountryCode(result.effectiveCountryCode);
          setQueryCountryIntentCode(result.queryCountryIntentCode);
          setShowForeignSuggestions(false);
        }
      } catch (err) {
        console.warn("[eventos/edit] autocomplete falhou", err);
        if (locationSearchSeq.current === seq) {
          setLocationSuggestions([]);
          setLocationSearchError(err instanceof Error ? err.message : "Falha ao obter sugestões.");
          setExpectedCountryCode(null);
          setEffectiveCountryCode(null);
          setQueryCountryIntentCode(null);
          setShowForeignSuggestions(false);
        }
      } finally {
        if (locationSearchSeq.current === seq) {
          setLocationSearchLoading(false);
        }
      }
    }, 280);

    return () => {
      if (locationSearchTimeout.current) {
        clearTimeout(locationSearchTimeout.current);
      }
    };
  }, [locationQuery, locationBias]);

  useEffect(() => {
    const queryLength = locationQuery.trim().length;
    const bypassActive = Boolean(
      queryLength >= 2 &&
      expectedCountryCode &&
      effectiveCountryCode &&
      expectedCountryCode !== effectiveCountryCode,
    );
    if (!bypassActive) {
      locationBypassAnalyticsRef.current = null;
      return;
    }

    const signature = `${expectedCountryCode}:${effectiveCountryCode}:${queryCountryIntentCode ?? ""}`;
    if (locationBypassAnalyticsRef.current === signature) return;
    locationBypassAnalyticsRef.current = signature;
    trackEvent("geo_autocomplete_country_bypass_triggered", {
      formContext: "event_edit",
      expectedCountryCode,
      effectiveCountryCode,
      queryCountryIntentCode,
      queryLength,
    });
  }, [effectiveCountryCode, expectedCountryCode, locationQuery, queryCountryIntentCode]);

  const rememberRecentLocation = (item: GeoAutocompleteItem) => {
    setRecentLocationItems((prev) => {
      const next = [item, ...prev.filter((entry) => entry.providerId !== item.providerId)].slice(0, MAX_RECENT_LOCATIONS);
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem(RECENT_LOCATION_KEY, JSON.stringify(next));
        } catch {
          // ignore storage failures
        }
      }
      return next;
    });
  };

  const requestLocationBias = () => {
    if (requestingLocationBias) return;
    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      setLocationBiasError("Este browser não suporta geolocalização.");
      return;
    }
    setRequestingLocationBias(true);
    setLocationBiasError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocationBias({ lat: position.coords.latitude, lng: position.coords.longitude });
        setRequestingLocationBias(false);
      },
      () => {
        setLocationBiasError("Não foi possível obter a tua localização.");
        setRequestingLocationBias(false);
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  };

  const applyGeoDetails = (details: GeoDetailsItem | null, fallbackName?: string | null) => {
    if (!details) return;
    const resolvedLabel = details.formattedAddress || details.name || fallbackName || null;
    setLocationFormattedAddress(resolvedLabel);
    setLocationAddressId(details.addressId ?? null);
    if (details.providerId) {
      setLocationProviderId(details.providerId);
    }
    if (Number.isFinite(details.lat ?? NaN) && Number.isFinite(details.lng ?? NaN)) {
      setLocationLat(details.lat);
      setLocationLng(details.lng);
    }
    const nextLabel = resolvedLabel || "";
    if (nextLabel) setLocationQuery(nextLabel);
  };

  const handleSelectGeoSuggestion = async (
    item: GeoAutocompleteItem,
    options?: { isForeign?: boolean },
  ) => {
    const queryLength = locationQuery.trim().length;
    if (options?.isForeign) {
      trackEvent("geo_autocomplete_foreign_selected", {
        formContext: "event_edit",
        expectedCountryCode,
        effectiveCountryCode,
        queryCountryIntentCode,
        queryLength,
      });
    }
    setLocationProviderId(item.providerId);
    setLocationAddressId(null);
    activeProviderRef.current = item.providerId;
    setLocationLat(item.lat);
    setLocationLng(item.lng);
    setLocationQuery(item.label);
    setLocationFormattedAddress(item.label);
    setLocationSuggestions([]);
    setShowLocationSuggestions(false);
    setShowForeignSuggestions(false);
    setLocationSearchError(null);
    setLocationBiasError(null);
    rememberRecentLocation(item);

    const seq = ++locationDetailsSeq.current;
    setLocationDetailsLoading(true);
    try {
      const details = await fetchGeoDetails(item.providerId, {
        lat: item.lat,
        lng: item.lng,
      });
      if (locationDetailsSeq.current !== seq) return;
      if (activeProviderRef.current !== item.providerId) return;
      applyGeoDetails(details, item.name || item.label);
      if (details) {
        rememberRecentLocation({
          providerId: details.providerId || item.providerId,
          label: details.formattedAddress || details.name || item.label,
          name: details.name || item.name,
          city: details.city || item.city,
          address: details.formattedAddress || details.address || item.address,
          lat: isFiniteCoordinate(details.lat) ? details.lat : item.lat,
          lng: isFiniteCoordinate(details.lng) ? details.lng : item.lng,
          sourceProvider: details.sourceProvider || item.sourceProvider || "APPLE_MAPS",
        });
      }
    } catch (err) {
      console.warn("[eventos/edit] detalhes falharam", err);
    } finally {
      if (locationDetailsSeq.current === seq) {
        setLocationDetailsLoading(false);
      }
    }
  };

  const updatePadelCategoryDraft = (categoryId: number, patch: Partial<PadelCategoryDraft>) => {
    setPadelCategoryDrafts((prev) => {
      const current = prev[categoryId] ?? { isEnabled: true, isHidden: false, capacityTeams: "" };
      return { ...prev, [categoryId]: { ...current, ...patch } };
    });
  };

  const handleSavePadelCategories = async () => {
    if (!isPadel || padelCategoryLinks.length === 0) return;
    setPadelCategorySaving(true);
    setPadelCategoryError(null);
    const linksPayload = padelCategoryLinks.map((link) => {
      const draft = padelCategoryDrafts[link.padelCategoryId];
      const rawCapacity = draft?.capacityTeams ?? "";
      const capacityValue = rawCapacity.trim() === "" ? null : Number(rawCapacity);
      return {
        padelCategoryId: link.padelCategoryId,
        isEnabled: draft?.isEnabled ?? link.isEnabled,
        isHidden: draft?.isHidden ?? link.isHidden,
        capacityTeams: Number.isFinite(capacityValue) && (capacityValue as number) > 0 ? Math.floor(capacityValue as number) : null,
      };
    });

    try {
      const res = await fetch("/api/padel/event-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: event.id, links: linksPayload }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Não foi possível guardar categorias.");
      }
      await mutatePadelEventCategories();
      pushToast("Categorias Padel atualizadas.", "success");
    } catch (err) {
      setPadelCategoryError(err instanceof Error ? err.message : "Erro ao guardar categorias.");
    } finally {
      setPadelCategorySaving(false);
    }
  };

  const handleAddPadelCategory = async () => {
    if (!isPadel) return;
    const categoryId = Number(padelCategoryAddId);
    if (!Number.isFinite(categoryId)) {
      setPadelCategoryError("Seleciona uma categoria válida.");
      return;
    }
    setPadelCategorySaving(true);
    setPadelCategoryError(null);
    try {
      const res = await fetch("/api/padel/event-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: event.id,
          links: [{ padelCategoryId: categoryId, isEnabled: true }],
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Não foi possível adicionar a categoria.");
      }
      setPadelCategoryAddId("");
      await mutatePadelEventCategories();
      pushToast(`Categoria adicionada ao ${primaryLabel}.`, "success");
    } catch (err) {
      setPadelCategoryError(err instanceof Error ? err.message : "Erro ao adicionar categoria.");
    } finally {
      setPadelCategorySaving(false);
    }
  };

  const accessWarnings = useMemo(() => {
    const warnings: string[] = [];
    if (isInviteRestricted) {
      warnings.push(`${primaryLabelTitle} apenas por convite.`);
    }
    if (isInviteRestricted && !publicInvitesLoading && publicInvites.length === 0) {
      warnings.push("Sem convites de público.");
    }
    return warnings;
  }, [isInviteRestricted, primaryLabelTitle, publicInvites.length, publicInvitesLoading]);

  const inviteGroups = [
    {
      scope: "PUBLIC" as const,
      enabled: isInviteRestricted,
      title: "Convites do público",
      description: `Quem pode ver ${ticketLabelPlural} por convite.`,
      footer: `Convites por email permitem checkout como convidado. ${primaryLabelPlural} grátis continuam a exigir conta e username.`,
      input: publicInviteInput,
      setInput: setPublicInviteInput,
      error: publicInviteError,
      isSaving: publicInviteSaving,
      invites: publicInvites,
      isLoading: publicInvitesLoading,
    },
  ].filter((group) => group.enabled);
  const FormAlert = ({
    variant,
    title,
    message,
  }: {
    variant: "error" | "warning" | "success";
    title?: string;
    message: string;
  }) => {
    const tones =
      variant === "error"
        ? "border-red-500/40 bg-red-500/10 text-red-100"
        : variant === "warning"
          ? "border-amber-400/40 bg-amber-400/10 text-amber-100"
          : "border-emerald-400/40 bg-emerald-500/10 text-emerald-50";
    return (
      <div className={`rounded-md border px-4 py-3 text-sm ${tones}`}>
        {title && <p className="font-semibold">{title}</p>}
        <p>{message}</p>
      </div>
    );
  };

  const focusField = (field: string) => {
    const target =
      field === "title"
        ? titleRef.current
        : field === "startsAt"
          ? (startsRef.current?.querySelector("button") as HTMLElement | null)
        : field === "endsAt"
          ? (endsRef.current?.querySelector("button") as HTMLElement | null)
        : field === "location"
          ? locationSearchRef.current
        : null;
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
    target?.focus({ preventScroll: true });
  };

  const applyErrors = (issues: { field: string; message: string }[]) => {
    setFieldErrors((prev) => {
      const next = { ...prev };
      issues.forEach((issue) => {
        next[issue.field as keyof typeof next] = issue.message;
      });
      return next;
    });
    setErrorSummary(issues);
    if (issues.length > 0) {
      setTimeout(() => errorSummaryRef.current?.focus({ preventScroll: false }), 40);
    }
  };

  const clearErrorsForFields = (fields: string[]) => {
    setFieldErrors((prev) => {
      const next = { ...prev };
      fields.forEach((f) => delete next[f as keyof typeof next]);
      return next;
    });
    setErrorSummary((prev) => prev.filter((err) => !fields.includes(err.field)));
  };

  const collectErrors = (step: number | "all") => {
    const stepsToCheck = step === "all" ? [0, 1] : [step];
    const issues: { field: string; message: string }[] = [];

    stepsToCheck.forEach((idx) => {
      if (idx === 0) {
        if (!title.trim()) issues.push({ field: "title", message: "Título obrigatório." });
        if (!locationAddressId) {
          issues.push({ field: "location", message: "Seleciona uma morada válida da lista de sugestões." });
        }
      }
      if (idx === 1) {
        if (!startsAt) issues.push({ field: "startsAt", message: "Data/hora de início obrigatória." });
        if (!endsAt) issues.push({ field: "endsAt", message: "Data/hora de fim obrigatória." });
        if (endsAt && startsAt && new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
          issues.push({ field: "endsAt", message: "A data/hora de fim tem de ser depois do início." });
        }
      }
    });

    return issues;
  };

  const validateStep = (step: number) => {
    const issues = collectErrors(step);
    if (issues.length > 0) {
      applyErrors(issues);
      setValidationAlert("Revê os campos assinalados antes de continuar.");
      setError(issues[0]?.message ?? null);
      return false;
    }
    clearErrorsForFields(step === 0 ? ["title", "location"] : ["startsAt", "endsAt"]);
    setValidationAlert(null);
    setError(null);
    return true;
  };

  useEffect(() => {
    if (title.trim()) clearErrorsForFields(["title"]);
  }, [title]);

  useEffect(() => {
    if (locationAddressId) {
      clearErrorsForFields(["location"]);
    }
  }, [locationAddressId]);

  useEffect(() => {
    if (startsAt) clearErrorsForFields(["startsAt"]);
  }, [startsAt]);

  useEffect(() => {
    if (startsAt && endsAt && new Date(endsAt).getTime() > new Date(startsAt).getTime()) {
      clearErrorsForFields(["endsAt"]);
    }
  }, [endsAt, startsAt]);

  const goNext = () => {
    const ok = validateStep(currentStep);
    if (!ok) return;
    if (currentStep < steps.length - 1) {
      setValidationAlert(null);
      setError(null);
      setErrorSummary([]);
      setCurrentStep((s) => s + 1);
    } else {
      handleSave();
    }
  };

  const goPrev = () => {
    setValidationAlert(null);
    setError(null);
    setCurrentStep((s) => Math.max(0, s - 1));
  };

  const handleCoverUpload = (file: File | null) => {
    if (!file) return;
    setCoverCropFile(file);
    setShowCoverCropModal(true);
  };

  const uploadCoverFile = async (file: File) => {
    setUploadingCover(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      if (!organizationId) {
        throw new Error("Organização inválida.");
      }
      const res = await fetch(`/api/upload?scope=event-cover&organizationId=${organizationId}`, {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (!res.ok || !json?.url) {
        throw new Error(json?.error || "Falha no upload da imagem.");
      }
      setCoverUrl(json.url as string);
    } catch (err) {
      console.error("Erro upload cover", err);
      setError("Não foi possível carregar a imagem de capa.");
    } finally {
      setUploadingCover(false);
    }
  };

  const handleCoverCropCancel = () => {
    setShowCoverCropModal(false);
    setCoverCropFile(null);
  };

  const handleCoverCropConfirm = async (file: File) => {
    setShowCoverCropModal(false);
    setCoverCropFile(null);
    await uploadCoverFile(file);
  };

  const handleAddInvite = async () => {
    const value = publicInviteInput.trim();
    if (!value) {
      setPublicInviteError("Indica um email ou @username.");
      return;
    }
    setPublicInviteSaving(true);
    setPublicInviteError(null);
    try {
      const res = await fetch(resolveCanonicalOrgApiPath(`/api/org/[orgId]/events/${event.id}/invites`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: value, scope: "PUBLIC" }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Erro ao criar convite.");
      }
      setPublicInviteInput("");
      await mutatePublicInvites();
      pushToast("Convite adicionado.", "success");
    } catch (err) {
      console.error("Erro ao criar convite", err);
      const message = err instanceof Error ? err.message : "Erro ao criar convite.";
      setPublicInviteError(message);
      pushToast(message);
    } finally {
      setPublicInviteSaving(false);
    }
  };

  const handleRemoveInvite = async (inviteId: number) => {
    setInviteRemovingId(inviteId);
    setPublicInviteError(null);
    try {
      const res = await fetch(resolveCanonicalOrgApiPath(`/api/org/[orgId]/events/${event.id}/invites`), {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteId }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Erro ao remover convite.");
      }
      await mutatePublicInvites();
      pushToast("Convite removido.", "success");
    } catch (err) {
      console.error("Erro ao remover convite", err);
      const message = err instanceof Error ? err.message : "Erro ao remover convite.";
      setPublicInviteError(message);
      pushToast(message);
    } finally {
      setInviteRemovingId(null);
    }
  };

  const handleSave = async () => {
    setStripeAlert(null);
    setValidationAlert(null);
    setBackendAlert(null);
    setError(null);
    setMessage(null);

    const issues = collectErrors("all");
    if (issues.length > 0) {
      applyErrors(issues);
      setValidationAlert(`Revê os campos assinalados antes de guardar o ${primaryLabel}.`);
      setError(issues[0]?.message ?? null);
      return;
    }
    clearErrorsForFields(["title", "location", "startsAt", "endsAt"]);

    if (hasPaidTicket && paymentsStatus !== "READY") {
      setStripeAlert(
        `Podes gerir o ${primaryLabel}, mas só vender ${ticketLabelPlural} pagos depois de ligares o Stripe.`,
      );
      setError(`Liga o Stripe em Finanças & Payouts para vender ${ticketLabelPlural} pagos.`);
      ctaRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    const resolvedAddressId = locationAddressId;
    if (!resolvedAddressId) {
      setValidationAlert("Seleciona uma morada válida antes de guardar.");
      pushToast("Seleciona uma morada válida.");
      return;
    }
    if (
      isPadel &&
      newTicket.name.trim() &&
      newTicket.priceEuro &&
      activePadelCategoryLinks.length > 0 &&
      !newTicket.padelEventCategoryLinkId
    ) {
      setValidationAlert(`Seleciona uma categoria Padel para ${ticketLabelNew}.`);
      pushToast(`Seleciona a categoria ${ticketLabelArticle} ${ticketLabel}.`);
      return;
    }

    setIsSaving(true);
    try {
      const ticketTypeUpdates = endingIds.map((id) => ({
        id,
        status: TicketTypeStatus.CLOSED,
      }));

      const newTicketTotalQuantityRaw = Number(newTicket.totalQuantity);
      const newTicketTotalQuantity =
        Number.isFinite(newTicketTotalQuantityRaw) && newTicketTotalQuantityRaw > 0
          ? Math.floor(newTicketTotalQuantityRaw)
          : null;
      const newTicketsPayload =
        newTicket.name.trim() && newTicket.priceEuro
          ? [
              {
                name: newTicket.name.trim(),
                description: newTicket.description?.trim() || null,
                price: Math.round(Number(newTicket.priceEuro.replace(",", ".")) * 100) || 0,
                totalQuantity: newTicketTotalQuantity,
                startsAt: newTicket.startsAt || null,
                endsAt: newTicket.endsAt || null,
                padelEventCategoryLinkId: newTicket.padelEventCategoryLinkId
                  ? Number(newTicket.padelEventCategoryLinkId)
                  : null,
              },
            ]
          : [];

      const res = await fetch(resolveCanonicalOrgApiPath("/api/org/[orgId]/events/update"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: event.id,
          title,
          description,
          startsAt,
          endsAt,
          addressId: resolvedAddressId,
          templateType,
          interestTags,
          isGratis,
          coverImageUrl: coverUrl,
          liveVisibility,
          liveStreamUrl: liveStreamUrl.trim() || null,
          ticketTypeUpdates,
          newTicketTypes: newTicketsPayload,
        }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || `Erro ao atualizar ${primaryLabel}.`);
      }

      setMessage(`${primaryLabelTitle} atualizado com sucesso.`);
      pushToast(`${primaryLabelTitle} atualizado com sucesso.`, "success");
      setEndingIds([]);
      if (ticketTypeUpdates.length > 0) {
        setTicketList((prev) =>
          prev.map((t) =>
            endingIds.includes(t.id) ? { ...t, status: TicketTypeStatus.CLOSED } : t
          )
        );
      }
      if (newTicketsPayload.length > 0) {
        // Não temos ID do novo ticket aqui, mas podemos forçar refresh manual ou deixar como está.
        // Para feedback imediato, adicionamos placeholder sem ID real.
        const padelLinkId = newTicketsPayload[0].padelEventCategoryLinkId ?? null;
        const padelLabel = padelCategoryLinks.find((link) => link.id === padelLinkId)?.category?.label ?? null;
        const tempId = Date.now();
        setTicketList((prev) => [
          ...prev,
          {
            id: tempId, // placeholder local
            name: newTicketsPayload[0].name,
            description: newTicketsPayload[0].description ?? null,
            price: newTicketsPayload[0].price,
            currency: "EUR",
            totalQuantity: newTicketsPayload[0].totalQuantity ?? null,
            soldQuantity: 0,
            status: TicketTypeStatus.ON_SALE,
            startsAt: newTicketsPayload[0].startsAt,
            endsAt: newTicketsPayload[0].endsAt,
            padelEventCategoryLinkId: padelLinkId,
            padelCategoryLabel: padelLabel,
          },
        ]);
      }
      setNewTicket({
        name: "",
        description: "",
        priceEuro: "",
        totalQuantity: "",
        startsAt: "",
        endsAt: "",
        padelEventCategoryLinkId: "",
      });
      setErrorSummary([]);
      setFieldErrors({});
      setMessage(`${primaryLabelTitle} atualizado com sucesso.`);
    } catch (err) {
      console.error(`Erro ao atualizar ${primaryLabel}`, err);
      setBackendAlert(err instanceof Error ? err.message : `Erro ao atualizar ${primaryLabel}.`);
      pushToast(err instanceof Error ? err.message : `Erro ao atualizar ${primaryLabel}.`);
      ctaRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    } finally {
      setIsSaving(false);
    }
  };

  const openConfirmEnd = (id: number) => {
    setConfirmId(id);
    setConfirmText("");
  };

  const confirmEnd = async () => {
    if (!confirmId) return;
    if (confirmText.trim().toUpperCase() !== "TERMINAR VENDA") {
      setError('Escreve "TERMINAR VENDA" para confirmar.');
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch(resolveCanonicalOrgApiPath("/api/org/[orgId]/events/update"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: event.id,
          ticketTypeUpdates: [{ id: confirmId, status: TicketTypeStatus.CLOSED }],
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Erro ao terminar venda.");
      }
      setTicketList((prev) =>
        prev.map((t) => (t.id === confirmId ? { ...t, status: TicketTypeStatus.CLOSED } : t)),
      );
      setMessage(`Venda terminada para ${ticketLabelThis}.`);
      pushToast(`Venda terminada para ${ticketLabelThis}.`, "success");
    } catch (err) {
      console.error("Erro ao terminar venda", err);
      setError(err instanceof Error ? err.message : "Erro ao terminar venda.");
      pushToast(err instanceof Error ? err.message : "Erro ao terminar venda.");
    } finally {
      setIsSaving(false);
      setConfirmId(null);
      setConfirmText("");
    }
  };

  const progress = steps.length > 1 ? Math.min(100, (currentStep / (steps.length - 1)) * 100) : 100;

  const renderStepContent = () => {
    const trimmedLocationQuery = locationQuery.trim();
    const waitingForLocationQuery = trimmedLocationQuery.length < 2;
    const selectedLocationLabel = locationFormattedAddress || locationQuery || "Local selecionado";
    const selectedLocationDistance =
      locationBias && isFiniteCoordinate(locationLat) && isFiniteCoordinate(locationLng)
        ? formatDistanceLabel(distanceKm(locationBias, { lat: locationLat, lng: locationLng }))
        : null;
    const groupedSuggestions = partitionSuggestionsByCountry(locationSuggestions, effectiveCountryCode);
    const hasLocalSuggestions = groupedSuggestions.local.length > 0 || groupedSuggestions.unknown.length > 0;
    const showForeignFallback = !hasLocalSuggestions && groupedSuggestions.foreign.length > 0;
    const primarySuggestions = showForeignFallback
      ? groupedSuggestions.foreign
      : [...groupedSuggestions.local, ...groupedSuggestions.unknown];
    const collapsedForeignSuggestions = showForeignFallback ? [] : groupedSuggestions.foreign;
    const bypassActive = Boolean(
      expectedCountryCode &&
      effectiveCountryCode &&
      expectedCountryCode !== effectiveCountryCode,
    );
    const showForeignFallbackNotice =
      !waitingForLocationQuery &&
      !locationSearchLoading &&
      !locationSearchError &&
      showForeignFallback;

    const handleToggleForeignSuggestions = () => {
      setShowForeignSuggestions((prev) => {
        const next = !prev;
        if (next) {
          trackEvent("geo_autocomplete_foreign_section_opened", {
            formContext: "event_edit",
            expectedCountryCode,
            effectiveCountryCode,
            queryCountryIntentCode,
            queryLength: trimmedLocationQuery.length,
          });
        }
        return next;
      });
    };

    const baseBlock = (
      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Imagem de capa</label>
          <div className="flex flex-col sm:flex-row gap-3 items-start">
            <div className="aspect-square w-36 rounded-xl border border-white/15 bg-black/30 overflow-hidden flex items-center justify-center text-[11px] text-white/60">
              {coverPreviewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={coverPreviewUrl} alt="Capa" className="h-full w-full object-cover" />
              ) : (
                <span>Sem imagem</span>
              )}
            </div>
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2 text-[11px] text-white/60">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-white/20 px-3 py-1 hover:bg-white/10">
                  <span>{coverUrl ? "Substituir" : "Adicionar capa"}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleCoverUpload(e.target.files?.[0] ?? null)}
                    className="hidden"
                  />
                </label>
                <button
                  type="button"
                  disabled={uploadingCover || !coverUrl}
                  onClick={() => setCoverUrl(null)}
                  className="inline-flex items-center rounded-full border border-white/20 px-3 py-1 hover:bg-white/10 disabled:opacity-60"
                >
                  Remover imagem
                </button>
              </div>
              <div className="text-[11px] text-white/50">1200x1200 recomendado</div>
              {uploadingCover && <span className="text-[11px] text-white/60">A carregar imagem…</span>}
            </div>
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Título *</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            ref={titleRef}
            aria-invalid={Boolean(fieldErrors.title)}
            className="w-full rounded-md border border-white/15 bg-black/20 px-3 py-2 text-sm outline-none focus:border-white/60"
          />
          {fieldErrors.title && (
            <p className="flex items-center gap-2 text-xs font-semibold text-amber-100">
              <span aria-hidden>⚠️</span>
              {fieldErrors.title}
            </p>
          )}
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Descrição</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="w-full rounded-md border border-white/15 bg-black/20 px-3 py-2 text-sm outline-none focus:border-white/60"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Interesses do evento</label>
          <div className="flex flex-wrap gap-2">
            {INTEREST_OPTIONS.map((interest) => {
              const active = interestTags.includes(interest.id);
              return (
                <FilterChip
                  key={interest.id}
                  label={interest.label}
                  icon={<InterestIcon id={interest.id} className="h-3 w-3" />}
                  active={active}
                  onClick={() => {
                    setInterestTags((prev) => {
                      if (prev.includes(interest.id)) {
                        return prev.filter((item) => item !== interest.id);
                      }
                      return [...prev, interest.id];
                    });
                  }}
                />
              );
            })}
          </div>
          <p className="text-[11px] text-white/55">Usado para personalização e ranking.</p>
        </div>

        <div id="livehub" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.24em] text-white/60">Live</p>
              <p className="text-sm text-white/80">Visibilidade e stream.</p>
            </div>
            <a
              href={livePreviewUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-white/20 px-3 py-1 text-[11px] font-semibold text-white/80 hover:border-white/40"
            >
              Abrir
            </a>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-sm font-medium">Visibilidade</label>
              <select
                value={liveVisibility}
                onChange={(e) => setLiveVisibility(e.target.value as LiveVisibility)}
                className="w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-white/60"
              >
                <option value="PUBLIC">Público</option>
                <option value="PRIVATE">Privado (só participantes)</option>
                <option value="DISABLED">Desativado</option>
              </select>
              <p className="text-[11px] text-white/55">Público, privado ou oculto.</p>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">URL da livestream</label>
              <input
                value={liveStreamUrl}
                onChange={(e) => setLiveStreamUrl(e.target.value)}
                placeholder="https://youtu.be/..."
                className="w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-white/60"
              />
              <p className="text-[11px] text-white/55">Vazio = sem vídeo.</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 sm:px-5 sm:py-5 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Local / Morada</label>
              <p className="text-[11px] text-white/60">
                Escreve pelo menos 2 caracteres e escolhe uma sugestão válida do Apple Maps.
              </p>
            </div>
            <button
              type="button"
              onClick={requestLocationBias}
              disabled={requestingLocationBias}
              className="rounded-full border border-white/20 px-3 py-1.5 text-[11px] text-white/80 hover:border-white/40 disabled:opacity-60"
            >
              {requestingLocationBias
                ? "A obter localização..."
                : locationBias
                  ? "Localização atual ativa"
                  : "Usar localização atual"}
            </button>
          </div>

          <div className="space-y-3">
            <div className="relative overflow-visible">
              <input
                ref={locationSearchRef}
                value={locationQuery}
                onChange={(e) => {
                  const next = e.target.value;
                  setLocationQuery(next);
                  setLocationSearchError(null);
                  setLocationBiasError(null);
                  if (locationProviderId || locationAddressId) {
                    setLocationProviderId(null);
                    setLocationAddressId(null);
                    activeProviderRef.current = null;
                    setLocationFormattedAddress(null);
                    setLocationLat(null);
                    setLocationLng(null);
                  }
                  setShowForeignSuggestions(false);
                  setShowLocationSuggestions(true);
                }}
                onFocus={() => setShowLocationSuggestions(true)}
                onBlur={() => {
                  if (suggestionBlurTimeout.current) clearTimeout(suggestionBlurTimeout.current);
                  suggestionBlurTimeout.current = setTimeout(() => setShowLocationSuggestions(false), 120);
                }}
                aria-invalid={Boolean(fieldErrors.location)}
                className={inputClass(Boolean(fieldErrors.location))}
                placeholder="Procura uma morada, rua, cidade ou espaço"
              />

              {showLocationSuggestions && (
                <div className="mt-2 w-full max-h-72 overflow-y-auto rounded-xl border border-white/12 bg-black/90 shadow-xl backdrop-blur-2xl">
                  {waitingForLocationQuery ? (
                    <div className="space-y-3 px-3 py-3">
                      <div className="space-y-1">
                        <p className="text-[11px] uppercase tracking-[0.16em] text-white/45">Sugestões</p>
                        <p className="text-[12px] text-white/70">Começa a escrever para procurar locais.</p>
                      </div>
                      {recentLocationItems.length > 0 ? (
                        <div className="space-y-1">
                          <p className="text-[11px] text-white/55">Recentes</p>
                          {recentLocationItems.map((suggestion) => (
                            <button
                              key={`recent-${suggestion.providerId}`}
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => handleSelectGeoSuggestion(suggestion)}
                              className="flex w-full items-center justify-between gap-3 rounded-lg border border-white/8 px-2 py-2 text-left hover:bg-white/8"
                            >
                              <div>
                                <p className="text-sm font-semibold text-white">{suggestion.label}</p>
                                <p className="text-[11px] text-white/60">{suggestion.city || suggestion.address || "—"}</p>
                              </div>
                              <span className="text-[10px] uppercase tracking-[0.16em] text-white/45">Recente</span>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[12px] text-white/55">Sem localizações recentes neste dispositivo.</p>
                      )}
                    </div>
                  ) : locationSearchLoading ? (
                    <div className="px-3 py-2 text-sm text-white/70">A procurar...</div>
                  ) : locationSearchError ? (
                    <div className="px-3 py-2 text-sm text-amber-100">{locationSearchError}</div>
                  ) : primarySuggestions.length === 0 ? (
                    <div className="space-y-1 px-3 py-2 text-sm text-white/65">
                      <p>Sem sugestões para este texto.</p>
                      <p className="text-[12px] text-white/50">Tenta rua + cidade (ex: &quot;Rua de Ceuta Porto&quot;).</p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {bypassActive ? (
                        <div className="px-3 py-2 text-[11px] text-cyan-100/90">
                          Pesquisa global ativada por país na query.
                        </div>
                      ) : null}
                      {showForeignFallbackNotice ? (
                        <div className="px-3 py-2 text-[11px] text-amber-100/90">
                          Sem resultados no país esperado; a mostrar globais.
                        </div>
                      ) : null}
                      {primarySuggestions.map((suggestion) => {
                        const suggestionDistance =
                          locationBias && isFiniteCoordinate(suggestion.lat) && isFiniteCoordinate(suggestion.lng)
                            ? formatDistanceLabel(distanceKm(locationBias, { lat: suggestion.lat, lng: suggestion.lng }))
                            : null;
                        return (
                          <button
                            key={suggestion.providerId}
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => handleSelectGeoSuggestion(suggestion, { isForeign: showForeignFallback })}
                            className="flex w-full flex-col items-start gap-1 border-b border-white/5 px-3 py-2 text-left text-sm hover:bg-white/8 last:border-0 transition"
                          >
                            <div className="flex w-full items-start justify-between gap-3">
                              <div className="space-y-0.5">
                                <span className="block font-semibold text-white">{suggestion.label}</span>
                                {(suggestion.secondaryLabel || suggestion.address || suggestion.city) && (
                                  <span className="block text-[12px] text-white/60">
                                    {suggestion.secondaryLabel || suggestion.address || suggestion.city}
                                  </span>
                                )}
                              </div>
                              {suggestionDistance && (
                                <span className="rounded-full border border-white/15 px-2 py-0.5 text-[10px] text-white/65">
                                  {suggestionDistance}
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                      {collapsedForeignSuggestions.length > 0 ? (
                        <div className="border-t border-white/10">
                          <button
                            type="button"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={handleToggleForeignSuggestions}
                            className="flex w-full items-center justify-between px-3 py-2 text-left text-[12px] font-semibold text-white/75 hover:bg-white/8"
                          >
                            <span>Outros países ({collapsedForeignSuggestions.length})</span>
                            <span aria-hidden>{showForeignSuggestions ? "▴" : "▾"}</span>
                          </button>
                          {showForeignSuggestions ? (
                            <div className="border-t border-white/5">
                              {collapsedForeignSuggestions.map((suggestion) => {
                                const suggestionDistance =
                                  locationBias && isFiniteCoordinate(suggestion.lat) && isFiniteCoordinate(suggestion.lng)
                                    ? formatDistanceLabel(distanceKm(locationBias, { lat: suggestion.lat, lng: suggestion.lng }))
                                    : null;
                                return (
                                  <button
                                    key={`foreign-${suggestion.providerId}`}
                                    type="button"
                                    onMouseDown={(event) => event.preventDefault()}
                                    onClick={() => handleSelectGeoSuggestion(suggestion, { isForeign: true })}
                                    className="flex w-full flex-col items-start gap-1 border-b border-white/5 px-3 py-2 text-left text-sm hover:bg-white/8 last:border-0 transition"
                                  >
                                    <div className="flex w-full items-start justify-between gap-3">
                                      <div className="space-y-0.5">
                                        <span className="block font-semibold text-white">{suggestion.label}</span>
                                        {(suggestion.secondaryLabel || suggestion.address || suggestion.city) && (
                                          <span className="block text-[12px] text-white/60">
                                            {suggestion.secondaryLabel || suggestion.address || suggestion.city}
                                          </span>
                                        )}
                                      </div>
                                      {suggestionDistance && (
                                        <span className="rounded-full border border-white/15 px-2 py-0.5 text-[10px] text-white/65">
                                          {suggestionDistance}
                                        </span>
                                      )}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              )}
            </div>

            {locationBiasError && <p className="text-[11px] text-amber-100">{locationBiasError}</p>}

            {(locationProviderId || locationAddressId || locationFormattedAddress) && (
              <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-[12px] text-white/75">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-white">{selectedLocationLabel}</p>
                    <p className="text-[11px] text-white/55">
                      {locationDetailsLoading ? "A validar morada..." : "Morada selecionada."}
                    </p>
                  </div>
                  {selectedLocationDistance && (
                    <span className="rounded-full border border-white/15 px-2 py-0.5 text-[10px] text-white/65">
                      {selectedLocationDistance}
                    </span>
                  )}
                </div>
              </div>
            )}

            {isFiniteCoordinate(locationLat) && isFiniteCoordinate(locationLng) && (
              <AppleLocationMapPreview lat={locationLat} lng={locationLng} label={selectedLocationLabel} />
            )}
          </div>

          {locationError && (
            <p className="flex items-center gap-2 text-xs font-semibold text-amber-100">
              <span aria-hidden>⚠️</span>
              {locationError}
            </p>
          )}
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Template</label>
          <div className="rounded-md border border-white/15 bg-black/20 px-3 py-2 text-sm text-white/80">
            {templateLabel}
          </div>
          <p className="text-[11px] text-white/55">Não pode ser alterado.</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-white/75">
          <p className="font-semibold text-white">Taxas</p>
          <p className="text-[12px] text-white/65">
            Taxas ORYA incluídas no preço público.
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-white/75">
          <p className="font-semibold text-white">{primaryLabelTitle} grátis</p>
          <p className="text-[12px] text-white/65">
            Estado: {isGratis ? "grátis" : "pago"}.
            {isGratis && (
              <span className="block text-[12px] text-white/60 mt-1">
                Vagas: {freeCapacity != null ? freeCapacity : "Sem limite"}.
              </span>
            )}
          </p>
        </div>
        {accessWarnings.length > 0 && (
          <div className="rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-[12px] text-amber-50">
            <div className="space-y-1 text-amber-50/90">
              {accessWarnings.map((warning) => (
                <p key={warning}>• {warning}</p>
              ))}
            </div>
          </div>
        )}

        {inviteGroups.length > 0 && (
          <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-white/75 space-y-4">
            <div>
              <p className="font-semibold text-white">Convites</p>
              <p className="text-[12px] text-white/65">Lista de convidados para {ticketLabelPlural} por convite.</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {inviteGroups.map((group) => (
                <div
                  key={group.scope}
                  className="rounded-xl border border-white/10 bg-black/30 px-3 py-3 space-y-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold text-white">{group.title}</p>
                      <p className="text-[11px] text-white/55">{group.description}</p>
                    </div>
                    <span className="rounded-full border border-white/20 bg-black/40 px-3 py-1 text-[10px] text-white/65 uppercase tracking-[0.18em]">
                      Público
                    </span>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      value={group.input}
                      onChange={(e) => group.setInput(e.target.value)}
                      placeholder="Email ou @username"
                      className="w-full rounded-md border border-white/15 bg-black/20 px-3 py-2 text-sm outline-none focus:border-white/60"
                    />
                    <button
                      type="button"
                      onClick={() => handleAddInvite()}
                      disabled={group.isSaving}
                      className="rounded-full border border-white/20 px-4 py-2 text-[12px] font-semibold text-white hover:bg-white/10 disabled:opacity-60"
                    >
                      {group.isSaving ? "A adicionar…" : "Adicionar"}
                    </button>
                  </div>
                  {group.error && <p className="text-[11px] font-semibold text-amber-100">{group.error}</p>}

                  <div className="space-y-2">
                    {group.isLoading && <p className="text-[11px] text-white/60">A carregar convites…</p>}
                    {!group.isLoading && group.invites.length === 0 && (
                      <p className="text-[11px] text-white/60">Sem convites adicionados.</p>
                    )}
                    {group.invites.map((invite) => {
                      const resolvedUsername = invite.targetUser?.username
                        ? `@${invite.targetUser.username}`
                        : null;
                      return (
                        <div
                          key={invite.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-[12px]"
                        >
                          <div className="flex flex-col">
                            <span className="font-semibold text-white">
                              {resolvedUsername ?? invite.targetIdentifier}
                            </span>
                            {resolvedUsername && (
                              <span className="text-[11px] text-white/60">{invite.targetIdentifier}</span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveInvite(invite.id)}
                            disabled={inviteRemovingId === invite.id}
                            className="rounded-full border border-white/20 px-3 py-1 text-[11px] text-white/70 hover:bg-white/10 disabled:opacity-60"
                          >
                            {inviteRemovingId === invite.id ? "A remover…" : "Remover"}
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  <p className="text-[11px] text-white/55">
                    Convites por email permitem checkout como convidado. {primaryLabelPlural} grátis continuam a exigir conta e username.
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );

    const datesBlock = (
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div ref={startsRef} className="space-y-1">
            <InlineDateTimePicker
              label="Data/hora início"
              value={startsAt}
              onChange={(v) => setStartsAt(v)}
            />
            {fieldErrors.startsAt && (
              <p className="flex items-center gap-2 text-xs font-semibold text-amber-100">
                <span aria-hidden>⚠️</span>
                {fieldErrors.startsAt}
              </p>
            )}
          </div>
          <div ref={endsRef} className="space-y-1">
            <InlineDateTimePicker
              label="Data/hora fim"
              value={endsAt}
              onChange={(v) => setEndsAt(v)}
              minDateTime={startsAt ? new Date(startsAt) : undefined}
            />
            {fieldErrors.endsAt && (
              <p className="flex items-center gap-2 text-xs font-semibold text-amber-100">
                <span aria-hidden>⚠️</span>
                {fieldErrors.endsAt}
              </p>
            )}
          </div>
        </div>
      </div>
    );

    const ticketsBlock = (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-white/70">
            Bilhetes (não removemos, só terminamos venda)
          </h2>
          <Link href={`/org/analyze?section=vendas&eventId=${event.id}`} className="text-[11px] text-[#6BFFFF]">
            Ver vendas →
          </Link>
        </div>

        {isPadel && (
          <div className="rounded-xl border border-white/12 bg-black/25 p-3 space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[12px] font-semibold">Categorias Padel</p>
                <p className="text-[11px] text-white/60">
                  Ativa as categorias que aceitam inscrições neste {primaryLabel}. Desativar antes do início gera refunds base-only.
                </p>
              </div>
              <button
                type="button"
                onClick={handleSavePadelCategories}
                disabled={padelCategorySaving || padelCategoryLinks.length === 0}
                className="rounded-full border border-white/20 px-3 py-1 text-[11px] text-white/80 hover:bg-white/10 disabled:opacity-60"
              >
                {padelCategorySaving ? "A guardar…" : "Guardar categorias"}
              </button>
            </div>
            {padelCategoryError && (
              <p className="text-[11px] text-amber-200">{padelCategoryError}</p>
            )}
            {padelCategoryLinks.length === 0 ? (
              <p className="text-[11px] text-white/60">Sem categorias associadas ao {primaryLabel}.</p>
            ) : (
              <div className="space-y-2">
                {padelCategoryLinks.map((link) => {
                  const draft =
                    padelCategoryDrafts[link.padelCategoryId] ?? {
                      isEnabled: link.isEnabled,
                      isHidden: link.isHidden ?? false,
                      capacityTeams: typeof link.capacityTeams === "number" ? String(link.capacityTeams) : "",
                    };
                  return (
                    <div key={link.id} className="rounded-lg border border-white/10 bg-black/30 p-3 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold">
                            {link.category?.label ?? `Categoria ${link.padelCategoryId}`}
                          </p>
                          <p className="text-[11px] text-white/60">
                            {draft.isEnabled ? "Ativa" : "Desativada"}
                            {draft.isHidden ? " · Oculta" : ""}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-[11px] text-white/70">
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={draft.isEnabled}
                              onChange={(e) => updatePadelCategoryDraft(link.padelCategoryId, { isEnabled: e.target.checked })}
                              className="h-4 w-4 rounded border-white/30 bg-black/30"
                            />
                            Ativa
                          </label>
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={draft.isHidden}
                              onChange={(e) => updatePadelCategoryDraft(link.padelCategoryId, { isHidden: e.target.checked })}
                              className="h-4 w-4 rounded border-white/30 bg-black/30"
                            />
                            Oculta
                          </label>
                        </div>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <label className="text-[11px] text-white/70">
                          Capacidade (equipas)
                          <input
                            type="number"
                            min={0}
                            step="1"
                            inputMode="numeric"
                            value={draft.capacityTeams}
                            onChange={(e) =>
                              updatePadelCategoryDraft(link.padelCategoryId, {
                                capacityTeams: normalizeIntegerInput(e.target.value),
                              })
                            }
                            className="mt-1 w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm"
                          />
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="flex flex-wrap items-end gap-2">
              <label className="text-[11px] text-white/70">
                Adicionar categoria
                <select
                  value={padelCategoryAddId}
                  onChange={(e) => setPadelCategoryAddId(e.target.value)}
                  className="mt-1 w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm"
                >
                  <option value="">Seleciona uma categoria</option>
                  {availablePadelCategories.map((cat) => (
                    <option key={`padel-cat-${cat.id}`} value={String(cat.id)}>
                      {cat.label ?? `Categoria ${cat.id}`}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={handleAddPadelCategory}
                disabled={padelCategorySaving || availablePadelCategories.length === 0}
                className="rounded-full border border-white/20 px-3 py-2 text-[11px] text-white/80 hover:bg-white/10 disabled:opacity-60"
              >
                Adicionar
              </button>
            </div>
            {availablePadelCategories.length === 0 && padelCategories.length > 0 && (
              <p className="text-[11px] text-white/60">Todas as categorias já estão ligadas.</p>
            )}
            {padelCategories.length === 0 && (
              <p className="text-[11px] text-white/60">
                Cria categorias no Hub Padel.
              </p>
            )}
          </div>
        )}

        <div className="space-y-2">
          {ticketList.map((t) => {
            const price = (t.price / 100).toFixed(2);
            const remaining =
              t.totalQuantity !== null && t.totalQuantity !== undefined
                ? t.totalQuantity - t.soldQuantity
                : null;
            const isEnding = endingIds.includes(t.id) || t.status === TicketTypeStatus.CLOSED;

            return (
              <div
                key={t.id}
                className="rounded-xl border border-white/12 bg-black/30 p-3 flex flex-col gap-2"
              >
                <div className="flex items-center justify-between gap-2">
                <div className="flex flex-col">
                  <p className="font-semibold text-sm">{t.name}</p>
                  <p className="text-[11px] text-white/60">
                      {price} € • Vendidos: {t.soldQuantity}
                      {remaining !== null ? ` • Stock restante: ${remaining}` : ""}
                      {isPadel && t.padelCategoryLabel ? ` • Categoria: ${t.padelCategoryLabel}` : ""}
                  </p>
                </div>
                  <span className="text-[10px] rounded-full border border-white/20 px-2 py-0.5 text-white/75">
                    {isEnding ? "Venda terminada" : t.status}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 text-[11px]">
                  <button
                    type="button"
                    onClick={() => openConfirmEnd(t.id)}
                    disabled={t.status === TicketTypeStatus.CLOSED}
                    className={`rounded-full px-3 py-1 border ${
                      t.status === TicketTypeStatus.CLOSED
                        ? "border-white/15 text-white/40 cursor-not-allowed"
                        : "border-amber-300/60 text-amber-100 hover:bg-amber-500/10"
                    }`}
                  >
                    Terminar venda
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="rounded-xl border border-white/12 bg-black/25 p-3 space-y-2">
          <p className="text-[12px] font-semibold">Adicionar {ticketLabelNew}</p>
          {isPadel && activePadelCategoryLinks.length === 0 && (
            <p className="text-[11px] text-amber-200">
              Cria categorias Padel no hub e associa-as ao {primaryLabel} antes de adicionar {ticketLabelPlural}.
            </p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <input
              placeholder="Nome"
              value={newTicket.name}
              onChange={(e) => setNewTicket((p) => ({ ...p, name: e.target.value }))}
              className="rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm"
            />
            <input
              placeholder="Preço (euros)"
              value={newTicket.priceEuro}
              onChange={(e) => setNewTicket((p) => ({ ...p, priceEuro: e.target.value }))}
              className="rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm"
            />
            {isPadel && activePadelCategoryLinks.length > 0 && (
              <label className="text-[11px] text-white/70">
                Categoria Padel
                <select
                  value={newTicket.padelEventCategoryLinkId}
                  onChange={(e) => setNewTicket((p) => ({ ...p, padelEventCategoryLinkId: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm"
                >
                  <option value="">Seleciona uma categoria</option>
                  {activePadelCategoryLinks.map((link) => (
                    <option key={`padel-category-${link.id}`} value={String(link.id)}>
                      {link.category?.label ?? `Categoria ${link.padelCategoryId}`}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <input
              placeholder="Quantidade total"
              type="number"
              min={0}
              step="1"
              inputMode="numeric"
              value={newTicket.totalQuantity}
              onChange={(e) => setNewTicket((p) => ({ ...p, totalQuantity: normalizeIntegerInput(e.target.value) }))}
              className="rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm"
            />
            <input
              placeholder="Descrição (opcional)"
              value={newTicket.description}
              onChange={(e) => setNewTicket((p) => ({ ...p, description: e.target.value }))}
              className="rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm"
            />
            <div className="text-[11px] text-white/70">
              Início vendas
              <input
                type="datetime-local"
                value={newTicket.startsAt}
                onChange={(e) => setNewTicket((p) => ({ ...p, startsAt: e.target.value }))}
                className="mt-1 w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm"
              />
            </div>
            <div className="text-[11px] text-white/70">
              Fim vendas
              <input
                type="datetime-local"
                value={newTicket.endsAt}
                onChange={(e) => setNewTicket((p) => ({ ...p, endsAt: e.target.value }))}
                className="mt-1 w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <p className="text-[11px] text-white/50">
            Nova {ticketLabel} fica ON_SALE por padrão. Não removemos {ticketLabelPlural} antigos para manter histórico.
          </p>
        </div>
      </div>
    );

    const summaryBlock = (
      <div className="space-y-4">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-sm font-semibold text-white">Resumo rápido</p>
          <p className="text-white/70 text-sm mt-1">Confirma os detalhes antes de guardar.</p>
          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-white/80">
            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <p className="text-[11px] uppercase tracking-wide text-white/60">{primaryLabelTitle}</p>
              <p className="font-semibold">{title || "Sem título"}</p>
              <p className="text-white/60 text-sm line-clamp-2">{description || "Sem descrição"}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 p-3 space-y-1">
              <p className="text-[11px] uppercase tracking-wide text-white/60">Local e datas</p>
              <p>{locationSummary}</p>
              <p className="text-white/70">
                {locationFormattedAddress || locationQuery.trim() || "Local a definir"}
              </p>
              <p className="text-white/70">
                {startsAt ? new Date(startsAt).toLocaleString() : "Início por definir"}{" "}
                {endsAt ? `→ ${new Date(endsAt).toLocaleString()}` : ""}
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 p-3 space-y-1">
              <p className="text-[11px] uppercase tracking-wide text-white/60">Estado</p>
              <p className="font-semibold">
                {isGratis ? `${primaryLabelTitle} grátis` : `${primaryLabelTitle} pago`}
              </p>
              {isGratis && (
                <p className="text-white/70">
                  Vagas/inscrições: {freeCapacity != null ? freeCapacity : "Sem limite definido"}.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    );

    switch (steps[currentStep].key) {
      case "base":
        return baseBlock;
      case "dates":
        return datesBlock;
      case "tickets":
        return ticketsBlock;
      case "summary":
        return summaryBlock;
      default:
        return null;
    }
  };

  return (
    <>
      <AppleMapsLoader />
      <div className="space-y-6">
        {confirmId && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur">
            <div className="w-full max-w-sm rounded-2xl border border-white/15 bg-black/90 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.85)] space-y-3">
              <h3 className="text-lg font-semibold">Terminar venda {ticketLabelArticle} {ticketLabel}?</h3>
              <p className="text-sm text-white/70">
                Esta ação é definitiva para este tipo de {ticketLabel}. Escreve{" "}
                <span className="font-semibold">TERMINAR VENDA</span> para confirmar.
              </p>
              <input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                className="w-full rounded-md border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-white/50"
                placeholder="TERMINAR VENDA"
              />
              <div className="flex justify-end gap-2 text-[12px]">
                <button
                  type="button"
                  onClick={() => {
                    setConfirmId(null);
                    setConfirmText("");
                  }}
                  className="rounded-full border border-white/20 px-3 py-1 text-white/75 hover:bg-white/10"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={confirmEnd}
                  className={`${CTA_PRIMARY} px-3 py-1 text-[12px]`}
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-white/60">Edição em passos</p>
              <p className="text-lg font-semibold text-white">Editar {primaryLabelTitle}</p>
              <p className="text-sm text-white/60">
                Define o teu {primaryLabel} passo a passo. Podes guardar como rascunho em qualquer momento.
              </p>
            </div>
            <div className="text-right text-[12px] text-white/60">
              <p>Estado: {isGratis ? "Grátis" : "Pago"}</p>
              <p>Template: {templateLabel}</p>
            </div>
          </div>

          {errorSummary.length > 0 && (
            <div
              ref={errorSummaryRef}
              tabIndex={-1}
              className="rounded-xl border border-amber-400/40 bg-amber-500/10 p-3 text-sm text-amber-50 focus:outline-none focus:ring-2 focus:ring-amber-200/70"
            >
              <div className="flex items-center gap-2 font-semibold">
                <span aria-hidden>⚠️</span>
                <span>Revê estes campos antes de continuar</span>
              </div>
              <ul className="mt-2 space-y-1 text-[13px]">
                {errorSummary.map((err) => (
                  <li key={`${err.field}-${err.message}`}>
                    <button
                      type="button"
                      onClick={() => focusField(err.field)}
                      className="inline-flex items-center gap-2 text-left font-semibold text-white underline decoration-amber-200 underline-offset-4 hover:text-amber-50"
                    >
                      <span aria-hidden>↘</span>
                      <span>{err.message}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="space-y-3">
            <div className="relative h-1 rounded-full bg-white/10">
              <div
                className="absolute left-0 top-0 h-1 rounded-full bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5]"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 md:grid-cols-5">
              {steps.map((step, idx) => {
                const state = idx === currentStep ? "active" : idx < currentStep ? "done" : "future";
                const allowClick = idx < currentStep;
                return (
                  <button
                    key={step.key}
                    type="button"
                    onClick={() => allowClick && setCurrentStep(idx)}
                    className={`flex flex-col items-start rounded-xl border px-3 py-3 text-left transition ${
                      state === "active"
                        ? "border-white/40 bg-white/10 shadow"
                        : state === "done"
                          ? "border-white/15 bg-white/5 text-white/80"
                          : "border-white/10 bg-black/10 text-white/60"
                    } ${!allowClick ? "cursor-default" : "hover:border-white/30 hover:bg-white/5"}`}
                    disabled={!allowClick}
                  >
                    <div
                      className={`mb-2 flex h-9 w-9 items-center justify-center rounded-full border ${
                        state === "active"
                          ? "border-white bg-white text-black shadow-[0_0_0_6px_rgba(255,255,255,0.08)]"
                          : state === "done"
                            ? "border-emerald-300/70 bg-emerald-400/20 text-emerald-100"
                            : "border-white/30 text-white/70"
                      }`}
                    >
                      {state === "done" ? "✔" : idx + 1}
                    </div>
                    <p className="text-sm font-semibold text-white">{step.label}</p>
                    <p className="text-[12px] text-white/60">{step.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            {renderStepContent()}
          </div>

          <div ref={ctaRef} className="space-y-3">
            {stripeAlert && (
              <FormAlert
                variant={hasPaidTicket ? "error" : "warning"}
                title="Stripe incompleto"
                message={stripeAlert}
              />
            )}
            {validationAlert && <FormAlert variant="warning" message={validationAlert} />}
            {error && <FormAlert variant="error" message={error} />}
            {backendAlert && (
              <FormAlert
                variant="error"
                title={`Algo correu mal ao guardar o ${primaryLabel}`}
                message={backendAlert}
              />
            )}
            {message && <FormAlert variant="success" message={message} />}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex gap-2 text-sm">
                <button
                  type="button"
                  onClick={goPrev}
                  disabled={currentStep === 0 || isSaving}
                  className="rounded-full border border-white/20 px-4 py-2 text-white/80 hover:bg-white/10 disabled:opacity-50"
                >
                  Anterior
                </button>
                <Link
                  href={`${eventRouteBase}/${event.id}`}
                  className="rounded-full border border-white/20 px-4 py-2 text-white/80 hover:bg-white/10"
                >
                  Voltar
                </Link>
              </div>
              <button
                type="button"
                onClick={goNext}
                disabled={isSaving}
                className={`${CTA_PRIMARY} px-5 py-2 text-sm disabled:opacity-60`}
              >
                {currentStep === steps.length - 1 ? (isSaving ? "A gravar…" : "Guardar alterações") : "Continuar"}
              </button>
            </div>
          </div>
        </div>
      </div>
      <EventCoverCropModal
        open={showCoverCropModal}
        file={coverCropFile}
        onCancel={handleCoverCropCancel}
        onConfirm={handleCoverCropConfirm}
      />
    </>
  );
}
