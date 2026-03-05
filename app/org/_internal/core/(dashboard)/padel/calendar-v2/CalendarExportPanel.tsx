type ExportLink = {
  key: "pdf" | "html" | "csv" | "ics";
  label: string;
  href: string;
  external?: boolean;
};
export function CalendarExportPanel(props: {
  eventId: number | null;
  links: ExportLink[];
}) {
  return (
    <div className="space-y-3 rounded-2xl border border-white/12 bg-white/[0.04] p-4 text-white">
      <p className="text-sm font-semibold text-white">Exportar</p>
      <p className="text-[12px] text-white/65">
        Partilha a agenda com equipas e árbitros.
      </p>
      <div className="grid grid-cols-2 gap-2">
        {props.links.map((link) => {
          const disabled = !props.eventId;
          return (
            <a
              key={`calendar-export-${link.key}`}
              href={disabled ? "#" : link.href}
              target={link.external ? "_blank" : undefined}
              rel={link.external ? "noreferrer" : undefined}
              aria-disabled={disabled}
              className={`inline-flex items-center justify-center rounded-full border px-4 py-2 text-[12px] font-semibold text-white transition ${disabled ? "pointer-events-none border-white/10 text-white/40" : "border-white/25 bg-white/[0.03] hover:border-[#22D3EE]/70 hover:text-[#d8ffff]"}`}
            >
              {link.label}
            </a>
          );
        })}
      </div>
      {!props.eventId ? (
        <p className="text-[12px] text-white/55">
          Seleciona um torneio para exportar.
        </p>
      ) : null}
    </div>
  );
}
