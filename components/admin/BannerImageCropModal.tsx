"use client";

import { ImageCropModal } from "@/components/admin/ImageCropModal";
import {
  HOME_BANNER_ASPECT,
  HOME_BANNER_ASPECT_CLASS,
  HOME_BANNER_IDEAL_SIZE_LABEL,
} from "@/lib/home-banner";

type BannerImageCropModalProps = {
  imageSrc: string;
  onCancel: () => void;
  onConfirm: (file: File) => void;
};

export function BannerImageCropModal({
  imageSrc,
  onCancel,
  onConfirm,
}: BannerImageCropModalProps) {
  return (
    <ImageCropModal
      imageSrc={imageSrc}
      aspect={HOME_BANNER_ASPECT}
      frameClassName={HOME_BANNER_ASPECT_CLASS}
      title="Ajustar banner da home"
      description={`Arraste e use o zoom para definir a área visível. Tamanho ideal: ${HOME_BANNER_IDEAL_SIZE_LABEL} (proporção 3:1).`}
      fileName="banner.jpg"
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
}
