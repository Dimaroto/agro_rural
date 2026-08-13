import Image from "next/image";

type BrandLogoProps = {
  className?: string;
  size?: "sm" | "md" | "lg" | "header" | "headerWide" | "hero";
  priority?: boolean;
  centered?: boolean;
};

const SIZES = {
  sm: { width: 88, height: 88, className: "h-10 w-auto max-w-[65vw] sm:h-11" },
  md: { width: 140, height: 140, className: "h-14 w-auto max-w-[80vw] sm:h-16" },
  lg: { width: 200, height: 200, className: "h-16 w-auto max-w-full sm:h-20" },
  header: {
    width: 980,
    height: 582,
    className: "h-[4.75rem] w-auto max-w-[min(72vw,17rem)] sm:h-[5.25rem]",
  },
  headerWide: {
    width: 980,
    height: 582,
    className:
      "h-[4.75rem] w-auto max-w-[min(72vw,20rem)] sm:h-[5.5rem] lg:h-full lg:max-h-full lg:max-w-full",
  },
  hero: { width: 280, height: 280, className: "h-[120px] w-auto max-w-[90vw]" },
} as const;

export function BrandLogo({
  className = "",
  size = "md",
  priority = false,
  centered = false,
}: BrandLogoProps) {
  const { width, height, className: sizeClass } = SIZES[size];

  return (
    <Image
      src="/brand/agrorural-logo.png"
      alt="Agrorural Agropecuária"
      width={width}
      height={height}
      className={`object-contain bg-transparent ${centered ? "mx-auto object-center" : "object-left"} ${sizeClass} ${className}`}
      priority={priority}
    />
  );
}
