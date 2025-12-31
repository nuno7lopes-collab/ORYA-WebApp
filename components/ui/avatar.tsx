"use client";

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
  className?: string;
  imageClassName?: string;
  textClassName?: string;
  fallbackText?: string;
  onError?: () => void;
};

export function Avatar({
  src,
  name,
  alt,
  version,
  className,
  imageClassName,
  textClassName,
  fallbackText,
  onError,
}: AvatarProps) {
  const [hasError, setHasError] = useState(false);
  const [fallbackSize, setFallbackSize] = useState<number | null>(null);
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
      setFallbackSize(size > 0 ? size : null);
    };

    updateSize();

    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => updateSize());
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const fallbackFontSize = useMemo(() => {
    if (!fallbackSize) return null;
    return Math.max(6, Math.round(fallbackSize * 0.125));
  }, [fallbackSize]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative flex items-center justify-center overflow-hidden rounded-full",
        className,
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
  );
}
