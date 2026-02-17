"use client";

import WeekCalendarReadClient from "./WeekCalendarReadClient";
import DayCalendarReadClient from "./day/DayCalendarReadClient";

type CalendarView = "week" | "day";

export default function CalendarReadClient({ view }: { view: CalendarView }) {
  if (view === "day") {
    return <DayCalendarReadClient />;
  }
  return <WeekCalendarReadClient />;
}
