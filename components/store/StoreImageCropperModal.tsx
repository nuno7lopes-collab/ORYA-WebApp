"use client";
/* eslint-disable @next/next/no-img-element */

import { type PointerEvent, useEffect, useMemo, useRef, useState } from "react";
import StorePanelModal from "@/components/store/StorePanelModal";

type StoreImageCropperModalProps = {
  open: boolean;
  file: File | null;
  title?: string;
  description?: string;
  outputSize?: number;
  maxBytes?: number;
  onClose: () => void;
  onConfirm: (file: File) => void;
};

const DEFAULT_OUTPUT_SIZE = 1024;
const DEFAULT_MAX_BYTES = 5 * 1024 * 1024;
const MIN_ZOOM = 1;
const MAX_ZOOM = 3;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function buildOutputName(original: string, extension: string) {
  const base = original.replace(/\.[^/.]+$/, "") || "imagem";
  return `${base}-crop.${extension}`;
}

function resolveOutputFormat(file: File) {
  if (file.type === "image/png") return { mime: "image/png", ext: "png", quality: 1 };
  if (file.type === "image/webp") return { mime: "image/webp", ext: "webp", quality: 0.9 };
  return { mime: "image/jpeg", ext: "jpg", quality: 0.9 };
}

export default function StoreImageCropperModal({
  open,
  file,
  title = "Ajustar imagem",
  description = "Formato 1:1. Arrasta para posicionar e usa o zoom.",
  outputSize = DEFAULT_OUTPUT_SIZE,
  maxBytes = DEFAULT_MAX_BYTES,
  onClose,
  onConfirm,
}: StoreImageCropperModalProps) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const dragState = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null);

  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);
  const [viewSize, setViewSize] = useState(320);
  const [zoom, setZoom] = useState(1);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !file) return undefined;
    const url = URL.createObjectURL(file);
    setImageSrc(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [open, file]);

  useEffect(() => {
    if (!open || !file) return;
    setZoom(1);
    setOffsetX(0);
    setOffsetY(0);
    setError(null);
  }, [open, file]);

  useEffect(() => {
    if (!open) return undefined;
    const element = frameRef.current;
    if (!element) return undefined;
    const updateSize = () => setViewSize(element.clientWidth || 320);
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(element);
    return () => observer.disconnect();
  }, [open]);

  const baseScale = useMemo(() => {
    if (!imageSize || !viewSize) return 1;
    return Math.max(viewSize / imageSize.width, viewSize / imageSize.height);
  }, [imageSize, viewSize]);

  const scale = useMemo(() => baseScale * zoom, [baseScale, zoom]);

  const clampOffsets = (nextX: number, nextY: number, nextScale = scale) => {
    if (!imageSize || !viewSize) return { x: 0, y: 0 };
    const scaledWidth = imageSize.width * nextScale;
    const scaledHeight = imageSize.height * nextScale;
    const maxX = Math.max(0, (scaledWidth - viewSize) / 2);
    const maxY = Math.max(0, (scaledHeight - viewSize) / 2);
    return {
      x: clamp(nextX, -maxX, maxX),
      y: clamp(nextY, -maxY, maxY),
    };
  };

  useEffect(() => {
    if (!imageSize || !viewSize) return;
    const clamped = clampOffsets(offsetX, offsetY, scale);
    if (clamped.x !== offsetX) setOffsetX(clamped.x);
    if (clamped.y !== offsetY) setOffsetY(clamped.y);
  }, [imageSize, viewSize, scale, offsetX, offsetY]);

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!imageSize) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragState.current = { x: event.clientX, y: event.clientY, offsetX, offsetY };
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragState.current) return;
    const deltaX = event.clientX - dragState.current.x;
    const deltaY = event.clientY - dragState.current.y;
    const nextX = dragState.current.offsetX + deltaX;
    const nextY = dragState.current.offsetY + deltaY;
    const clamped = clampOffsets(nextX, nextY);
    setOffsetX(clamped.x);
    setOffsetY(clamped.y);
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragState.current) return;
    dragState.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const resetPosition = () => {
    const clamped = clampOffsets(0, 0);
    setOffsetX(clamped.x);
    setOffsetY(clamped.y);
    setZoom(1);
  };

  const handleZoomChange = (value: number) => {
    const nextZoom = clamp(value, MIN_ZOOM, MAX_ZOOM);
    setZoom(nextZoom);
    const clamped = clampOffsets(offsetX, offsetY, baseScale * nextZoom);
    setOffsetX(clamped.x);
    setOffsetY(clamped.y);
  };

  const buildCroppedFile = async () => {
    if (!file || !imageRef.current || !imageSize) {
      throw new Error("Imagem nao carregada.");
    }

    const canvas = document.createElement("canvas");
    canvas.width = outputSize;
    canvas.height = outputSize;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas indisponivel.");

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    const scaledWidth = imageSize.width * scale;
    const scaledHeight = imageSize.height * scale;
    const imageLeft = viewSize / 2 - scaledWidth / 2 + offsetX;
    const imageTop = viewSize / 2 - scaledHeight / 2 + offsetY;
    const cropLeft = (0 - imageLeft) / scale;
    const cropTop = (0 - imageTop) / scale;
    const cropSize = viewSize / scale;

    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, outputSize, outputSize);
    ctx.drawImage(
      imageRef.current,
      cropLeft,
      cropTop,
      cropSize,
      cropSize,
      0,
      0,
      outputSize,
      outputSize,
    );

    const { mime, ext, quality } = resolveOutputFormat(file);
    let currentQuality = quality;
    let blob: Blob | null = null;

    for (let attempt = 0; attempt < 4; attempt += 1) {
      blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, mime, currentQuality),
      );
      if (!blob) break;
      if (blob.size <= maxBytes || mime === "image/png") break;
      currentQuality = Math.max(0.7, currentQuality - 0.1);
    }

    if (!blob) throw new Error("Falha ao gerar imagem.");
    if (blob.size > maxBytes) {
      throw new Error("Imagem demasiado grande depois do corte.");
    }

    return new File([blob], buildOutputName(file.name, ext), { type: mime });
  };

  const handleConfirm = async () => {
    if (processing) return;
    setProcessing(true);
    setError(null);
    try {
      const cropped = await buildCroppedFile();
      onConfirm(cropped);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao recortar.");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <StorePanelModal
      open={open}
      onClose={onClose}
      eyebrow="Recorte"
      title={title}
      description={description}
      size="md"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/20 px-4 py-2 text-xs text-white/75 hover:border-white/40"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={processing || !imageSrc}
            className="rounded-full border border-white/20 bg-white/85 px-4 py-2 text-xs font-semibold text-black shadow-[0_10px_26px_rgba(255,255,255,0.2)] transition hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60"
          >
            {processing ? "A recortar..." : "Aplicar corte"}
          </button>
        </>
      }
    >
      <div className="grid gap-4">
        <div
          ref={frameRef}
          className="relative aspect-square w-full overflow-hidden rounded-2xl border border-white/15 bg-black/40"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          style={{ touchAction: "none" }}
        >
          {imageSrc ? (
            <img
              ref={imageRef}
              src={imageSrc}
              alt="Imagem para recorte"
              onLoad={(event) => {
                const target = event.currentTarget;
                setImageSize({ width: target.naturalWidth, height: target.naturalHeight });
              }}
              className="absolute left-1/2 top-1/2 max-w-none select-none"
              style={{
                transform: `translate(-50%, -50%) translate(${offsetX}px, ${offsetY}px) scale(${scale})`,
                transformOrigin: "center center",
              }}
              draggable={false}
            />
          ) : null}
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute inset-0 border border-white/20" />
            <div className="absolute inset-0 grid grid-cols-3 grid-rows-3">
              {Array.from({ length: 9 }).map((_, index) => (
                <div key={index} className="border border-white/10" />
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs text-white/60">
          <span>Zoom</span>
          <input
            type="range"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={0.01}
            value={zoom}
            onChange={(event) => handleZoomChange(Number(event.target.value))}
            className="flex-1 accent-white"
          />
          <button
            type="button"
            onClick={resetPosition}
            className="rounded-full border border-white/20 px-3 py-1 text-[11px] text-white/70 hover:border-white/40"
          >
            Recentrar
          </button>
        </div>

        <div className="flex items-center justify-between text-[11px] text-white/50">
          <span>Saida: {outputSize}x{outputSize}px</span>
          <span>Arrasta para ajustar</span>
        </div>

        {error ? (
          <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-xs text-red-100">
            {error}
          </div>
        ) : null}
      </div>
    </StorePanelModal>
  );
}
