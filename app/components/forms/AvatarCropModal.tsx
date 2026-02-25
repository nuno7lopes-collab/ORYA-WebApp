"use client";

import { ImageCropModal } from "@/app/components/forms/ImageCropModal";

type AvatarCropModalProps = {
  open: boolean;
  file: File | null;
  onCancel: () => void;
  onConfirm: (file: File) => void;
};

export function AvatarCropModal({ open, file, onCancel, onConfirm }: AvatarCropModalProps) {
  return (
    <ImageCropModal
      open={open}
      file={file}
      onCancel={onCancel}
      onConfirm={onConfirm}
      ariaLabel="Cortar avatar"
      eyebrow="Avatar"
      title="Cortar para círculo"
      description="Arrasta e usa zoom para posicionar. O resultado final fica otimizado para avatar."
      aspectRatio={1}
      shape="round"
      outputWidth={1024}
      outputHeight={1024}
      outputFileName="avatar.png"
      outputMimeType="image/png"
      frameMaxWidthClassName="max-w-[360px]"
    />
  );
}
