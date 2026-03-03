"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const DEFAULT_FALLBACK = "OR";
const DEFAULT_SIZE = 40;

type AvatarRingMode = "auto" | "none" | "subtle" | "story";
type AvatarRingVariant = "none" | "subtle" | "story-soft" | "story";

function getInitials(name?: string | null) {
  if (!name) return "";
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "";
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";
  return `${first}${last}`.toUpperCase();
}

export type AvatarProps = {
  src?: string | null;
  name?: string | null;
  alt?: string;
  version?: string | number | Date | null;
  ringMode?: AvatarRingMode;
  /**
   * @deprecated prefer ringMode. Kept for backwards compatibility.
   */
  ring?: boolean;
  className?: string;
  imageClassName?: string;
  textClassName?: string;
  fallbackText?: string;
  style?: CSSProperties;
  onError?: () => void;
};

export function Avatar({
  src,
  name,
  alt,
  version,
  ringMode,
  ring = true,
  className,
  imageClassName,
  textClassName,
  fallbackText,
  style,
  onError,
}: AvatarProps) {
  const [hasError, setHasError] = useState(false);
  const [avatarSize, setAvatarSize] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const resolvedSrc = useMemo(() => {
    if (!src) return null;
    if (version === undefined || version === null || version === "") return src;
    const versionValue = version instanceof Date ? version.getTime() : version;
    const separator = src.includes("?") ? "&" : "?";
    return `${src}${separator}v=${encodeURIComponent(String(versionValue))}`;
  }, [src, version]);
  const initials = useMemo(() => {
    const computed = getInitials(name);
    if (computed) return computed;
    return fallbackText || DEFAULT_FALLBACK;
  }, [fallbackText, name]);
  const hasImage = Boolean(resolvedSrc) && !hasError;

  const requestedRingMode = useMemo<AvatarRingMode>(() => {
    if (ringMode) return ringMode;
    return ring ? "auto" : "none";
  }, [ring, ringMode]);

  useEffect(() => {
    setHasError(false);
  }, [resolvedSrc]);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const updateSize = () => {
      const size = Math.min(node.offsetWidth, node.offsetHeight);
      setAvatarSize(size > 0 ? size : null);
    };

    updateSize();

    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => updateSize());
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const resolvedRingVariant = useMemo<AvatarRingVariant>(() => {
    const effectiveSize = avatarSize ?? DEFAULT_SIZE;
    if (requestedRingMode === "none") return "none";
    if (requestedRingMode === "subtle") return "subtle";

    // Micro avatars ficam mais nítidos sem "story ring" completo.
    if (effectiveSize <= 20) return "none";
    if (effectiveSize <= 32) return "subtle";
    if (effectiveSize <= 48) return "story-soft";

    return "story";
  }, [avatarSize, requestedRingMode]);

  const ringMetrics = useMemo(() => {
    const effectiveSize = avatarSize ?? DEFAULT_SIZE;
    if (resolvedRingVariant === "none") {
      return { width: 0, gap: 0, glow: 0 };
    }
    if (resolvedRingVariant === "subtle") {
      return { width: 1, gap: 0, glow: 0 };
    }
    if (resolvedRingVariant === "story-soft") {
      if (effectiveSize <= 40) return { width: 1, gap: 1, glow: 1 };
      return { width: 2, gap: 1, glow: 2 };
    }
    if (effectiveSize <= 56) return { width: 2, gap: 1, glow: 2 };
    if (effectiveSize <= 96) return { width: 2, gap: 1, glow: 3 };
    return { width: 3, gap: 1, glow: 4 };
  }, [avatarSize, resolvedRingVariant]);

  const ringTotalInset = ringMetrics.width + ringMetrics.gap;

  const fallbackFontSize = useMemo(() => {
    if (!avatarSize) return null;
    const innerSize = Math.max(0, avatarSize - ringTotalInset * 2);
    return Math.max(6, Math.round(innerSize * 0.28));
  }, [avatarSize, ringTotalInset]);

  const textClassHasExplicitSize = useMemo(() => {
    const value = textClassName ?? "";
    return /(?:^|\s)text-(?:xs|sm|base|lg|xl|[2-9]xl)(?:\s|$)|text-\[[0-9.]+(?:px|rem|em)\]/.test(value);
  }, [textClassName]);

  const normalizedClassName = useMemo(() => {
    if (resolvedRingVariant === "none" || !className) return className;
    return className
      .split(/\s+/)
      .filter(Boolean)
      .filter((token) => {
        const base = token.split(":").pop() ?? token;
        if (base === "border" || base.startsWith("border-")) return false;
        if (base === "ring" || base.startsWith("ring-")) return false;
        if (base === "outline" || base.startsWith("outline-")) return false;
        return true;
      })
      .join(" ");
  }, [className, resolvedRingVariant]);

  const ringStyle = useMemo<CSSProperties>(() => {
    return {
      ...(style ?? {}),
      ["--orya-avatar-ring-width" as string]: `${ringMetrics.width}px`,
      ["--orya-avatar-ring-gap" as string]: `${ringMetrics.gap}px`,
      ["--orya-avatar-ring-glow" as string]: `${ringMetrics.glow}px`,
    };
  }, [ringMetrics.gap, ringMetrics.glow, ringMetrics.width, style]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "orya-avatar relative inline-flex shrink-0 aspect-square items-center justify-center rounded-full",
        resolvedRingVariant !== "none" && "orya-avatar--with-ring",
        resolvedRingVariant === "subtle" && "orya-avatar--ring-subtle",
        resolvedRingVariant === "story-soft" && "orya-avatar--ring-story-soft",
        resolvedRingVariant === "story" && "orya-avatar--ring-story",
        normalizedClassName,
      )}
      style={ringStyle}
    >
      <div
        className={cn(
          "orya-avatar-inner absolute flex items-center justify-center overflow-hidden rounded-full",
          !hasImage && "orya-avatar-fallback",
        )}
      >
        {hasImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={resolvedSrc ?? ""}
            alt={alt ?? name ?? "Avatar"}
            className={cn("h-full w-full object-cover", imageClassName)}
            onError={() => {
              setHasError(true);
              onError?.();
            }}
          />
        ) : (
          <span
            style={
              fallbackFontSize && !textClassHasExplicitSize
                ? { fontSize: `${fallbackFontSize}px` }
                : undefined
            }
            className={cn(
              "font-semibold uppercase tracking-[0.08em] leading-none text-white/90 text-center",
              textClassName,
            )}
          >
            {initials}
          </span>
        )}
      </div>
    </div>
  );
}
