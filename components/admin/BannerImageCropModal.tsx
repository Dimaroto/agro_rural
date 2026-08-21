"use client";

import { ImageCropModal } from "@/components/admin/ImageCropModal";
import {
  homeBannerConfig,
  homeBannerIdealLabel,
  type HomeBannerVariant,
} from "@/lib/home-banner";

type BannerImageCropModalProps = {
  imageSrc: string;
  variant?: HomeBannerVariant;
  onCancel: () => void;
  onConfirm: (file: File) => void;
};

export function BannerImageCropModal({
  imageSrc,
  variant = "desktop",
  onCancel,
  onConfirm,
}: BannerImageCropModalProps) {
  const cfg = homeBannerConfig(variant);
  const ideal = homeBannerIdealLabel(variant);
  return (
    <ImageCropModal
      imageSrc={imageSrc}
      aspect={cfg.aspect}
      frameClassName={cfg.aspectClass}
      title={`Ajustar ${cfg.title.toLowerCase()}`}
      description={`Arraste e use o zoom para definir a área visível. Tamanho ideal: ${ideal} (proporção ${cfg.label}).`}
      fileName={variant === "mobile" ? "banner-mobile.jpg" : "banner.jpg"}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
}
