"use client";

import { resolveCanonicalOrgApiPath } from "@/lib/canonicalOrgApiPath";
import { appendOrganizationIdToHref, buildOrgHref } from "@/lib/organizationIdUtils";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { InlineDateTimePicker } from "@/app/components/forms/InlineDateTimePicker";
import { EventCoverCropModal } from "@/app/components/forms/EventCoverCropModal";
import { useUser } from "@/app/hooks/useUser";
import { CTA_PRIMARY } from "@/app/org/_internal/core/dashboardUi";
import { getEventCoverSuggestionIds, getEventCoverUrl, parseEventCoverToken } from "@/lib/eventCover";
import { AppleMapsLoader } from "@/app/components/maps/AppleMapsLoader";
import { AppleLocationMapPreview } from "@/app/components/maps/AppleLocationMapPreview";
import { FilterChip } from "@/app/components/mobile/MobileFilters";
import InterestIcon from "@/app/components/interests/InterestIcon";
import { useToast } from "@/components/ui/toast-provider";
import { INTEREST_OPTIONS, type InterestId } from "@/lib/interests";
import type { GeoDetailsItem } from "@/lib/geo/types";
import { AddressCombobox } from "@/components/ui/address-combobox";
import { OryaDateTimeField } from "@/components/ui/datetime";
import type { Prisma } from "@prisma/client";

const TicketTypeStatus = {
  ON_SALE: "ON_SALE",
  UPCOMING: "UPCOMING",
  CLOSED: "CLOSED",
  SOLD_OUT: "SOLD_OUT",
} as const;

type TicketTypeStatus = (typeof TicketTypeStatus)[keyof typeof TicketTypeStatus];

