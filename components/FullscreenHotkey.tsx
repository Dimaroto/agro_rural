"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    agroDesktop?: {
      toggleFullscreen: () => void;
    };
  }
}

/** F11 alterna tela cheia (navegador). No app Windows o Electron trata o atalho. */
export function FullscreenHotkey() {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "F11") return;
      if (window.agroDesktop) return;
      e.preventDefault();
      if (!document.fullscreenElement) {
        void document.documentElement.requestFullscreen();
      } else {
        void document.exitFullscreen();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return null;
}
