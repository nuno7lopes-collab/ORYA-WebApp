"use client";

import { resolveCanonicalOrgApiPath } from "@/lib/canonicalOrgApiPath";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import { cn } from "@/lib/utils";
import { appendOrganizationIdToHref, parseOrganizationId, parseOrganizationIdFromPathname } from "@/lib/organizationIdUtils";
import { mapPaymentGateUiState, parseApiError } from "@/lib/payments/paymentGateUi";
import { getEventCoverUrl } from "@/lib/eventCover";
import { EventCoverCropModal } from "@/app/components/forms/EventCoverCropModal";
import { OryaDateField, OryaTimeField } from "@/components/ui/datetime";
import {
  CTA_PRIMARY,
  CTA_SECONDARY,
  DASHBOARD_CARD,
  DASHBOARD_LABEL,
  DASHBOARD_MUTED,
} from "@/app/org/_internal/core/dashboardUi";

type LocationMode = "FIXED" | "CHOOSE_AT_BOOKING";
type CreationKind = "CLASS";
type ScheduleMode = "NONE" | "SINGLE" | "RECURRING";

type ProfessionalItem = {
  id: number;
  name: string;
  isActive: boolean;
};

type ResourceItem = {
  id: number;
  label: string;
  isActive: boolean;
  sourceType?: "RESOURCE" | "COURT";
  resourceId?: number | null;
  courtId?: number | null;
  clubName?: string | null;
};

type PreviewSession = {
  key: string;
  startsAt: Date;
  endsAt: Date;
};

const fetcher = (url: string) => fetch(url).then((res) => res.json());
const DEFAULT_DURATION_MINUTES = 60;
const DEFAULT_CURRENCY = "EUR";
const DEFAULT_LOCATION_MODE: LocationMode = "FIXED";
const DURATION_OPTIONS = [30, 60, 90, 120];
const DAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];
const CONTROL_BASE =
  "w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white outline-none transition focus:border-cyan-300/70 focus:ring-2 focus:ring-cyan-300/20";
const PANEL_BASE = "rounded-2xl border border-white/10 bg-white/[0.03]";

const WIZARD_STEPS = [
  {
    id: "details",
    title: "Detalhes",
    subtitle: "Nome, preço e duração",
  },
  {
    id: "team",
    title: "Equipa",
    subtitle: "Treinador, campo e foto",
  },
  {
    id: "schedule",
    title: "Agenda",
    subtitle: "Única ou recorrente",
  },
  {
    id: "review",
    title: "Revisão",
    subtitle: "Confirmar e criar",
  },
] as const;

function resolveResourceLinkId(resource: ResourceItem): number | null {
  if (typeof resource.resourceId === "number" && Number.isFinite(resource.resourceId) && resource.resourceId > 0) {
    return resource.resourceId;
  }
  if ((resource.sourceType ?? "RESOURCE") === "RESOURCE") {
    return resource.id;
  }
  return null;
}

