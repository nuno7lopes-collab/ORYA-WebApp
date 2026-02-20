import type { ReactNode } from "react";

export function ScheduleToolbar(props: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  filters?: ReactNode;
}) {
  return (
    <div className="space-y-2 text-white">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-white/55">Calendário V2</p>
          <h3 className="text-base font-semibold">{props.title}</h3>
          {props.subtitle ? <p className="text-[12px] text-white/70">{props.subtitle}</p> : null}
        </div>
        {props.actions}
      </div>
      {props.filters}
    </div>
  );
}
