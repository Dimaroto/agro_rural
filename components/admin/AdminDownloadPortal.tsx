"use client";

import { useEffect, useMemo, useState } from "react";

type PlatformInfo = {
  platform: "windows" | "android" | "ios" | "other";
  label: string;
  filename: string | null;
  href: string | null;
};

function detectClient(windowsSetupUrl: string): PlatformInfo {
  const ua = navigator.userAgent.toLowerCase();
  const apk =
    process.env.NEXT_PUBLIC_ADMIN_APK_URL?.trim() ||
    "/downloads/AgroRural-Admin.apk";
  const exe =
    windowsSetupUrl.trim() ||
    process.env.NEXT_PUBLIC_ADMIN_EXE_URL?.trim() ||
    process.env.NEXT_PUBLIC_EMISSOR_SETUP_URL?.trim() ||
    "/downloads/AgroRural-Setup.exe";

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
      filename: "AgroRural-Setup.exe",
      href: exe,
    };
  }
  return {
    platform: "other",
    label: "Desktop",
    filename: "AgroRural-Setup.exe",
    href: exe,
  };
}

export function AdminDownloadPortal({
  storeName,
  windowsSetupUrl = "",
}: {
  storeName: string;
  windowsSetupUrl?: string;
}) {
  const [info, setInfo] = useState<PlatformInfo | null>(null);

  useEffect(() => {
    setInfo(detectClient(windowsSetupUrl));
  }, [windowsSetupUrl]);

  const ready = useMemo(() => info != null, [info]);
  const exeHref = useMemo(
    () =>
      windowsSetupUrl.trim() ||
      process.env.NEXT_PUBLIC_ADMIN_EXE_URL?.trim() ||
      process.env.NEXT_PUBLIC_EMISSOR_SETUP_URL?.trim() ||
      "/downloads/AgroRural-Setup.exe",
    [windowsSetupUrl]
  );
  const apkHref =
    process.env.NEXT_PUBLIC_ADMIN_APK_URL?.trim() ||
    "/downloads/AgroRural-Admin.apk";
  const windowsReady = Boolean(windowsSetupUrl.trim() || exeHref.startsWith("http"));

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
              Ainda não há app para iPhone/iPad. Use um computador Windows para
              baixar o AgroRural Admin com emissor de NF-e.
            </p>
            <a href={exeHref} className="admin-btn-secondary inline-flex">
              Baixar versão Windows (PC)
            </a>
          </>
        ) : (
          <>
            <p className="text-sm text-zinc-600 dark:text-zinc-300">
              Detectamos <strong>{info?.label}</strong>. O instalador Windows
              inclui o painel admin e o emissor de notas fiscais.
            </p>
            {info?.platform === "android" && !apkHref.startsWith("http") ? (
              <p className="rounded-xl bg-amber-50 px-3 py-2 text-left text-sm text-amber-900">
                O APK Android ainda não foi publicado. Baixe a versão Windows no
                PC da loja (recomendado para NF-e) ou use o atalho abaixo quando
                o link estiver disponível.
              </p>
            ) : null}
            <a
              href={
                info?.platform === "android" && !apkHref.startsWith("http")
                  ? exeHref
                  : (info?.href ?? exeHref)
              }
              className="admin-btn-primary inline-flex w-full justify-center px-6 py-3 text-base"
            >
              {info?.platform === "android" && !apkHref.startsWith("http")
                ? "Baixar versão Windows (PC)"
                : `Baixar AgroRural Admin${info?.platform === "windows" ? " (Windows)" : ""}`}
            </a>
            {info?.platform === "android" && (
              <a
                href={exeHref}
                className="admin-btn-secondary inline-flex w-full justify-center text-sm"
              >
                Prefiro a versão Windows (PC)
              </a>
            )}
            {info?.platform === "windows" && apkHref.startsWith("http") && (
              <a
                href={apkHref}
                className="admin-btn-secondary inline-flex w-full justify-center text-sm"
              >
                Prefiro a versão Android
              </a>
            )}
            {!windowsReady && info?.platform === "windows" && (
              <p className="text-left text-xs text-amber-800">
                O Setup ainda está sendo gerado/publicado. Se o download falhar,
                tente novamente em alguns minutos.
              </p>
            )}
          </>
        )}
      </div>

      <p className="max-w-md text-xs text-zinc-500">
        A gestão completa fica no aplicativo. Neste site você só baixa o
        instalador após o login. Configurações fiscais e certificado A1 você
        preenche no emissor local.
      </p>
    </div>
  );
}
