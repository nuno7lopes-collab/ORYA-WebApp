import Link from "next/link";
import { cn } from "@/lib/utils";
import type { DiscoverServiceCard } from "@/app/descobrir/_lib/discoverFeed";

const formatServicePrice = (service: DiscoverServiceCard) => {
  if (!service.unitPriceCents) return "Gratuito";
  const value = (service.unitPriceCents / 100).toFixed(2);
  return `${value} ${service.currency}`;
};

const formatServiceAddress = (service: DiscoverServiceCard) => {
  return (
    service.addressRef?.formattedAddress ||
    service.organization.addressRef?.formattedAddress ||
    "Local"
  );
};

const formatNextAvailability = (value?: string | null) => {
  if (!value) return "Sem horários";
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return "Sem horários";
  return `Próximo horário: ${parsed.toLocaleString("pt-PT", {
    dateStyle: "short",
    timeStyle: "short",
  })}`;
};

export default function ServiceCard({ service, className }: { service: DiscoverServiceCard; className?: string }) {
  const href = service.organization.username
    ? `/${service.organization.username}?serviceId=${service.id}`
    : `/servicos/${service.id}`;
  const orgName = service.organization.publicName || service.organization.businessName || "Organização";

  return (
    <Link
      href={href}
      className={cn(
        "group relative w-full rounded-[26px] p-[1px]",
        "bg-[linear-gradient(135deg,rgba(107,255,255,0.35),rgba(255,0,200,0.3))]",
        "shadow-[0_0_26px_rgba(107,255,255,0.14),0_0_26px_rgba(255,0,200,0.1)]",
        className,
      )}
    >
      <div className="relative flex h-full flex-col gap-3 overflow-hidden rounded-[24px] border border-white/10 bg-[rgba(7,10,16,0.92)] px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[14px] font-semibold text-white line-clamp-1">{service.title}</p>
            <p className="text-[11px] text-white/65">
              {service.durationMinutes} min · {formatServicePrice(service)}
            </p>
          </div>
          <span className="rounded-full border border-white/15 bg-white/10 px-2 py-1 text-[10px] text-white/70">
            {formatServiceAddress(service)}
          </span>
        </div>
        {service.description ? (
          <p className="text-[11px] text-white/65 line-clamp-2">{service.description}</p>
        ) : null}
        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 text-[11px] text-white/60">
          <span>{orgName}</span>
          <span>{formatNextAvailability(service.nextAvailability)}</span>
        </div>
      </div>
    </Link>
  );
}