type TicketTypeUI = {
  id: number;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  publicAccess: boolean;
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
    consumesResources?: boolean | null;
    selectedResourceIds?: number[] | null;
    selectedProfessionalIds?: number[] | null;
    isGratis: boolean;
    coverImageUrl: string | null;
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

type ReservasResourceItem = {
  id: number;
  label?: string | null;
  isActive?: boolean;
};

type ReservasProfessionalItem = {
  id: number;
  name?: string | null;
  isActive?: boolean;
};

type EventAccessPolicyUI = NonNullable<EventEditClientProps["event"]["accessPolicy"]>;

const fetcher = (url: string) => fetch(url).then((res) => res.json());
const normalizeIntegerInput = (value: string) => {
  const match = value.trim().match(/^\d+/);
  return match ? match[0] : "";
};

const toggleSelectionId = (current: number[], id: number, enabled: boolean) => {
  if (enabled) {
    return Array.from(new Set([...current, id])).sort((a, b) => a - b);
  }
  return current.filter((value) => value !== id);
};

export function EventEditClient({ event, tickets }: EventEditClientProps) {
  const { pushToast: publishToast } = useToast();
  const { user, profile } = useUser();
  const organizationId = event.organizationId ?? null;
  const resolveOrgApiPath = (path: string) =>
    resolveCanonicalOrgApiPath(path, organizationId);
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
  const [locationFormattedAddress, setLocationFormattedAddress] = useState<string | null>(
    event.addressRef?.formattedAddress ?? null,
  );
  const [locationLat, setLocationLat] = useState<number | null>(event.addressRef?.latitude ?? null);
  const [locationLng, setLocationLng] = useState<number | null>(event.addressRef?.longitude ?? null);
  const [consumesResources, setConsumesResources] = useState(event.consumesResources === true);
  const [selectedResourceIds, setSelectedResourceIds] = useState<number[]>(
    Array.isArray(event.selectedResourceIds) ? event.selectedResourceIds : [],
  );
  const [selectedProfessionalIds, setSelectedProfessionalIds] = useState<number[]>(
    Array.isArray(event.selectedProfessionalIds) ? event.selectedProfessionalIds : [],
  );
  const [templateType] = useState(event.templateType ?? "OTHER");
  const isPadel = templateType === "PADEL";
  const ticketLabel = isPadel ? "inscrição" : "bilhete";
  const ticketLabelPlural = isPadel ? "inscrições" : "bilhetes";
  const ticketLabelPluralCap = isPadel ? "Inscrições" : "Bilhetes";
  const ticketLabelArticle = isPadel ? "da" : "do";
  const ticketLabelThis = isPadel ? "esta inscrição" : "este bilhete";
  const ticketLabelNew = isPadel ? "nova inscrição" : "novo bilhete";
  const eventRouteBase = isPadel ? "/org/padel/tournaments" : "/org/events";
  const eventDetailHref = organizationId
    ? buildOrgHref(
        organizationId,
        isPadel ? `/padel/tournaments/${event.id}` : `/events/${event.id}`,
      )
    : appendOrganizationIdToHref(
        `${eventRouteBase}/${event.id}`,
        organizationId,
      );
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
  const [currentAccessPolicy, setCurrentAccessPolicy] = useState<EventAccessPolicyUI | null>(event.accessPolicy ?? null);
  const inviteIdentityMatch = "BOTH";
  const checkinMethods = Array.isArray(currentAccessPolicy?.checkinMethods)
    ? currentAccessPolicy.checkinMethods
        .map((method) => String(method).trim().toUpperCase())
        .filter((method): method is "QR_TICKET" | "QR_REGISTRATION" => method === "QR_TICKET" || method === "QR_REGISTRATION")
    : [];
  const resolvedCheckinMethods = checkinMethods.length > 0 ? checkinMethods : [isPadel ? "QR_REGISTRATION" : "QR_TICKET"];
  const accessMode =
    typeof currentAccessPolicy?.mode === "string"
      ? currentAccessPolicy.mode.trim().toUpperCase()
      : "PUBLIC";
  const inviteTokenAllowed = currentAccessPolicy?.inviteTokenAllowed === true;
  const { data: padelEventCategories, mutate: mutatePadelEventCategories } = useSWR<{ ok?: boolean; items?: PadelCategoryLink[] }>(
    isPadel ? `/api/padel/event-categories?eventId=${event.id}` : null,
    fetcher,
  );
  const { data: padelCategoriesData } = useSWR<{ ok?: boolean; items?: PadelCategoryOption[] }>(
    isPadel && organizationId ? `/api/padel/categories/my?organizationId=${organizationId}` : null,
    fetcher,
  );
  const { data: resourcesData } = useSWR<{ ok?: boolean; items?: ReservasResourceItem[] }>(
    organizationId ? `/api/org/${organizationId}/reservas/recursos?includeCourts=1` : null,
    fetcher,
  );
  const { data: professionalsData } = useSWR<{ ok?: boolean; items?: ReservasProfessionalItem[] }>(
    organizationId ? `/api/org/${organizationId}/reservas/profissionais` : null,
    fetcher,
  );
  const resourceOptions = Array.isArray(resourcesData?.items) ? resourcesData.items.filter((item) => item.isActive !== false) : [];
  const professionalOptions = Array.isArray(professionalsData?.items)
    ? professionalsData.items.filter((item) => item.isActive !== false)
    : [];
  const hasResourceSelectionsAvailable = resourceOptions.length > 0 || professionalOptions.length > 0;
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
    Partial<Record<"title" | "startsAt" | "endsAt" | "location" | "resources", string>>
  >({});
  const [errorSummary, setErrorSummary] = useState<{ field: string; message: string }[]>([]);
  const [visibilityUpdates, setVisibilityUpdates] = useState<Record<number, boolean>>({});
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
    publicAccess: true,
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
  const resourcesRef = useRef<HTMLDivElement | null>(null);
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
  const inputClass = (invalid: boolean) =>
    `w-full rounded-md border ${invalid ? "border-amber-400/60 focus:border-amber-300" : "border-white/15 focus:border-white/60"} bg-black/20 px-3 py-2 text-sm outline-none`;
  const locationError = fieldErrors.location ?? null;
  const resourcesError = fieldErrors.resources ?? null;
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

  const applyGeoDetails = (details: GeoDetailsItem | null) => {
    if (!details) {
      setLocationFormattedAddress(null);
      setLocationLat(null);
      setLocationLng(null);
      return;
    }
    const resolvedLabel = details.formattedAddress || details.name || null;
    setLocationFormattedAddress(resolvedLabel);
    setLocationAddressId(details.addressId ?? null);
    if (Number.isFinite(details.lat ?? NaN) && Number.isFinite(details.lng ?? NaN)) {
      setLocationLat(details.lat);
      setLocationLng(details.lng);
    } else {
      setLocationLat(null);
      setLocationLng(null);
    }
    if (resolvedLabel) setLocationQuery(resolvedLabel);
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
    const hasPrivateTickets = ticketList.some(
      (ticket) => (visibilityUpdates[ticket.id] ?? ticket.publicAccess) === false,
    );
    const hasPublicTickets = ticketList.some(
      (ticket) => (visibilityUpdates[ticket.id] ?? ticket.publicAccess) !== false,
    );
    const policyOutOfSync = hasPrivateTickets && !inviteTokenAllowed;

    if (hasPrivateTickets && hasPublicTickets) {
      warnings.push(`Acesso misto: ${ticketLabelPlural} públicos e por convite.`);
    } else if (hasPrivateTickets) {
      warnings.push(`${ticketLabelPluralCap} disponíveis apenas por convite.`);
    }
    if (policyOutOfSync) {
      warnings.push("A política de acesso está desalinhada com os bilhetes. Guarda para sincronizar.");
    }
    return warnings;
  }, [
    inviteTokenAllowed,
    ticketLabelPlural,
    ticketLabelPluralCap,
    ticketList,
    visibilityUpdates,
  ]);

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
          : field === "resources"
            ? (resourcesRef.current?.querySelector("button,input") as HTMLElement | null)
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
        if (consumesResources && selectedResourceIds.length === 0 && selectedProfessionalIds.length === 0) {
          issues.push({ field: "resources", message: "Seleciona pelo menos um recurso ou profissional." });
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
    clearErrorsForFields(step === 0 ? ["title", "location", "resources"] : ["startsAt", "endsAt"]);
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
    if (!consumesResources || selectedResourceIds.length > 0 || selectedProfessionalIds.length > 0) {
      clearErrorsForFields(["resources"]);
    }
  }, [consumesResources, selectedProfessionalIds, selectedResourceIds]);

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
    clearErrorsForFields(["title", "location", "startsAt", "endsAt", "resources"]);

    if (hasPaidTicket && paymentsStatus !== "READY") {
      setStripeAlert(
        `Podes gerir o ${primaryLabel}, mas só vender ${ticketLabelPlural} pagos depois de ligares o Stripe.`,
      );
      setError(`Liga o Stripe em Finanças e transferências para vender ${ticketLabelPlural} pagos.`);
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
      const ticketUpdateMap = new Map<number, { id: number; status?: TicketTypeStatus; publicAccess?: boolean }>();
      endingIds.forEach((id) => {
        const existing = ticketUpdateMap.get(id) ?? { id };
        ticketUpdateMap.set(id, { ...existing, id, status: TicketTypeStatus.CLOSED });
      });
      Object.entries(visibilityUpdates).forEach(([ticketIdRaw, nextPublicAccess]) => {
        const ticketId = Number(ticketIdRaw);
        if (!Number.isFinite(ticketId)) return;
        const current = ticketList.find((ticket) => ticket.id === ticketId);
        if (!current || current.publicAccess === nextPublicAccess) return;
        const existing = ticketUpdateMap.get(ticketId) ?? { id: ticketId };
        ticketUpdateMap.set(ticketId, { ...existing, id: ticketId, publicAccess: nextPublicAccess });
      });
      const ticketTypeUpdates = Array.from(ticketUpdateMap.values());

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
                publicAccess: newTicket.publicAccess,
                totalQuantity: newTicketTotalQuantity,
                startsAt: newTicket.startsAt || null,
                endsAt: newTicket.endsAt || null,
                padelEventCategoryLinkId: newTicket.padelEventCategoryLinkId
                  ? Number(newTicket.padelEventCategoryLinkId)
                  : null,
              },
            ]
          : [];
      const effectiveTicketVisibility = [
        ...ticketList.map((ticket) => (visibilityUpdates[ticket.id] ?? ticket.publicAccess) !== false),
        ...newTicketsPayload.map((ticket) => ticket.publicAccess !== false),
      ];
      const hasPrivateTickets = effectiveTicketVisibility.some((isPublic) => !isPublic);
      const nextMode = "PUBLIC";
      const nextAccessPolicy = {
        mode: nextMode,
        guestCheckoutAllowed: currentAccessPolicy?.guestCheckoutAllowed === true,
        inviteTokenAllowed: hasPrivateTickets,
        inviteIdentityMatch,
        inviteTokenTtlSeconds: hasPrivateTickets
          ? typeof currentAccessPolicy?.inviteTokenTtlSeconds === "number" &&
            Number.isFinite(currentAccessPolicy.inviteTokenTtlSeconds) &&
            currentAccessPolicy.inviteTokenTtlSeconds > 0
            ? currentAccessPolicy.inviteTokenTtlSeconds
            : 60 * 60 * 24 * 7
          : null,
        requiresEntitlementForEntry: currentAccessPolicy?.requiresEntitlementForEntry === true,
        checkinMethods: resolvedCheckinMethods,
      };
      const previousCheckins = [...resolvedCheckinMethods].sort().join("|");
      const nextCheckins = [...nextAccessPolicy.checkinMethods].sort().join("|");
      const policyChanged =
        !currentAccessPolicy ||
        accessMode !== nextAccessPolicy.mode ||
        (currentAccessPolicy?.guestCheckoutAllowed === true) !== nextAccessPolicy.guestCheckoutAllowed ||
        (currentAccessPolicy?.inviteTokenAllowed === true) !== nextAccessPolicy.inviteTokenAllowed ||
        inviteIdentityMatch !== nextAccessPolicy.inviteIdentityMatch ||
        (currentAccessPolicy?.inviteTokenTtlSeconds ?? null) !== nextAccessPolicy.inviteTokenTtlSeconds ||
        (currentAccessPolicy?.requiresEntitlementForEntry === true) !== nextAccessPolicy.requiresEntitlementForEntry ||
        previousCheckins !== nextCheckins;

      const res = await fetch(resolveOrgApiPath("/api/org/[orgId]/events/update"), {
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
          consumesResources,
          resourceIds: selectedResourceIds,
          professionalIds: selectedProfessionalIds,
          isGratis,
          coverImageUrl: coverUrl,
          ticketTypeUpdates,
          newTicketTypes: newTicketsPayload,
          ...(policyChanged ? { accessPolicy: nextAccessPolicy } : {}),
        }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || `Erro ao atualizar ${primaryLabel}.`);
      }

      setMessage(`${primaryLabelTitle} atualizado com sucesso.`);
      pushToast(`${primaryLabelTitle} atualizado com sucesso.`, "success");
      setEndingIds([]);
      setVisibilityUpdates({});
      if (ticketTypeUpdates.length > 0) {
        setTicketList((prev) =>
          prev.map((ticket) => {
            const update = ticketUpdateMap.get(ticket.id);
            if (!update) return ticket;
            return {
              ...ticket,
              ...(update.status ? { status: update.status } : {}),
              ...(typeof update.publicAccess === "boolean" ? { publicAccess: update.publicAccess } : {}),
            };
          }),
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
            publicAccess: newTicketsPayload[0].publicAccess !== false,
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
      if (policyChanged) {
        setCurrentAccessPolicy(nextAccessPolicy);
      }
      setNewTicket({
        name: "",
        description: "",
        priceEuro: "",
        publicAccess: true,
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
      const res = await fetch(resolveOrgApiPath("/api/org/[orgId]/events/update"), {
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
    const selectedLocationLabel = locationFormattedAddress || locationQuery || "Local selecionado";

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

        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 sm:px-5 sm:py-5 space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">Local / Morada</label>
            <p className="text-[11px] text-white/60">
              Escreve pelo menos 2 caracteres e escolhe uma sugestão válida do Apple Maps.
            </p>
          </div>

          <div className="space-y-3">
            <AddressCombobox
              label="Local / Morada"
              value={locationQuery}
              onValueChange={setLocationQuery}
              addressId={locationAddressId}
              onAddressIdChange={setLocationAddressId}
              onDetailsResolved={applyGeoDetails}
              inputRef={locationSearchRef}
              inputClassName={inputClass(Boolean(fieldErrors.location))}
              placeholder="Procura uma morada, rua, cidade ou espaço"
            />

            {(locationAddressId || locationFormattedAddress) && (
              <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-[12px] text-white/75">
                <p className="font-semibold text-white">{selectedLocationLabel}</p>
                <p className="text-[11px] text-white/55">Morada selecionada.</p>
              </div>
            )}

            {typeof locationLat === "number" && typeof locationLng === "number" && (
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
        <div ref={resourcesRef} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 sm:px-5 sm:py-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Consome recursos</label>
              <p className="text-[11px] text-white/60">
                Quando ativo, este evento bloqueia os recursos/profissionais escolhidos no calendário.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setConsumesResources((prev) => !prev)}
              disabled={!hasResourceSelectionsAvailable}
              className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${
                consumesResources
                  ? "border-emerald-300/60 bg-emerald-500/20 text-emerald-50"
                  : "border-white/20 bg-black/20 text-white/75"
              } disabled:opacity-50`}
            >
              {consumesResources ? "Ativo" : "Inativo"}
            </button>
          </div>

          {!hasResourceSelectionsAvailable ? (
            <p className="text-[11px] text-white/60">
              Não existem recursos/profissionais ativos nesta organização.
            </p>
          ) : consumesResources ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <p className="text-[11px] uppercase tracking-wide text-white/60">Profissionais</p>
                <div className="max-h-36 space-y-2 overflow-auto pr-1">
                  {professionalOptions.map((professional) => {
                    const checked = selectedProfessionalIds.includes(professional.id);
                    return (
                      <label
                        key={`pro-${professional.id}`}
                        className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-2 py-1 text-[12px] text-white/80"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) =>
                            setSelectedProfessionalIds((prev) =>
                              toggleSelectionId(prev, professional.id, e.target.checked),
                            )
                          }
                          className="h-4 w-4 rounded border-white/30 bg-black/20"
                        />
                        <span>{professional.name || `Profissional #${professional.id}`}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-[11px] uppercase tracking-wide text-white/60">Recursos</p>
                <div className="max-h-36 space-y-2 overflow-auto pr-1">
                  {resourceOptions.map((resource) => {
                    const checked = selectedResourceIds.includes(resource.id);
                    return (
                      <label
                        key={`res-${resource.id}`}
                        className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-2 py-1 text-[12px] text-white/80"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) =>
                            setSelectedResourceIds((prev) =>
                              toggleSelectionId(prev, resource.id, e.target.checked),
                            )
                          }
                          className="h-4 w-4 rounded border-white/30 bg-black/20"
                        />
                        <span>{resource.label || `Recurso #${resource.id}`}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : null}

          {resourcesError && (
            <p className="flex items-center gap-2 text-xs font-semibold text-amber-100">
              <span aria-hidden>⚠️</span>
              {resourcesError}
            </p>
          )}
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Modelo</label>
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

        <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-white/75">
          Convites por evento foram removidos. Para acesso privado, usa bilhetes com visibilidade &quot;Por convite&quot; e
          emite tokens por bilhete.
        </div>
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
          <Link
            href={
              organizationId
                ? `/org/${organizationId}/analytics?view=buyers&eventId=${event.id}`
                : `/org/analytics?view=buyers&eventId=${event.id}`
            }
            className="text-[11px] text-[#22D3EE]"
          >
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
            const effectivePublicAccess = visibilityUpdates[t.id] ?? t.publicAccess;

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
                      {` • Visibilidade: ${effectivePublicAccess !== false ? "Público" : "Convite"}`}
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
                  <button
                    type="button"
                    onClick={() =>
                      setVisibilityUpdates((prev) => ({
                        ...prev,
                        [t.id]: !(prev[t.id] ?? t.publicAccess),
                      }))
                    }
                    disabled={isEnding}
                    className={`rounded-full px-3 py-1 border ${
                      isEnding
                        ? "border-white/15 text-white/40 cursor-not-allowed"
                        : "border-cyan-300/60 text-cyan-100 hover:bg-cyan-500/10"
                    }`}
                  >
                    {effectivePublicAccess ? "Tornar por convite" : "Tornar público"}
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
            <div className="rounded-md border border-white/15 bg-black/30 px-3 py-2">
              <p className="text-[11px] text-white/70">Visibilidade</p>
              <div className="mt-2 inline-flex rounded-full border border-white/15 bg-black/40 p-1 text-[11px]">
                <button
                  type="button"
                  onClick={() => setNewTicket((p) => ({ ...p, publicAccess: true }))}
                  className={`rounded-full px-3 py-1 font-semibold transition ${
                    newTicket.publicAccess ? "bg-white text-black shadow" : "text-white/70"
                  }`}
                >
                  Público
                </button>
                <button
                  type="button"
                  onClick={() => setNewTicket((p) => ({ ...p, publicAccess: false }))}
                  className={`rounded-full px-3 py-1 font-semibold transition ${
                    !newTicket.publicAccess ? "bg-white text-black shadow" : "text-white/70"
                  }`}
                >
                  Por convite
                </button>
              </div>
            </div>
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
              <OryaDateTimeField
                value={newTicket.startsAt}
                onChange={(next) => setNewTicket((p) => ({ ...p, startsAt: next }))}
                className="mt-1 w-full"
                dateButtonClassName="h-10 flex-1 rounded-xl"
                timeButtonClassName="h-10 rounded-xl"
              />
            </div>
            <div className="text-[11px] text-white/70">
              Fim vendas
              <OryaDateTimeField
                value={newTicket.endsAt}
                onChange={(next) => setNewTicket((p) => ({ ...p, endsAt: next }))}
                minDateTime={newTicket.startsAt || undefined}
                className="mt-1 w-full"
                dateButtonClassName="h-10 flex-1 rounded-xl"
                timeButtonClassName="h-10 rounded-xl"
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
            <div className="rounded-xl border border-white/10 bg-black/20 p-3 space-y-1">
              <p className="text-[11px] uppercase tracking-wide text-white/60">Bloqueio de recursos</p>
              <p className="font-semibold">{consumesResources ? "Ativo" : "Inativo"}</p>
              <p className="text-white/70">
                {consumesResources
                  ? `${selectedProfessionalIds.length} profissionais · ${selectedResourceIds.length} recursos`
                  : "Sem recursos bloqueados"}
              </p>
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
                Define o teu {primaryLabel} passo a passo. Guarda as alterações para manter tudo atualizado.
              </p>
            </div>
            <div className="text-right text-[12px] text-white/60">
              <p>Estado: {isGratis ? "Grátis" : "Pago"}</p>
              <p>Modelo: {templateLabel}</p>
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
                className="absolute left-0 top-0 h-1 rounded-full bg-gradient-to-r from-[#FF00C8] via-[#22D3EE] to-[#1646F5]"
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
                  href={eventDetailHref}
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
