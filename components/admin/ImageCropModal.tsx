"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Cropper, { type Area } from "react-easy-crop";
import "react-easy-crop/react-easy-crop.css";
import { getCroppedImg } from "@/lib/crop-image";

type ImageCropModalProps = {
  imageSrc: string;
  aspect: number;
  title: string;
  description: string;
  fileName?: string;
  /** Classes Tailwind do frame (ex.: aspect-square ou aspect-[4/3]). */
  frameClassName: string;
  onCancel: () => void;
  onConfirm: (file: File) => void;
};

export function ImageCropModal({
  imageSrc,
  aspect,
  title,
  description,
  fileName = "foto.jpg",
  frameClassName,
  onCancel,
  onConfirm,
}: ImageCropModalProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(
    null
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);
  const wide = aspect >= 2;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onCancel]);

  const onCropComplete = useCallback((_area: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels);
  }, []);

  async function handleConfirm() {
    if (!croppedAreaPixels || busy) return;
    setBusy(true);
    setError("");
    try {
      const file = await getCroppedImg(imageSrc, croppedAreaPixels, fileName);
      onConfirm(file);
    } catch {
      setError("Não foi possível recortar a imagem. Tente outra foto.");
      setBusy(false);
    }
  }

  const modal = (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="image-crop-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel();
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div
        className={`flex max-h-[min(92dvh,42rem)] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl dark:bg-zinc-900 sm:rounded-2xl ${
          wide ? "max-w-2xl" : "max-w-lg"
        }`}
      >
        <header className="shrink-0 border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
          <h2
            id="image-crop-title"
            className="text-base font-semibold text-zinc-900 dark:text-zinc-100"
          >
            {title}
          </h2>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            {description}
          </p>
        </header>

        <div
          className={`relative mx-auto mt-3 overflow-hidden rounded-2xl bg-[#E4EAD8] ring-1 ring-zinc-200 dark:ring-zinc-700 ${
            wide ? "w-[calc(100%-2rem)]" : "w-[min(100%,22rem)]"
          } ${frameClassName}`}
        >
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
            showGrid={false}
            objectFit={
              aspect === 1
                ? "cover"
                : aspect > 1
                  ? "horizontal-cover"
                  : "vertical-cover"
            }
            classes={{
              containerClassName: "!bg-[#E4EAD8]",
              cropAreaClassName:
                "!border-2 !border-white/90 !shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]",
            }}
          />
        </div>

        <div className="shrink-0 space-y-3 px-4 py-4">
          <label className="flex items-center gap-3 text-sm text-zinc-600 dark:text-zinc-300">
            <span className="w-10 shrink-0 text-xs font-medium uppercase tracking-wide text-zinc-400">
              Zoom
            </span>
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="h-2 w-full accent-emerald-600"
              aria-label="Zoom da imagem"
            />
          </label>

          {error ? (
            <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
          ) : null}

          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={onCancel}
              className="min-h-[2.75rem] flex-1 rounded-xl border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={busy || !croppedAreaPixels}
              onClick={() => void handleConfirm()}
              className="min-h-[2.75rem] flex-1 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {busy ? "Preparando…" : "Usar foto"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (!mounted) return null;
  return createPortal(modal, document.body);
}
