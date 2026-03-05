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

export default function NovaAulaPage() {
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

  const isLastStep = currentStep === WIZARD_STEPS.length - 1;

  return (
    <>
      <div className="space-y-6">
        <div className="space-y-3">
          <p className={DASHBOARD_LABEL}>Academia</p>
          <h1 className="text-3xl font-semibold text-white">Novo wizard de aula</h1>
          <p className={DASHBOARD_MUTED}>
            Num único fluxo: cria a aula, define equipa e configura agenda única ou recorrente.
          </p>
        </div>

        <section className={cn(DASHBOARD_CARD, "overflow-hidden p-0")}> 
          <div className="relative border-b border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.24),transparent_45%),linear-gradient(135deg,rgba(8,24,45,0.92),rgba(4,10,24,0.92))] px-5 py-4">
            <div className="grid gap-2 md:grid-cols-4">
              {WIZARD_STEPS.map((step, index) => {
                const isDone = index < currentStep;
                const isActive = index === currentStep;
                return (
                  <button
                    key={step.id}
                    type="button"
                    onClick={() => handleStepChange(index)}
                    className={cn(
                      "group rounded-2xl border px-3 py-2 text-left transition",
                      isActive
                        ? "border-cyan-300/60 bg-cyan-300/10 shadow-[0_0_0_1px_rgba(167,243,255,0.25)]"
                        : "border-white/12 bg-white/[0.04] hover:border-white/30",
                    )}
                  >
                    <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">
                      {isDone ? "Concluído" : `Passo ${index + 1}`}
                    </p>
                    <p className={cn("text-sm font-semibold", isActive ? "text-white" : "text-white/82")}>{step.title}</p>
                    <p className="text-[11px] text-white/55">{step.subtitle}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-4 p-5">
            {currentStep === 0 && (
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-sm text-white/80">Título</label>
                    <input
                      className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300/70"
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                      placeholder="Ex: Aula de iniciação"
                    />
                  </div>

                  <div>
                    <label className="text-sm text-white/80">Duração</label>
                    <select
                      className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300/70"
                      value={durationMinutes}
                      onChange={(event) => setDurationMinutes(event.target.value)}
                    >
                      {DURATION_OPTIONS.map((option) => (
                        <option key={option} value={String(option)}>
                          {option} min
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-sm text-white/80">Preço</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300/70"
                      value={unitPrice}
                      onChange={(event) => setUnitPrice(event.target.value)}
                    />
                    <p className="text-[11px] text-white/50">Usa 0 para gratuito.</p>
                  </div>

                  <div>
                    <label className="text-sm text-white/80">Moeda</label>
                    <div className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/75">
                      {DEFAULT_CURRENCY}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-sm text-white/80">Descrição</label>
                  <textarea
                    className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300/70"
                    rows={4}
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Resumo (opcional)"
                  />
                </div>
              </div>
            )}

            {currentStep === 1 && (
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="text-sm text-white/80">Treinador principal (opcional)</label>
                    <select
                      className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300/70"
                      value={selectedProfessionalId}
                      onChange={(event) => setSelectedProfessionalId(event.target.value)}
                    >
                      <option value="">Sem treinador definido</option>
                      {activeProfessionals.map((professional) => (
                        <option key={professional.id} value={String(professional.id)}>
                          {professional.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-sm text-white/80">Campo principal (opcional)</label>
                    <select
                      className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300/70"
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
                      <option value="">Sem campo definido</option>
                      {linkedCourtOptions.map((resource) => (
                        <option key={resource.id} value={String(resource.linkId)}>
                          {resource.labelText}
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] text-white/45">Campo ligado ao serviço e usado como predefinição da agenda.</p>
                  </div>
                </div>

                <div>
                  <label className="text-sm text-white/80">Fotografia</label>
                  <div className="mt-2 flex flex-wrap gap-4">
                    <div className="relative h-32 w-32 overflow-hidden rounded-2xl border border-white/15 bg-white/5">
                      {coverPreviewUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={coverPreviewUrl} alt={`Capa da ${entityLabel}`} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[11px] text-white/50">Sem foto</div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-2 text-[12px] text-white/80 hover:bg-white/10">
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(event) => handleCoverUpload(event.target.files?.[0] ?? null)}
                        />
                        <span>{coverUrl ? "Substituir foto" : "Adicionar foto"}</span>
                      </label>
                      {coverUrl && (
                        <button type="button" className={CTA_SECONDARY} onClick={() => setCoverUrl(null)}>
                          Remover foto
                        </button>
                      )}
                      <p className={DASHBOARD_MUTED}>Imagem quadrada recomendada.</p>
                      {uploadingCover && <p className={DASHBOARD_MUTED}>A carregar imagem...</p>}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {currentStep === 2 && (
              <div className="space-y-5">
                <div className="grid gap-3 md:grid-cols-3">
                  {[
                    {
                      id: "SINGLE",
                      title: "Aula única",
                      subtitle: "Uma sessão específica",
                    },
                    {
                      id: "RECURRING",
                      title: "Aula recorrente",
                      subtitle: "Série semanal automática",
                    },
                    {
                      id: "NONE",
                      title: "Sem agenda",
                      subtitle: "Criar serviço e agendar depois",
                    },
                  ].map((option) => {
                    const isSelected = scheduleMode === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setScheduleMode(option.id as ScheduleMode)}
                        className={cn(
                          "rounded-2xl border px-4 py-3 text-left transition",
                          isSelected
                            ? "border-cyan-300/60 bg-cyan-300/10 shadow-[0_0_0_1px_rgba(167,243,255,0.3)]"
                            : "border-white/12 bg-white/[0.04] hover:border-white/30",
                        )}
                      >
                        <p className="text-sm font-semibold text-white">{option.title}</p>
                        <p className="text-[12px] text-white/60">{option.subtitle}</p>
                      </button>
                    );
                  })}
                </div>

                {scheduleMode !== "NONE" && (
                  <div className="space-y-4">
                    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                      <label className="text-[12px] text-white/70">
                        Hora de início
                        <OryaTimeField
                          value={scheduleStartTime}
                          onChange={setScheduleStartTime}
                          stepMinutes={15}
                          className="mt-1 w-full"
                          buttonClassName="h-10 rounded-xl"
                        />
                      </label>

                      <label className="text-[12px] text-white/70">
                        Capacidade
                        <input
                          type="number"
                          min="1"
                          className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300/70"
                          value={scheduleCapacity}
                          onChange={(event) => setScheduleCapacity(event.target.value)}
                        />
                      </label>

                      <label className="text-[12px] text-white/70">
                        Treinador da agenda
                        <select
                          className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300/70"
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
                        Campo da agenda
                        <select
                          className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300/70"
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
                          Data da aula única
                          <OryaDateField
                            value={singleDate}
                            onChange={setSingleDate}
                            minDate={today}
                            className="mt-1 w-full"
                            buttonClassName="h-10 rounded-xl"
                          />
                        </label>
                      </div>
                    ) : (
                      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                        <label className="text-[12px] text-white/70">
                          Dia da semana
                          <select
                            className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300/70"
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
                          Válido desde
                          <OryaDateField
                            value={recurringValidFrom}
                            onChange={setRecurringValidFrom}
                            className="mt-1 w-full"
                            buttonClassName="h-10 rounded-xl"
                          />
                        </label>

                        <label className="text-[12px] text-white/70">
                          Válido até
                          <OryaDateField
                            value={recurringValidUntil}
                            onChange={setRecurringValidUntil}
                            minDate={recurringValidFrom || undefined}
                            className="mt-1 w-full"
                            buttonClassName="h-10 rounded-xl"
                          />
                        </label>

                        <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white/80">
                          <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Estimativa</p>
                          <p className="mt-1 font-semibold text-white">
                            {recurringEstimatedSessions == null
                              ? "Sem fim definido"
                              : `${recurringEstimatedSessions} sessão${recurringEstimatedSessions === 1 ? "" : "ões"}`}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <p className="text-[12px] uppercase tracking-[0.2em] text-white/55">Pré-visualização da agenda</p>
                  {scheduleMode === "NONE" ? (
                    <p className="mt-2 text-sm text-white/65">A aula será criada sem sessões automáticas.</p>
                  ) : schedulePreview.length === 0 ? (
                    <p className="mt-2 text-sm text-white/65">Preenche os dados de agenda para visualizar sessões.</p>
                  ) : (
                    <div className="mt-3 space-y-2">
                      {schedulePreview.map((session) => (
                        <div key={session.key} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[12px] text-white/75">
                          <p className="font-semibold text-white">{formatSessionLabel(session)}</p>
                          <p>
                            Termina às{" "}
                            {new Intl.DateTimeFormat("pt-PT", { timeStyle: "short" }).format(session.endsAt)}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {currentStep === 3 && (
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-white/55">Detalhes</p>
                    <p className="mt-2 text-base font-semibold text-white">{title || "Sem título"}</p>
                    <p className="text-[12px] text-white/70">{durationMinutes} min · {unitPrice || "0"} EUR</p>
                    <p className="mt-2 text-[12px] text-white/60">{description || "Sem descrição"}</p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-white/55">Equipa e campo</p>
                    <p className="mt-2 text-[13px] text-white/75">
                      Treinador: {selectedProfessionalId ? activeProfessionals.find((item) => item.id === Number(selectedProfessionalId))?.name ?? "-" : "Sem treinador"}
                    </p>
                    <p className="text-[13px] text-white/75">
                      Campo: {selectedResourceId ? linkedCourtOptions.find((item) => item.linkId === Number(selectedResourceId))?.labelText ?? "-" : "Sem campo"}
                    </p>
                    <p className="text-[12px] text-white/55">Foto: {coverUrl ? "Configurada" : "Sem foto"}</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-white/55">Agenda</p>
                  <p className="mt-2 text-sm font-semibold text-white">
                    {scheduleMode === "NONE"
                      ? "Sem agenda inicial"
                      : scheduleMode === "SINGLE"
                        ? "Aula única"
                        : "Aula recorrente"}
                  </p>
                  {scheduleMode !== "NONE" ? (
                    <div className="mt-2 space-y-2 text-[13px] text-white/70">
                      <p>Hora: {scheduleStartTime}</p>
                      <p>Capacidade: {scheduleCapacity}</p>
                      {scheduleMode === "SINGLE" ? (
                        <p>Data: {singleDate}</p>
                      ) : (
                        <>
                          <p>Dia: {DAY_LABELS[Number(recurringDay)]}</p>
                          <p>Válido: {recurringValidFrom}{recurringValidUntil ? ` até ${recurringValidUntil}` : " sem fim"}</p>
                        </>
                      )}
                    </div>
                  ) : (
                    <p className="mt-2 text-[13px] text-white/70">Sem sessões automáticas nesta criação.</p>
                  )}
                </div>
              </div>
            )}

            {error && (
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
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="flex flex-wrap gap-2">
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
              </div>

              <div className="flex flex-wrap gap-2">
                {!isLastStep ? (
                  <button type="button" className={CTA_PRIMARY} onClick={handleNextStep}>
                    Seguinte
                  </button>
                ) : (
                  <button type="button" className={CTA_PRIMARY} onClick={handleSubmit} disabled={saving}>
                    {saving ? "A criar..." : `Criar ${entityLabel}`}
                  </button>
                )}
              </div>
            </div>
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
