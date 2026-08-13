"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ArrowRightIcon } from "@/components/icons/UiIcons";

const HIGHLIGHTS = ["Botânico", "Artesanal", "Presenteável"] as const;

const HERO_PHOTOS = [
  {
    src: "/brand/hero-products/gift-butterfly-pink.png",
    alt: "Sabonetes personalizados em embalagem rosa com laço",
    className: "catalog-hero-premium__photo catalog-hero-premium__photo--pink",
  },
  {
    src: "/brand/hero-products/gift-blue-feet.png",
    alt: "Sabonetes azuis personalizados em embalagem com laço",
    className: "catalog-hero-premium__photo catalog-hero-premium__photo--blue",
  },
  {
    src: "/brand/hero-products/green-baby-soap.png",
    alt: "Sabonete verde em formato de body infantil",
    className: "catalog-hero-premium__photo catalog-hero-premium__photo--green",
  },
] as const;

const HOVER_ACTIVATION_DELAY_MS = 700;
const ROTATION_END_MS = 980;

export function CatalogHero() {
  const parallaxBgRef = useRef<HTMLDivElement>(null);
  const hoverDelayTimerRef = useRef<number | null>(null);
  const rotationTimerRef = useRef<number | null>(null);
  const activePhotoRef = useRef(2);
  const [activePhoto, setActivePhoto] = useState(2);
  const [isRotating, setIsRotating] = useState(false);

  useEffect(() => {
    function onScroll() {
      const y = window.scrollY;
      if (parallaxBgRef.current) {
        parallaxBgRef.current.style.transform = `translate3d(0, ${y * 0.04}px, 0)`;
      }
    }

    // #region agent log
    fetch("http://127.0.0.1:7775/ingest/6812b337-414d-43d2-af37-a43171d1804b", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "0b9625",
      },
      body: JSON.stringify({
        sessionId: "0b9625",
        runId: "post-fix",
        hypothesisId: "E",
        location: "CatalogHero.tsx:mount",
        message: "CatalogHero mounted",
        data: { activePhoto: activePhotoRef.current },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    return () => {
      if (hoverDelayTimerRef.current) {
        window.clearTimeout(hoverDelayTimerRef.current);
      }
      if (rotationTimerRef.current) {
        window.clearTimeout(rotationTimerRef.current);
      }
    };
  }, []);

  function scrollToProducts() {
    document
      .getElementById("catalog-products")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function clearHoverDelay() {
    if (hoverDelayTimerRef.current) {
      window.clearTimeout(hoverDelayTimerRef.current);
      hoverDelayTimerRef.current = null;

      // #region agent log
      fetch("http://127.0.0.1:7775/ingest/6812b337-414d-43d2-af37-a43171d1804b", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Debug-Session-Id": "0b9625",
        },
        body: JSON.stringify({
          sessionId: "0b9625",
          runId: "post-fix",
          hypothesisId: "F",
          location: "CatalogHero.tsx:clearHoverDelay",
          message: "Hover delay cancelled",
          data: { activePhoto: activePhotoRef.current },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
    }
  }

  function activatePhoto(index: number) {
    if (index === activePhotoRef.current) return;

    // #region agent log
    fetch("http://127.0.0.1:7775/ingest/6812b337-414d-43d2-af37-a43171d1804b", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "0b9625",
      },
      body: JSON.stringify({
        sessionId: "0b9625",
        runId: "post-fix",
        hypothesisId: "B",
        location: "CatalogHero.tsx:activatePhoto",
        message: "Photo activation started",
        data: { from: activePhotoRef.current, to: index },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion

    activePhotoRef.current = index;
    setActivePhoto(index);
    setIsRotating(true);

    if (rotationTimerRef.current !== null) {
      window.clearTimeout(rotationTimerRef.current);
    }

    rotationTimerRef.current = window.setTimeout(() => {
      setIsRotating(false);
      rotationTimerRef.current = null;

      // #region agent log
      fetch(
        "http://127.0.0.1:7775/ingest/6812b337-414d-43d2-af37-a43171d1804b",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Debug-Session-Id": "0b9625",
          },
          body: JSON.stringify({
            sessionId: "0b9625",
            runId: "post-fix",
            hypothesisId: "D",
            location: "CatalogHero.tsx:rotationTimer",
            message: "Rotation blur ended",
            data: { activePhoto: activePhotoRef.current },
            timestamp: Date.now(),
          }),
        }
      ).catch(() => {});
      // #endregion
    }, ROTATION_END_MS);
  }

  function schedulePhotoActivation(index: number) {
    clearHoverDelay();

    // #region agent log
    fetch("http://127.0.0.1:7775/ingest/6812b337-414d-43d2-af37-a43171d1804b", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "0b9625",
      },
      body: JSON.stringify({
        sessionId: "0b9625",
        runId: "post-fix",
        hypothesisId: "A",
        location: "CatalogHero.tsx:schedulePhotoActivation",
        message: "Hover delay scheduled",
        data: { index, delayMs: HOVER_ACTIVATION_DELAY_MS },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion

    hoverDelayTimerRef.current = window.setTimeout(() => {
      activatePhoto(index);
      hoverDelayTimerRef.current = null;
    }, HOVER_ACTIVATION_DELAY_MS);
  }

  return (
    <section
      aria-label="Apresentação da loja"
      className="catalog-hero-premium relative w-full"
    >
      <div
        ref={parallaxBgRef}
        className="catalog-hero-premium__parallax catalog-hero-premium__bg"
        aria-hidden
      />

      <div className="catalog-hero-premium__shade" aria-hidden />
      <div className="catalog-hero-premium__overlay" aria-hidden />
      <div className="catalog-hero-premium__orb catalog-hero-premium__orb--top" aria-hidden />
      <div className="catalog-hero-premium__orb catalog-hero-premium__orb--bottom" aria-hidden />
      <div className="catalog-hero-premium__leaf catalog-hero-premium__leaf--left" aria-hidden />
      <div className="catalog-hero-premium__leaf catalog-hero-premium__leaf--right" aria-hidden />

      <div className="catalog-hero-premium__inner">
        <div className="catalog-hero-premium__layout">
          <div className="catalog-hero-premium__content">
            <p className="catalog-hero-premium__eyebrow catalog-hero-animate-title">
              SaboArt Atelier Botânico
            </p>

            <h1 className="catalog-hero-premium__title catalog-hero-animate-title">
              Cuidados artesanais com alma de floresta moderna
            </h1>

            <p className="catalog-hero-premium__subtitle catalog-hero-animate-subtitle">
              Sabonetes, sachês e aromas delicados para transformar pequenos
              gestos em rituais elegantes.
            </p>

            <ul className="catalog-hero-premium__highlights catalog-hero-animate-highlights">
              {HIGHLIGHTS.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>

            <div className="catalog-hero-premium__actions catalog-hero-animate-cta">
              <button
                type="button"
                onClick={scrollToProducts}
                className="catalog-hero-premium__cta catalog-btn-primary"
              >
                Ver coleção
                <ArrowRightIcon className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={scrollToProducts}
                className="catalog-hero-premium__secondary"
              >
                Explorar aromas
              </button>
            </div>
          </div>

          <div
            className={`catalog-hero-premium__gallery ${
              isRotating ? "catalog-hero-premium__gallery--rotating" : ""
            }`}
            aria-label="Produtos em destaque"
          >
            <div className="catalog-hero-premium__gallery-glow" aria-hidden />
            {HERO_PHOTOS.map((photo, index) => {
              const relativePosition =
                index === activePhoto
                  ? "center"
                  : (index - activePhoto + HERO_PHOTOS.length) %
                      HERO_PHOTOS.length ===
                    1
                  ? "right"
                  : "left";

              return (
                <figure
                  key={photo.src}
                  className={`${photo.className} catalog-hero-premium__photo--${relativePosition}`}
                  tabIndex={0}
                  onMouseEnter={() => schedulePhotoActivation(index)}
                  onMouseLeave={clearHoverDelay}
                  onFocus={() => activatePhoto(index)}
                  aria-label={photo.alt}
                >
                  <Image
                    src={photo.src}
                    alt={photo.alt}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 45vw, (max-width: 1200px) 24vw, 330px"
                    priority={index === 0}
                  />
                </figure>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
