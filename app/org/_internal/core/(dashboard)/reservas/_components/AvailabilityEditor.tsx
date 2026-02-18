"use client";

import { resolveCanonicalOrgApiPath } from "@/lib/canonicalOrgApiPath";

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import useSWR from "swr";
import { cn } from "@/lib/utils";
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
const SLOT_MINUTES = 15;
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

type IntervalDraft = { startMinute: number; endMinute: number };
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
};

type AvailabilityEditorProps = {
  scopeType: "ORGANIZATION" | "PROFESSIONAL" | "RESOURCE";
  scopeId?: number | null;
  title?: string;
  subtitle?: string;
  hourHeight?: number;
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

function buildTemplateDrafts(templates: AvailabilityTemplate[]) {
  const drafts: Record<number, IntervalDraft[]> = {};
  DAY_LABELS.forEach((_, idx) => {
    drafts[idx] = [];
  });
  templates.forEach((template) => {
    const normalized = normalizeIntervals(template.intervals ?? []);
    drafts[template.dayOfWeek] = normalized.map((interval) => ({
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
  scopeType,
  scopeId,
  title = "Disponibilidade semanal",
  subtitle = "Define os intervalos semanais e exceções.",
  hourHeight = 56,
}: AvailabilityEditorProps) {
  const scopeParams = useMemo(() => {
    const params = new URLSearchParams({ scopeType });
    if (scopeId) params.set("scopeId", String(scopeId));
    return params.toString();
  }, [scopeType, scopeId]);

  const [selectedScheduleId, setSelectedScheduleId] = useState<number | null>(null);
  const availabilityKey = resolveCanonicalOrgApiPath(
    `/api/org/[orgId]/reservas/disponibilidade?${scopeParams}${selectedScheduleId ? `&scheduleId=${selectedScheduleId}` : ""}`,
  );
  const { data: availabilityData, mutate: mutateAvailability } = useSWR<AvailabilityResponse>(availabilityKey, fetcher);

  const schedules = availabilityData?.schedules ?? [];
  const activeScheduleId = availabilityData?.activeScheduleId ?? null;
  const selectedSchedule = schedules.find((schedule) => schedule.id === (selectedScheduleId ?? availabilityData?.selectedScheduleId ?? null)) ?? null;
  const templates = availabilityData?.templates ?? [];
  const overrides = availabilityData?.overrides ?? [];
  const inheritsOrganization = availabilityData?.inheritsOrganization ?? false;
  const hasAvailability = availabilityData
    ? templates.some((template) => normalizeIntervals(template.intervals ?? []).length > 0)
    : true;
  const minuteHeight = hourHeight / 60;
  const gridHeight = hourHeight * 24;
  const slotHeight = minuteHeight * SLOT_MINUTES;
  const timezone = availabilityData?.timezone ?? "Europe/Lisbon";
  const todayParts = getDateParts(new Date(), timezone);
  const minScheduleDate = `${todayParts.year}-${padTime(todayParts.month)}-${padTime(todayParts.day)}`;

  const [templateDrafts, setTemplateDrafts] = useState<Record<number, IntervalDraft[]>>({});
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [templateSavingAll, setTemplateSavingAll] = useState(false);
  const [scheduleStartDate, setScheduleStartDate] = useState("");
  const [scheduleEndDate, setScheduleEndDate] = useState("");
  const [scheduleNoEnd, setScheduleNoEnd] = useState(true);
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [scheduleFormMode, setScheduleFormMode] = useState<"create" | "edit">("create");
  const [scheduleDraftId, setScheduleDraftId] = useState<number | null>(null);
  const [cloneFromActive, setCloneFromActive] = useState(true);
  const [overrideDate, setOverrideDate] = useState("");
  const [overrideKind, setOverrideKind] = useState<AvailabilityOverride["kind"]>("CLOSED");
  const [overrideIntervals, setOverrideIntervals] = useState<TimeDraft[]>([]);
  const [overrideSaving, setOverrideSaving] = useState(false);
  const dragStateRef = useRef<{
    dayIdx: number;
    index: number;
    mode: "create" | "move" | "resize-start" | "resize-end";
    anchorMinute: number;
    durationMinutes: number;
    offsetMinutes: number;
    rectTop: number;
    rectHeight: number;
  } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (!availabilityData?.templates) return;
    setTemplateDrafts(buildTemplateDrafts(availabilityData.templates));
  }, [availabilityData?.templates]);

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

  const handleTemplateAdd = (dayIdx: number) => {
    setTemplateDrafts((prev) => ({
      ...prev,
      [dayIdx]: [
        ...(prev[dayIdx] ?? []),
        { startMinute: 9 * 60, endMinute: 10 * 60 },
      ],
    }));
  };

  const handleTemplateRemove = (dayIdx: number, idx: number) => {
    setTemplateDrafts((prev) => {
      const list = [...(prev[dayIdx] ?? [])];
      list.splice(idx, 1);
      return { ...prev, [dayIdx]: list };
    });
  };

  const handleSplitInterval = (dayIdx: number, idx: number) => {
    setTemplateDrafts((prev) => {
      const list = [...(prev[dayIdx] ?? [])];
      const current = list[idx];
      if (!current) return prev;
      const duration = current.endMinute - current.startMinute;
      if (duration < SLOT_MINUTES * 2) return prev;
      const midpoint = snapMinute(current.startMinute + duration / 2);
      if (midpoint <= current.startMinute + SLOT_MINUTES || midpoint >= current.endMinute - SLOT_MINUTES) {
        return prev;
      }
      list.splice(
        idx,
        1,
        { startMinute: current.startMinute, endMinute: midpoint },
        { startMinute: midpoint, endMinute: current.endMinute },
      );
      return { ...prev, [dayIdx]: list };
    });
  };

  const handleTemplateSaveAll = async () => {
    if (!selectedScheduleId) {
      setAvailabilityError("Cria ou seleciona uma disponibilidade base primeiro.");
      return;
    }
    setTemplateSavingAll(true);
    setAvailabilityError(null);
    try {
      for (const dayIdx of DAY_ORDER) {
        const drafts = templateDrafts[dayIdx] ?? [];
        const parsed = normalizeIntervals(drafts);
        const res = await fetch(resolveCanonicalOrgApiPath("/api/org/[orgId]/reservas/disponibilidade"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "TEMPLATE",
            scopeType,
            scopeId,
            scheduleId: selectedScheduleId,
            dayOfWeek: dayIdx,
            intervals: parsed,
          }),
        });
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.ok) {
          throw new Error(json?.error || `Erro ao guardar ${DAY_LABELS[dayIdx]}.`);
        }
      }
      mutateAvailability();
    } catch (err) {
      setAvailabilityError(err instanceof Error ? err.message : "Erro ao guardar disponibilidade.");
    } finally {
      setTemplateSavingAll(false);
    }
  };

  const resetScheduleForm = () => {
    setScheduleFormMode("create");
    setScheduleDraftId(null);
    setScheduleStartDate("");
    setScheduleEndDate("");
    setScheduleNoEnd(true);
    setCloneFromActive(true);
  };

  const handleEditSchedule = (schedule: AvailabilitySchedule) => {
    setScheduleFormMode("edit");
    setScheduleDraftId(schedule.id);
    setScheduleStartDate(toDateInput(schedule.startDate));
    setScheduleEndDate(toDateInput(schedule.endDate));
    setScheduleNoEnd(!schedule.endDate);
    setCloneFromActive(false);
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
      const res = await fetch(resolveCanonicalOrgApiPath("/api/org/[orgId]/reservas/disponibilidade"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "SCHEDULE",
          scopeType,
          scopeId,
          scheduleId: scheduleFormMode === "edit" ? scheduleDraftId : undefined,
          startDate: scheduleStartDate,
          endDate: scheduleNoEnd ? null : scheduleEndDate,
          cloneFromScheduleId: scheduleFormMode === "create" && cloneFromActive ? activeScheduleId : undefined,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Erro ao guardar disponibilidade.");
      }
      const nextId = json?.schedule?.id ?? null;
      resetScheduleForm();
      mutateAvailability();
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
    if (!window.confirm("Remover esta disponibilidade?")) return;
    setAvailabilityError(null);
    try {
      const res = await fetch(resolveCanonicalOrgApiPath("/api/org/[orgId]/reservas/disponibilidade"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "SCHEDULE_DELETE",
          scopeType,
          scopeId,
          scheduleId,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Erro ao remover disponibilidade.");
      }
      mutateAvailability();
      if (selectedScheduleId === scheduleId) {
        setSelectedScheduleId(activeScheduleId ?? null);
      }
    } catch (err) {
      setAvailabilityError(err instanceof Error ? err.message : "Erro ao remover disponibilidade.");
    }
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
      const res = await fetch(resolveCanonicalOrgApiPath("/api/org/[orgId]/reservas/disponibilidade"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "OVERRIDE",
          scopeType,
          scopeId,
          date: overrideDate,
          kind: overrideKind,
          intervals: parsed.intervals,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Erro ao guardar exceção.");
      }
      setOverrideDate("");
      setOverrideIntervals([]);
      mutateAvailability();
    } catch (err) {
      setAvailabilityError(err instanceof Error ? err.message : "Erro ao guardar exceção.");
    } finally {
      setOverrideSaving(false);
    }
  };

  const handleOverrideDelete = async (overrideId: number) => {
    setAvailabilityError(null);
    try {
      const res = await fetch(resolveCanonicalOrgApiPath(`/api/org/[orgId]/reservas/disponibilidade/${overrideId}`), { method: "DELETE" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Erro ao remover exceção.");
      }
      mutateAvailability();
    } catch (err) {
      setAvailabilityError(err instanceof Error ? err.message : "Erro ao remover exceção.");
    }
  };

  const clampMinute = (value: number) => Math.min(DAY_MINUTES, Math.max(0, value));
  const snapMinute = (value: number) => Math.round(value / SLOT_MINUTES) * SLOT_MINUTES;

  const getMinuteFromPointer = (clientY: number, rectTop: number, rectHeight: number) => {
    const ratio = (clientY - rectTop) / rectHeight;
    return clampMinute(snapMinute(ratio * DAY_MINUTES));
  };

  const updateInterval = (dayIdx: number, index: number, startMinute: number, endMinute: number) => {
    setTemplateDrafts((prev) => {
      const list = [...(prev[dayIdx] ?? [])];
      if (!list[index]) return prev;
      list[index] = { startMinute, endMinute };
      return { ...prev, [dayIdx]: list };
    });
  };

  const normalizeDayDrafts = (dayIdx: number) => {
    setTemplateDrafts((prev) => {
      const list = prev[dayIdx] ?? [];
      const normalized = normalizeIntervals(list).map((interval) => ({
        startMinute: interval.startMinute,
        endMinute: interval.endMinute,
      }));
      return { ...prev, [dayIdx]: normalized };
    });
  };

  const startDragCreate = (dayIdx: number, event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const startMinute = getMinuteFromPointer(event.clientY, rect.top, rect.height);
    let index = 0;
    setTemplateDrafts((prev) => {
      const list = [...(prev[dayIdx] ?? [])];
      index = list.length;
      list.push({
        startMinute,
        endMinute: Math.min(startMinute + SLOT_MINUTES, DAY_MINUTES),
      });
      return { ...prev, [dayIdx]: list };
    });
    dragStateRef.current = {
      dayIdx,
      index,
      mode: "create",
      anchorMinute: startMinute,
      durationMinutes: SLOT_MINUTES,
      offsetMinutes: 0,
      rectTop: rect.top,
      rectHeight: rect.height,
    };
    setIsDragging(true);
  };

  const startDragResize = (
    dayIdx: number,
    index: number,
    mode: "resize-start" | "resize-end",
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    const column = event.currentTarget.closest("[data-day-column]") as HTMLDivElement | null;
    const rect = column?.getBoundingClientRect();
    if (!rect) return;
    const interval = templateDrafts[dayIdx]?.[index];
    if (!interval) return;
    dragStateRef.current = {
      dayIdx,
      index,
      mode,
      anchorMinute: interval.startMinute,
      durationMinutes: interval.endMinute - interval.startMinute,
      offsetMinutes: 0,
      rectTop: rect.top,
      rectHeight: rect.height,
    };
    setIsDragging(true);
  };

  const startDragMove = (
    dayIdx: number,
    index: number,
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    const column = event.currentTarget.closest("[data-day-column]") as HTMLDivElement | null;
    const rect = column?.getBoundingClientRect();
    if (!rect) return;
    const interval = templateDrafts[dayIdx]?.[index];
    if (!interval) return;
    const minute = getMinuteFromPointer(event.clientY, rect.top, rect.height);
    dragStateRef.current = {
      dayIdx,
      index,
      mode: "move",
      anchorMinute: interval.startMinute,
      durationMinutes: interval.endMinute - interval.startMinute,
      offsetMinutes: minute - interval.startMinute,
      rectTop: rect.top,
      rectHeight: rect.height,
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
        endMinute = Math.max(state.anchorMinute + SLOT_MINUTES, minute);
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
      if (endMinute - startMinute < SLOT_MINUTES) {
        if (state.mode === "resize-start") {
          startMinute = Math.max(0, endMinute - SLOT_MINUTES);
        } else {
          endMinute = Math.min(DAY_MINUTES, startMinute + SLOT_MINUTES);
        }
      }

      updateInterval(state.dayIdx, state.index, startMinute, endMinute);
    };

    const handleUp = () => {
      const state = dragStateRef.current;
      dragStateRef.current = null;
      setIsDragging(false);
      if (state) {
        normalizeDayDrafts(state.dayIdx);
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
  }, [isDragging]);

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
    <section className={cn(DASHBOARD_CARD, "p-5 space-y-4")}>
      <div>
        <h2 className="text-base font-semibold text-white">{title}</h2>
        <p className={DASHBOARD_MUTED}>{subtitle}</p>
        {inheritsOrganization && (
          <p className="mt-2 text-[12px] text-white/60">
            Sem horários próprios. A usar disponibilidade base da organização.
          </p>
        )}
        {!inheritsOrganization && scopeType === "ORGANIZATION" && schedules.length === 0 && (
          <p className="mt-2 text-[12px] text-white/60">
            Default ativo: 2ª a 6ª, 08:00-17:00 (sábado/domingo fechado).
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
                    onClick={() => setSelectedScheduleId(schedule.id)}
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
            {scheduleFormMode === "create" && (
              <label className="flex items-center gap-2 text-xs text-white/70">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-white/20 bg-black/30"
                  checked={cloneFromActive}
                  onChange={(event) => setCloneFromActive(event.target.checked)}
                  disabled={!activeScheduleId}
                />
                Copiar da disponibilidade ativa
              </label>
            )}
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
              disabled={templateSavingAll}
            >
              {templateSavingAll ? "A guardar semana..." : "Guardar semana"}
            </button>
            <div className="text-[10px] uppercase tracking-[0.22em] text-white/45">Grelha {SLOT_MINUTES} min</div>
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
                        {dayDrafts.map((interval, idx) => {
                          const top = interval.startMinute * minuteHeight;
                          const height = Math.max(12, (interval.endMinute - interval.startMinute) * minuteHeight);
                          const labelText = `${minutesToTime(interval.startMinute)}-${minutesToTime(interval.endMinute)}`;
                          return (
                            <div
                              key={`${label}-${idx}`}
                              className="group absolute left-1 right-1 rounded-xl border border-white/25 bg-[linear-gradient(135deg,rgba(255,255,255,0.14),rgba(255,255,255,0.05))] px-2.5 py-2 text-[10px] text-white shadow-[0_18px_40px_rgba(0,0,0,0.5)] backdrop-blur-2xl"
                              style={{ top, height }}
                              onPointerDown={(event) => startDragMove(dayIdx, idx, event)}
                            >
                              <div
                                className="absolute inset-x-1 top-0 h-2 cursor-ns-resize"
                                onPointerDown={(event) => startDragResize(dayIdx, idx, "resize-start", event)}
                              />
                              <div
                                className="absolute inset-x-1 bottom-0 h-2 cursor-ns-resize"
                                onPointerDown={(event) => startDragResize(dayIdx, idx, "resize-end", event)}
                              />
                              <div className="flex items-center justify-between gap-1">
                                <span className="font-semibold">{labelText}</span>
                                <div className="flex gap-1 opacity-0 transition group-hover:opacity-100">
                                  <button
                                    type="button"
                                    className="rounded-full border border-white/20 px-2 text-[10px] text-white/80"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      handleSplitInterval(dayIdx, idx);
                                    }}
                                  >
                                    Dividir
                                  </button>
                                  <button
                                    type="button"
                                    className="rounded-full border border-white/20 px-2 text-[10px] text-white/80"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      handleTemplateRemove(dayIdx, idx);
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
                  stepMinutes={15}
                  buttonClassName="h-10 rounded-xl"
                />
                <span className="text-white/60">→</span>
                <OryaTimeField
                  value={interval.end}
                  onChange={(next) => handleOverrideIntervalChange(idx, "end", next)}
                  stepMinutes={15}
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
          {overrides.length === 0 && (
            <p className="text-[12px] text-white/50">Sem exceções.</p>
          )}
          {overrides.map((override) => {
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
