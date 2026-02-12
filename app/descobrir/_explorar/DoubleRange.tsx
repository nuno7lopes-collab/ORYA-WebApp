"use client";

import { useEffect, useRef, useState } from "react";

type DoubleRangeProps = {
  min: number;
  max: number;
  step: number;
  valueMin: number;
  valueMax: number;
  onCommit: (min: number, max: number) => void;
};

export function DoubleRange({ min, max, step, valueMin, valueMax, onCommit }: DoubleRangeProps) {
  const gap = 1;
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = useState<0 | 1 | null>(null);
  const draggingRef = useRef<0 | 1 | null>(null);
  const [localMin, setLocalMin] = useState(valueMin);
  const [localMax, setLocalMax] = useState(valueMax);
  const localMinRef = useRef(valueMin);
  const localMaxRef = useRef(valueMax);

  useEffect(() => {
    if (draggingRef.current !== null) return;
    localMinRef.current = valueMin;
    localMaxRef.current = valueMax;
    setLocalMin(valueMin);
    setLocalMax(valueMax);
  }, [valueMin, valueMax]);

  const clampValue = (value: number) => Math.min(max, Math.max(min, value));
  const snapValue = (value: number) => {
    const snapped = Math.round(value / step) * step;
    return clampValue(snapped);
  };
  const valueFromClientX = (clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return min;
    const percent = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    return snapValue(min + percent * (max - min));
  };
  const applyValue = (next: number, thumb: 0 | 1) => {
    const currentMin = localMinRef.current;
    const currentMax = localMaxRef.current;
    if (thumb === 0) {
      const clamped = Math.min(next, currentMax - gap);
      const nextMin = clampValue(clamped);
      localMinRef.current = nextMin;
      localMaxRef.current = currentMax;
      setLocalMin(nextMin);
      setLocalMax(currentMax);
    } else {
      const clamped = Math.max(next, currentMin + gap);
      const nextMax = clampValue(clamped);
      localMinRef.current = currentMin;
      localMaxRef.current = nextMax;
      setLocalMin(currentMin);
      setLocalMax(nextMax);
    }
  };

  const startDrag = (thumb: 0 | 1, clientX: number) => {
    setDragging(thumb);
    draggingRef.current = thumb;
    applyValue(valueFromClientX(clientX), thumb);
  };

  const stopDrag = () => {
    if (draggingRef.current === null) return;
    draggingRef.current = null;
    setDragging(null);
    onCommit(localMinRef.current, localMaxRef.current);
  };

  const handleThumbMouseDown = (thumb: 0 | 1) => (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    startDrag(thumb, event.clientX);
  };

  const handleThumbTouchStart = (thumb: 0 | 1) => (event: React.TouchEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const touch = event.touches[0];
    if (!touch) return;
    startDrag(thumb, touch.clientX);
  };

  const handleTrackMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const next = valueFromClientX(event.clientX);
    const distToMin = Math.abs(next - localMinRef.current);
    const distToMax = Math.abs(next - localMaxRef.current);
    const targetThumb: 0 | 1 = distToMin <= distToMax ? 0 : 1;
    startDrag(targetThumb, event.clientX);
  };

  const handleTrackTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const touch = event.touches[0];
    if (!touch) return;
    const next = valueFromClientX(touch.clientX);
    const distToMin = Math.abs(next - localMinRef.current);
    const distToMax = Math.abs(next - localMaxRef.current);
    const targetThumb: 0 | 1 = distToMin <= distToMax ? 0 : 1;
    startDrag(targetThumb, touch.clientX);
  };

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (draggingRef.current === null) return;
      applyValue(valueFromClientX(event.clientX), draggingRef.current);
    };
    const handleMouseUp = () => stopDrag();
    const handleTouchMove = (event: TouchEvent) => {
      if (draggingRef.current === null) return;
      const touch = event.touches[0];
      if (!touch) return;
      event.preventDefault();
      applyValue(valueFromClientX(touch.clientX), draggingRef.current);
    };
    const handleTouchEnd = () => stopDrag();

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    window.addEventListener("touchend", handleTouchEnd);
    window.addEventListener("touchcancel", handleTouchEnd);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
      window.removeEventListener("touchcancel", handleTouchEnd);
    };
  }, [min, max, step]);

  const minPercent = ((localMin - min) / (max - min)) * 100;
  const maxPercent = ((localMax - min) / (max - min)) * 100;

  return (
    <div className="space-y-3">
      <div
        ref={trackRef}
        onMouseDown={handleTrackMouseDown}
        onTouchStart={handleTrackTouchStart}
        className="relative h-3 rounded-full border border-white/12 bg-white/8 cursor-pointer select-none"
        style={{ touchAction: "none" }}
      >
        <div className="absolute inset-0 rounded-full bg-gradient-to-r from-white/10 via-white/5 to-transparent" />
        <div
          className="absolute h-full rounded-full bg-gradient-to-r from-[#6BFFFF] via-[#8B8CFF] to-[#FF5EDB] shadow-[0_0_14px_rgba(107,255,255,0.35)]"
          style={{ left: `${minPercent}%`, width: `${maxPercent - minPercent}%` }}
        />
        <button
          type="button"
          role="slider"
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={valueMin}
          onMouseDown={handleThumbMouseDown(0)}
          onTouchStart={handleThumbTouchStart(0)}
          className="absolute top-1/2 h-7 w-7 -translate-y-1/2 -translate-x-1/2 rounded-full border border-white/60 bg-[radial-gradient(circle_at_30%_30%,#F8FFFF,#8FE9FF_55%,#315CFF_100%)] shadow-[0_0_16px_rgba(107,255,255,0.55),inset_0_0_8px_rgba(255,255,255,0.5)]"
          style={{ left: `${minPercent}%`, zIndex: dragging === 0 ? 30 : 20, touchAction: "none" }}
        />
        {dragging !== null && (
          <div
            className="absolute -top-8 px-2 py-1 rounded-full border border-white/15 bg-black/70 text-[10px] text-white/85 shadow-[0_8px_20px_rgba(0,0,0,0.45)]"
            style={{ left: `${minPercent}%`, transform: "translateX(-50%)", pointerEvents: "none" }}
          >
            € {localMin}
          </div>
        )}
        <button
          type="button"
          role="slider"
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={valueMax}
          onMouseDown={handleThumbMouseDown(1)}
          onTouchStart={handleThumbTouchStart(1)}
          className="absolute top-1/2 h-7 w-7 -translate-y-1/2 -translate-x-1/2 rounded-full border border-white/60 bg-[radial-gradient(circle_at_30%_30%,#F8FFFF,#8FE9FF_55%,#315CFF_100%)] shadow-[0_0_16px_rgba(107,255,255,0.55),inset_0_0_8px_rgba(255,255,255,0.5)]"
          style={{ left: `${maxPercent}%`, zIndex: dragging === 1 ? 30 : 20, touchAction: "none" }}
        />
        {dragging !== null && (
          <div
            className="absolute -top-8 px-2 py-1 rounded-full border border-white/15 bg-black/70 text-[10px] text-white/85 shadow-[0_8px_20px_rgba(0,0,0,0.45)]"
            style={{ left: `${maxPercent}%`, transform: "translateX(-50%)", pointerEvents: "none" }}
          >
            {localMax >= max ? "100+" : `€ ${localMax}`}
          </div>
        )}
      </div>
      <div className="flex justify-between text-[10px] text-white/60">
        <span>{min}€</span>
        <span>{max}+€</span>
      </div>
    </div>
  );
}
