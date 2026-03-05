import type { ReactNode } from "react";

export function ScheduleShell(props: {
  toolbar: ReactNode;
  main: ReactNode;
  side?: ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-white/12 bg-black/20 p-3">{props.toolbar}</div>
      <div className="grid gap-3 lg:grid-cols-[1fr_320px]">
        <div className="rounded-2xl border border-white/12 bg-black/25 p-3">{props.main}</div>
        <div className="space-y-3">{props.side}</div>
      </div>
    </div>
  );
}