function toDateInputValue(source: Date) {
  const year = source.getFullYear();
  const month = String(source.getMonth() + 1).padStart(2, "0");
  const day = String(source.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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

function parseTimeInputToMinute(value: string) {
  const match = value.match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return hour * 60 + minute;
}

function buildLocalDateTime(dateInput: string, startMinute: number) {
  const date = parseDateInput(dateInput);
  if (!date) return null;
  const hours = Math.floor(startMinute / 60);
  const minutes = startMinute % 60;
  date.setHours(hours, minutes, 0, 0);
  return date;
}

function addMinutes(base: Date, minutes: number) {
  return new Date(base.getTime() + minutes * 60_000);
}

function formatSessionLabel(session: PreviewSession) {
  return new Intl.DateTimeFormat("pt-PT", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(session.startsAt);
}

function resolveScheduleScopeLabel(scopeTypeRaw: unknown) {
  const scopeType = typeof scopeTypeRaw === "string" ? scopeTypeRaw.toUpperCase() : "";
  if (scopeType === "PROFESSIONAL") return "treinador";
  if (scopeType === "RESOURCE") return "campo";
  return "agenda geral";
}

function mapSeriesApiErrorToMessage(parsedError: { errorCode: string | null; message: string; details: Record<string, unknown> | null }) {
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

export default function ClassCreationWizard() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const organizationIdFromQuery = parseOrganizationId(searchParams?.get("organizationId"));
  const organizationIdFromPath = parseOrganizationIdFromPathname(pathname);
  const organizationId = organizationIdFromQuery ?? organizationIdFromPath;
  const creationKind: CreationKind = "CLASS";
  const today = useMemo(() => toDateInputValue(new Date()), []);

  const [currentStep, setCurrentStep] = useState(0);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [unitPrice, setUnitPrice] = useState("20");
  const [durationMinutes, setDurationMinutes] = useState(String(DEFAULT_DURATION_MINUTES));
  const [selectedProfessionalId, setSelectedProfessionalId] = useState("");
  const [selectedResourceId, setSelectedResourceId] = useState("");

  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>("RECURRING");
  const [scheduleStartTime, setScheduleStartTime] = useState("18:00");
  const [scheduleCapacity, setScheduleCapacity] = useState("4");
  const [singleDate, setSingleDate] = useState(today);
  const [recurringDay, setRecurringDay] = useState(String(new Date().getDay()));
  const [recurringValidFrom, setRecurringValidFrom] = useState(today);
  const [recurringValidUntil, setRecurringValidUntil] = useState("");
  const [seriesProfessionalId, setSeriesProfessionalId] = useState("");
  const [seriesCourtId, setSeriesCourtId] = useState("");
  const [seriesProfessionalTouched, setSeriesProfessionalTouched] = useState(false);
  const [seriesCourtTouched, setSeriesCourtTouched] = useState(false);

  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [coverCropFile, setCoverCropFile] = useState<File | null>(null);
  const [showCoverCropModal, setShowCoverCropModal] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCtaHref, setErrorCtaHref] = useState<string | null>(null);
  const [errorCtaLabel, setErrorCtaLabel] = useState<string | null>(null);

  const { data: professionalsData } = useSWR<{ ok: boolean; items: ProfessionalItem[] }>(
    resolveCanonicalOrgApiPath("/api/org/[orgId]/academy/trainers"),
    fetcher,
  );
  const { data: resourcesData } = useSWR<{ ok: boolean; items: ResourceItem[] }>(
    resolveCanonicalOrgApiPath("/api/org/[orgId]/academy/resources?includeCourts=1"),
    fetcher,
  );

  const activeProfessionals = (professionalsData?.items ?? []).filter((item) => item.isActive);

  const linkedCourtOptions = useMemo(
    () =>
      (resourcesData?.items ?? [])
        .filter((resource) => (resource.sourceType ?? "RESOURCE") === "COURT" && resource.isActive)
        .map((resource) => {
          const linkId = resolveResourceLinkId(resource);
          return {
            id: resource.id,
            linkId,
            courtId: typeof resource.courtId === "number" ? resource.courtId : null,
            labelText: resource.clubName ? `${resource.label} · ${resource.clubName}` : resource.label,
          };
        })
        .filter((resource): resource is { id: number; linkId: number; courtId: number | null; labelText: string } =>
          resource.linkId != null,
        ),
    [resourcesData?.items],
  );

  const scheduleCourtOptions = useMemo(
    () =>
      (resourcesData?.items ?? [])
        .filter((resource) => (resource.sourceType ?? "RESOURCE") === "COURT" && resource.isActive)
        .map((resource) => ({
          courtId: typeof resource.courtId === "number" ? resource.courtId : null,
          labelText: resource.clubName ? `${resource.label} · ${resource.clubName}` : resource.label,
        }))
        .filter((resource): resource is { courtId: number; labelText: string } => resource.courtId != null),
    [resourcesData?.items],
  );

  const fallbackCourtIdFromLinkedResource = useMemo(() => {
    if (!selectedResourceId) return null;
    const linkId = Number(selectedResourceId);
    if (!Number.isFinite(linkId) || linkId <= 0) return null;
    const selectedOption = linkedCourtOptions.find((resource) => resource.linkId === linkId);
    if (!selectedOption?.courtId) return null;
    return selectedOption.courtId;
  }, [linkedCourtOptions, selectedResourceId]);

  useEffect(() => {
    if (seriesProfessionalTouched) return;
    setSeriesProfessionalId(selectedProfessionalId);
  }, [selectedProfessionalId, seriesProfessionalTouched]);

  useEffect(() => {
    if (seriesCourtTouched) return;
    setSeriesCourtId(fallbackCourtIdFromLinkedResource ? String(fallbackCourtIdFromLinkedResource) : "");
  }, [fallbackCourtIdFromLinkedResource, seriesCourtTouched]);

  const coverPreviewUrl = useMemo(() => {
    if (!coverUrl) return null;
    return getEventCoverUrl(coverUrl, {
      seed: "new-class-cover",
      width: 700,
      quality: 72,
      square: true,
    });
  }, [coverUrl]);

  const schedulePreview = useMemo<PreviewSession[]>(() => {
    const durationValue = Number(durationMinutes);
    const startMinute = parseTimeInputToMinute(scheduleStartTime);
    if (!DURATION_OPTIONS.includes(durationValue) || startMinute == null) return [];

    if (scheduleMode === "NONE") return [];

    if (scheduleMode === "SINGLE") {
      const startsAt = buildLocalDateTime(singleDate, startMinute);
      if (!startsAt) return [];
      return [
        {
          key: `${singleDate}-${startMinute}`,
          startsAt,
          endsAt: addMinutes(startsAt, durationValue),
        },
      ];
    }

    const recurringStartDate = parseDateInput(recurringValidFrom);
    if (!recurringStartDate) return [];

    const targetDay = Number(recurringDay);
    if (!Number.isFinite(targetDay) || targetDay < 0 || targetDay > 6) return [];

    const effectiveStartDate = parseDateInput(today) ?? recurringStartDate;
    if (effectiveStartDate.getTime() > recurringStartDate.getTime()) {
      recurringStartDate.setTime(effectiveStartDate.getTime());
    }

    const validUntil = recurringValidUntil ? parseDateInput(recurringValidUntil) : null;
    if (validUntil && validUntil.getTime() < recurringStartDate.getTime()) return [];

    const first = new Date(recurringStartDate.getTime());
    const dayDelta = (targetDay - first.getDay() + 7) % 7;
    first.setDate(first.getDate() + dayDelta);

    const items: PreviewSession[] = [];
    const cursor = new Date(first.getTime());

    while (items.length < 8) {
      if (validUntil && cursor.getTime() > validUntil.getTime()) break;
      const startsAt = buildLocalDateTime(toDateInputValue(cursor), startMinute);
      if (!startsAt) break;
      items.push({
        key: `${toDateInputValue(cursor)}-${startMinute}`,
        startsAt,
        endsAt: addMinutes(startsAt, durationValue),
      });
      cursor.setDate(cursor.getDate() + 7);
    }

    return items;
  }, [durationMinutes, recurringDay, recurringValidFrom, recurringValidUntil, scheduleMode, scheduleStartTime, singleDate, today]);

  const recurringEstimatedSessions = useMemo(() => {
    if (scheduleMode !== "RECURRING") return null;
    if (!recurringValidUntil) return null;

    const startDate = parseDateInput(recurringValidFrom);
    const endDate = parseDateInput(recurringValidUntil);
    const dayOfWeek = Number(recurringDay);
    if (!startDate || !endDate || endDate < startDate || dayOfWeek < 0 || dayOfWeek > 6) return null;

    const first = new Date(startDate.getTime());
    first.setDate(first.getDate() + ((dayOfWeek - first.getDay() + 7) % 7));
    if (first > endDate) return 0;

    let count = 0;
    const cursor = new Date(first.getTime());
    while (cursor <= endDate && count <= 300) {
      count += 1;
      cursor.setDate(cursor.getDate() + 7);
    }
    return count;
  }, [recurringDay, recurringValidFrom, recurringValidUntil, scheduleMode]);

  const entityLabel = "aula";

  const resetError = () => {
    setError(null);
    setErrorCtaHref(null);
    setErrorCtaLabel(null);
  };

  const handleCoverUpload = (file: File | null) => {
    if (!file) return;
    setCoverCropFile(file);
    setShowCoverCropModal(true);
  };

  const uploadCoverFile = async (file: File) => {
    setUploadingCover(true);
    resetError();

    try {
      const formData = new FormData();
      formData.append("file", file);
      if (!organizationId) throw new Error("Organização inválida.");

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
      setError(err instanceof Error ? err.message : "Não foi possível carregar a imagem.");
      setErrorCtaHref(null);
      setErrorCtaLabel(null);
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

  const validateDetailsStep = () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError(`Indica o título da ${entityLabel}.`);
      return false;
    }

    const durationValue = Number(durationMinutes);
    if (!DURATION_OPTIONS.includes(durationValue)) {
      setError("Seleciona a duração.");
      return false;
    }

    const unitPriceValue = Number(unitPrice.replace(",", "."));
    if (!Number.isFinite(unitPriceValue) || unitPriceValue < 0) {
      setError("Preço inválido.");
      return false;
    }

    return true;
  };

  const validateTeamStep = () => {
    if (!selectedProfessionalId && !selectedResourceId && !coverUrl) {
      return true;
    }

    if (selectedProfessionalId) {
      const professionalIdValue = Number(selectedProfessionalId);
      if (!Number.isFinite(professionalIdValue) || professionalIdValue <= 0) {
        setError("Treinador inválido.");
        return false;
      }
    }

    if (selectedResourceId) {
      const resourceIdValue = Number(selectedResourceId);
      if (!Number.isFinite(resourceIdValue) || resourceIdValue <= 0) {
        setError("Campo inválido.");
        return false;
      }
    }

    return true;
  };

  const validateScheduleStep = () => {
    if (scheduleMode === "NONE") return true;

    const startMinute = parseTimeInputToMinute(scheduleStartTime);
    if (startMinute == null) {
      setError("Hora inválida.");
      return false;
    }

    const capacityValue = Number(scheduleCapacity);
    if (!Number.isFinite(capacityValue) || Math.floor(capacityValue) <= 0) {
      setError("Capacidade inválida.");
      return false;
    }

    if (seriesProfessionalId) {
      const professionalIdValue = Number(seriesProfessionalId);
      if (!Number.isFinite(professionalIdValue) || professionalIdValue <= 0) {
        setError("Treinador da agenda inválido.");
        return false;
      }
    }

    if (seriesCourtId) {
      const courtIdValue = Number(seriesCourtId);
      if (!Number.isFinite(courtIdValue) || courtIdValue <= 0) {
        setError("Campo da agenda inválido.");
        return false;
      }
    }

    if (scheduleMode === "SINGLE") {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(singleDate)) {
        setError("Data da aula única inválida.");
        return false;
      }
      if (singleDate < today) {
        setError("A aula única deve ser marcada para hoje ou para uma data futura.");
        return false;
      }
      return true;
    }

    const dayValue = Number(recurringDay);
    if (!Number.isFinite(dayValue) || dayValue < 0 || dayValue > 6) {
      setError("Dia da semana inválido.");
      return false;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(recurringValidFrom)) {
      setError("Data inicial inválida.");
      return false;
    }

    if (recurringValidUntil) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(recurringValidUntil)) {
        setError("Data final inválida.");
        return false;
      }
      if (recurringValidUntil < recurringValidFrom) {
        setError("A data final não pode ser anterior à data inicial.");
        return false;
      }
    }

    return true;
  };

  const validateStepByIndex = (stepIndex: number) => {
    resetError();

    if (stepIndex === 0) return validateDetailsStep();
    if (stepIndex === 1) return validateTeamStep();
    if (stepIndex === 2) return validateScheduleStep();
    return validateDetailsStep() && validateTeamStep() && validateScheduleStep();
  };

  const canMoveToStep = (nextStep: number) => {
    if (nextStep <= currentStep) return true;

    let pointer = currentStep;
    while (pointer < nextStep) {
      if (!validateStepByIndex(pointer)) return false;
      pointer += 1;
    }
    return true;
  };

  const handleStepChange = (nextStep: number) => {
    if (nextStep < 0 || nextStep >= WIZARD_STEPS.length) return;
    if (!canMoveToStep(nextStep)) return;
    setCurrentStep(nextStep);
  };

  const handleNextStep = () => {
    if (!validateStepByIndex(currentStep)) return;
    setCurrentStep((prev) => Math.min(prev + 1, WIZARD_STEPS.length - 1));
  };

  const resolveSchedulePayload = () => {
    if (scheduleMode === "NONE") return null;

    const durationValue = Number(durationMinutes);
    const capacityValue = Math.floor(Number(scheduleCapacity));
    const startMinute = parseTimeInputToMinute(scheduleStartTime);
    if (!DURATION_OPTIONS.includes(durationValue) || !Number.isFinite(capacityValue) || capacityValue <= 0 || startMinute == null) {
      return null;
    }

    const professionalIdValue = seriesProfessionalId
      ? Number(seriesProfessionalId)
      : selectedProfessionalId
        ? Number(selectedProfessionalId)
        : null;
    const derivedCourtId = seriesCourtId
      ? Number(seriesCourtId)
      : fallbackCourtIdFromLinkedResource
        ? Number(fallbackCourtIdFromLinkedResource)
        : null;

    const professionalId = Number.isFinite(professionalIdValue ?? NaN) && (professionalIdValue ?? 0) > 0
      ? Math.trunc(professionalIdValue as number)
      : null;
    const courtId = Number.isFinite(derivedCourtId ?? NaN) && (derivedCourtId ?? 0) > 0 ? Math.trunc(derivedCourtId as number) : null;

    if (scheduleMode === "SINGLE") {
      const dayOfWeek = parseDateInput(singleDate)?.getDay();
      if (!Number.isFinite(dayOfWeek)) return null;
      return {
        dayOfWeek,
        startMinute,
        durationMinutes: durationValue,
        capacity: capacityValue,
        validFrom: singleDate,
        validUntil: singleDate,
        professionalId,
        courtId,
        isActive: true,
      };
    }

    const recurringDayValue = Number(recurringDay);
    if (!Number.isFinite(recurringDayValue) || recurringDayValue < 0 || recurringDayValue > 6) return null;

    return {
      dayOfWeek: recurringDayValue,
      startMinute,
      durationMinutes: durationValue,
      capacity: capacityValue,
      validFrom: recurringValidFrom,
      validUntil: recurringValidUntil || null,
      professionalId,
      courtId,
      isActive: true,
    };
  };

  const handleSubmit = async () => {
    if (!validateDetailsStep() || !validateTeamStep() || !validateScheduleStep()) {
      return;
    }

    const trimmedTitle = title.trim();
    const durationValue = Number(durationMinutes);
    const unitPriceValue = Number(unitPrice.replace(",", "."));

    const professionalIdValue = selectedProfessionalId ? Number(selectedProfessionalId) : null;
    const resourceIdValue = selectedResourceId ? Number(selectedResourceId) : null;
    const assignmentMode = resourceIdValue ? "PROFESSIONAL_AND_RESOURCE" : "PROFESSIONAL_ONLY";

    setSaving(true);
    resetError();

    let createdClassId: number | null = null;

    try {
      const res = await fetch(resolveCanonicalOrgApiPath("/api/org/[orgId]/academy/classes"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: trimmedTitle,
          description,
          durationMinutes: durationValue,
          unitPriceCents: Math.round(unitPriceValue * 100),
          currency: DEFAULT_CURRENCY,
          categoryTag: null,
          locationMode: DEFAULT_LOCATION_MODE,
          kind: creationKind,
          coverImageUrl: coverUrl,
          assignmentMode,
          professionalIds: professionalIdValue ? [professionalIdValue] : [],
          resourceIds: resourceIdValue ? [resourceIdValue] : [],
        }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        const parsedError = parseApiError(json, `Erro ao criar ${entityLabel}.`);
        const uiError = mapPaymentGateUiState({
          organizationId,
          errorCode: parsedError.errorCode,
          message: parsedError.message,
          details: parsedError.details,
        });
        setError(uiError.message);
        setErrorCtaHref(uiError.ctaHref);
        setErrorCtaLabel(uiError.ctaLabel);
        return;
      }

      createdClassId =
        typeof json?.service?.id === "number"
          ? json.service.id
          : typeof json?.class?.id === "number"
            ? json.class.id
            : null;

      if (!createdClassId) {
        throw new Error("Resposta inválida ao criar aula.");
      }

      if (scheduleMode !== "NONE") {
        const schedulePayload = resolveSchedulePayload();
        if (!schedulePayload) {
          throw new Error("Agenda inválida. Revê os dados do wizard.");
        }

        const seriesRes = await fetch(
          resolveCanonicalOrgApiPath(`/api/org/[orgId]/academy/classes/${createdClassId}/series`),
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(schedulePayload),
          },
        );
        const seriesJson = await seriesRes.json().catch(() => null);

        if (!seriesRes.ok || !seriesJson?.ok) {
          const parsedSeriesError = parseApiError(seriesJson, "Erro ao criar agenda da aula.");

          await fetch(resolveCanonicalOrgApiPath(`/api/org/[orgId]/academy/classes/${createdClassId}`), {
            method: "DELETE",
          }).catch(() => null);

          setError(mapSeriesApiErrorToMessage(parsedSeriesError));
          setErrorCtaHref(null);
          setErrorCtaLabel(null);
          return;
        }
      }

      const detailHref = appendOrganizationIdToHref(`/org/academy/classes/${createdClassId}`, organizationId);
      router.push(detailHref);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Erro ao criar ${entityLabel}.`);
      setErrorCtaHref(null);
      setErrorCtaLabel(null);
    } finally {
      setSaving(false);
    }
  };

  const pricePreview = useMemo(() => {
    const value = Number(unitPrice.replace(",", "."));
    if (!Number.isFinite(value)) return "0,00 €";
    return new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(value);
  }, [unitPrice]);

  const selectedProfessionalName = useMemo(() => {
    if (!selectedProfessionalId) return "Sem treinador";
    return activeProfessionals.find((item) => item.id === Number(selectedProfessionalId))?.name ?? "Sem treinador";
  }, [activeProfessionals, selectedProfessionalId]);

  const selectedResourceLabel = useMemo(() => {
    if (!selectedResourceId) return "Sem campo";
    return linkedCourtOptions.find((item) => item.linkId === Number(selectedResourceId))?.labelText ?? "Sem campo";
  }, [linkedCourtOptions, selectedResourceId]);

  const scheduleModeLabel = useMemo(() => {
    if (scheduleMode === "NONE") return "Sem agenda";
    if (scheduleMode === "SINGLE") return "Aula única";
    return "Aula recorrente";
  }, [scheduleMode]);

  const currentStepMeta = WIZARD_STEPS[currentStep];
  const progressValue = Math.round(((currentStep + 1) / WIZARD_STEPS.length) * 100);
  const isLastStep = currentStep === WIZARD_STEPS.length - 1;

  return (
    <>
      <div className="space-y-5">
        <div className="space-y-2">
          <p className={DASHBOARD_LABEL}>Academia</p>
          <h1 className="text-3xl font-semibold text-white">Nova aula</h1>
          <p className={DASHBOARD_MUTED}>Aula única e recorrente no mesmo fluxo.</p>
        </div>

        <section className={cn(DASHBOARD_CARD, "overflow-hidden p-0")}>
          <div className="relative border-b border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.2),transparent_50%),linear-gradient(145deg,rgba(7,20,38,0.95),rgba(5,12,26,0.95))] px-5 py-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.2em] text-white/55">Passo {currentStep + 1} de {WIZARD_STEPS.length}</p>
                <p className="text-sm font-semibold text-white">{currentStepMeta.title}</p>
              </div>
              <p className="text-[11px] text-white/60">{progressValue}%</p>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-cyan-300 transition-all duration-300"
                style={{ width: `${progressValue}%` }}
              />
            </div>

            <div className="mt-4 grid gap-2 md:grid-cols-4">
              {WIZARD_STEPS.map((step, index) => {
                const isDone = index < currentStep;
                const isActive = index === currentStep;
                return (
                  <button
                    key={step.id}
                    type="button"
                    onClick={() => handleStepChange(index)}
                    className={cn(
                      "group rounded-xl border px-3 py-2 text-left transition",
                      isActive
                        ? "border-cyan-300/60 bg-cyan-300/10"
                        : "border-white/12 bg-white/[0.04] hover:border-white/30",
                    )}
                  >
                    <p className={cn("text-sm font-semibold", isActive ? "text-white" : "text-white/85")}>{step.title}</p>
                    <p className="text-[11px] text-white/55">{isDone ? "Feito" : step.subtitle}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-5 p-5 xl:grid-cols-[minmax(0,1fr)_300px]">
            <div className="space-y-5">
              {currentStep === 0 && (
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="space-y-1.5 text-sm text-white/80">
                      <span>Título</span>
                      <input
                        className={CONTROL_BASE}
                        value={title}
                        onChange={(event) => setTitle(event.target.value)}
                        placeholder="Ex: Aula de iniciação"
                      />
                    </label>
                    <label className="space-y-1.5 text-sm text-white/80">
                      <span>Duração</span>
                      <select
                        className={CONTROL_BASE}
                        value={durationMinutes}
                        onChange={(event) => setDurationMinutes(event.target.value)}
                      >
                        {DURATION_OPTIONS.map((option) => (
                          <option key={option} value={String(option)}>
                            {option} min
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="space-y-1.5 text-sm text-white/80">
                      <span>Preço</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        inputMode="decimal"
                        className={CONTROL_BASE}
                        value={unitPrice}
                        onChange={(event) => setUnitPrice(event.target.value)}
                      />
                    </label>
                    <label className="space-y-1.5 text-sm text-white/80">
                      <span>Moeda</span>
                      <div className={cn(CONTROL_BASE, "border-white/10 text-white/75")}>
                        {DEFAULT_CURRENCY}
                      </div>
                    </label>
                  </div>

                  <label className="space-y-1.5 text-sm text-white/80">
                    <span>Descrição</span>
                    <textarea
                      className={CONTROL_BASE}
                      rows={4}
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      placeholder="Opcional"
                    />
                  </label>
                </div>
              )}

              {currentStep === 1 && (
                <div className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="space-y-1.5 text-sm text-white/80">
                      <span>Treinador</span>
                      <select
                        className={CONTROL_BASE}
                        value={selectedProfessionalId}
                        onChange={(event) => setSelectedProfessionalId(event.target.value)}
                      >
                        <option value="">Sem treinador</option>
                        {activeProfessionals.map((professional) => (
                          <option key={professional.id} value={String(professional.id)}>
                            {professional.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="space-y-1.5 text-sm text-white/80">
                      <span>Campo</span>
                      <select
                        className={CONTROL_BASE}
                        value={selectedResourceId}
                        onChange={(event) => {
                          setSelectedResourceId(event.target.value);
                          if (!seriesCourtTouched) {
                            const resourceId = Number(event.target.value);
                            const selectedOption = linkedCourtOptions.find((option) => option.linkId === resourceId);
                            setSeriesCourtId(selectedOption?.courtId ? String(selectedOption.courtId) : "");
                          }
                        }}
                      >
                        <option value="">Sem campo</option>
                        {linkedCourtOptions.map((resource) => (
                          <option key={resource.id} value={String(resource.linkId)}>
                            {resource.labelText}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className={cn(PANEL_BASE, "p-3")}>
                    <p className="text-[12px] text-white/70">Imagem</p>
                    <div className="mt-2 flex flex-wrap gap-3">
                      <div className="relative h-28 w-28 overflow-hidden rounded-xl border border-white/15 bg-white/5">
                        {coverPreviewUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={coverPreviewUrl} alt={`Capa da ${entityLabel}`} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[11px] text-white/45">Sem imagem</div>
                        )}
                      </div>
                      <div className="flex flex-col items-start gap-2">
                        <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-[12px] text-white/85 hover:bg-white/10">
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(event) => handleCoverUpload(event.target.files?.[0] ?? null)}
                          />
                          <span>{coverUrl ? "Substituir" : "Adicionar"}</span>
                        </label>
                        {coverUrl ? (
                          <button type="button" className={CTA_SECONDARY} onClick={() => setCoverUrl(null)}>
                            Remover
                          </button>
                        ) : null}
                        {uploadingCover ? <p className="text-[11px] text-white/55">A carregar...</p> : null}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {currentStep === 2 && (
                <div className="space-y-4">
                  <div className="grid gap-2 md:grid-cols-3">
                    {[
                      {
                        id: "SINGLE",
                        title: "Aula única",
                        subtitle: "Data definida",
                      },
                      {
                        id: "RECURRING",
                        title: "Aula recorrente",
                        subtitle: "Semanal",
                      },
                      {
                        id: "NONE",
                        title: "Sem agenda",
                        subtitle: "Só serviço",
                      },
                    ].map((option) => {
                      const isSelected = scheduleMode === option.id;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => setScheduleMode(option.id as ScheduleMode)}
                          className={cn(
                            "rounded-xl border px-3 py-2.5 text-left transition",
                            isSelected
                              ? "border-cyan-300/60 bg-cyan-300/10"
                              : "border-white/12 bg-white/[0.04] hover:border-white/30",
                          )}
                        >
                          <p className="text-sm font-semibold text-white">{option.title}</p>
                          <p className="text-[11px] text-white/55">{option.subtitle}</p>
                        </button>
                      );
                    })}
                  </div>

                  {scheduleMode !== "NONE" && (
                    <div className={cn(PANEL_BASE, "space-y-4 p-3")}>
                      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                        <label className="text-[12px] text-white/70">
                          Hora
                          <OryaTimeField
                            value={scheduleStartTime}
                            onChange={setScheduleStartTime}
                            stepMinutes={15}
                            className="mt-1 w-full"
                            buttonClassName="h-10 rounded-xl border border-white/15 bg-white/5 text-white transition hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-cyan-300/20"
                          />
                        </label>

                        <label className="text-[12px] text-white/70">
                          Capacidade
                          <input
                            type="number"
                            min="1"
                            className={cn(CONTROL_BASE, "mt-1 py-2")}
                            value={scheduleCapacity}
                            onChange={(event) => setScheduleCapacity(event.target.value)}
                          />
                        </label>

                        <label className="text-[12px] text-white/70">
                          Treinador
                          <select
                            className={cn(CONTROL_BASE, "mt-1 py-2")}
                            value={seriesProfessionalId}
                            onChange={(event) => {
                              setSeriesProfessionalTouched(true);
                              setSeriesProfessionalId(event.target.value);
                            }}
                          >
                            <option value="">Sem treinador fixo</option>
                            {activeProfessionals.map((professional) => (
                              <option key={professional.id} value={professional.id}>
                                {professional.name}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="text-[12px] text-white/70">
                          Campo
                          <select
                            className={cn(CONTROL_BASE, "mt-1 py-2")}
                            value={seriesCourtId}
                            onChange={(event) => {
                              setSeriesCourtTouched(true);
                              setSeriesCourtId(event.target.value);
                            }}
                          >
                            <option value="">Sem campo fixo</option>
                            {scheduleCourtOptions.map((court) => (
                              <option key={court.courtId} value={court.courtId}>
                                {court.labelText}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>

                      {scheduleMode === "SINGLE" ? (
                        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                          <label className="text-[12px] text-white/70">
                            Data
                            <OryaDateField
                              value={singleDate}
                              onChange={setSingleDate}
                              minDate={today}
                              className="mt-1 w-full"
                              buttonClassName="h-10 rounded-xl border border-white/15 bg-white/5 text-white transition hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-cyan-300/20"
                            />
                          </label>
                        </div>
                      ) : (
                        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                          <label className="text-[12px] text-white/70">
                            Dia
                            <select
                              className={cn(CONTROL_BASE, "mt-1 py-2")}
                              value={recurringDay}
                              onChange={(event) => setRecurringDay(event.target.value)}
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
                              value={recurringValidFrom}
                              onChange={setRecurringValidFrom}
                              className="mt-1 w-full"
                              buttonClassName="h-10 rounded-xl border border-white/15 bg-white/5 text-white transition hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-cyan-300/20"
                            />
                          </label>

                          <label className="text-[12px] text-white/70">
                            Até
                            <OryaDateField
                              value={recurringValidUntil}
                              onChange={setRecurringValidUntil}
                              minDate={recurringValidFrom || undefined}
                              className="mt-1 w-full"
                              buttonClassName="h-10 rounded-xl border border-white/15 bg-white/5 text-white transition hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-cyan-300/20"
                            />
                          </label>

                          <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white/80">
                            <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Sessões</p>
                            <p className="mt-1 font-semibold text-white">
                              {recurringEstimatedSessions == null
                                ? "Sem fim"
                                : `${recurringEstimatedSessions} sessão${recurringEstimatedSessions === 1 ? "" : "ões"}`}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className={cn(PANEL_BASE, "p-4")}>
                    <p className="text-[11px] uppercase tracking-[0.2em] text-white/55">Prévia</p>
                    {scheduleMode === "NONE" ? (
                      <p className="mt-2 text-sm text-white/65">Sem sessões automáticas.</p>
                    ) : schedulePreview.length === 0 ? (
                      <p className="mt-2 text-sm text-white/65">Preenche agenda para visualizar.</p>
                    ) : (
                      <div className="mt-3 space-y-2">
                        {schedulePreview.map((session) => (
                          <div key={session.key} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[12px] text-white/75">
                            <p className="font-semibold text-white">{formatSessionLabel(session)}</p>
                            <p>
                              Fim às{" "}
                              {new Intl.DateTimeFormat("pt-PT", { timeStyle: "short" }).format(session.endsAt)}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {currentStep === 3 ? (
                <div className="space-y-3">
                  <div className="rounded-2xl border border-emerald-300/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                    Tudo pronto.
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className={cn(PANEL_BASE, "p-4")}>
                      <p className="text-[11px] uppercase tracking-[0.2em] text-white/55">Aula</p>
                      <p className="mt-2 text-base font-semibold text-white">{title || "Sem título"}</p>
                      <p className="text-[12px] text-white/65">{durationMinutes} min · {pricePreview}</p>
                    </div>
                    <div className={cn(PANEL_BASE, "p-4")}>
                      <p className="text-[11px] uppercase tracking-[0.2em] text-white/55">Agenda</p>
                      <p className="mt-2 text-sm font-semibold text-white">{scheduleModeLabel}</p>
                      {scheduleMode !== "NONE" ? (
                        <p className="text-[12px] text-white/65">
                          {scheduleMode === "SINGLE"
                            ? `${singleDate} · ${scheduleStartTime}`
                            : `${DAY_LABELS[Number(recurringDay)]} · ${scheduleStartTime}`}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : null}

              {error ? (
                <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">
                  <p>{error}</p>
                  {errorCtaHref && errorCtaLabel ? (
                    <button
                      type="button"
                      onClick={() => router.push(errorCtaHref)}
                      className="mt-3 rounded-full border border-red-200/50 bg-red-200/15 px-3 py-1.5 text-xs font-semibold text-red-50 transition hover:bg-red-200/25"
                    >
                      {errorCtaLabel}
                    </button>
                  ) : null}
                </div>
              ) : null}

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
                <button
                  type="button"
                  className={CTA_SECONDARY}
                  onClick={() => {
                    if (currentStep === 0) {
                      router.push(appendOrganizationIdToHref("/org/academy/classes", organizationId));
                      return;
                    }
                    handleStepChange(currentStep - 1);
                  }}
                >
                  {currentStep === 0 ? "Cancelar" : "Voltar"}
                </button>

                {!isLastStep ? (
                  <button type="button" className={CTA_PRIMARY} onClick={handleNextStep}>
                    Seguinte
                  </button>
                ) : (
                  <button type="button" className={CTA_PRIMARY} onClick={handleSubmit} disabled={saving}>
                    {saving ? "A criar..." : "Criar aula"}
                  </button>
                )}
              </div>
            </div>

            <aside className="space-y-3 xl:sticky xl:top-4 xl:self-start">
              <div className={cn(PANEL_BASE, "p-4")}>
                <p className="text-[11px] uppercase tracking-[0.2em] text-white/50">Resumo</p>
                <p className="mt-2 text-base font-semibold text-white">{title.trim() || "Nova aula"}</p>
                <div className="mt-3 space-y-2 text-[12px]">
                  <p className="flex items-center justify-between gap-3 text-white/70">
                    <span>Duração</span>
                    <span className="text-white">{durationMinutes} min</span>
                  </p>
                  <p className="flex items-center justify-between gap-3 text-white/70">
                    <span>Preço</span>
                    <span className="text-white">{pricePreview}</span>
                  </p>
                  <p className="flex items-center justify-between gap-3 text-white/70">
                    <span>Treinador</span>
                    <span className="text-white">{selectedProfessionalName}</span>
                  </p>
                  <p className="flex items-center justify-between gap-3 text-white/70">
                    <span>Campo</span>
                    <span className="text-white">{selectedResourceLabel}</span>
                  </p>
                  <p className="flex items-center justify-between gap-3 text-white/70">
                    <span>Agenda</span>
                    <span className="text-white">{scheduleModeLabel}</span>
                  </p>
                </div>
              </div>

              {scheduleMode !== "NONE" ? (
                <div className={cn(PANEL_BASE, "p-4")}>
                  <p className="text-[11px] uppercase tracking-[0.2em] text-white/50">Próximas sessões</p>
                  {schedulePreview.length === 0 ? (
                    <p className="mt-2 text-[12px] text-white/65">Sem sessões.</p>
                  ) : (
                    <div className="mt-2 space-y-2">
                      {schedulePreview.slice(0, 4).map((session) => (
                        <div key={session.key} className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-2 text-[11px] text-white/75">
                          {formatSessionLabel(session)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
            </aside>
          </div>
        </section>
      </div>

      {showCoverCropModal && coverCropFile ? (
        <EventCoverCropModal
          open={showCoverCropModal}
          file={coverCropFile}
          onCancel={handleCoverCropCancel}
          onConfirm={handleCoverCropConfirm}
        />
      ) : null}
    </>
  );
}
