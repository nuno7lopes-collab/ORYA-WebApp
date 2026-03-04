"use client";

import WeekCalendarReadClient from "../WeekCalendarReadClient";

export default function DayCalendarReadClient() {
  // loading e estados vazios/erro são tratados dentro de WeekCalendarReadClient.
  return <WeekCalendarReadClient mode="day" />;
}
