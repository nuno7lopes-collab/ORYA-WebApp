"use client";

import { useEffect, useMemo } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import WeekCalendarReadClient from "./WeekCalendarReadClient";
import DayCalendarReadClient from "./day/DayCalendarReadClient";
import MonthCalendarReadClient from "./month/MonthCalendarReadClient";
import type { CalendarView } from "./ViewSwitcher";
import { buildOrgHref } from "@/lib/organizationIdUtils";

function normalizeView(raw: string | null): CalendarView {
  if (raw === "day" || raw === "month" || raw === "week") return raw;
  return "week";
}

export default function CalendarReadClient() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const orgIdRaw = Array.isArray(params?.orgId) ? params.orgId[0] : params?.orgId;
  const organizationId = Number(orgIdRaw);
  const view = useMemo(() => normalizeView(searchParams.get("view")), [searchParams]);
  useEffect(() => {
    if (!Number.isFinite(organizationId) || organizationId <= 0) return;
    const hasTimezoneParam = searchParams.has("tz");
    if (searchParams.get("view") === view && !hasTimezoneParam) return;
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("view", view);
    nextParams.delete("tz");
    const destination = buildOrgHref(organizationId, "/calendar");
    const serialized = nextParams.toString();
    router.replace(serialized ? `${destination}?${serialized}` : destination, { scroll: false });
  }, [organizationId, router, searchParams, view]);

  return (
    <>
      {view === "day" ? <DayCalendarReadClient /> : null}
      {view === "week" ? <WeekCalendarReadClient /> : null}
      {view === "month" ? <MonthCalendarReadClient /> : null}
    </>
  );
}
