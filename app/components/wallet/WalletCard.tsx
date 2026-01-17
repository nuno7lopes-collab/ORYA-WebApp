import Image from "next/image";
import Link from "next/link";
import { defaultBlurDataURL } from "@/lib/image";
import { getEventCoverUrl } from "@/lib/eventCover";
import { WalletItem } from "./useWallet";

type Props = {
  item: WalletItem;
  compact?: boolean;
};

export function WalletCard({ item, compact = false }: Props) {
  const badgeColor =
    item.status === "ACTIVE"
      ? "bg-emerald-500/20 border-emerald-400/40 text-emerald-50"
      : item.status === "USED"
        ? "bg-blue-500/10 border-blue-400/30 text-blue-50"
        : "bg-red-500/10 border-red-400/30 text-red-50";

  const dateLabel = item.snapshot.startAt
    ? new Date(item.snapshot.startAt).toLocaleString("pt-PT", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Data a anunciar";
  const coverSrc = getEventCoverUrl(item.snapshot.coverUrl, {
    seed: item.snapshot.title ?? item.entitlementId,
    width: compact ? 500 : 700,
    quality: 75,
    format: "webp",
  });

  return (
    <article
      className={`group relative overflow-hidden rounded-2xl border border-white/15 bg-[linear-gradient(160deg,rgba(255,255,255,0.1),rgba(2,6,16,0.9))] backdrop-blur-2xl shadow-[0_20px_55px_rgba(0,0,0,0.7)] ${
        compact ? "aspect-[1/1.05] w-[220px] min-w-[220px]" : "aspect-[1/1.1] flex flex-col"
      }`}
    >
      <div className="absolute inset-0 overflow-hidden">
        <Image
          src={coverSrc}
          alt={item.snapshot.title}
          fill
          sizes={compact ? "260px" : "400px"}
          className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          placeholder="blur"
          blurDataURL={defaultBlurDataURL}
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />
      </div>

      <div className="relative h-full flex flex-col justify-end p-3 text-[12px] text-white">
        <div className="flex items-center justify-between mb-2">
          <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] ${badgeColor}`}>
            {item.status}
          </span>
          <span className="text-[10px] uppercase tracking-[0.16em] text-white/70">{item.type}</span>
        </div>
        <h3 className="text-sm font-semibold leading-snug line-clamp-2">{item.snapshot.title}</h3>
        <p className="text-[11px] text-white/80">{dateLabel}</p>
        <p className="text-[10px] text-white/65 mt-1">{item.snapshot.venueName ?? "Local a anunciar"}</p>

        <div className="mt-3 flex items-center justify-between gap-2">
          <Link
            href={`/me/bilhetes/${encodeURIComponent(item.entitlementId)}`}
            className="text-[11px] font-semibold text-white/90 underline underline-offset-4 hover:text-white"
          >
            Ver detalhe
          </Link>
          {item.actions?.canShowQr && (
            <span className="inline-flex items-center rounded-lg border border-white/20 bg-white/15 px-2 py-1 text-[10px] text-white/90">
              QR pronto
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
