"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { CameraIcon } from "@/components/icons/UiIcons";
import { BannerImageCropModal } from "@/components/admin/BannerImageCropModal";
import { formatApiError } from "@/lib/apiError";
import { HOME_BANNER_ASPECT_CLASS, HOME_BANNER_IDEAL_SIZE_LABEL } from "@/lib/home-banner";

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

  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
        Banner da home
      </p>
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
        Substitui o texto de apresentação na página inicial, com cantos
        arredondados. Tamanho ideal: {HOME_BANNER_IDEAL_SIZE_LABEL} (proporção
        3:1).
      </p>

      {currentUrl ? (
        <div className="mt-3">
          <div
            className={`relative w-full overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 ${HOME_BANNER_ASPECT_CLASS}`}
          >
            <Image
              src={currentUrl}
              alt="Prévia do banner"
              fill
              className="object-cover"
              unoptimized
            />
          </div>
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
          className={`mt-3 flex w-full cursor-pointer flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-zinc-300 bg-zinc-50 text-zinc-500 transition hover:border-emerald-400 hover:bg-emerald-50/50 hover:text-emerald-700 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-950 dark:hover:border-emerald-600 dark:hover:bg-emerald-950/30 dark:hover:text-emerald-400 ${HOME_BANNER_ASPECT_CLASS}`}
        >
          <CameraIcon className="h-6 w-6" />
          <span className="text-xs font-medium">
            {busy ? "Salvando…" : "Selecionar imagem"}
          </span>
        </button>
      )}

      {error ? (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>
      ) : null}
      {busy && currentUrl ? (
        <p className="mt-2 text-xs text-zinc-500">Salvando…</p>
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
