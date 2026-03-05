export function ScheduleToolbar(props: { title: string; subtitle?: string }) {
  return (
    <div className="space-y-2 text-white">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold">{props.title}</h3>
          {props.subtitle ? (
            <p className="text-[12px] text-white/70">{props.subtitle}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
