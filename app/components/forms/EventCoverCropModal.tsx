"use client";

import { ImageCropModal } from "@/app/components/forms/ImageCropModal";

type EventCoverCropModalProps = {
  open: boolean;
  file: File | null;
  onCancel: () => void;
  onConfirm: (file: File) => void;
};

export function EventCoverCropModal({ open, file, onCancel, onConfirm }: EventCoverCropModalProps) {
  return (
    <ImageCropModal
      open={open}
      file={file}
      onCancel={onCancel}
      onConfirm={onConfirm}
      ariaLabel="Cortar capa"
      eyebrow="Capa"
      title="Cortar para 1:1"
      description="Arrasta a imagem para ajustar o recorte. O resultado fica sempre 1:1."
      aspectRatio={1}
      outputWidth={1200}
      outputHeight={1200}
      outputFileName="event-cover.jpg"
      outputMimeType="image/jpeg"
      frameMaxWidthClassName="max-w-[420px]"
    />
  );
}
