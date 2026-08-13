"use client";

import { ImageCropModal } from "@/components/admin/ImageCropModal";

type CategoryImageCropModalProps = {
  imageSrc: string;
  categoryName?: string;
  onCancel: () => void;
  onConfirm: (file: File) => void;
};

/** Crop 4:3 alinhado ao card de categoria no catálogo. */
export function CategoryImageCropModal({
  imageSrc,
  categoryName,
  onCancel,
  onConfirm,
}: CategoryImageCropModalProps) {
  return (
    <ImageCropModal
      imageSrc={imageSrc}
      aspect={4 / 3}
      frameClassName="aspect-[4/3]"
      title="Ajustar foto da categoria"
      description={
        categoryName
          ? `Arraste e use o zoom para definir a área visível de “${categoryName}” no catálogo.`
          : "Arraste e use o zoom para definir a área visível no catálogo (formato 4:3)."
      }
      fileName="categoria.jpg"
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
}
