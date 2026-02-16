"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";

type CropOffset = { x: number; y: number };

type ProfileCoverCropModalProps = {
  open: boolean;
  file: File | null;
  onCancel: () => void;
  onConfirm: (file: File) => void;
};

const OUTPUT_WIDTH = 1500;
const OUTPUT_HEIGHT = 500;
const ASPECT_RATIO = OUTPUT_WIDTH / OUTPUT_HEIGHT;

export function ProfileCoverCropModal({
  open,
  file,
  onCancel,
  onConfirm,
}: ProfileCoverCropModalProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [containerRect, setContainerRect] = useState({ width: 0, height: 0 });
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<CropOffset>({ x: 0, y: 0 });
  const [processing, setProcessing] = useState(false);
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const dragStartRef = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null);

  useEffect(() => {
    if (!open || !file) {
      setImageUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [open, file]);

  useEffect(() => {
    if (!open) return;
    const updateSize = () => {
      const width = containerRef.current?.clientWidth ?? 0;
      const height = width > 0 ? width / ASPECT_RATIO : 0;
      setContainerRect({ width, height });
    };
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }, [open, file]);

  useEffect(() => {
    setPortalRoot(document.body);
  }, []);

  const baseScale = useMemo(() => {
    if (!containerRect.width || !containerRect.height || !imageSize.width || !imageSize.height) return 1;
    return Math.max(containerRect.width / imageSize.width, containerRect.height / imageSize.height);
  }, [containerRect, imageSize]);

  const clampOffset = (next: CropOffset, scale: number) => {
    if (!containerRect.width || !containerRect.height || !imageSize.width || !imageSize.height) return next;
    const maxX = Math.max(0, (imageSize.width * scale - containerRect.width) / 2);
    const maxY = Math.max(0, (imageSize.height * scale - containerRect.height) / 2);
    return {
      x: Math.min(Math.max(next.x, -maxX), maxX),
      y: Math.min(Math.max(next.y, -maxY), maxY),
    };
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    dragStartRef.current = {
      x: event.clientX,
      y: event.clientY,
      offsetX: offset.x,
      offsetY: offset.y,
    };
    containerRef.current.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStartRef.current) return;
    const scale = baseScale * zoom;
    const deltaX = event.clientX - dragStartRef.current.x;
    const deltaY = event.clientY - dragStartRef.current.y;
    const next = clampOffset(
      {
        x: dragStartRef.current.offsetX + deltaX,
        y: dragStartRef.current.offsetY + deltaY,
      },
      scale,
    );
    setOffset(next);
  };

  const handlePointerUp = () => {
    dragStartRef.current = null;
  };

  const handleConfirm = async () => {
    if (!imageRef.current || !containerRect.width || !containerRect.height || !imageSize.width || !imageSize.height) return;
    const scale = baseScale * zoom;
    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT_WIDTH;
    canvas.height = OUTPUT_HEIGHT;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const x0 = containerRect.width / 2 - (imageSize.width * scale) / 2 + offset.x;
    const y0 = containerRect.height / 2 - (imageSize.height * scale) / 2 + offset.y;
    const srcWidth = containerRect.width / scale;
    const srcHeight = containerRect.height / scale;
    const maxSrcX = Math.max(0, imageSize.width - srcWidth);
    const maxSrcY = Math.max(0, imageSize.height - srcHeight);
    const srcX = Math.min(Math.max((0 - x0) / scale, 0), maxSrcX);
    const srcY = Math.min(Math.max((0 - y0) / scale, 0), maxSrcY);

    setProcessing(true);
    ctx.drawImage(imageRef.current, srcX, srcY, srcWidth, srcHeight, 0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT);
    canvas.toBlob(
      (blob) => {
        setProcessing(false);
        if (!blob) return;
        const croppedFile = new File([blob], "profile-cover.jpg", { type: "image/jpeg" });
        onConfirm(croppedFile);
      },
      "image/jpeg",
      0.92,
    );
  };

  if (!open || !file || !portalRoot) return null;

  const scale = baseScale * zoom;

  return createPortal(
    <div className="fixed inset-0 z-[210] flex items-start justify-center overflow-y-auto overscroll-contain px-4 py-6">
      <div className="fixed inset-0 bg-black/75" onClick={onCancel} aria-hidden />
      <div className="relative z-10 w-full max-w-3xl" role="dialog" aria-modal="true" aria-label="Cortar capa do perfil">
        <div className="mb-3 flex items-center justify-between rounded-2xl border border-white/15 bg-[#0a0f1d]/90 px-4 py-3 text-white shadow-[0_24px_70px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Capa do perfil</p>
            <p className="text-sm font-semibold text-white">Cortar para 3:1</p>
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
              disabled={processing}
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
                ref={containerRef}
                className="relative mx-auto aspect-[3/1] w-full max-w-[560px] cursor-grab overflow-hidden rounded-2xl border border-white/15 bg-black/40 active:cursor-grabbing"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
                role="presentation"
              >
                {imageUrl && (
                  <Image
                    src={imageUrl}
                    alt="Pre-visualizacao da capa"
                    width={imageSize.width || 1}
                    height={imageSize.height || 1}
                    unoptimized
                    onLoadingComplete={(img) => {
                      imageRef.current = img;
                      setImageSize({ width: img.naturalWidth, height: img.naturalHeight });
                    }}
                    className="absolute left-1/2 top-1/2 select-none"
                    style={{
                      width: imageSize.width || "auto",
                      height: imageSize.height || "auto",
                      transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
                      transformOrigin: "center",
                    }}
                  />
                )}
              </div>
            </div>

            <div className="w-full space-y-3 text-sm text-white/70 md:w-[220px]">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/55">Zoom</p>
                <input
                  type="range"
                  min="1"
                  max="3"
                  step="0.01"
                  value={zoom}
                  onChange={(event) => {
                    const next = Number(event.target.value);
                    const nextOffset = clampOffset(offset, baseScale * next);
                    setZoom(next);
                    setOffset(nextOffset);
                  }}
                  className="mt-2 w-full accent-white"
                />
              </div>
              <p className="text-[12px] text-white/60">
                Arrasta para reposicionar a imagem. O resultado final fica sempre no formato 3:1.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>,
    portalRoot,
  );
}
