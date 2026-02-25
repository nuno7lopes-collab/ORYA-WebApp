"use client";

import { resolveCanonicalOrgApiPath } from "@/lib/canonicalOrgApiPath";
import { buildOrgHref } from "@/lib/organizationIdUtils";

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { cn } from "@/lib/utils";
import { normalizeStepMinutes } from "@/lib/datetime/localInput";
import { getDateParts, normalizeIntervals } from "@/lib/reservas/availability";
import { OryaDateField, OryaTimeField } from "@/components/ui/datetime";
import {
  CTA_DANGER,
  CTA_NEUTRAL,
  CTA_PRIMARY,
  CTA_SECONDARY,
  DASHBOARD_CARD,
  DASHBOARD_MUTED,
} from "@/app/org/_internal/core/dashboardUi";

const fetcher = (url: string) => fetch(url).then((res) => res.json());
const DAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"] as const;
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;
const DEFAULT_SLOT_MINUTES = 30;
const DAY_MINUTES = 24 * 60;

type AvailabilityTemplate = {
  id: number;
  availabilityId?: number;
  dayOfWeek: number;
  intervals: Array<{ startMinute: number; endMinute: number }>;
};

type AvailabilitySchedule = {
  id: number;
  startDate: string;
  endDate: string | null;
  createdAt?: string;
  updatedAt?: string;
};

type AvailabilityOverride = {
  id: number;
  date: string;
  kind: "CLOSED" | "OPEN" | "BLOCK";
  intervals: Array<{ startMinute: number; endMinute: number }>;
};

type IntervalDraft = { id: string; startMinute: number; endMinute: number };
type TimeDraft = { start: string; end: string };

type AvailabilityResponse = {
  ok: boolean;
  timezone?: string;
  schedules: AvailabilitySchedule[];
  activeScheduleId?: number | null;
  selectedScheduleId?: number | null;
  templates: AvailabilityTemplate[];
  overrides: AvailabilityOverride[];
  inheritsOrganization?: boolean;
  bookingPolicy?: {
    gridMinutes?: number;
    allowedDurations?: number[];
  };
};

type AvailabilityEditorProps = {
  orgId: number;
  scopeType: "ORGANIZATION" | "PROFESSIONAL" | "RESOURCE";
  scopeId?: number | null;
  title?: string;
  subtitle?: string;
  hourHeight?: number;
  gridMinutes?: number;
};

function padTime(value: number) {
  return String(value).padStart(2, "0");
}

function minutesToTime(minutes: number) {
  const clamped = Math.max(0, Math.min(24 * 60, minutes));
  const hours = Math.floor(clamped / 60);
  const mins = clamped % 60;
  return `${padTime(hours)}:${padTime(mins)}`;
}

function toDateInput(value: string | null | undefined) {
  if (!value) return "";
  return value.slice(0, 10);
}

function timeToMinutes(value: string) {
  const match = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const mins = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(mins)) return null;
  if (hours < 0 || hours > 23 || mins < 0 || mins > 59) return null;
  return hours * 60 + mins;
}

function buildTemplateDrafts(templates: AvailabilityTemplate[], createId: () => string) {
  const drafts: Record<number, IntervalDraft[]> = {};
  DAY_LABELS.forEach((_, idx) => {
    drafts[idx] = [];
  });
  templates.forEach((template) => {
    const normalized = normalizeIntervals(template.intervals ?? []);
    drafts[template.dayOfWeek] = normalized.map((interval) => ({
      id: createId(),
      startMinute: interval.startMinute,
      endMinute: interval.endMinute,
    }));
  });
  return drafts;
}

function parseIntervals(drafts: TimeDraft[]) {
  const intervals: Array<{ startMinute: number; endMinute: number }> = [];
  for (const draft of drafts) {
    const startMinute = timeToMinutes(draft.start);
    const endMinute = timeToMinutes(draft.end);
    if (startMinute == null || endMinute == null) {
      return { ok: false, error: "Intervalo inválido. Usa o formato HH:MM." };
    }
    if (endMinute <= startMinute) {
      return { ok: false, error: "O fim do intervalo tem de ser depois do início." };
    }
    intervals.push({ startMinute, endMinute });
  }
  return { ok: true, intervals };
}

function formatIntervals(intervals: AvailabilityOverride["intervals"]) {
  if (!intervals || intervals.length === 0) return "—";
  return intervals
    .map((interval) => `${minutesToTime(interval.startMinute)}-${minutesToTime(interval.endMinute)}`)
    .join(", ");
}

