"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type DragEvent } from "react";
import { CameraIcon } from "@/components/icons/UiIcons";
import { BannerImageCropModal } from "@/components/admin/BannerImageCropModal";
import { formatApiError } from "@/lib/apiError";
import {
  HOME_BANNER_ASPECT_CLASS,
  HOME_BANNER_IDEAL_SIZE_LABEL,
} from "@/lib/home-banner";

type BannerImageFieldProps = {
  currentUrl: string | null;
  onSaved: (url: string | null) => void;
};

export function BannerImageField({
  currentUrl,
  onSaved,
}: BannerImageFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    return () => {
      if (cropSrc) URL.revokeObjectURL(cropSrc);
    };
  }, [cropSrc]);

  function openCrop(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Selecione um arquivo de imagem (JPG, PNG, WebP).");
      return;
    }
    if (file.size > 4.5 * 1024 * 1024) {
      setError("A imagem deve ter no máximo 4,5 MB.");
      return;
    }
    setError("");
    setCropSrc((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  }

  function closeCrop() {
    setCropSrc((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    if (inputRef.current) inputRef.current.value = "";
  }

  async function saveBanner(url: string | null) {
    setBusy(true);
    setError("");
    const res = await fetch("/api/admin/store", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bannerUrl: url }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(formatApiError(data.error, "Erro ao salvar o banner"));
      return false;
    }
    onSaved(data.bannerUrl ?? url);
    return true;
  }

  async function applyCroppedFile(file: File) {
    closeCrop();
    setBusy(true);
    setError("");
    const uploadFd = new FormData();
    uploadFd.append("file", file);
    const up = await fetch("/api/admin/upload", {
      method: "POST",
      body: uploadFd,
    });
    if (!up.ok) {
      const data = await up.json().catch(() => ({}));
      setBusy(false);
      setError(formatApiError(data.error, "Erro ao enviar a imagem"));
      return;
    }
    const { url } = await up.json();
    setBusy(false);
    await saveBanner(url as string);
  }

  async function handleRemove() {
    await saveBanner(null);
  }

  function onDragOver(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    setDragging(true);
  }

  function onDragLeave(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
    if (busy) return;
    const file = e.dataTransfer.files?.[0] ?? null;
    openCrop(file);
  }

  const dropClass = dragging
    ? "border-emerald-500 bg-emerald-50/80 dark:border-emerald-500 dark:bg-emerald-950/40"
    : "border-zinc-300 dark:border-zinc-600";

  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
        Banner da home
      </p>
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
        Arraste uma imagem ou clique para selecionar. Substitui o texto de
        apresentação na página inicial. Tamanho ideal:{" "}
        {HOME_BANNER_IDEAL_SIZE_LABEL} (proporção 3:1).
      </p>

      {currentUrl ? (
        <div className="mt-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            onDragOver={onDragOver}
            onDragEnter={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            className={`relative block w-full overflow-hidden rounded-2xl border-2 border-dashed bg-zinc-100 text-left transition disabled:opacity-50 dark:bg-zinc-800 ${HOME_BANNER_ASPECT_CLASS} ${dropClass}`}
          >
            <Image
              src={currentUrl}
              alt="Prévia do banner"
              fill
              className="object-cover"
              unoptimized
            />
            <span className="absolute inset-x-0 bottom-0 bg-black/45 px-2 py-1.5 text-center text-[11px] font-medium text-white">
              {dragging
                ? "Solte para trocar"
                : busy
                  ? "Salvando…"
                  : "Arraste outra imagem ou clique para trocar"}
            </span>
          </button>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
              className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              Trocar
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleRemove()}
              className="rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/50"
            >
              Remover
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          onDragOver={onDragOver}
          onDragEnter={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          className={`mt-3 flex w-full cursor-pointer flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed bg-zinc-50 text-zinc-500 transition hover:border-emerald-400 hover:bg-emerald-50/50 hover:text-emerald-700 disabled:opacity-50 dark:bg-zinc-950 dark:hover:border-emerald-600 dark:hover:bg-emerald-950/30 dark:hover:text-emerald-400 ${HOME_BANNER_ASPECT_CLASS} ${dropClass}`}
        >
          <CameraIcon className="h-6 w-6" />
          <span className="text-xs font-medium">
            {busy
              ? "Salvando…"
              : dragging
                ? "Solte a imagem aqui"
                : "Arraste ou selecione uma imagem"}
          </span>
        </button>
      )}

      {error ? (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>
      ) : null}

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
        <BannerImageCropModal
          imageSrc={cropSrc}
          onCancel={closeCrop}
          onConfirm={(file) => void applyCroppedFile(file)}
        />
      ) : null}
    </div>
  );
}
