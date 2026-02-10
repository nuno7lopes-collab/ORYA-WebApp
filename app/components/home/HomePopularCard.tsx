"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { defaultBlurDataURL } from "@/lib/image";

type HomePopularCardProps = {
  href: string;
  imageUrl: string;
  title: string;
  location?: string | null;
  tagLabel?: string;
  metaLabel?: string | null;
};

type Tint = {
  r: number;
  g: number;
  b: number;
};

const clamp = (value: number) => Math.max(0, Math.min(255, value));

const DEFAULT_TINT: Tint = { r: 12, g: 16, b: 24 };

const buildTint = (r: number, g: number, b: number): Tint => {
  const factor = 0.48;
  return {
    r: clamp(Math.round(r * factor)),
    g: clamp(Math.round(g * factor)),
    b: clamp(Math.round(b * factor)),
  };
};

const toRgba = (tint: Tint, alpha: number) =>
  `rgba(${tint.r}, ${tint.g}, ${tint.b}, ${alpha})`;

const sampleTintFromImage = (image: HTMLImageElement): Tint | null => {
  try {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return null;
    canvas.width = 1;
    canvas.height = 1;
    context.drawImage(image, 0, 0, 1, 1);
    const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
    return buildTint(r, g, b);
  } catch {
    return null;
  }
};

export default function HomePopularCard({
  href,
  imageUrl,
  title,
  location,
  tagLabel,
  metaLabel,
}: HomePopularCardProps) {
  const [tint, setTint] = useState<Tint>(DEFAULT_TINT);
  const sampledRef = useRef(false);

  useEffect(() => {
    setTint(DEFAULT_TINT);
    sampledRef.current = false;
  }, [imageUrl]);

  const overlayHeight = "68%";
  const gradientStyle = useMemo(
    () => ({
      background: `linear-gradient(180deg, ${toRgba(tint, 0)} 0%, ${toRgba(
        tint,
        0.45,
      )} 18%, ${toRgba(tint, 0.82)} 42%, ${toRgba(tint, 0.98)} 70%, rgba(0, 0, 0, 0.6) 100%)`,
    }),
    [tint],
  );

  return (
    <Link
      href={href}
      draggable={false}
      onDragStart={(event) => event.preventDefault()}
      className="group block shrink-0"
    >
      <div
        className="relative w-[260px] overflow-hidden rounded-2xl border border-white/10 bg-[#0f141a] transition hover:border-white/25"
        style={{ width: 260 }}
      >
        <div className="relative aspect-square w-full overflow-hidden bg-[#0f141a]">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={title}
              fill
              sizes="260px"
              draggable={false}
              onLoadingComplete={(image) => {
                if (sampledRef.current) return;
                const resolved = sampleTintFromImage(image);
                if (resolved) {
                  sampledRef.current = true;
                  setTint(resolved);
                }
              }}
              className="object-cover transition-transform duration-700 group-hover:scale-[1.04]"
              placeholder="blur"
              blurDataURL={defaultBlurDataURL}
            />
          ) : (
            <div className="absolute inset-0 orya-profile-cover-fallback" />
          )}
          <div
            className="absolute inset-x-0 bottom-0 rounded-b-2xl backdrop-blur-[16px]"
            style={{
              height: overlayHeight,
              maskImage: "linear-gradient(180deg, rgba(0,0,0,0) 0%, #000 32%, #000 100%)",
              WebkitMaskImage:
                "linear-gradient(180deg, rgba(0,0,0,0) 0%, #000 32%, #000 100%)",
            }}
          />
          <div
            className="absolute inset-x-0 bottom-0 rounded-b-2xl"
            style={{ height: overlayHeight, ...gradientStyle }}
          />
          <div
            className="absolute inset-x-0 bottom-0 rounded-b-2xl"
            style={{
              height: overlayHeight,
              background:
                "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.28) 30%, rgba(0,0,0,0.55) 100%)",
            }}
          />
          {tagLabel ? (
            <span className="absolute left-3 top-3 rounded-full border border-white/30 bg-black/70 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white shadow-[0_6px_18px_rgba(0,0,0,0.45)]">
              {tagLabel}
            </span>
          ) : null}
          <div
            className="absolute inset-x-0 bottom-0 flex flex-col justify-end gap-1 px-4 pb-4 pt-6"
            style={{ height: overlayHeight }}
          >
            <p className="orya-clamp-2 text-[15px] font-semibold text-white drop-shadow-[0_3px_12px_rgba(0,0,0,0.85)]">
              {title}
            </p>
            {metaLabel ? (
              <p className="orya-clamp-1 text-[12px] font-medium text-white/95 drop-shadow-[0_3px_10px_rgba(0,0,0,0.75)]">
                {metaLabel}
              </p>
            ) : null}
            {location ? (
              <p className="orya-clamp-1 text-[12px] text-white/80 drop-shadow-[0_3px_10px_rgba(0,0,0,0.75)]">
                {location}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </Link>
  );
}
