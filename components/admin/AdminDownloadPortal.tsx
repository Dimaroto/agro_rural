"use client";

import { useEffect, useMemo, useState } from "react";

type PlatformInfo = {
  platform: "windows" | "android" | "ios" | "other";
  label: string;
  filename: string | null;
  href: string | null;
};

function detectClient(): PlatformInfo {
  const ua = navigator.userAgent.toLowerCase();
  const apk =
    process.env.NEXT_PUBLIC_ADMIN_APK_URL?.trim() ||
    "/downloads/AgroRural-Admin.apk";
  const exe =
    process.env.NEXT_PUBLIC_ADMIN_EXE_URL?.trim() ||
    "/downloads/AgroRural-Admin-Setup.exe";

  if (/iphone|ipad|ipod/.test(ua)) {
    return {
      platform: "ios",
      label: "iPhone / iPad",
      filename: null,
      href: null,
    };
  }
  if (/android/.test(ua)) {
    return {
      platform: "android",
      label: "Android",
      filename: "AgroRural-Admin.apk",
      href: apk,
    };
  }
  if (/windows|win64|win32|wow64/.test(ua)) {
    return {
      platform: "windows",
      label: "Windows",
      filename: "AgroRural-Admin-Setup.exe",
      href: exe,
    };
  }
  return {
    platform: "other",
    label: "Desktop",
    filename: "AgroRural-Admin-Setup.exe",
    href: exe,
  };
}

export function AdminDownloadPortal({ storeName }: { storeName: string }) {
  const [info, setInfo] = useState<PlatformInfo | null>(null);

  useEffect(() => {
    setInfo(detectClient());
  }, []);

  const ready = useMemo(() => info != null, [info]);

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-6 py-10 text-center">
      <div>
        <h1 className="text-2xl font-bold text-[#026842] dark:text-zinc-100">
          AgroRural Admin
        </h1>
        <p className="mt-2 text-sm text-[#6b7280] dark:text-zinc-400">
          {storeName} — baixe o aplicativo para gerenciar produtos, PDV, vendas
          e notas fiscais no seu dispositivo.
        </p>
      </div>

      <div className="admin-card w-full space-y-4 p-6">
        {!ready ? (
          <p className="text-sm text-zinc-500">Detectando dispositivo…</p>
        ) : info?.platform === "ios" ? (
          <>
            <p className="text-sm text-zinc-600 dark:text-zinc-300">
              Ainda não há app para iPhone/iPad. Use um computador Windows ou um
              celular Android para baixar o AgroRural Admin.
            </p>
            <a href={exeFallback()} className="admin-btn-secondary inline-flex">
              Baixar versão Windows (PC)
            </a>
          </>
        ) : (
          <>
            <p className="text-sm text-zinc-600 dark:text-zinc-300">
              Detectamos <strong>{info?.label}</strong>. O instalador inclui o
              painel admin
              {info?.platform === "windows"
                ? " e o emissor de notas fiscais."
                : "."}
            </p>
            <a
              href={info?.href ?? "#"}
              className="admin-btn-primary inline-flex w-full justify-center px-6 py-3 text-base"
              download={info?.filename ?? undefined}
            >
              Baixar AgroRural Admin
              {info?.filename ? ` (${info.filename})` : ""}
            </a>
            {info?.platform === "android" && (
              <a
                href={exeFallback()}
                className="admin-btn-secondary inline-flex w-full justify-center text-sm"
              >
                Prefiro a versão Windows (PC)
              </a>
            )}
            {info?.platform === "windows" && (
              <a
                href={
                  process.env.NEXT_PUBLIC_ADMIN_APK_URL?.trim() ||
                  "/downloads/AgroRural-Admin.apk"
                }
                className="admin-btn-secondary inline-flex w-full justify-center text-sm"
              >
                Prefiro a versão Android
              </a>
            )}
          </>
        )}
      </div>

      <p className="max-w-md text-xs text-zinc-500">
        A gestão completa (produtos, PDV, clientes, financeiro e NF-e) fica no
        aplicativo. Neste site você só baixa o instalador após o login.
      </p>
    </div>
  );
}

function exeFallback() {
  return (
    process.env.NEXT_PUBLIC_ADMIN_EXE_URL?.trim() ||
    "/downloads/AgroRural-Admin-Setup.exe"
  );
}
