"use client";

import { useCallback, useEffect, useState } from "react";

export type OverlayPlacement = "top" | "bottom";

export type AdaptiveOverlayPosition = {
  style: React.CSSProperties | null;
  placement: OverlayPlacement;
};

type Params = {
  open: boolean;
  anchorRef: React.RefObject<HTMLElement | null>;
  overlayRef: React.RefObject<HTMLElement | null>;
  preferredWidth?: number;
  minWidth?: number;
  minHeight?: number;
  maxHeight?: number;
  gap?: number;
  viewportPadding?: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function useAdaptiveOverlayPosition(params: Params): AdaptiveOverlayPosition {
  const {
    open,
    anchorRef,
    overlayRef,
    preferredWidth = 320,
    minWidth = 200,
    minHeight = 220,
    maxHeight = 420,
    gap = 8,
    viewportPadding = 8,
  } = params;

  const [state, setState] = useState<AdaptiveOverlayPosition>({
    style: null,
    placement: "bottom",
  });

  const compute = useCallback(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;

    const rect = anchor.getBoundingClientRect();
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;

    const widthFromAnchor = Math.max(minWidth, rect.width);
    const idealWidth = Math.max(widthFromAnchor, preferredWidth);
    const width = clamp(idealWidth, minWidth, Math.max(minWidth, viewportW - viewportPadding * 2));

    const left = clamp(rect.left, viewportPadding, viewportW - width - viewportPadding);

    const overlayEl = overlayRef.current;
    const measuredHeight = overlayEl ? overlayEl.getBoundingClientRect().height : maxHeight;
    const spaceBelow = viewportH - rect.bottom - gap - viewportPadding;
    const spaceAbove = rect.top - gap - viewportPadding;

    const placeBottom = spaceBelow >= minHeight || spaceBelow >= spaceAbove;
    const placement: OverlayPlacement = placeBottom ? "bottom" : "top";

    const heightCap = Math.max(minHeight, Math.min(maxHeight, placeBottom ? spaceBelow : spaceAbove));
    const top = placeBottom
      ? rect.bottom + gap
      : Math.max(viewportPadding, rect.top - gap - Math.min(measuredHeight, heightCap));

    setState({
      placement,
      style: {
        position: "fixed",
        left,
        top,
        width,
        maxHeight: heightCap,
      },
    });
  }, [anchorRef, gap, maxHeight, minHeight, minWidth, overlayRef, preferredWidth, viewportPadding]);

  useEffect(() => {
    if (!open) {
      setState((current) => ({ ...current, style: null }));
      return;
    }

    compute();
    const onScroll = () => compute();
    const onResize = () => compute();

    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    const raf = window.requestAnimationFrame(compute);

    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
      window.cancelAnimationFrame(raf);
    };
  }, [compute, open]);

  return state;
}
