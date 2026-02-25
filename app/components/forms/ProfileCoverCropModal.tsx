"use client";

import { ImageCropModal } from "@/app/components/forms/ImageCropModal";

type ProfileCoverCropModalProps = {
  open: boolean;
  file: File | null;
  onCancel: () => void;
  onConfirm: (file: File) => void;
};

export function ProfileCoverCropModal({
  open,
  file,
  onCancel,
  onConfirm,
}: ProfileCoverCropModalProps) {
  return (
    <ImageCropModal
      open={open}
      file={file}
      onCancel={onCancel}
      onConfirm={onConfirm}
      ariaLabel="Cortar capa do perfil"
      eyebrow="Capa do perfil"
      title="Cortar para 3:1"
      description="Arrasta para reposicionar a imagem. O resultado final fica sempre no formato 3:1."
      aspectRatio={3}
      outputWidth={1500}
      outputHeight={500}
      outputFileName="profile-cover.jpg"
      outputMimeType="image/jpeg"
      frameMaxWidthClassName="max-w-[560px]"
    />
  );
}
