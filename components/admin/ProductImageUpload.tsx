"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { CameraIcon } from "@/components/icons/UiIcons";
import { ImageCropModal } from "@/components/admin/ImageCropModal";

export type ImageSlotChange = { file: File | null; remove: boolean };

type ImageSlotProps = {
  label: string;
  hint?: string;
  currentImageUrl: string | null;
  onChange: (value: ImageSlotChange) => void;
};

function ImageSlot({
  label,
  hint,
  currentImageUrl,
  onChange,
}: ImageSlotProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [removed, setRemoved] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);

  const displayUrl = removed ? null : previewUrl ?? currentImageUrl;

  useEffect(() => {
    return () => {
      if (cropSrc) URL.revokeObjectURL(cropSrc);
    };
  }, [cropSrc]);

  function openCrop(file: File | null) {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Selecione um arquivo de imagem (JPG, PNG, WebP).");
      return;
    }

    if (file.size > 4.5 * 1024 * 1024) {
      alert("A imagem deve ter no máximo 4,5 MB.");
      return;
    }

    setCropSrc((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  }

  function applyCroppedFile(file: File) {
    setCropSrc((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setRemoved(false);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    onChange({ file, remove: false });
    if (inputRef.current) inputRef.current.value = "";
  }

  function closeCrop() {
    setCropSrc((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    if (inputRef.current) inputRef.current.value = "";
  }

  function handleRemove() {
    setRemoved(true);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    if (inputRef.current) inputRef.current.value = "";
    onChange({ file: null, remove: true });
  }

  return (
    <div className="space-y-2">
      <div>
        <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          {label}
        </p>
        {hint ? (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">{hint}</p>
        ) : null}
      </div>

      {displayUrl ? (
        <div className="relative inline-block">
          <div className="relative aspect-square w-36 overflow-hidden rounded-2xl border border-zinc-200 bg-brand-light shadow-sm dark:border-zinc-700 dark:bg-zinc-800 sm:w-40">
            <Image
              src={displayUrl}
              alt={`Prévia — ${label}`}
              fill
              className="object-cover"
              unoptimized
            />
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              Trocar
            </button>
            <button
              type="button"
              onClick={handleRemove}
              className="rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/50"
            >
              Remover
            </button>
          </div>
        </div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
          }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const file = e.dataTransfer.files?.[0] ?? null;
            openCrop(file);
          }}
          className="flex aspect-square w-full max-w-[10rem] cursor-pointer flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-zinc-300 bg-zinc-50 px-2 text-center text-zinc-500 transition hover:border-emerald-400 hover:bg-emerald-50/50 hover:text-emerald-700 dark:border-zinc-600 dark:bg-zinc-950 dark:hover:border-emerald-600 dark:hover:bg-emerald-950/30 dark:hover:text-emerald-400"
        >
          <CameraIcon className="h-6 w-6" />
          <span className="text-xs font-medium">Adicionar</span>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0] ?? null;
          openCrop(file);
        }}
      />

      {cropSrc ? (
        <ImageCropModal
          imageSrc={cropSrc}
          aspect={1}
          frameClassName="aspect-square"
          title={`Ajustar foto — ${label}`}
          description="Arraste e use o zoom para definir a área visível no catálogo e no detalhe do produto (formato quadrado 1:1)."
          fileName="produto.jpg"
          onCancel={closeCrop}
          onConfirm={applyCroppedFile}
        />
      ) : null}
    </div>
  );
}

type ProductImageUploadProps = {
  coverUrl: string | null;
  extraUrls: string[];
  onCoverChange: (value: ImageSlotChange) => void;
  onExtraChange: (index: 0 | 1, value: ImageSlotChange) => void;
};

/** Capa + até 2 fotos adicionais. */
export function ProductImageUpload({
  coverUrl,
  extraUrls,
  onCoverChange,
  onExtraChange,
}: ProductImageUploadProps) {
  return (
    <div className="space-y-4">
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        A capa aparece no catálogo. Você pode adicionar até 2 fotos extras para
        o detalhe do produto. Ao escolher a imagem, ajuste a área visível
        (quadrado). JPG, PNG ou WebP — até 4,5 MB cada.
      </p>
      <div className="flex flex-wrap gap-6">
        <ImageSlot
          label="Capa"
          hint="Principal no catálogo (1:1)"
          currentImageUrl={coverUrl}
          onChange={onCoverChange}
        />
        <ImageSlot
          label="Extra 1"
          hint="Opcional (1:1)"
          currentImageUrl={extraUrls[0] ?? null}
          onChange={(v) => onExtraChange(0, v)}
        />
        <ImageSlot
          label="Extra 2"
          hint="Opcional (1:1)"
          currentImageUrl={extraUrls[1] ?? null}
          onChange={(v) => onExtraChange(1, v)}
        />
      </div>
    </div>
  );
}
