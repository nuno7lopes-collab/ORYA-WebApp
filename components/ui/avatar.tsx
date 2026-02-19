"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const DEFAULT_FALLBACK = "OR";

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

  const ringInset = useMemo(() => {
    if (!ring) return 0;
    if (!avatarSize) return 1.5;
    if (avatarSize <= 36) return 1;
    if (avatarSize <= 64) return 1.35;
    if (avatarSize <= 96) return 1.75;
    return 2;
  }, [avatarSize, ring]);

  const fallbackFontSize = useMemo(() => {
    if (!avatarSize) return null;
    const innerSize = ring ? Math.max(0, avatarSize - ringInset * 2) : avatarSize;
    return Math.max(6, Math.round(innerSize * 0.125));
  }, [avatarSize, ring, ringInset]);

  const ringGlow = useMemo(() => {
    if (!ring) return 0;
    if (!avatarSize) return 8;
    if (avatarSize <= 36) return 6;
    if (avatarSize <= 64) return 8;
    if (avatarSize <= 96) return 10;
    return 12;
  }, [avatarSize, ring]);

  const ringStyle = useMemo<CSSProperties>(() => {
    if (!ring) return style ?? {};
    return {
      ...(style ?? {}),
      ["--orya-avatar-ring-padding" as string]: `${ringInset}px`,
      ["--orya-avatar-ring-glow" as string]: `${ringGlow}px`,
    };
  }, [ring, ringGlow, ringInset, style]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative inline-flex items-center justify-center rounded-full",
        ring && "orya-avatar-ring",
        className,
      )}
      style={ringStyle}
    >
      <div
        className={cn(
          "relative flex h-full w-full items-center justify-center overflow-hidden rounded-full",
          ring && "border border-white/70",
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
            style={fallbackFontSize ? { fontSize: `${fallbackFontSize}px` } : undefined}
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
