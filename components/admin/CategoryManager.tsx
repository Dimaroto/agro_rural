"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { formatApiError } from "@/lib/apiError";
import { PackageIcon, HomeIcon } from "@/components/icons/UiIcons";
import { CategoryImageCropModal } from "@/components/admin/CategoryImageCropModal";

type Category = {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  active: boolean;
  showOnHome: boolean;
  imageUrl: string | null;
  _count: { products: number };
};

type CropSession = {
  categoryId: string;
  categoryName: string;
  imageSrc: string;
};

export function CategoryManager({ initial }: { initial: Category[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [errorById, setErrorById] = useState<Record<string, string>>({});
  const [cropSession, setCropSession] = useState<CropSession | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    return () => {
      if (cropSession?.imageSrc) {
        URL.revokeObjectURL(cropSession.imageSrc);
      }
    };
  }, [cropSession?.imageSrc]);

  function closeCropSession() {
    setCropSession((prev) => {
      if (prev?.imageSrc) URL.revokeObjectURL(prev.imageSrc);
      return null;
    });
  }

  function openCropForFile(category: Category, file: File) {
    if (!file.type.startsWith("image/")) {
      setErrorById((prev) => ({
        ...prev,
        [category.id]: "Selecione um arquivo de imagem",
      }));
      return;
    }
    const imageSrc = URL.createObjectURL(file);
    setErrorById((prev) => ({ ...prev, [category.id]: "" }));
    setCropSession({
      categoryId: category.id,
      categoryName: category.name,
      imageSrc,
    });
  }

  async function create() {
    if (!name.trim()) return;
    setLoading(true);
    await fetch("/api/admin/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setName("");
    setLoading(false);
    router.refresh();
  }

  function startEdit(category: Category) {
    setEditingId(category.id);
    setEditName(category.name);
    setErrorById((prev) => ({ ...prev, [category.id]: "" }));
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName("");
  }

  async function saveEdit(id: string) {
    const nextName = editName.trim();
    if (!nextName) {
      setErrorById((prev) => ({
        ...prev,
        [id]: "Informe o nome da categoria",
      }));
      return;
    }

    setSavingId(id);
    setErrorById((prev) => ({ ...prev, [id]: "" }));

    const res = await fetch(`/api/admin/categories/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: nextName }),
    });
    const data = await res.json().catch(() => ({}));
    setSavingId(null);

    if (!res.ok) {
      setErrorById((prev) => ({
        ...prev,
        [id]: formatApiError(data.error, "Erro ao salvar"),
      }));
      return;
    }

    setEditingId(null);
    setEditName("");
    router.refresh();
  }

  async function toggle(id: string, active: boolean) {
    await fetch(`/api/admin/categories/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !active }),
    });
    router.refresh();
  }

  async function toggleShowOnHome(id: string, showOnHome: boolean) {
    await fetch(`/api/admin/categories/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ showOnHome: !showOnHome }),
    });
    router.refresh();
  }

  async function uploadImage(id: string, file: File) {
    setUploadingId(id);
    setErrorById((prev) => ({ ...prev, [id]: "" }));

    const uploadFd = new FormData();
    uploadFd.append("file", file);
    const up = await fetch("/api/admin/upload", {
      method: "POST",
      body: uploadFd,
    });

    if (!up.ok) {
      const data = await up.json().catch(() => ({}));
      setUploadingId(null);
      setErrorById((prev) => ({
        ...prev,
        [id]: formatApiError(data.error, "Erro ao enviar imagem"),
      }));
      return;
    }

    const { url } = await up.json();
    const res = await fetch(`/api/admin/categories/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageUrl: url }),
    });

    setUploadingId(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErrorById((prev) => ({
        ...prev,
        [id]: formatApiError(data.error, "Erro ao salvar imagem"),
      }));
      return;
    }

    router.refresh();
  }

  async function removeImage(id: string) {
    setUploadingId(id);
    const res = await fetch(`/api/admin/categories/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageUrl: null }),
    });
    setUploadingId(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErrorById((prev) => ({
        ...prev,
        [id]: formatApiError(data.error, "Erro ao remover imagem"),
      }));
      return;
    }
    router.refresh();
  }

  async function remove(id: string, categoryName: string) {
    if (!window.confirm(`Excluir a categoria "${categoryName}"?`)) return;

    setDeletingId(id);
    setErrorById((prev) => ({ ...prev, [id]: "" }));

    const res = await fetch(`/api/admin/categories/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    setDeletingId(null);

    if (!res.ok) {
      setErrorById((prev) => ({
        ...prev,
        [id]: formatApiError(data.error, "Erro ao excluir"),
      }));
      return;
    }

    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 rounded-2xl bg-white p-4 shadow-sm sm:flex-row dark:bg-zinc-900 dark:shadow-none dark:ring-1 dark:ring-zinc-800">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nova categoria"
          className="admin-input min-h-[2.75rem] flex-1 py-2 sm:min-h-0"
        />
        <button
          type="button"
          disabled={loading}
          onClick={create}
          className="min-h-[2.75rem] shrink-0 rounded-xl bg-emerald-600 px-4 py-2 text-white sm:min-h-0"
        >
          Adicionar
        </button>
      </div>

      <ul className="space-y-2">
        {initial.map((c) => {
          const isEditing = editingId === c.id;
          return (
            <li
              key={c.id}
              className="rounded-xl bg-white px-4 py-3 shadow-sm dark:bg-zinc-900 dark:shadow-none dark:ring-1 dark:ring-zinc-800"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 flex-1 gap-3">
                  <div className="relative aspect-[4/3] w-20 shrink-0 overflow-hidden rounded-xl bg-zinc-100 dark:bg-zinc-800">
                    {c.imageUrl ? (
                      <Image
                        src={c.imageUrl}
                        alt=""
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center opacity-40 text-zinc-400">
                        <PackageIcon className="h-7 w-7" />
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    {isEditing ? (
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") void saveEdit(c.id);
                            if (e.key === "Escape") cancelEdit();
                          }}
                          className="admin-input min-h-[2.5rem] flex-1 py-2"
                          autoFocus
                          aria-label={`Nome da categoria ${c.name}`}
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={savingId === c.id}
                            onClick={() => void saveEdit(c.id)}
                            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                          >
                            {savingId === c.id ? "Salvando..." : "Salvar"}
                          </button>
                          <button
                            type="button"
                            disabled={savingId === c.id}
                            onClick={cancelEdit}
                            className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium dark:text-zinc-100">
                          {c.name}
                        </span>
                        <span className="text-sm text-zinc-400">
                          ({c._count.products} produtos)
                        </span>
                      </div>
                    )}
                    <div className="mt-2 flex flex-wrap gap-2">
                      {!isEditing && (
                        <button
                          type="button"
                          onClick={() => startEdit(c)}
                          className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                        >
                          Editar
                        </button>
                      )}
                      <input
                        ref={(el) => {
                          fileInputRefs.current[c.id] = el;
                        }}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) openCropForFile(c, file);
                          e.target.value = "";
                        }}
                      />
                      <button
                        type="button"
                        disabled={uploadingId === c.id}
                        onClick={() => fileInputRefs.current[c.id]?.click()}
                        className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                      >
                        {uploadingId === c.id
                          ? "Enviando..."
                          : c.imageUrl
                            ? "Trocar imagem"
                            : "Adicionar imagem"}
                      </button>
                      {c.imageUrl && (
                        <button
                          type="button"
                          disabled={uploadingId === c.id}
                          onClick={() => void removeImage(c.id)}
                          className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-500 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                        >
                          Remover imagem
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void toggleShowOnHome(c.id, c.showOnHome)}
                    title={
                      c.showOnHome
                        ? "Ocultar da home"
                        : "Mostrar na home"
                    }
                    aria-label={
                      c.showOnHome
                        ? "Ocultar da home"
                        : "Mostrar na home"
                    }
                    aria-pressed={c.showOnHome}
                    className={`flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl border transition-colors sm:h-11 sm:w-11 ${
                      c.showOnHome
                        ? "border-emerald-300 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 dark:hover:bg-emerald-950/70"
                        : "border-zinc-200 bg-zinc-50 text-zinc-400 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-500 dark:hover:bg-zinc-800"
                    }`}
                  >
                    <HomeIcon className="h-5 w-5 sm:h-6 sm:w-6" />
                  </button>
                  <button
                    type="button"
                    onClick={() => toggle(c.id, c.active)}
                    className={`min-h-[2.5rem] cursor-pointer px-2 text-sm sm:min-h-0 ${c.active ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"}`}
                  >
                    {c.active ? "Ativa" : "Inativa"}
                  </button>
                  <button
                    type="button"
                    disabled={deletingId === c.id || c._count.products > 0}
                    title={
                      c._count.products > 0
                        ? "Remova ou mova os produtos antes de excluir"
                        : `Excluir ${c.name}`
                    }
                    onClick={() => remove(c.id, c.name)}
                    className="min-h-[2.5rem] cursor-pointer rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/50 sm:min-h-0"
                  >
                    {deletingId === c.id ? "Excluindo..." : "Excluir"}
                  </button>
                </div>
              </div>
              {errorById[c.id] && (
                <p className="mt-2 text-xs text-red-600 dark:text-red-400">
                  {errorById[c.id]}
                </p>
              )}
            </li>
          );
        })}
      </ul>

      {cropSession ? (
        <CategoryImageCropModal
          imageSrc={cropSession.imageSrc}
          categoryName={cropSession.categoryName}
          onCancel={closeCropSession}
          onConfirm={(file) => {
            const id = cropSession.categoryId;
            closeCropSession();
            void uploadImage(id, file);
          }}
        />
      ) : null}
    </div>
  );
}
