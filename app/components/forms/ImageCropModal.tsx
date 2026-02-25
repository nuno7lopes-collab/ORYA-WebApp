"use client";
/* eslint-disable @next/next/no-img-element */

import { type PointerEvent, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { clamp, clampCropOffset, computeBaseScale, computeSourceCrop, type CropOffset } from "@/app/components/forms/imageCropMath";

type CropShape = "rect" | "round";

type ImageCropModalProps = {
  open: boolean;
  file: File | null;
  onCancel: () => void;
  onConfirm: (file: File) => void | Promise<void>;
  ariaLabel: string;
  eyebrow: string;
  title: string;
  description: string;
  aspectRatio: number;
  outputWidth: number;
  outputHeight: number;
  outputFileName: string;
  outputMimeType?: "image/jpeg" | "image/png" | "image/webp";
  outputQuality?: number;
  minZoom?: number;
  maxZoom?: number;
  frameMaxWidthClassName?: string;
  shape?: CropShape;
};

const DEFAULT_MIN_ZOOM = 1;
const DEFAULT_MAX_ZOOM = 3;
const DEFAULT_JPEG_QUALITY = 0.92;

export function ImageCropModal({
  open,
  file,
  onCancel,
  onConfirm,
  ariaLabel,
  eyebrow,
  title,
  description,
  aspectRatio,
  outputWidth,
  outputHeight,
  outputFileName,
  outputMimeType = "image/jpeg",
  outputQuality,
  minZoom = DEFAULT_MIN_ZOOM,
  maxZoom = DEFAULT_MAX_ZOOM,
  frameMaxWidthClassName = "max-w-[560px]",
  shape = "rect",
}: ImageCropModalProps) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const dragStateRef = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null);

  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);
  const [frameSize, setFrameSize] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(minZoom);
  const [offset, setOffset] = useState<CropOffset>({ x: 0, y: 0 });
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPortalRoot(document.body);
  }, []);

  useEffect(() => {
    if (!open || !file) {
      setImageUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    setImageSize(null);
    return () => URL.revokeObjectURL(url);
  }, [open, file]);

  useEffect(() => {
    if (!open) return;
    setZoom(minZoom);
    setOffset({ x: 0, y: 0 });
    setProcessing(false);
    setError(null);
  }, [open, file, minZoom]);

  useEffect(() => {
    if (!open) return undefined;
    const frame = frameRef.current;
    if (!frame) return undefined;
    const update = () => {
      setFrameSize({
        width: frame.clientWidth || 0,
        height: frame.clientHeight || 0,
      });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(frame);
    return () => observer.disconnect();
  }, [open]);

  const baseScale = useMemo(
    () => computeBaseScale(frameSize, imageSize ?? { width: 0, height: 0 }),
    [frameSize, imageSize],
  );
  const scale = useMemo(() => baseScale * zoom, [baseScale, zoom]);

  const clampOffset = (nextOffset: CropOffset, nextScale = scale) =>
    clampCropOffset(nextOffset, frameSize, imageSize ?? { width: 0, height: 0 }, nextScale);

  useEffect(() => {
    if (!imageSize || !frameSize.width || !frameSize.height) return;
    const clamped = clampOffset(offset);
    if (clamped.x !== offset.x || clamped.y !== offset.y) {
      setOffset(clamped);
    }
  }, [imageSize, frameSize.width, frameSize.height, scale, offset.x, offset.y]);

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!imageSize) return;
    event.preventDefault();
    dragStateRef.current = {
      x: event.clientX,
      y: event.clientY,
      offsetX: offset.x,
      offsetY: offset.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragStateRef.current) return;
    const deltaX = event.clientX - dragStateRef.current.x;
    const deltaY = event.clientY - dragStateRef.current.y;
    const clamped = clampOffset({
      x: dragStateRef.current.offsetX + deltaX,
      y: dragStateRef.current.offsetY + deltaY,
    });
    setOffset(clamped);
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragStateRef.current) return;
    dragStateRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleZoomChange = (nextValue: number) => {
    const nextZoom = clamp(nextValue, minZoom, maxZoom);
    setZoom(nextZoom);
    setOffset((current) => clampOffset(current, baseScale * nextZoom));
  };

  const buildCroppedFile = async () => {
    if (!file || !imageRef.current || !imageSize) {
      throw new Error("Imagem não carregada.");
    }
    if (!frameSize.width || !frameSize.height) {
      throw new Error("Área de recorte indisponível.");
    }

    const canvas = document.createElement("canvas");
    canvas.width = outputWidth;
    canvas.height = outputHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas indisponível.");

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    const source = computeSourceCrop(frameSize, imageSize, offset, scale);
    if (shape === "round" && outputWidth === outputHeight) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(outputWidth / 2, outputHeight / 2, outputWidth / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
    }

    ctx.drawImage(
      imageRef.current,
      source.x,
      source.y,
      source.width,
      source.height,
      0,
      0,
      outputWidth,
      outputHeight,
    );

    if (shape === "round" && outputWidth === outputHeight) {
      ctx.restore();
    }

    const quality =
      outputQuality ??
      (outputMimeType === "image/png" ? 1 : DEFAULT_JPEG_QUALITY);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, outputMimeType, quality);
    });

    if (!blob) {
      throw new Error("Não foi possível gerar a imagem recortada.");
    }

    return new File([blob], outputFileName, { type: outputMimeType });
  };

  const handleConfirm = async () => {
    if (processing) return;
    setProcessing(true);
    setError(null);
    try {
      const croppedFile = await buildCroppedFile();
      await onConfirm(croppedFile);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao recortar imagem.");
    } finally {
      setProcessing(false);
    }
  };

  if (!open || !file || !portalRoot) return null;

  return createPortal(
    <div className="fixed inset-0 z-[210] flex items-start justify-center overflow-y-auto overscroll-contain px-4 py-6">
      <div className="fixed inset-0 bg-black/75" onClick={onCancel} aria-hidden />
      <div className="relative z-10 w-full max-w-3xl" role="dialog" aria-modal="true" aria-label={ariaLabel}>
        <div className="mb-3 flex items-center justify-between rounded-2xl border border-white/15 bg-[#0a0f1d]/90 px-4 py-3 text-white shadow-[0_24px_70px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">{eyebrow}</p>
            <p className="text-sm font-semibold text-white">{title}</p>
          </div>
          <div className="flex items-center gap-2 text-[12px]">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-white/70 hover:bg-white/10"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={processing || !imageUrl}
              className="rounded-full border border-white/25 bg-white/15 px-3 py-1 text-white/90 hover:bg-white/20 disabled:opacity-60"
            >
              {processing ? "A processar..." : "Concluir"}
            </button>
          </div>
        </div>

        <div className="rounded-3xl border border-white/12 bg-black/40 p-4 shadow-[0_18px_50px_rgba(0,0,0,0.45)]">
          <div className="flex flex-col gap-4 md:flex-row md:items-start">
            <div className="flex-1">
              <div
                ref={frameRef}
                className={`relative mx-auto w-full ${frameMaxWidthClassName} cursor-grab overflow-hidden rounded-2xl border border-white/15 bg-black/40 active:cursor-grabbing`}
                style={{ aspectRatio: String(aspectRatio), touchAction: "none" }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                onPointerLeave={handlePointerUp}
                onDragStart={(event) => event.preventDefault()}
                role="presentation"
              >
                {imageUrl ? (
                  <img
                    ref={imageRef}
                    src={imageUrl}
                    alt="Pré-visualização da imagem"
                    onLoad={(event) => {
                      const { naturalWidth, naturalHeight } = event.currentTarget;
                      setImageSize({
                        width: naturalWidth,
                        height: naturalHeight,
                      });
                    }}
                    className="pointer-events-none absolute left-1/2 top-1/2 max-w-none select-none"
                    style={{
                      width: imageSize ? `${imageSize.width}px` : "auto",
                      height: imageSize ? `${imageSize.height}px` : "auto",
                      transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
                      transformOrigin: "center center",
                    }}
                    draggable={false}
                    onDragStart={(event) => event.preventDefault()}
                  />
                ) : null}

                {shape === "round" ? (
                  <div className="pointer-events-none absolute inset-0">
                    <div className="absolute inset-0 rounded-full border border-white/30 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" />
                  </div>
                ) : (
                  <div className="pointer-events-none absolute inset-0">
                    <div className="absolute inset-0 border border-white/20" />
                    <div className="absolute inset-0 grid grid-cols-3 grid-rows-3">
                      {Array.from({ length: 9 }).map((_, index) => (
                        <div key={index} className="border border-white/10" />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="w-full space-y-3 text-sm text-white/70 md:w-[220px]">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/55">Zoom</p>
                <input
                  type="range"
                  min={minZoom}
                  max={maxZoom}
                  step={0.01}
                  value={zoom}
                  onChange={(event) => handleZoomChange(Number(event.target.value))}
                  className="mt-2 w-full accent-white"
                />
              </div>
              <p className="text-[12px] text-white/60">{description}</p>
              {error ? (
                <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-[12px] text-red-100">
                  {error}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>,
    portalRoot,
  );
}