export default function AvailabilityEditor({
  orgId,
  scopeType,
  scopeId,
  title = "Disponibilidade semanal",
  subtitle = "Define os intervalos semanais e exceções.",
  hourHeight = 56,
  gridMinutes = DEFAULT_SLOT_MINUTES,
}: AvailabilityEditorProps) {
  const router = useRouter();
  const scopeParams = useMemo(() => {
    const params = new URLSearchParams({ scopeType });
    if (scopeId) params.set("scopeId", String(scopeId));
    return params.toString();
  }, [scopeType, scopeId]);

  const [selectedScheduleId, setSelectedScheduleId] = useState<number | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const availabilityKey = resolveCanonicalOrgApiPath(
    `/api/org/[orgId]/reservas/disponibilidade?${scopeParams}${selectedScheduleId ? `&scheduleId=${selectedScheduleId}` : ""}`,
  );
  const { data: availabilityData, mutate: mutateAvailability } = useSWR<AvailabilityResponse>(availabilityKey, fetcher, {
    revalidateOnFocus: !isDirty,
    revalidateOnReconnect: !isDirty,
  });

  const schedules = availabilityData?.schedules ?? [];
  const activeScheduleId = availabilityData?.activeScheduleId ?? null;
  const selectedSchedule = schedules.find((schedule) => schedule.id === (selectedScheduleId ?? availabilityData?.selectedScheduleId ?? null)) ?? null;
  const templates = availabilityData?.templates ?? [];
  const inheritsOrganization = availabilityData?.inheritsOrganization ?? false;
  const hasAvailability = availabilityData
    ? templates.some((template) => normalizeIntervals(template.intervals ?? []).length > 0)
    : true;
  const minuteHeight = hourHeight / 60;
  const gridHeight = hourHeight * 24;
  const resolvedGridMinutes =
    typeof availabilityData?.bookingPolicy?.gridMinutes === "number" && Number.isFinite(availabilityData.bookingPolicy.gridMinutes)
      ? availabilityData.bookingPolicy.gridMinutes
      : gridMinutes;
  const slotMinutes =
    Number.isFinite(resolvedGridMinutes) &&
    resolvedGridMinutes > 0 &&
    resolvedGridMinutes <= 60 &&
    resolvedGridMinutes % 5 === 0 &&
    60 % resolvedGridMinutes === 0
      ? Math.floor(resolvedGridMinutes)
      : DEFAULT_SLOT_MINUTES;
  const timePickerStepMinutes = normalizeStepMinutes(slotMinutes);
  const slotHeight = minuteHeight * slotMinutes;
  const timezone = availabilityData?.timezone ?? "Europe/Lisbon";
  const todayParts = getDateParts(new Date(), timezone);
  const minScheduleDate = `${todayParts.year}-${padTime(todayParts.month)}-${padTime(todayParts.day)}`;

  const [templateDrafts, setTemplateDrafts] = useState<Record<number, IntervalDraft[]>>({});
  const nextDraftIdRef = useRef(0);
  const createDraftId = () => {
    nextDraftIdRef.current += 1;
    return `availability-draft-${nextDraftIdRef.current}`;
  };
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [templateSavingAll, setTemplateSavingAll] = useState(false);
  const [scheduleStartDate, setScheduleStartDate] = useState("");
  const [scheduleEndDate, setScheduleEndDate] = useState("");
  const [scheduleNoEnd, setScheduleNoEnd] = useState(true);
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [scheduleFormMode, setScheduleFormMode] = useState<"create" | "edit">("create");
  const [scheduleDraftId, setScheduleDraftId] = useState<number | null>(null);
  const [overrideDate, setOverrideDate] = useState("");
  const [overrideKind, setOverrideKind] = useState<AvailabilityOverride["kind"]>("CLOSED");
  const [overrideIntervals, setOverrideIntervals] = useState<TimeDraft[]>([]);
  const [overrideDrafts, setOverrideDrafts] = useState<AvailabilityOverride[]>([]);
  const nextOverrideIdRef = useRef(0);
  const createLocalOverrideId = () => {
    nextOverrideIdRef.current -= 1;
    return nextOverrideIdRef.current;
  };
  const [overrideSaving, setOverrideSaving] = useState(false);
  const [hasUnsavedBarDismissed, setHasUnsavedBarDismissed] = useState(false);
  const hydrationSignatureRef = useRef<string | null>(null);
  const editorRootRef = useRef<HTMLElement | null>(null);
  const dragStateRef = useRef<{
    dayIdx: number;
    blockId: string;
    mode: "create" | "move" | "resize-start" | "resize-end";
    anchorMinute: number;
    durationMinutes: number;
    offsetMinutes: number;
    rectTop: number;
    rectHeight: number;
    pointerId: number;
    captureElement: HTMLElement | null;
  } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (!availabilityData?.templates) return;
    const signature = JSON.stringify({
      selectedScheduleId: availabilityData.selectedScheduleId ?? null,
      templates: availabilityData.templates,
    });
    if (isDirty && hydrationSignatureRef.current && hydrationSignatureRef.current !== signature) {
      return;
    }
    setTemplateDrafts(buildTemplateDrafts(availabilityData.templates, createDraftId));
    hydrationSignatureRef.current = signature;
  }, [availabilityData?.selectedScheduleId, availabilityData?.templates, isDirty]);

  useEffect(() => {
    if (!availabilityData?.overrides) return;
    if (isDirty) return;
    setOverrideDrafts(availabilityData.overrides);
  }, [availabilityData?.overrides, isDirty]);

  useEffect(() => {
    if (!availabilityData) return;
    const availableIds = new Set(schedules.map((schedule) => schedule.id));
    const fallbackId = availabilityData.selectedScheduleId ?? availabilityData.activeScheduleId ?? null;
    if (selectedScheduleId && availableIds.has(selectedScheduleId)) return;
    if (fallbackId && availableIds.has(fallbackId)) {
      setSelectedScheduleId(fallbackId);
    } else if (!availableIds.size) {
      setSelectedScheduleId(null);
    }
  }, [availabilityData, schedules, selectedScheduleId]);

  useEffect(() => {
    if (!isDirty) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const handleAnchorNavigation = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const anchor = target?.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;
      if (!editorRootRef.current?.contains(anchor)) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("javascript:")) return;
      if (anchor.target === "_blank") return;
      const confirmed = window.confirm("Tens alterações por aplicar. Queres sair sem guardar?");
      if (!confirmed) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("click", handleAnchorNavigation, true);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("click", handleAnchorNavigation, true);
    };
  }, [isDirty]);

  const handleTemplateAdd = (dayIdx: number) => {
    setTemplateDrafts((prev) => ({
      ...prev,
      [dayIdx]: [
        ...(prev[dayIdx] ?? []),
        { id: createDraftId(), startMinute: 9 * 60, endMinute: 10 * 60 },
      ],
    }));
    setIsDirty(true);
    setHasUnsavedBarDismissed(false);
  };

  const handleTemplateRemove = (dayIdx: number, blockId: string) => {
    setTemplateDrafts((prev) => {
      const list = (prev[dayIdx] ?? []).filter((item) => item.id !== blockId);
      return { ...prev, [dayIdx]: list };
    });
    setIsDirty(true);
    setHasUnsavedBarDismissed(false);
  };

  const handleSplitInterval = (dayIdx: number, blockId: string) => {
    setTemplateDrafts((prev) => {
      const list = [...(prev[dayIdx] ?? [])];
      const idx = list.findIndex((item) => item.id === blockId);
      const current = idx >= 0 ? list[idx] : null;
      if (!current) return prev;
      const duration = current.endMinute - current.startMinute;
      if (duration < slotMinutes * 2) return prev;
      const midpoint = snapMinute(current.startMinute + duration / 2);
      if (midpoint <= current.startMinute + slotMinutes || midpoint >= current.endMinute - slotMinutes) {
        return prev;
      }
      list.splice(
        idx,
        1,
        { id: createDraftId(), startMinute: current.startMinute, endMinute: midpoint },
        { id: createDraftId(), startMinute: midpoint, endMinute: current.endMinute },
      );
      return { ...prev, [dayIdx]: list };
    });
    setIsDirty(true);
    setHasUnsavedBarDismissed(false);
  };

  const handleTemplateSaveAll = async () => {
    if (!selectedScheduleId) {
      setAvailabilityError("Cria ou seleciona uma disponibilidade base primeiro.");
      return;
    }
    if (!selectedSchedule) {
      setAvailabilityError("Seleciona uma disponibilidade ativa para aplicar alterações.");
      return;
    }
    setTemplateSavingAll(true);
    setAvailabilityError(null);
    try {
      const templatePayload = DAY_ORDER.reduce<Record<string, Array<{ startMinute: number; endMinute: number }>>>((acc, dayIdx) => {
        acc[String(dayIdx)] = normalizeIntervals(
          (templateDrafts[dayIdx] ?? []).map((block) => ({
            startMinute: block.startMinute,
            endMinute: block.endMinute,
          })),
        );
        return acc;
      }, {});

      const res = await fetch(resolveCanonicalOrgApiPath("/api/org/[orgId]/reservas/disponibilidade/changesets"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scopeType,
          scopeId,
          scheduleId: selectedScheduleId,
          startDate: toDateInput(selectedSchedule.startDate),
          endDate: toDateInput(selectedSchedule.endDate) || null,
          templates: templatePayload,
          overrides: (overrideDrafts ?? []).map((override) => ({
            date: toDateInput(override.date),
            kind: override.kind,
            intervals: override.intervals ?? [],
          })),
          autoApply: true,
        }),
      });
      const json = await res.json().catch(() => null);
      const payload = json?.data ?? json;
      if (!res.ok || !json?.ok) {
        const errorCode = String(json?.errorCode ?? json?.code ?? "");
        const details = (json?.details ?? json?.data ?? null) as { changeSetId?: number } | null;
        if (errorCode === "AVAILABILITY_CONFLICTS_FOUND" && Number.isFinite(details?.changeSetId)) {
          const changeSetId = Number(details?.changeSetId);
          setIsDirty(false);
          setHasUnsavedBarDismissed(false);
          router.push(buildOrgHref(orgId, `/calendar/availability/conflicts/${changeSetId}`));
          return;
        }
        throw new Error(String(json?.message ?? json?.error ?? "Erro ao aplicar alterações."));
      }

      if (payload?.changeSetId && payload?.status === "PENDING") {
        router.push(buildOrgHref(orgId, `/calendar/availability/conflicts/${payload.changeSetId}`));
        return;
      }

      setIsDirty(false);
      setHasUnsavedBarDismissed(false);
      await mutateAvailability();
    } catch (err) {
      setAvailabilityError(err instanceof Error ? err.message : "Erro ao aplicar disponibilidade.");
    } finally {
      setTemplateSavingAll(false);
    }
  };

  const handleDiscardDraft = () => {
    if (!isDirty) return;
    const confirmed = window.confirm("Descartar rascunho desta semana?");
    if (!confirmed) return;
    const nextTemplates = availabilityData?.templates ?? [];
    setTemplateDrafts(buildTemplateDrafts(nextTemplates, createDraftId));
    setOverrideDrafts(availabilityData?.overrides ?? []);
    hydrationSignatureRef.current = JSON.stringify({
      selectedScheduleId: availabilityData?.selectedScheduleId ?? null,
      templates: nextTemplates,
    });
    setIsDirty(false);
    setHasUnsavedBarDismissed(false);
    setAvailabilityError(null);
  };

  const resetScheduleForm = () => {
    setScheduleFormMode("create");
    setScheduleDraftId(null);
    setScheduleStartDate("");
    setScheduleEndDate("");
    setScheduleNoEnd(true);
  };

  const handleEditSchedule = (schedule: AvailabilitySchedule) => {
    setScheduleFormMode("edit");
    setScheduleDraftId(schedule.id);
    setScheduleStartDate(toDateInput(schedule.startDate));
    setScheduleEndDate(toDateInput(schedule.endDate));
    setScheduleNoEnd(!schedule.endDate);
  };

  const handleScheduleSubmit = async () => {
    if (!scheduleStartDate) {
      setAvailabilityError("Seleciona a data de início.");
      return;
    }
    if (!scheduleNoEnd && !scheduleEndDate) {
      setAvailabilityError("Seleciona a data de fim ou marca como sem fim.");
      return;
    }
    setScheduleSaving(true);
    setAvailabilityError(null);
    try {
      const templatePayload = DAY_ORDER.reduce<Record<string, Array<{ startMinute: number; endMinute: number }>>>((acc, dayIdx) => {
        acc[String(dayIdx)] = normalizeIntervals(
          (templateDrafts[dayIdx] ?? []).map((block) => ({
            startMinute: block.startMinute,
            endMinute: block.endMinute,
          })),
        );
        return acc;
      }, {});

      const res = await fetch(resolveCanonicalOrgApiPath("/api/org/[orgId]/reservas/disponibilidade/changesets"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scopeType,
          scopeId,
          scheduleId: scheduleFormMode === "edit" ? scheduleDraftId : null,
          startDate: scheduleStartDate,
          endDate: scheduleNoEnd ? null : scheduleEndDate,
          templates: templatePayload,
          overrides: (overrideDrafts ?? []).map((override) => ({
            date: toDateInput(override.date),
            kind: override.kind,
            intervals: override.intervals ?? [],
          })),
          autoApply: true,
        }),
      });
      const json = await res.json().catch(() => null);
      const payload = json?.data ?? json;
      if (!res.ok || !json?.ok) {
        const errorCode = String(json?.errorCode ?? json?.code ?? "");
        const details = (json?.details ?? json?.data ?? null) as { changeSetId?: number } | null;
        if (errorCode === "AVAILABILITY_CONFLICTS_FOUND" && Number.isFinite(details?.changeSetId)) {
          router.push(buildOrgHref(orgId, `/calendar/availability/conflicts/${Number(details?.changeSetId)}`));
          return;
        }
        throw new Error(String(json?.message ?? json?.error ?? "Erro ao guardar disponibilidade."));
      }
      const nextId = Number(payload?.scheduleId) > 0 ? Number(payload?.scheduleId) : null;
      resetScheduleForm();
      setIsDirty(false);
      setHasUnsavedBarDismissed(false);
      await mutateAvailability();
      if (nextId) {
        setSelectedScheduleId(nextId);
      }
    } catch (err) {
      setAvailabilityError(err instanceof Error ? err.message : "Erro ao guardar disponibilidade.");
    } finally {
      setScheduleSaving(false);
    }
  };

  const handleScheduleDelete = async (scheduleId: number) => {
    void scheduleId;
    setAvailabilityError(
      "A remoção direta foi desativada. Ajusta o período (data fim) e aplica alterações via changeset.",
    );
  };

  const handleOverrideAdd = () => {
    setOverrideIntervals((prev) => [...prev, { start: "09:00", end: "10:00" }]);
  };

  const handleOverrideIntervalChange = (idx: number, field: "start" | "end", value: string) => {
    setOverrideIntervals((prev) => {
      const list = [...prev];
      if (!list[idx]) return prev;
      list[idx] = { ...list[idx], [field]: value };
      return list;
    });
  };

  const handleOverrideRemove = (idx: number) => {
    setOverrideIntervals((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleOverrideCreate = async () => {
    if (!overrideDate) {
      setAvailabilityError("Seleciona uma data.");
      return;
    }
    const parsed = overrideKind === "CLOSED" ? { ok: true, intervals: [] } : parseIntervals(overrideIntervals);
    if (!parsed.ok) {
      setAvailabilityError(parsed.error || "Erro nos intervalos.");
      return;
    }

    setOverrideSaving(true);
    setAvailabilityError(null);
    try {
      const dateIso = new Date(`${overrideDate}T00:00:00.000Z`).toISOString();
      setOverrideDrafts((prev) => {
        const next = [...prev];
        const existingIdx = next.findIndex((item) => toDateInput(item.date) === overrideDate);
        const payload: AvailabilityOverride = {
          id: existingIdx >= 0 ? next[existingIdx].id : createLocalOverrideId(),
          date: dateIso,
          kind: overrideKind,
          intervals: parsed.intervals ?? [],
        };
        if (existingIdx >= 0) {
          next[existingIdx] = payload;
        } else {
          next.push(payload);
        }
        next.sort((a, b) => toDateInput(a.date).localeCompare(toDateInput(b.date)));
        return next;
      });
      setOverrideDate("");
      setOverrideIntervals([]);
      setIsDirty(true);
      setHasUnsavedBarDismissed(false);
    } catch (err) {
      setAvailabilityError(err instanceof Error ? err.message : "Erro ao guardar exceção.");
    } finally {
      setOverrideSaving(false);
    }
  };

  const handleOverrideDelete = async (overrideId: number) => {
    setAvailabilityError(null);
    setOverrideDrafts((prev) => prev.filter((override) => override.id !== overrideId));
    setIsDirty(true);
    setHasUnsavedBarDismissed(false);
  };

  const clampMinute = (value: number) => Math.min(DAY_MINUTES, Math.max(0, value));
  const snapMinute = (value: number) => Math.round(value / slotMinutes) * slotMinutes;

  const getMinuteFromPointer = (clientY: number, rectTop: number, rectHeight: number) => {
    const ratio = (clientY - rectTop) / rectHeight;
    return clampMinute(snapMinute(ratio * DAY_MINUTES));
  };

  const updateInterval = (dayIdx: number, blockId: string, startMinute: number, endMinute: number) => {
    setTemplateDrafts((prev) => {
      const list = [...(prev[dayIdx] ?? [])];
      const index = list.findIndex((item) => item.id === blockId);
      if (index < 0 || !list[index]) return prev;
      list[index] = { ...list[index], startMinute, endMinute };
      return { ...prev, [dayIdx]: list };
    });
  };

  const normalizeDayDrafts = (dayIdx: number) => {
    setTemplateDrafts((prev) => {
      const list = prev[dayIdx] ?? [];
      const normalized = normalizeIntervals(list).map((interval) => ({
        id: createDraftId(),
        startMinute: interval.startMinute,
        endMinute: interval.endMinute,
      }));
      return { ...prev, [dayIdx]: normalized };
    });
  };

  const startDragCreate = (dayIdx: number, event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const rect = event.currentTarget.getBoundingClientRect();
    const startMinute = getMinuteFromPointer(event.clientY, rect.top, rect.height);
    const blockId = createDraftId();
    setTemplateDrafts((prev) => {
      const list = [...(prev[dayIdx] ?? [])];
      list.push({
        id: blockId,
        startMinute,
        endMinute: Math.min(startMinute + slotMinutes, DAY_MINUTES),
      });
      return { ...prev, [dayIdx]: list };
    });
    dragStateRef.current = {
      dayIdx,
      blockId,
      mode: "create",
      anchorMinute: startMinute,
      durationMinutes: slotMinutes,
      offsetMinutes: 0,
      rectTop: rect.top,
      rectHeight: rect.height,
      pointerId: event.pointerId,
      captureElement: event.currentTarget,
    };
    setIsDragging(true);
  };

  const startDragResize = (
    dayIdx: number,
    blockId: string,
    mode: "resize-start" | "resize-end",
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const column = event.currentTarget.closest("[data-day-column]") as HTMLDivElement | null;
    const rect = column?.getBoundingClientRect();
    if (!rect) return;
    const interval = (templateDrafts[dayIdx] ?? []).find((item) => item.id === blockId);
    if (!interval) return;
    dragStateRef.current = {
      dayIdx,
      blockId,
      mode,
      anchorMinute: interval.startMinute,
      durationMinutes: interval.endMinute - interval.startMinute,
      offsetMinutes: 0,
      rectTop: rect.top,
      rectHeight: rect.height,
      pointerId: event.pointerId,
      captureElement: event.currentTarget,
    };
    setIsDragging(true);
  };

  const startDragMove = (
    dayIdx: number,
    blockId: string,
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const column = event.currentTarget.closest("[data-day-column]") as HTMLDivElement | null;
    const rect = column?.getBoundingClientRect();
    if (!rect) return;
    const interval = (templateDrafts[dayIdx] ?? []).find((item) => item.id === blockId);
    if (!interval) return;
    const minute = getMinuteFromPointer(event.clientY, rect.top, rect.height);
    dragStateRef.current = {
      dayIdx,
      blockId,
      mode: "move",
      anchorMinute: interval.startMinute,
      durationMinutes: interval.endMinute - interval.startMinute,
      offsetMinutes: minute - interval.startMinute,
      rectTop: rect.top,
      rectHeight: rect.height,
      pointerId: event.pointerId,
      captureElement: event.currentTarget,
    };
    setIsDragging(true);
  };

  useEffect(() => {
    if (!isDragging) return;
    const handleMove = (event: globalThis.PointerEvent) => {
      const state = dragStateRef.current;
      if (!state) return;
      const minute = getMinuteFromPointer(event.clientY, state.rectTop, state.rectHeight);
      let startMinute = state.anchorMinute;
      let endMinute = state.anchorMinute + state.durationMinutes;

      if (state.mode === "create") {
        startMinute = Math.min(state.anchorMinute, minute);
        endMinute = Math.max(state.anchorMinute + slotMinutes, minute);
      } else if (state.mode === "move") {
        startMinute = minute - state.offsetMinutes;
        startMinute = clampMinute(startMinute);
        endMinute = startMinute + state.durationMinutes;
        if (endMinute > DAY_MINUTES) {
          endMinute = DAY_MINUTES;
          startMinute = endMinute - state.durationMinutes;
        }
      } else if (state.mode === "resize-start") {
        startMinute = minute;
      } else if (state.mode === "resize-end") {
        endMinute = minute;
      }

      startMinute = clampMinute(startMinute);
      endMinute = clampMinute(endMinute);
      if (endMinute - startMinute < slotMinutes) {
        if (state.mode === "resize-start") {
          startMinute = Math.max(0, endMinute - slotMinutes);
        } else {
          endMinute = Math.min(DAY_MINUTES, startMinute + slotMinutes);
        }
      }

      updateInterval(state.dayIdx, state.blockId, startMinute, endMinute);
    };

    const handleUp = () => {
      const state = dragStateRef.current;
      if (state?.captureElement && state.captureElement.hasPointerCapture(state.pointerId)) {
        state.captureElement.releasePointerCapture(state.pointerId);
      }
      dragStateRef.current = null;
      setIsDragging(false);
      if (state) {
        normalizeDayDrafts(state.dayIdx);
        setIsDirty(true);
        setHasUnsavedBarDismissed(false);
      }
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
    };
  }, [isDragging, slotMinutes]);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const scrollInitRef = useRef(false);
  const lastMinuteHeightRef = useRef(minuteHeight);
  const viewStartHour = 9;
  const viewHours = 10;
  const viewportHeight = hourHeight * viewHours;

  useEffect(() => {
    scrollInitRef.current = false;
  }, [scopeType, scopeId]);

  useEffect(() => {
    if (!scrollRef.current) return;
    if (!scrollInitRef.current) {
      scrollRef.current.scrollTop = viewStartHour * hourHeight;
      scrollInitRef.current = true;
    }
  }, [hourHeight, scopeType, scopeId]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const previous = lastMinuteHeightRef.current;
    if (previous && previous !== minuteHeight) {
      const minutes = container.scrollTop / previous;
      container.scrollTop = minutes * minuteHeight;
    }
    lastMinuteHeightRef.current = minuteHeight;
  }, [minuteHeight]);

  return (
    <section ref={editorRootRef} className={cn(DASHBOARD_CARD, "p-5 space-y-4")}>
      <div>
        <h2 className="text-base font-semibold text-white">{title}</h2>
        <p className={DASHBOARD_MUTED}>{subtitle}</p>
        {inheritsOrganization && (
          <p className="mt-2 text-[12px] text-white/60">
            Sem horários próprios. A usar disponibilidade base da organização.
          </p>
        )}
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-[0_18px_60px_rgba(0,0,0,0.35)]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-white">Disponibilidade base</h3>
            <p className="text-[12px] text-white/60">
              Cada disponibilidade aplica-se a partir da data de início e pode ter fim.
            </p>
          </div>
          <button type="button" className={CTA_NEUTRAL} onClick={resetScheduleForm}>
            Nova disponibilidade
          </button>
        </div>

        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {schedules.length === 0 && (
            <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-white/60">
              Sem disponibilidades criadas. Cria uma para começares.
            </div>
          )}
          {schedules.map((schedule) => {
            const startKey = toDateInput(schedule.startDate);
            const endKey = toDateInput(schedule.endDate);
            const isActive = Boolean(startKey) && startKey <= minScheduleDate && (!endKey || minScheduleDate <= endKey);
            const isFuture = Boolean(startKey) && startKey > minScheduleDate;
            const isSelected = selectedScheduleId === schedule.id;
            const labelStart = schedule.startDate
              ? new Date(schedule.startDate).toLocaleDateString("pt-PT", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" })
              : "—";
            const labelEnd = schedule.endDate
              ? new Date(schedule.endDate).toLocaleDateString("pt-PT", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" })
              : "Sem fim";
            return (
              <div
                key={`schedule-${schedule.id}`}
                className={cn(
                  "rounded-xl border border-white/10 bg-black/20 p-3 transition",
                  isSelected ? "border-cyan-300/60 shadow-[0_18px_40px_rgba(34,211,238,0.25)]" : "hover:border-white/25",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    className="text-left"
                    onClick={() => {
                      if (schedule.id === selectedScheduleId) return;
                      if (isDirty) {
                        const confirmed = window.confirm("Existem alterações por aplicar. Queres descartá-las e trocar de disponibilidade?");
                        if (!confirmed) return;
                        setIsDirty(false);
                      }
                      setSelectedScheduleId(schedule.id);
                    }}
                  >
                    <p className="text-sm font-semibold text-white">
                      {labelStart} → {labelEnd}
                    </p>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-white/50">
                      {isActive ? "Ativo" : isFuture ? "Futuro" : "Terminado"}
                      {schedule.id === activeScheduleId ? " · Atual" : ""}
                    </p>
                  </button>
                  <div className="flex items-center gap-2">
                    <button type="button" className={CTA_NEUTRAL} onClick={() => handleEditSchedule(schedule)}>
                      Editar
                    </button>
                    <button type="button" className={CTA_DANGER} onClick={() => handleScheduleDelete(schedule.id)}>
                      Remover
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <div>
            <label className="text-sm text-white/80">Início</label>
            <OryaDateField
              value={scheduleStartDate}
              onChange={setScheduleStartDate}
              className="mt-1 w-full"
              buttonClassName="h-10 rounded-xl"
              minDate={minScheduleDate}
            />
          </div>
          <div>
            <label className="text-sm text-white/80">Fim</label>
            <OryaDateField
              value={scheduleEndDate}
              onChange={setScheduleEndDate}
              className="mt-1 w-full"
              buttonClassName="h-10 rounded-xl"
              disabled={scheduleNoEnd}
              minDate={scheduleStartDate || minScheduleDate}
            />
          </div>
          <div className="flex flex-col justify-end gap-2">
            <label className="flex items-center gap-2 text-xs text-white/70">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-white/20 bg-black/30"
                checked={scheduleNoEnd}
                onChange={(event) => {
                  setScheduleNoEnd(event.target.checked);
                  if (event.target.checked) setScheduleEndDate("");
                }}
              />
              Sem fim
            </label>
          </div>
          <div className="flex items-end">
            <button type="button" className={CTA_PRIMARY} onClick={handleScheduleSubmit} disabled={scheduleSaving}>
              {scheduleSaving ? "A guardar..." : scheduleFormMode === "edit" ? "Atualizar disponibilidade" : "Criar disponibilidade"}
            </button>
          </div>
        </div>
      </div>

      {!hasAvailability && !inheritsOrganization && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
          Define horários para permitir marcações.
        </div>
      )}

      {isDirty && !hasUnsavedBarDismissed && (
        <div className="rounded-xl border border-amber-300/35 bg-amber-500/10 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-amber-100">Alterações por aplicar</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className={CTA_PRIMARY}
                onClick={handleTemplateSaveAll}
                disabled={templateSavingAll}
              >
                {templateSavingAll ? "A aplicar..." : "Aplicar alterações"}
              </button>
              <button type="button" className={CTA_DANGER} onClick={handleDiscardDraft}>
                Descartar rascunho
              </button>
              <button
                type="button"
                className={CTA_NEUTRAL}
                onClick={() => setHasUnsavedBarDismissed(true)}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-white/12 bg-[linear-gradient(165deg,rgba(255,255,255,0.08),rgba(255,255,255,0.01))] shadow-[0_30px_90px_rgba(3,8,20,0.55)] backdrop-blur-xl overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
          <div>
            <h3 className="text-sm font-semibold text-white/90 tracking-[0.02em]">Calendário semanal</h3>
            <p className="text-[12px] text-white/60">
              Arrasta para criar blocos. Visível 09:00–19:00 (scroll para o resto do dia).
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className={cn(CTA_NEUTRAL, "text-[11px]")}
              onClick={handleTemplateSaveAll}
              disabled={templateSavingAll || !isDirty}
            >
              {templateSavingAll ? "A aplicar..." : "Aplicar alterações"}
            </button>
            <div className="text-[10px] uppercase tracking-[0.22em] text-white/45">Grelha {slotMinutes} min</div>
          </div>
        </div>

        <div className="overflow-x-auto px-4 pb-4">
          <div className="min-w-[860px]">
            <div
              className="grid gap-1 sticky top-0 z-20 border-b border-white/10 bg-[rgba(6,10,20,0.86)] backdrop-blur-xl"
              style={{ gridTemplateColumns: "72px minmax(0,1fr)" }}
            >
              <div className="sticky left-0 z-20 h-11 rounded-tl-2xl border-r border-white/10 bg-[rgba(6,10,20,0.86)] backdrop-blur-xl" />
              <div className="grid gap-1 grid-cols-7">
                {DAY_ORDER.map((dayIdx) => {
                  const label = DAY_LABELS[dayIdx];
                  return (
                    <div
                      key={`availability-header-${label}`}
                      className="flex h-11 items-center justify-center rounded-t-lg rounded-b-none border border-white/10 border-b-0 bg-white/[0.06] px-3 py-0 text-[11px] font-semibold text-white/70 shadow-[0_10px_26px_rgba(0,0,0,0.22)]"
                    >
                      <span className="font-semibold text-white/80">{label}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div
              ref={scrollRef}
              className="overflow-y-auto orya-scrollbar-hide"
              style={{ height: viewportHeight, maxHeight: "calc(100vh - 320px)" }}
            >
              <div className="grid gap-2" style={{ gridTemplateColumns: "72px minmax(0,1fr)" }}>
                <div
                  className="sticky left-0 z-20 relative border-r border-white/8 bg-[rgba(6,10,20,0.7)] backdrop-blur-xl"
                  style={{
                    height: gridHeight,
                    backgroundImage:
                      "linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.06) 1px, transparent 1px)",
                    backgroundSize: `100% ${slotHeight}px, 100% ${hourHeight}px`,
                    backgroundPosition: "0 0, 0 0",
                  }}
                >
                  {Array.from({ length: 24 }).map((_, hour) => {
                    const top = hour * hourHeight;
                    const labelClass =
                      hour === 0
                        ? "absolute right-2 text-[10px] font-mono leading-none tracking-[0.12em] text-white/40"
                        : "absolute right-2 -translate-y-1/2 text-[10px] font-mono leading-none tracking-[0.12em] text-white/40";
                    return (
                      <div
                        key={`availability-time-${hour}`}
                        className={labelClass}
                        style={{ top }}
                      >
                        {padTime(hour)}:00
                      </div>
                    );
                  })}
                </div>
                <div className="grid gap-1 grid-cols-7">
                  {DAY_ORDER.map((dayIdx) => {
                    const label = DAY_LABELS[dayIdx];
                    const dayDrafts = templateDrafts[dayIdx] ?? [];
                    return (
                      <div
                        key={`availability-day-${label}`}
                        data-day-column
                        className="relative rounded-b-xl rounded-t-none border border-white/10 border-t-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.015))] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                        style={{
                          height: gridHeight,
                          backgroundImage:
                            "linear-gradient(to bottom, rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.08) 1px, transparent 1px)",
                          backgroundSize: `100% ${slotHeight}px, 100% ${hourHeight}px`,
                          backgroundPosition: "0 0, 0 0",
                          touchAction: "none",
                        }}
                        onPointerDown={(event) => startDragCreate(dayIdx, event)}
                      >
                        {dayDrafts.length === 0 && (
                          <div className="absolute inset-x-0 top-3 text-center text-[11px] text-white/40">
                            Dia fechado
                          </div>
                        )}
                        {dayDrafts.map((interval) => {
                          const top = interval.startMinute * minuteHeight;
                          const height = Math.max(12, (interval.endMinute - interval.startMinute) * minuteHeight);
                          const labelText = `${minutesToTime(interval.startMinute)}-${minutesToTime(interval.endMinute)}`;
                          return (
                            <div
                              key={interval.id}
                              className="group absolute left-1 right-1 rounded-xl border border-white/25 bg-[linear-gradient(135deg,rgba(255,255,255,0.14),rgba(255,255,255,0.05))] px-2.5 py-2 text-[10px] text-white shadow-[0_18px_40px_rgba(0,0,0,0.5)] backdrop-blur-2xl"
                              style={{ top, height }}
                              onPointerDown={(event) => startDragMove(dayIdx, interval.id, event)}
                            >
                              <div
                                className="absolute inset-x-1 top-0 h-2 cursor-ns-resize"
                                onPointerDown={(event) => startDragResize(dayIdx, interval.id, "resize-start", event)}
                              />
                              <div
                                className="absolute inset-x-1 bottom-0 h-2 cursor-ns-resize"
                                onPointerDown={(event) => startDragResize(dayIdx, interval.id, "resize-end", event)}
                              />
                              <div className="flex items-center justify-between gap-1">
                                <span className="font-semibold">{labelText}</span>
                                <div className="flex gap-1 opacity-0 transition group-hover:opacity-100">
                                  <button
                                    type="button"
                                    className="rounded-full border border-white/20 px-2 text-[10px] text-white/80"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      handleSplitInterval(dayIdx, interval.id);
                                    }}
                                  >
                                    Dividir
                                  </button>
                                  <button
                                    type="button"
                                    className="rounded-full border border-white/20 px-2 text-[10px] text-white/80"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      handleTemplateRemove(dayIdx, interval.id);
                                    }}
                                  >
                                    Remover
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-white">Override por data</h3>
          <p className="text-[12px] text-white/60">Excecoes: fechado, aberto ou bloqueio parcial.</p>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <label className="text-sm text-white/80">Data</label>
            <OryaDateField
              value={overrideDate}
              onChange={setOverrideDate}
              className="mt-1 w-full"
              buttonClassName="h-10 rounded-xl"
            />
          </div>
          <div>
            <label className="text-sm text-white/80">Tipo</label>
            <select
              className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              value={overrideKind}
              onChange={(e) => setOverrideKind(e.target.value as AvailabilityOverride["kind"])}
            >
              <option value="CLOSED">Fechado</option>
              <option value="OPEN">Horário especial</option>
              <option value="BLOCK">Bloquear intervalos</option>
            </select>
          </div>
          <div className="flex items-end">
            <button type="button" className={CTA_PRIMARY} onClick={handleOverrideCreate} disabled={overrideSaving}>
              {overrideSaving ? "A guardar..." : "Guardar exceção"}
            </button>
          </div>
        </div>

        {overrideKind !== "CLOSED" && (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[12px] text-white/60">Intervalos</p>
              <button type="button" className={CTA_SECONDARY} onClick={handleOverrideAdd}>
                Adicionar intervalo
              </button>
            </div>
            {overrideIntervals.length === 0 && (
              <p className="text-[12px] text-white/50">Sem intervalos definidos.</p>
            )}
            {overrideIntervals.map((interval, idx) => (
              <div key={`override-${idx}`} className="flex flex-wrap items-center gap-2">
                <OryaTimeField
                  value={interval.start}
                  onChange={(next) => handleOverrideIntervalChange(idx, "start", next)}
                  stepMinutes={timePickerStepMinutes}
                  buttonClassName="h-10 rounded-xl"
                />
                <span className="text-white/60">→</span>
                <OryaTimeField
                  value={interval.end}
                  onChange={(next) => handleOverrideIntervalChange(idx, "end", next)}
                  stepMinutes={timePickerStepMinutes}
                  buttonClassName="h-10 rounded-xl"
                />
                <button type="button" className={CTA_DANGER} onClick={() => handleOverrideRemove(idx)}>
                  Remover
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-2">
          {overrideDrafts.length === 0 && (
            <p className="text-[12px] text-white/50">Sem exceções.</p>
          )}
          {overrideDrafts.map((override) => {
            const dateLabel = new Date(override.date).toLocaleDateString("pt-PT", {
              day: "2-digit",
              month: "short",
              year: "numeric",
              timeZone: "UTC",
            });
            return (
              <div
                key={override.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 p-3"
              >
                <div>
                  <p className="text-sm font-semibold text-white">{dateLabel}</p>
                  <p className="text-[12px] text-white/60">
                    {override.kind === "CLOSED"
                      ? "Fechado"
                      : override.kind === "OPEN"
                        ? "Horário especial"
                        : "Bloqueio"}
                    {override.kind === "CLOSED" ? "" : ` · ${formatIntervals(override.intervals)}`}
                  </p>
                </div>
                <button type="button" className={CTA_DANGER} onClick={() => handleOverrideDelete(override.id)}>
                  Remover
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {availabilityError && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">
          {availabilityError}
        </div>
      )}
    </section>
  );
}
