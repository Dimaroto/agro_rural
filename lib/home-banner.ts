/** Proporções do banner da home — desktop (largo) e mobile (16:9). */

export type HomeBannerVariant = "desktop" | "mobile";

export const HOME_BANNER_DESKTOP = {
  aspect: 3,
  aspectClass: "aspect-[3/1]",
  idealWidth: 1800,
  idealHeight: 600,
  label: "3:1",
  field: "bannerUrl" as const,
  title: "Banner computador",
} as const;

export const HOME_BANNER_MOBILE = {
  aspect: 16 / 9,
  aspectClass: "aspect-video",
  idealWidth: 1200,
  idealHeight: 675,
  label: "16:9",
  field: "bannerUrlMobile" as const,
  title: "Banner celular",
} as const;

export function homeBannerConfig(variant: HomeBannerVariant) {
  return variant === "mobile" ? HOME_BANNER_MOBILE : HOME_BANNER_DESKTOP;
}

export function homeBannerIdealLabel(variant: HomeBannerVariant) {
  const c = homeBannerConfig(variant);
  return `${c.idealWidth} × ${c.idealHeight} px`;
}

/** @deprecated use HOME_BANNER_DESKTOP — mantido para imports legados */
export const HOME_BANNER_ASPECT = HOME_BANNER_DESKTOP.aspect;
export const HOME_BANNER_ASPECT_CLASS = HOME_BANNER_DESKTOP.aspectClass;
export const HOME_BANNER_IDEAL_WIDTH = HOME_BANNER_DESKTOP.idealWidth;
export const HOME_BANNER_IDEAL_HEIGHT = HOME_BANNER_DESKTOP.idealHeight;
export const HOME_BANNER_IDEAL_SIZE_LABEL = homeBannerIdealLabel("desktop");
