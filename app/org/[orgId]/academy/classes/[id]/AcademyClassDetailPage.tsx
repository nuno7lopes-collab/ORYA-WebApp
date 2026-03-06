"use client";

import { resolveCanonicalOrgApiPath } from "@/lib/canonicalOrgApiPath";

import { useEffect, useMemo, useState } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import { cn } from "@/lib/utils";
import { appendOrganizationIdToHref, parseOrganizationId, parseOrganizationIdFromPathname } from "@/lib/organizationIdUtils";
import { mapPaymentGateUiState, parseApiError } from "@/lib/payments/paymentGateUi";
import { getEventCoverUrl } from "@/lib/eventCover";
import { AddressCombobox } from "@/components/ui/address-combobox";
import { OryaDateField, OryaTimeField } from "@/components/ui/datetime";
import type { GeoDetailsItem } from "@/lib/geo/types";
import { EventCoverCropModal } from "@/app/components/forms/EventCoverCropModal";
import {
  CTA_DANGER,
  CTA_PRIMARY,
  CTA_SECONDARY,
  DASHBOARD_CARD,
  DASHBOARD_LABEL,
  DASHBOARD_MUTED,
} from "@/app/org/_internal/core/dashboardUi";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const DURATION_OPTIONS = [30, 60, 90, 120];
const DAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const CONTROL_BASE =
  "mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-300/70 focus:ring-2 focus:ring-cyan-300/20";
const PANEL_BASE = "rounded-2xl border border-white/10 bg-white/[0.03]";
type SeriesDraftMode = "RECURRING" | "SINGLE";

type Service = {
  id: number;
  policyId?: number | null;
  title: string;
  description: string | null;
  durationMinutes: number;
  unitPriceCents: number;
  currency: string;
  isActive: boolean;
  kind?: string | null;
  categoryTag?: string | null;
  coverImageUrl?: string | null;
  locationMode?: "FIXED" | "CHOOSE_AT_BOOKING" | null;
  addressId?: string | null;
  addressRef?: { formattedAddress?: string | null; canonical?: Record<string, unknown> | null } | null;
  policy?: {
    id: number;
    name: string;
    policyType: string;
    cancellationWindowMinutes: number | null;
  } | null;
  professionalLinks?: Array<{ professionalId: number }>;
  resourceLinks?: Array<{ resourceId: number }>;
};


type PolicyItem = {
  id: number;
  name: string;
  policyType: string;
  cancellationWindowMinutes: number | null;
};

type ProfessionalItem = {
  id: number;
  name: string;
  roleTitle: string | null;
  isActive: boolean;
};

type ResourceItem = {
  id: number;
  label: string;
  capacity: number;
  isActive: boolean;
  sourceType?: "RESOURCE" | "COURT";
  resourceId?: number | null;
  courtId?: number | null;
  clubName?: string | null;
};

type ClassSeriesItem = {
  id: number;
  dayOfWeek: number;
  startMinute: number;
  durationMinutes: number;
  capacity: number;
  validFrom: string;
  validUntil: string | null;
  isActive: boolean;
  professional?: { id: number; name: string } | null;
  court?: { id: number; name: string | null; isActive?: boolean | null } | null;
  _count?: { sessions: number };
};

type ClassSessionItem = {
  id: number;
  startsAt: string;
  endsAt: string;
  capacity: number;
  enrolledCount?: number;
  isFull?: boolean;
  isOverbooked?: boolean;
  status: string;
  professional?: { id: number; name: string } | null;
  court?: { id: number; name: string | null; isActive?: boolean | null } | null;
  series?: { id: number };
};

type LocationMode = "FIXED" | "CHOOSE_AT_BOOKING";

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: (currency || "EUR").toUpperCase(),
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function resolveResourceLinkId(resource: ResourceItem): number | null {
  if (typeof resource.resourceId === "number" && Number.isFinite(resource.resourceId) && resource.resourceId > 0) {
    return resource.resourceId;
  }
  if ((resource.sourceType ?? "RESOURCE") === "RESOURCE") {
    return resource.id;
  }
  return null;
}

