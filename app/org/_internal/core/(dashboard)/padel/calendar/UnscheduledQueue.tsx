export function UnscheduledQueue(props: {
  title?: string;
  rows: Array<{ label: string; value: number }>;
}) {
  return (
    <div className="rounded-2xl border border-white/12 bg-white/5 p-3 text-white">
      <p className="text-sm font-semibold">{props.title ?? "Pendentes"}</p>
      {props.rows.length === 0 ? (
        <p className="mt-2 text-[12px] text-white/65">Sem pendentes.</p>
      ) : (
        <div className="mt-2 max-h-52 space-y-1 overflow-y-auto pr-1 text-[12px] text-white/75 orya-scrollbar-hide">
          {props.rows.map((row) => (
            <div
              key={row.label}
              className="flex items-center justify-between gap-2 rounded-lg border border-white/10 px-2 py-1"
            >
              <span className="truncate">{row.label}</span>
              <span className="font-semibold text-white">{row.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
