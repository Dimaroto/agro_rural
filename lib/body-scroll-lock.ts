/** Trava scroll da página sob modais (iOS/Safari exige position:fixed). */

let lockCount = 0;
let lockedScrollY = 0;

export function lockBodyScroll() {
  if (typeof document === "undefined") return;
  if (lockCount === 0) {
    lockedScrollY = window.scrollY;
    const body = document.body;
    body.classList.add("catalog-product-modal-open");
    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${lockedScrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
  }
  lockCount += 1;
}

export function unlockBodyScroll() {
  if (typeof document === "undefined") return;
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount > 0) return;

  const body = document.body;
  body.classList.remove("catalog-product-modal-open");
  body.style.overflow = "";
  body.style.position = "";
  body.style.top = "";
  body.style.left = "";
  body.style.right = "";
  body.style.width = "";
  window.scrollTo(0, lockedScrollY);
}

/** Força liberação (ex.: fechar modal sem passar pelo cleanup do effect). */
export function forceUnlockBodyScroll() {
  if (typeof document === "undefined") return;
  lockCount = 0;
  const body = document.body;
  const top = body.style.top;
  const y = top ? Math.abs(parseInt(top, 10)) || lockedScrollY : lockedScrollY;
  body.classList.remove("catalog-product-modal-open");
  body.style.overflow = "";
  body.style.position = "";
  body.style.top = "";
  body.style.left = "";
  body.style.right = "";
  body.style.width = "";
  window.scrollTo(0, y);
}