function parseDateInput(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [yearRaw, monthRaw, dayRaw] = value.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  const parsed = new Date(year, month - 1, day, 0, 0, 0, 0);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function resolveScheduleScopeLabel(scopeTypeRaw: unknown) {
  const scopeType = typeof scopeTypeRaw === "string" ? scopeTypeRaw.toUpperCase() : "";
  if (scopeType === "PROFESSIONAL") return "treinador";
  if (scopeType === "RESOURCE") return "campo";
  return "agenda geral";
}

function mapSeriesApiErrorToMessage(parsedError: {
  errorCode: string | null;
  message: string;
  details: Record<string, unknown> | null;
}) {
  if (parsedError.errorCode === "CLASS_SLOT_UNAVAILABLE") {
    const date = typeof parsedError.details?.date === "string" ? parsedError.details.date : null;
    const start = typeof parsedError.details?.start === "string" ? parsedError.details.start : null;
    const end = typeof parsedError.details?.end === "string" ? parsedError.details.end : null;
    const scopeLabel = resolveScheduleScopeLabel(parsedError.details?.scopeType);

    if (date && start && end) {
      return `Sem disponibilidade de ${scopeLabel} para ${date} entre ${start} e ${end}.`;
    }
    return `O horário escolhido está fora da disponibilidade de ${scopeLabel}.`;
  }

  return parsedError.message;
}

function rangesOverlap(startsAtA: number, endsAtA: number, startsAtB: number, endsAtB: number) {
  return startsAtA < endsAtB && endsAtA > startsAtB;
}

function formatPreviewDateLabel(value: Date) {
  return new Intl.DateTimeFormat("pt-PT", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function resolveSessionStatusVisual(statusRaw: string | null | undefined) {
  const status = String(statusRaw ?? "").trim().toUpperCase();
  if (status === "SCHEDULED") {
    return { label: "Agendada", className: "border-emerald-300/35 bg-emerald-400/10 text-emerald-100" };
  }
  if (status === "CANCELLED") {
    return { label: "Cancelada", className: "border-red-400/40 bg-red-500/12 text-red-100" };
  }
  if (status === "COMPLETED") {
    return { label: "Concluída", className: "border-cyan-300/35 bg-cyan-400/10 text-cyan-100" };
  }
  return { label: status || "Estado", className: "border-white/15 bg-white/8 text-white/70" };
}


export default function AcademyClassDetailPage() {
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const organizationIdFromQuery = parseOrganizationId(searchParams?.get("organizationId"));
  const organizationIdFromPath = parseOrganizationIdFromPathname(pathname);
  const organizationId = organizationIdFromQuery ?? organizationIdFromPath;
  const idRaw = params?.id;
  const serviceId = useMemo(() => {
    const value = Array.isArray(idRaw) ? idRaw[0] : idRaw;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }, [idRaw]);

  const serviceKey = serviceId
    ? resolveCanonicalOrgApiPath(`/api/org/[orgId]/academy/classes/${serviceId}`)
    : null;
  const classSeriesKey = serviceId
    ? resolveCanonicalOrgApiPath(`/api/org/[orgId]/academy/classes/${serviceId}/series`)
    : null;
  const classSessionsKey = serviceId
    ? resolveCanonicalOrgApiPath(`/api/org/[orgId]/academy/classes/${serviceId}/sessions`)
    : null;

  const { data: serviceData, mutate: mutateService } = useSWR<{ ok: boolean; service: Service }>(
    serviceKey,
    fetcher,
  );
  const { data: policiesData } = useSWR<{ ok: boolean; items: PolicyItem[] }>(
    resolveCanonicalOrgApiPath("/api/org/[orgId]/policies"),
    fetcher,
  );
  const { data: professionalsData } = useSWR<{ ok: boolean; items: ProfessionalItem[] }>(
    resolveCanonicalOrgApiPath("/api/org/[orgId]/academy/trainers"),
    fetcher,
  );
  const { data: resourcesData } = useSWR<{ ok: boolean; items: ResourceItem[] }>(
    resolveCanonicalOrgApiPath("/api/org/[orgId]/academy/resources?includeCourts=1"),
    fetcher,
  );
  const { data: classSeriesData, mutate: mutateClassSeries } = useSWR<{ ok: boolean; items: ClassSeriesItem[] }>(
    classSeriesKey,
    fetcher,
  );
  const { data: classSessionsData, mutate: mutateClassSessions } = useSWR<{ ok: boolean; items: ClassSessionItem[] }>(
    classSessionsKey,
    fetcher,
  );

  const service = serviceData?.service ?? null;
  const classSeries = classSeriesData?.items ?? [];
  const classSessions = classSessionsData?.items ?? [];
  const policies = policiesData?.items ?? [];
  const professionals = professionalsData?.items ?? [];
  const resources = resourcesData?.items ?? [];
  const activeProfessionals = professionals.filter((professional) => professional.isActive);
  const resourceOptions = useMemo(
    () =>
      resources.map((resource) => {
        const linkId = resolveResourceLinkId(resource);
        const isCourt = (resource.sourceType ?? "RESOURCE") === "COURT";
        const scopeLabel = resource.clubName ? `${resource.label} · ${resource.clubName}` : resource.label;
        return {
          ...resource,
          linkId,
          scopeLabel,
          isCourt,
        };
      }),
    [resources],
  );
  const activeResourceOptions = resourceOptions.filter(
    (resource): resource is (typeof resourceOptions)[number] & { linkId: number } =>
      resource.isActive && resource.linkId != null,
  );
  const seriesCourtOptions = useMemo(
    () =>
      resourceOptions
        .filter((resource): resource is (typeof resourceOptions)[number] & { courtId: number } =>
          resource.isCourt && resource.courtId != null,
        )
        .map((resource) => ({
          id: resource.courtId,
          label: resource.scopeLabel,
          isActive: resource.isActive,
        })),
    [resourceOptions],
  );
  const hasUnlinkedCourtOptions = resourceOptions.some((resource) => resource.isCourt && resource.linkId == null);
  const entityLabel = "aula";
  const entityLabelTitle = "Aula";
  const teamHeading = "Treinadores e campos";
  const professionalLabelPlural = "Treinadores";
  const professionalLabelSingular = "Treinador";
  const resourceLabelPlural = "Campos";
  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formDuration, setFormDuration] = useState("60");
  const [formUnitPrice, setFormUnitPrice] = useState("0");
  const [formCurrency, setFormCurrency] = useState("EUR");
  const [formCategoryTag, setFormCategoryTag] = useState("");
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [coverCropFile, setCoverCropFile] = useState<File | null>(null);
  const [showCoverCropModal, setShowCoverCropModal] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [formLocationMode, setFormLocationMode] = useState<LocationMode>("FIXED");
  const [formAddressQuery, setFormAddressQuery] = useState("");
  const [formAddressId, setFormAddressId] = useState<string | null>(null);
  const [formAddressLabel, setFormAddressLabel] = useState<string | null>(null);
  const [formPolicyId, setFormPolicyId] = useState("");
  const [linkedProfessionalIds, setLinkedProfessionalIds] = useState<number[]>([]);
  const [linkedResourceIds, setLinkedResourceIds] = useState<number[]>([]);
  const [serviceSaving, setServiceSaving] = useState(false);
  const [serviceError, setServiceError] = useState<string | null>(null);
  const [serviceErrorCtaHref, setServiceErrorCtaHref] = useState<string | null>(null);
  const [serviceErrorCtaLabel, setServiceErrorCtaLabel] = useState<string | null>(null);


  const [seriesEditingId, setSeriesEditingId] = useState<number | null>(null);
  const [seriesDraftMode, setSeriesDraftMode] = useState<SeriesDraftMode>("RECURRING");
  const [seriesDay, setSeriesDay] = useState("1");
  const [seriesStartTime, setSeriesStartTime] = useState("18:00");
  const [seriesDuration, setSeriesDuration] = useState("60");
  const [seriesCapacity, setSeriesCapacity] = useState("4");
  const [seriesValidFrom, setSeriesValidFrom] = useState("");
  const [seriesValidUntil, setSeriesValidUntil] = useState("");
  const [seriesSingleDate, setSeriesSingleDate] = useState("");
  const [seriesProfessionalId, setSeriesProfessionalId] = useState("");
  const [seriesCourtId, setSeriesCourtId] = useState("");
  const [seriesActive, setSeriesActive] = useState(true);
  const [seriesSaving, setSeriesSaving] = useState(false);
  const [seriesError, setSeriesError] = useState<string | null>(null);
  const seriesDraftSummary = useMemo(() => {
    const modeLabel = seriesDraftMode === "SINGLE" ? "Sessão única" : "Série";
    if (seriesDraftMode === "SINGLE") {
      return `${modeLabel} · ${seriesSingleDate || "--"} · ${seriesStartTime}`;
    }
    return `${modeLabel} · ${DAY_LABELS[Number(seriesDay)] ?? "--"} · ${seriesStartTime}`;
  }, [seriesDay, seriesDraftMode, seriesSingleDate, seriesStartTime]);

  useEffect(() => {
    if (!service) return;
    setFormTitle(service.title ?? "");
    setFormDescription(service.description ?? "");
    setFormDuration(String(service.durationMinutes ?? 60));
    setFormUnitPrice(((service.unitPriceCents ?? 0) / 100).toFixed(2));
    setFormCurrency(service.currency ?? "EUR");
    setFormCategoryTag(service.categoryTag ?? "");
    setCoverUrl(service.coverImageUrl ?? null);
    setFormLocationMode(service.locationMode ?? "FIXED");
    setFormAddressId(service.addressId ?? null);
    setFormAddressLabel(service.addressRef?.formattedAddress ?? null);
    setFormAddressQuery(service.addressRef?.formattedAddress ?? "");
    setFormPolicyId(service.policyId ? String(service.policyId) : "");
    setLinkedProfessionalIds(service.professionalLinks?.map((link) => link.professionalId) ?? []);
    setLinkedResourceIds(service.resourceLinks?.map((link) => link.resourceId) ?? []);
  }, [service]);

  useEffect(() => {
    if (!seriesValidFrom) setSeriesValidFrom(todayIso);
    if (!seriesSingleDate) setSeriesSingleDate(todayIso);
  }, [seriesSingleDate, seriesValidFrom, todayIso]);


  const toggleService = async () => {
    if (!serviceId || !service) return;
    setServiceError(null);
    setServiceErrorCtaHref(null);
    setServiceErrorCtaLabel(null);
    const res = await fetch(resolveCanonicalOrgApiPath(`/api/org/[orgId]/academy/classes/${serviceId}`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !service.isActive }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.ok) {
      const parsedError = parseApiError(json, `Não foi possível atualizar ${entityLabel}.`);
      const uiError = mapPaymentGateUiState({
        organizationId,
        errorCode: parsedError.errorCode,
        message: parsedError.message,
        details: parsedError.details,
      });
      setServiceError(uiError.message);
      setServiceErrorCtaHref(uiError.ctaHref);
      setServiceErrorCtaLabel(uiError.ctaLabel);
      return;
    }
    mutateService();
  };

  const toggleProfessionalLink = (id: number) => {
    setLinkedProfessionalIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const toggleResourceLink = (id: number | null) => {
    if (!id) return;
    setLinkedResourceIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const coverPreviewUrl = useMemo(() => {
    if (!coverUrl) return null;
    return getEventCoverUrl(coverUrl, {
      seed: `service-${serviceId ?? "cover"}`,
      width: 600,
      quality: 72,
      square: true,
    });
  }, [coverUrl, serviceId]);

  const handleCoverUpload = (file: File | null) => {
    if (!file) return;
    setCoverCropFile(file);
    setShowCoverCropModal(true);
  };

  const uploadCoverFile = async (file: File) => {
    setUploadingCover(true);
    setServiceError(null);
    setServiceErrorCtaHref(null);
    setServiceErrorCtaLabel(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      if (!organizationId) {
        throw new Error("Organização inválida.");
      }
      const res = await fetch(`/api/upload?scope=service-cover&organizationId=${organizationId}`, {
        method: "POST",
        body: formData,
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.url) {
        throw new Error(json?.error || "Falha no upload da imagem.");
      }
      setCoverUrl(json.url as string);
    } catch (err) {
      console.error("Erro upload cover", err);
      setServiceError(err instanceof Error ? err.message : "Não foi possível carregar a imagem.");
      setServiceErrorCtaHref(null);
      setServiceErrorCtaLabel(null);
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

  const handleServiceSave = async () => {
    if (!serviceId) return;
    setServiceError(null);
    setServiceErrorCtaHref(null);
    setServiceErrorCtaLabel(null);
    if (formLocationMode === "FIXED" && !formAddressId) {
      setServiceError("Seleciona uma morada Apple Maps.");
      setServiceErrorCtaHref(null);
      setServiceErrorCtaLabel(null);
      return;
    }
    setServiceSaving(true);

    try {
      const res = await fetch(resolveCanonicalOrgApiPath(`/api/org/[orgId]/academy/classes/${serviceId}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formTitle,
          description: formDescription,
          durationMinutes: Number(formDuration),
          unitPriceCents: Math.round(Number(formUnitPrice) * 100),
          currency: formCurrency,
          categoryTag: formCategoryTag.trim() || null,
          coverImageUrl: coverUrl,
          locationMode: formLocationMode,
          addressId: formLocationMode === "FIXED" ? formAddressId : null,
          policyId: formPolicyId ? Number(formPolicyId) : null,
          professionalIds: linkedProfessionalIds,
          resourceIds: linkedResourceIds,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        const parsedError = parseApiError(json, `Erro ao guardar ${entityLabel}.`);
        const uiError = mapPaymentGateUiState({
          organizationId,
          errorCode: parsedError.errorCode,
          message: parsedError.message,
          details: parsedError.details,
        });
        setServiceError(uiError.message);
        setServiceErrorCtaHref(uiError.ctaHref);
        setServiceErrorCtaLabel(uiError.ctaLabel);
        return;
      }
      mutateService();
    } catch (err) {
      setServiceError(err instanceof Error ? err.message : `Erro ao guardar ${entityLabel}.`);
      setServiceErrorCtaHref(null);
      setServiceErrorCtaLabel(null);
    } finally {
      setServiceSaving(false);
    }
  };


  const resetSeriesForm = () => {
    setSeriesEditingId(null);
    setSeriesDraftMode("RECURRING");
    setSeriesDay("1");
    setSeriesStartTime("18:00");
    setSeriesDuration("60");
    setSeriesCapacity("4");
    setSeriesValidFrom(todayIso);
    setSeriesValidUntil("");
    setSeriesSingleDate(todayIso);
    setSeriesProfessionalId("");
    setSeriesCourtId("");
    setSeriesActive(true);
    setSeriesError(null);
  };

  const handleSeriesEdit = (series: ClassSeriesItem) => {
    const hour = Math.floor(series.startMinute / 60);
    const minute = series.startMinute % 60;
    const pad = (value: number) => String(value).padStart(2, "0");
    const validFromDate = series.validFrom?.slice(0, 10) ?? todayIso;
    const validUntilDate = series.validUntil ? series.validUntil.slice(0, 10) : "";
    const isSingleSession = Boolean(validUntilDate && validUntilDate === validFromDate);
    const singleDateDay = parseDateInput(validFromDate)?.getDay();
    setSeriesEditingId(series.id);
    setSeriesDraftMode(isSingleSession ? "SINGLE" : "RECURRING");
    setSeriesDay(String(isSingleSession && Number.isFinite(singleDateDay) ? singleDateDay : series.dayOfWeek));
    setSeriesStartTime(`${pad(hour)}:${pad(minute)}`);
    setSeriesDuration(String(series.durationMinutes));
    setSeriesCapacity(String(series.capacity));
    setSeriesValidFrom(validFromDate);
    setSeriesValidUntil(isSingleSession ? "" : validUntilDate);
    setSeriesSingleDate(validFromDate);
    setSeriesProfessionalId(series.professional?.id ? String(series.professional.id) : "");
    setSeriesCourtId(series.court?.id ? String(series.court.id) : "");
    setSeriesActive(series.isActive);
    setSeriesError(null);
  };

  const handleSeriesSubmit = async () => {
    if (!serviceId) return;
    const [hourStr, minuteStr] = seriesStartTime.split(":");
    const hour = Number(hourStr);
    const minute = Number(minuteStr);
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
      setSeriesError("Hora inválida.");
      return;
    }
    const startMinute = hour * 60 + minute;
    const durationValue = Number(seriesDuration);
    const capacityValue = Number(seriesCapacity);
    if (!Number.isFinite(durationValue) || durationValue <= 0) {
      setSeriesError("Duração inválida.");
      return;
    }
    if (!Number.isFinite(capacityValue) || capacityValue <= 0) {
      setSeriesError("Capacidade inválida.");
      return;
    }

    let dayOfWeekValue: number | null = null;
    let validFromValue: string | null = null;
    let validUntilValue: string | null = null;

    if (seriesDraftMode === "SINGLE") {
      if (!seriesSingleDate) {
        setSeriesError("Seleciona a data da sessão única.");
        return;
      }
      const singleDate = parseDateInput(seriesSingleDate);
      if (!singleDate) {
        setSeriesError("Data da sessão única inválida.");
        return;
      }
      dayOfWeekValue = singleDate.getDay();
      validFromValue = seriesSingleDate;
      validUntilValue = seriesSingleDate;
    } else {
      if (!seriesValidFrom) {
        setSeriesError("Seleciona a data inicial.");
        return;
      }
      const dayOfWeek = Number(seriesDay);
      if (!Number.isFinite(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
        setSeriesError("Seleciona o dia da semana.");
        return;
      }
      if (seriesValidUntil && seriesValidUntil < seriesValidFrom) {
        setSeriesError("A data final não pode ser anterior à inicial.");
        return;
      }
      dayOfWeekValue = dayOfWeek;
      validFromValue = seriesValidFrom;
      validUntilValue = seriesValidUntil || null;
    }

    const professionalValue = seriesProfessionalId ? Number(seriesProfessionalId) : null;
    if (professionalValue != null && (!Number.isFinite(professionalValue) || professionalValue <= 0)) {
      setSeriesError("Treinador inválido.");
      return;
    }
    const courtValue = seriesCourtId ? Number(seriesCourtId) : null;
    if (courtValue != null && (!Number.isFinite(courtValue) || courtValue <= 0)) {
      setSeriesError("Campo inválido.");
      return;
    }
    if (dayOfWeekValue == null || !validFromValue) {
      setSeriesError("Dados de agenda inválidos.");
      return;
    }

    const payload = {
      dayOfWeek: dayOfWeekValue,
      startMinute,
      durationMinutes: durationValue,
      capacity: Math.floor(capacityValue),
      validFrom: validFromValue,
      validUntil: validUntilValue,
      professionalId: professionalValue,
      courtId: courtValue,
      isActive: seriesActive,
    };

    setSeriesSaving(true);
    setSeriesError(null);
    try {
      const url = seriesEditingId
        ? resolveCanonicalOrgApiPath(`/api/org/[orgId]/academy/classes/${serviceId}/series/${seriesEditingId}`)
        : resolveCanonicalOrgApiPath(`/api/org/[orgId]/academy/classes/${serviceId}/series`);
      const res = await fetch(url, {
        method: seriesEditingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        const parsedError = parseApiError(json, "Erro ao guardar série.");
        setSeriesError(mapSeriesApiErrorToMessage(parsedError));
        return;
      }
      mutateClassSeries();
      mutateClassSessions();
      resetSeriesForm();
    } catch (err) {
      setSeriesError(err instanceof Error ? err.message : "Erro ao guardar série.");
    } finally {
      setSeriesSaving(false);
    }
  };

  const handleSeriesToggle = async (series: ClassSeriesItem, next: boolean) => {
    if (!serviceId) return;
    try {
      const res = await fetch(
        resolveCanonicalOrgApiPath(`/api/org/[orgId]/academy/classes/${serviceId}/series/${series.id}`),
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isActive: next }),
        },
      );
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        const parsedError = parseApiError(json, "Erro ao atualizar série.");
        setSeriesError(mapSeriesApiErrorToMessage(parsedError));
        return;
      }
      mutateClassSeries();
      mutateClassSessions();
    } catch (err) {
      setSeriesError(err instanceof Error ? err.message : "Erro ao atualizar série.");
    }
  };

  const draftSchedulePreview = useMemo(() => {
    const [hourRaw, minuteRaw] = seriesStartTime.split(":");
    const hour = Number(hourRaw);
    const minute = Number(minuteRaw);
    const durationValue = Number(seriesDuration);
    if (!Number.isFinite(hour) || !Number.isFinite(minute) || !Number.isFinite(durationValue) || durationValue <= 0) {
      return [];
    }
    const startMinute = hour * 60 + minute;

    if (seriesDraftMode === "SINGLE") {
      const date = parseDateInput(seriesSingleDate);
      if (!date) return [];
      const startsAt = new Date(date.getTime());
      startsAt.setHours(hour, minute, 0, 0);
      return [
        {
          key: `${seriesSingleDate}-${startMinute}`,
          startsAt,
          endsAt: new Date(startsAt.getTime() + durationValue * 60_000),
        },
      ];
    }

    const startDate = parseDateInput(seriesValidFrom);
    if (!startDate) return [];
    const targetDay = Number(seriesDay);
    if (!Number.isFinite(targetDay) || targetDay < 0 || targetDay > 6) return [];
    const validUntil = seriesValidUntil ? parseDateInput(seriesValidUntil) : null;
    if (validUntil && validUntil < startDate) return [];

    const first = new Date(startDate.getTime());
    first.setDate(first.getDate() + ((targetDay - first.getDay() + 7) % 7));
    const previews: Array<{ key: string; startsAt: Date; endsAt: Date }> = [];
    const cursor = new Date(first.getTime());

    while (previews.length < 8) {
      if (validUntil && cursor > validUntil) break;
      const startsAt = new Date(cursor.getTime());
      startsAt.setHours(hour, minute, 0, 0);
      previews.push({
        key: `${startsAt.toISOString()}-${startMinute}`,
        startsAt,
        endsAt: new Date(startsAt.getTime() + durationValue * 60_000),
      });
      cursor.setDate(cursor.getDate() + 7);
    }

    return previews;
  }, [seriesDraftMode, seriesDay, seriesDuration, seriesSingleDate, seriesStartTime, seriesValidFrom, seriesValidUntil]);

  const draftConflictAlerts = useMemo(() => {
    const trainerId = Number(seriesProfessionalId);
    const courtId = Number(seriesCourtId);
    const hasTrainerScope = Number.isFinite(trainerId) && trainerId > 0;
    const hasCourtScope = Number.isFinite(courtId) && courtId > 0;
    if ((!hasTrainerScope && !hasCourtScope) || draftSchedulePreview.length === 0 || classSessions.length === 0) {
      return [];
    }

    const alerts: Array<{ key: string; label: string }> = [];
    draftSchedulePreview.forEach((preview) => {
      const previewStartMs = preview.startsAt.getTime();
      const previewEndMs = preview.endsAt.getTime();
      classSessions.forEach((session) => {
        if (seriesEditingId && session.series?.id === seriesEditingId) return;
        if (String(session.status ?? "").toUpperCase() === "CANCELLED") return;
        const sessionStartMs = new Date(session.startsAt).getTime();
        const sessionEndMs = new Date(session.endsAt).getTime();
        if (!Number.isFinite(sessionStartMs) || !Number.isFinite(sessionEndMs)) return;
        if (!rangesOverlap(previewStartMs, previewEndMs, sessionStartMs, sessionEndMs)) return;

        const trainerConflict = hasTrainerScope && session.professional?.id === trainerId;
        const courtConflict = hasCourtScope && session.court?.id === courtId;
        if (!trainerConflict && !courtConflict) return;

        const scopeLabel = trainerConflict && courtConflict
          ? "treinador e campo"
          : trainerConflict
            ? "treinador"
            : "campo";
        const label = `${formatPreviewDateLabel(preview.startsAt)} · conflito com ${scopeLabel}.`;
        alerts.push({
          key: `${preview.key}-${session.id}-${scopeLabel}`,
          label,
        });
      });
    });

    return alerts.slice(0, 6);
  }, [classSessions, draftSchedulePreview, seriesProfessionalId, seriesCourtId, seriesEditingId]);

  const sessionSummary = useMemo(() => {
    const total = classSessions.length;
    const full = classSessions.filter((session) => session.isFull).length;
    const overbooked = classSessions.filter((session) => session.isOverbooked).length;
    return { total, full, overbooked };
  }, [classSessions]);

  const seriesSummary = useMemo(() => {
    const total = classSeries.length;
    const active = classSeries.filter((series) => series.isActive).length;
    return { total, active };
  }, [classSeries]);

  if (!serviceId) {
    return <div className="text-white/70">Registo inválido.</div>;
  }

  return (
    <>
    <div className="space-y-6">
      <div>
        <p className={DASHBOARD_LABEL}>{entityLabelTitle}</p>
        <h1 className="text-2xl font-semibold text-white">{service?.title || entityLabelTitle}</h1>
        <p className={DASHBOARD_MUTED}>
          {service
            ? `${service.durationMinutes} min · Preço: ${formatMoney(service.unitPriceCents, service.currency)}`
            : "A carregar detalhes..."}
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
          <span className="rounded-full border border-white/15 bg-white/8 px-2 py-0.5 text-white/75">
            Séries {seriesSummary.total}
          </span>
          <span className="rounded-full border border-emerald-300/35 bg-emerald-400/10 px-2 py-0.5 text-emerald-100">
            Ativas {seriesSummary.active}
          </span>
          <span className="rounded-full border border-white/15 bg-white/8 px-2 py-0.5 text-white/75">
            Sessões {sessionSummary.total}
          </span>
          <span className="rounded-full border border-amber-300/35 bg-amber-400/10 px-2 py-0.5 text-amber-100">
            Cheias {sessionSummary.full}
          </span>
        </div>
      </div>

      <section className={cn(DASHBOARD_CARD, "p-5 space-y-4")}> 
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-white">Detalhes</h2>
            <p className={DASHBOARD_MUTED}>Define a {entityLabel} e o preço unitário.</p>
          </div>
          {service && (
            <button type="button" className={CTA_SECONDARY} onClick={toggleService}>
              {service.isActive ? "Desativar" : "Ativar"}
            </button>
          )}
        </div>

        <div>
          <label className="text-sm text-white/80">Título</label>
          <input
            className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
            value={formTitle}
            onChange={(e) => setFormTitle(e.target.value)}
          />
        </div>

        <div>
          <label className="text-sm text-white/80">Descrição</label>
          <textarea
            className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
            rows={3}
            value={formDescription}
            onChange={(e) => setFormDescription(e.target.value)}
          />
        </div>

        <div>
          <label className="text-sm text-white/80">Fotografia da aula</label>
          <div className="mt-2 flex flex-wrap gap-4">
            <div className="relative h-32 w-32 overflow-hidden rounded-2xl border border-white/15 bg-white/5">
              {coverPreviewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={coverPreviewUrl} alt={`Capa da ${entityLabel}`} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[11px] text-white/50">
                  Sem capa
                </div>
              )}
            </div>
            <div className="space-y-2">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-2 text-[12px] text-white/80 hover:bg-white/10">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleCoverUpload(e.target.files?.[0] ?? null)}
                />
                <span>{coverUrl ? "Substituir capa" : "Adicionar capa"}</span>
              </label>
              {coverUrl && (
                <button type="button" className={CTA_SECONDARY} onClick={() => setCoverUrl(null)}>
                  Remover capa
                </button>
              )}
              <p className={DASHBOARD_MUTED}>Imagem quadrada recomendada.</p>
              {uploadingCover && <p className={DASHBOARD_MUTED}>A carregar imagem...</p>}
            </div>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <label className="text-sm text-white/80">Duração (min)</label>
            <select
              className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              value={formDuration}
              onChange={(e) => setFormDuration(e.target.value)}
            >
              {DURATION_OPTIONS.map((value) => (
                <option key={value} value={String(value)}>
                  {value}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm text-white/80">Preço</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              value={formUnitPrice}
              onChange={(e) => setFormUnitPrice(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm text-white/80">Moeda</label>
            <input
              className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              value={formCurrency}
              onChange={(e) => setFormCurrency(e.target.value.toUpperCase())}
            />
          </div>
        </div>

        <div>
          <label className="text-sm text-white/80">Categoria (tag)</label>
          <input
            className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
            value={formCategoryTag}
            onChange={(e) => setFormCategoryTag(e.target.value)}
          />
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="text-sm text-white/80">Modo de localização</label>
            <select
              className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              value={formLocationMode}
              onChange={(e) => {
                const next = e.target.value as LocationMode;
                setFormLocationMode(next);
                if (next !== "FIXED") {
                  setFormAddressId(null);
                  setFormAddressLabel(null);
                  setFormAddressQuery("");
                }
              }}
            >
              <option value="FIXED">Local fixo</option>
              <option value="CHOOSE_AT_BOOKING">Escolher na marcação</option>
            </select>
          </div>
          {formLocationMode === "FIXED" && (
            <div>
              <AddressCombobox
                label="Morada (Apple Maps)"
                className="mt-1"
                value={formAddressQuery}
                onValueChange={(next) => {
                  setFormAddressQuery(next);
                  if (!next.trim()) {
                    setFormAddressLabel(null);
                  }
                }}
                addressId={formAddressId}
                onAddressIdChange={(next) => {
                  setFormAddressId(next);
                  if (!next) {
                    setFormAddressLabel(null);
                  }
                }}
                onDetailsResolved={(details: GeoDetailsItem | null) => {
                  if (!details?.addressId) {
                    setFormAddressLabel(null);
                    return;
                  }
                  setFormAddressLabel(details.formattedAddress?.trim() || details.address?.trim() || null);
                }}
                minChars={2}
                maxItems={10}
                enableRecents
                enableGeolocationCta
              />
              {formAddressId && (
                <div className="mt-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-[12px] text-white/70">
                  Morada confirmada: {formAddressLabel || formAddressQuery}
                </div>
              )}
            </div>
          )}
        </div>

        <div>
          <label className="text-sm text-white/80">Política de cancelamento</label>
          <select
            className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
            value={formPolicyId}
            onChange={(event) => setFormPolicyId(event.target.value)}
          >
            <option value="">Usar política default</option>
            {policies.map((policy) => (
              <option key={policy.id} value={String(policy.id)}>
                {policy.name}
              </option>
            ))}
          </select>
        </div>

        {serviceError && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">
            <p>{serviceError}</p>
            {serviceErrorCtaHref && serviceErrorCtaLabel ? (
              <button
                type="button"
                onClick={() => router.push(serviceErrorCtaHref)}
                className="mt-3 rounded-full border border-red-200/50 bg-red-200/15 px-3 py-1.5 text-xs font-semibold text-red-50 transition hover:bg-red-200/25"
              >
                {serviceErrorCtaLabel}
              </button>
            ) : null}
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <button type="button" className={CTA_PRIMARY} onClick={handleServiceSave} disabled={serviceSaving}>
            {serviceSaving ? "A guardar..." : "Guardar alterações"}
          </button>
          <button
            type="button"
            className={CTA_SECONDARY}
            onClick={() => router.push(appendOrganizationIdToHref("/org/academy/classes", organizationId))}
          >
            Voltar
          </button>
        </div>
      </section>

      <section className={cn(DASHBOARD_CARD, "p-5 space-y-4")}>
        <div>
          <h2 className="text-base font-semibold text-white">{teamHeading}</h2>
          <p className={DASHBOARD_MUTED}>
            Define quem pode executar esta {entityLabel}. Se não selecionares ninguém, usa todos os ativos.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-white/80">{professionalLabelPlural}</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="rounded-full border border-white/15 px-3 py-1 text-[11px] text-white/70"
                  onClick={() => setLinkedProfessionalIds(activeProfessionals.map((item) => item.id))}
                >
                  Todos
                </button>
                <button
                  type="button"
                  className="rounded-full border border-white/15 px-3 py-1 text-[11px] text-white/70"
                  onClick={() => setLinkedProfessionalIds([])}
                >
                  Limpar
                </button>
              </div>
            </div>
            {activeProfessionals.length === 0 ? (
              <p className="text-[12px] text-white/50">Sem {professionalLabelPlural.toLowerCase()} ativos.</p>
            ) : (
              <div className="space-y-2">
                {activeProfessionals.map((professional) => (
                  <label
                    key={professional.id}
                    className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80"
                  >
                    <span>{professional.name}</span>
                    <input
                      type="checkbox"
                      checked={linkedProfessionalIds.includes(professional.id)}
                      onChange={() => toggleProfessionalLink(professional.id)}
                    />
                  </label>
                ))}
              </div>
            )}
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-white/80">{resourceLabelPlural}</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="rounded-full border border-white/15 px-3 py-1 text-[11px] text-white/70"
                  onClick={() => setLinkedResourceIds(activeResourceOptions.map((item) => item.linkId))}
                >
                  Todos
                </button>
                <button
                  type="button"
                  className="rounded-full border border-white/15 px-3 py-1 text-[11px] text-white/70"
                  onClick={() => setLinkedResourceIds([])}
                >
                  Limpar
                </button>
              </div>
            </div>
            {activeResourceOptions.length === 0 ? (
              <p className="text-[12px] text-white/50">Sem {resourceLabelPlural.toLowerCase()} ativos.</p>
            ) : (
              <div className="space-y-2">
                {activeResourceOptions.map((resource) => (
                  <label
                    key={`${resource.sourceType ?? "RESOURCE"}-${resource.id}`}
                    className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80"
                  >
                    <span>
                      {resource.scopeLabel} · {resource.capacity}
                    </span>
                    <input
                      type="checkbox"
                      checked={linkedResourceIds.includes(resource.linkId)}
                      onChange={() => toggleResourceLink(resource.linkId)}
                    />
                  </label>
                ))}
              </div>
            )}
            {hasUnlinkedCourtOptions ? (
              <p className="text-[11px] text-white/45">
                Alguns campos ainda não têm recurso associado em Reservas e não podem ser ligados aqui.
              </p>
            ) : null}
          </div>
        </div>
      </section>


      {service?.kind === "CLASS" && (
        <section className={cn(DASHBOARD_CARD, "p-5 space-y-4")}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-white">Agenda</h2>
              <p className={DASHBOARD_MUTED}>{seriesDraftSummary}</p>
            </div>
            {seriesEditingId && (
              <button type="button" className={CTA_SECONDARY} onClick={resetSeriesForm}>
                Cancelar edição
              </button>
            )}
          </div>

          <div className="grid gap-2 md:grid-cols-2">
            <button
              type="button"
              onClick={() => setSeriesDraftMode("RECURRING")}
              className={cn(
                "rounded-xl border px-3 py-2 text-left transition",
                seriesDraftMode === "RECURRING"
                  ? "border-cyan-300/60 bg-cyan-300/10 text-white"
                  : "border-white/12 bg-white/[0.04] text-white/70 hover:border-white/35",
              )}
            >
              <p className="text-sm font-semibold">Série recorrente</p>
              <p className="text-[11px] text-white/55">Semanal</p>
            </button>
            <button
              type="button"
              onClick={() => setSeriesDraftMode("SINGLE")}
              className={cn(
                "rounded-xl border px-3 py-2 text-left transition",
                seriesDraftMode === "SINGLE"
                  ? "border-cyan-300/60 bg-cyan-300/10 text-white"
                  : "border-white/12 bg-white/[0.04] text-white/70 hover:border-white/35",
              )}
            >
              <p className="text-sm font-semibold">Sessão única</p>
              <p className="text-[11px] text-white/55">Data</p>
            </button>
          </div>

          <div className={cn(PANEL_BASE, "grid gap-3 p-3 md:grid-cols-2 lg:grid-cols-4")}>
            <label className="text-[12px] text-white/70">
              Hora
              <OryaTimeField
                value={seriesStartTime}
                onChange={setSeriesStartTime}
                stepMinutes={15}
                className="mt-1 w-full"
                buttonClassName="h-10 rounded-xl border border-white/15 bg-white/5 text-white transition hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-cyan-300/20"
              />
            </label>
            <label className="text-[12px] text-white/70">
              Duração
              <select
                className={CONTROL_BASE}
                value={seriesDuration}
                onChange={(e) => setSeriesDuration(e.target.value)}
              >
                {DURATION_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt} min
                  </option>
                ))}
              </select>
            </label>
            <label className="text-[12px] text-white/70">
              Capacidade
              <input
                type="number"
                min="1"
                className={CONTROL_BASE}
                value={seriesCapacity}
                onChange={(e) => setSeriesCapacity(e.target.value)}
              />
            </label>
            <label className="text-[12px] text-white/70">
              {professionalLabelSingular}
              <select
                className={CONTROL_BASE}
                value={seriesProfessionalId}
                onChange={(e) => setSeriesProfessionalId(e.target.value)}
              >
                <option value="">{`Sem ${professionalLabelSingular.toLowerCase()}`}</option>
                {activeProfessionals.map((professional) => (
                  <option key={professional.id} value={professional.id}>
                    {professional.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className={cn(PANEL_BASE, "grid gap-3 p-3 md:grid-cols-2 lg:grid-cols-4")}>
            {seriesDraftMode === "RECURRING" ? (
              <>
                <label className="text-[12px] text-white/70">
                  Dia
                  <select
                    className={CONTROL_BASE}
                    value={seriesDay}
                    onChange={(e) => setSeriesDay(e.target.value)}
                  >
                    {DAY_LABELS.map((label, idx) => (
                      <option key={label} value={idx}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-[12px] text-white/70">
                  Desde
                  <OryaDateField
                    value={seriesValidFrom}
                    onChange={setSeriesValidFrom}
                    className="mt-1 w-full"
                    buttonClassName="h-10 rounded-xl border border-white/15 bg-white/5 text-white transition hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-cyan-300/20"
                  />
                </label>
                <label className="text-[12px] text-white/70">
                  Até
                  <OryaDateField
                    value={seriesValidUntil}
                    onChange={setSeriesValidUntil}
                    minDate={seriesValidFrom || undefined}
                    className="mt-1 w-full"
                    buttonClassName="h-10 rounded-xl border border-white/15 bg-white/5 text-white transition hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-cyan-300/20"
                  />
                </label>
              </>
            ) : (
              <label className="text-[12px] text-white/70">
                Data
                <OryaDateField
                  value={seriesSingleDate}
                  onChange={setSeriesSingleDate}
                  minDate={todayIso}
                  className="mt-1 w-full"
                  buttonClassName="h-10 rounded-xl border border-white/15 bg-white/5 text-white transition hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-cyan-300/20"
                />
              </label>
            )}
            <label className="text-[12px] text-white/70">
              Campo
              <select
                className={CONTROL_BASE}
                value={seriesCourtId}
                onChange={(e) => setSeriesCourtId(e.target.value)}
                disabled={seriesCourtOptions.length === 0}
              >
                <option value="">Sem campo</option>
                {seriesCourtOptions.map((court) => (
                  <option key={court.id} value={court.id}>
                    {court.label || `Campo ${court.id}`}{court.isActive ? "" : " (inativo)"}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="inline-flex items-center gap-2 text-[12px] text-white/70">
            <input
              type="checkbox"
              checked={seriesActive}
              onChange={(e) => setSeriesActive(e.target.checked)}
            />
            Ativa
          </label>

          {seriesError && (
            <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">
              {seriesError}
            </div>
          )}
          {!seriesError && draftConflictAlerts.length > 0 && (
            <div className="rounded-xl border border-amber-300/45 bg-amber-500/12 px-3 py-2">
              <p className="text-[12px] font-semibold text-amber-100">Conflitos detetados na pré-visualização</p>
              <ul className="mt-1 space-y-1 text-[11px] text-amber-100/85">
                {draftConflictAlerts.map((alert) => (
                  <li key={alert.key}>{alert.label}</li>
                ))}
              </ul>
            </div>
          )}
          {draftSchedulePreview.length > 0 && (
            <div className="rounded-xl border border-white/12 bg-white/[0.04] px-3 py-2">
              <p className="text-[12px] font-semibold text-white/85">Pré-visualização</p>
              <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
                {draftSchedulePreview.slice(0, 8).map((preview) => (
                  <span key={preview.key} className="rounded-full border border-white/15 bg-white/8 px-2 py-0.5 text-white/70">
                    {formatPreviewDateLabel(preview.startsAt)}
                  </span>
                ))}
              </div>
            </div>
          )}

          <button type="button" className={CTA_PRIMARY} onClick={handleSeriesSubmit} disabled={seriesSaving}>
            {seriesSaving
              ? "A guardar..."
              : seriesEditingId
                ? "Guardar agenda"
                : seriesDraftMode === "SINGLE"
                  ? "Criar sessão"
                  : "Criar série"}
          </button>

          <div className="space-y-3">
            {classSeries.length === 0 && (
              <p className="text-[12px] text-white/60">Sem agenda criada.</p>
            )}
            {classSeries.map((series) => {
              const hour = Math.floor(series.startMinute / 60);
              const minute = series.startMinute % 60;
              const pad = (value: number) => String(value).padStart(2, "0");
              const isSingleSession =
                Boolean(series.validUntil) && series.validUntil?.slice(0, 10) === series.validFrom.slice(0, 10);
              return (
                <div key={series.id} className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {DAY_LABELS[series.dayOfWeek]} · {pad(hour)}:{pad(minute)} · {series.durationMinutes} min
                      </p>
                      <p className="mt-1 text-[11px] text-white/50">
                        {isSingleSession
                          ? `Sessão única: ${series.validFrom.slice(0, 10)}`
                          : `Válido: ${series.validFrom.slice(0, 10)}${series.validUntil ? ` → ${series.validUntil.slice(0, 10)}` : ""}`}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <span className="rounded-full border border-white/15 bg-white/8 px-2 py-0.5 text-[10px] text-white/75">
                          Capacidade {series.capacity}
                        </span>
                        <span className="rounded-full border border-white/15 bg-white/8 px-2 py-0.5 text-[10px] text-white/75">
                          Sessões {series._count?.sessions ?? 0}
                        </span>
                        {series.professional?.name ? (
                          <span className="rounded-full border border-cyan-300/35 bg-cyan-400/10 px-2 py-0.5 text-[10px] text-cyan-100">
                            {series.professional.name}
                          </span>
                        ) : null}
                        {series.court?.name ? (
                          <span className="rounded-full border border-violet-300/35 bg-violet-400/10 px-2 py-0.5 text-[10px] text-violet-100">
                            {series.court.name}{series.court.isActive === false ? " (inativo)" : ""}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-white/60">
                      <span
                        className={cn(
                          "rounded-full border px-2 py-0.5",
                          series.isActive
                            ? "border-emerald-300/35 bg-emerald-400/10 text-emerald-100"
                            : "border-white/20 bg-white/8 text-white/65",
                        )}
                      >
                        {series.isActive ? "Ativa" : "Inativa"}
                      </span>
                      <button
                        type="button"
                        className={CTA_SECONDARY}
                        onClick={() => handleSeriesEdit(series)}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className={CTA_DANGER}
                        onClick={() => handleSeriesToggle(series, !series.isActive)}
                      >
                        {series.isActive ? "Desativar" : "Reativar"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[12px] text-white/60">Próximas sessões</p>
              <div className="flex flex-wrap gap-1.5 text-[10px]">
                <span className="rounded-full border border-white/15 bg-white/8 px-2 py-0.5 text-white/75">
                  {sessionSummary.total} sessões
                </span>
                <span className="rounded-full border border-amber-300/35 bg-amber-400/10 px-2 py-0.5 text-amber-100">
                  {sessionSummary.full} cheias
                </span>
                {sessionSummary.overbooked > 0 ? (
                  <span className="rounded-full border border-red-400/40 bg-red-500/12 px-2 py-0.5 text-red-100">
                    {sessionSummary.overbooked} sobrelotadas
                  </span>
                ) : null}
              </div>
            </div>
            {classSessions.length === 0 ? (
              <p className="text-[12px] text-white/50">Sem sessões futuras.</p>
            ) : (
              <div className="space-y-2">
                {classSessions.slice(0, 10).map((session) => {
                  const statusVisual = resolveSessionStatusVisual(session.status);
                  const enrolledCount = session.enrolledCount ?? 0;
                  const safeCapacity = Math.max(1, session.capacity);
                  const occupancyRatio = Math.min(1, enrolledCount / safeCapacity);
                  return (
                    <div key={session.id} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-[12px] font-semibold text-white">
                          {new Date(session.startsAt).toLocaleString("pt-PT", { dateStyle: "medium", timeStyle: "short" })}
                        </p>
                        <div className="flex flex-wrap gap-1.5 text-[10px]">
                          <span className="rounded-full border border-white/15 bg-white/8 px-2 py-0.5 text-white/75">
                            {enrolledCount}/{session.capacity}
                          </span>
                          {session.isFull ? (
                            <span className="rounded-full border border-amber-300/35 bg-amber-400/10 px-2 py-0.5 text-amber-100">
                              Cheia
                            </span>
                          ) : null}
                          {session.isOverbooked ? (
                            <span className="rounded-full border border-red-400/40 bg-red-500/12 px-2 py-0.5 text-red-100">
                              Sobrelotada
                            </span>
                          ) : null}
                          <span className={cn("rounded-full border px-2 py-0.5", statusVisual.className)}>
                            {statusVisual.label}
                          </span>
                        </div>
                      </div>
                      <div className="mt-2">
                        <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                          <div
                            className={cn(
                              "h-full rounded-full",
                              session.isOverbooked
                                ? "bg-red-400"
                                : session.isFull
                                  ? "bg-amber-300"
                                  : "bg-cyan-300",
                            )}
                            style={{
                              width:
                                enrolledCount <= 0
                                  ? "0%"
                                  : `${Math.max(6, Math.round(occupancyRatio * 100))}%`,
                            }}
                          />
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
                        {session.professional?.name ? (
                          <span className="rounded-full border border-cyan-300/35 bg-cyan-400/10 px-2 py-0.5 text-cyan-100">
                            {session.professional.name}
                          </span>
                        ) : null}
                        {session.court?.name ? (
                          <span className="rounded-full border border-violet-300/35 bg-violet-400/10 px-2 py-0.5 text-violet-100">
                            {session.court.name}{session.court.isActive === false ? " (inativo)" : ""}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      )}

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
