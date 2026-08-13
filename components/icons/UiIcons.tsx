import type { SVGProps } from "react";

type IconProps = { className?: string };

function Svg({
  className,
  children,
  ...props
}: IconProps & SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
      {...props}
    >
      {children}
    </svg>
  );
}

export function LeafPlaceholderIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <Svg className={className} strokeWidth={1.75}>
      <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.5 18 2c1 2.5 1 6.5-2 10.5" />
      <path d="M2 21c0-3 2.5-5 5-5" />
    </Svg>
  );
}

export function CloseIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <Svg className={className} strokeWidth={2}>
      <path d="M18 6 6 18M6 6l12 12" />
    </Svg>
  );
}

export function CartEmptyIcon({ className = "h-10 w-10" }: IconProps) {
  return (
    <Svg className={className} strokeWidth={1.75}>
      <circle cx="8" cy="21" r="1" fill="currentColor" stroke="none" />
      <circle cx="19" cy="21" r="1" fill="currentColor" stroke="none" />
      <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
    </Svg>
  );
}

export function MinusIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <Svg className={className} strokeWidth={2.5}>
      <path d="M5 12h14" />
    </Svg>
  );
}

export function PlusIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <Svg className={className} strokeWidth={2.5}>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  );
}

export function CheckIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <Svg className={className} strokeWidth={2.5}>
      <path d="M20 6 9 17l-5-5" />
    </Svg>
  );
}

export function BoltIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <Svg className={className} strokeWidth={2}>
      <path d="M13 2 3 14h8l-1 8 10-12h-8l1-8z" />
    </Svg>
  );
}

export function XCircleIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <Svg className={className} strokeWidth={2}>
      <circle cx="12" cy="12" r="9" />
      <path d="m15 9-6 6M9 9l6 6" />
    </Svg>
  );
}

export function SearchIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <Svg className={className} strokeWidth={2}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </Svg>
  );
}

export function ArrowRightIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <Svg className={className} strokeWidth={2.5}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </Svg>
  );
}

export function ArrowLeftIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <Svg className={className} strokeWidth={2.5}>
      <path d="M19 12H5M11 6l-6 6 6 6" />
    </Svg>
  );
}

export function HomeIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <Svg className={className} strokeWidth={2}>
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <path d="M9 22V12h6v10" />
    </Svg>
  );
}

export function PackageIcon({ className = "h-6 w-6" }: IconProps) {
  return (
    <Svg className={className} strokeWidth={1.75}>
      <path d="M12 22V12" />
      <path d="m2 7 10-4 10 4-10 4-10-4z" />
      <path d="M2 7v10l10 4 10-4V7" />
    </Svg>
  );
}

export function SoapIcon({ className = "h-6 w-6" }: IconProps) {
  return (
    <Svg className={className} strokeWidth={1.75}>
      <rect x="5" y="8" width="14" height="10" rx="3" />
      <path d="M8 8V6a4 4 0 0 1 8 0v2" />
      <circle cx="10" cy="13" r="0.75" fill="currentColor" stroke="none" />
      <circle cx="14" cy="13" r="0.75" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function FlowerIcon({ className = "h-6 w-6" }: IconProps) {
  return (
    <Svg className={className} strokeWidth={1.75}>
      <circle cx="12" cy="12" r="2.25" />
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" />
    </Svg>
  );
}

export function SprayIcon({ className = "h-6 w-6" }: IconProps) {
  return (
    <Svg className={className} strokeWidth={1.75}>
      <path d="M9 4h6v4H9z" />
      <path d="M10 8v3" />
      <path d="M14 8v3" />
      <path d="M8 15h8l-1 5H9l-1-5z" />
      <path d="M6 12h2M16 12h2M4 9h1M19 9h1" />
    </Svg>
  );
}

export function CategorySlugIcon({
  slug,
  className = "h-6 w-6",
}: {
  slug: string;
  className?: string;
}) {
  const key = slug.toLowerCase();
  if (key.includes("sabon")) return <SoapIcon className={className} />;
  if (key.includes("sache") || key.includes("perfum") || key.includes("floral")) {
    return <FlowerIcon className={className} />;
  }
  if (key.includes("spray")) return <SprayIcon className={className} />;
  return <PackageIcon className={className} />;
}

export function ProductPlaceholder({
  className = "h-8 w-8",
}: IconProps) {
  return <LeafPlaceholderIcon className={className} />;
}

export function CameraIcon({ className = "h-6 w-6" }: IconProps) {
  return (
    <Svg className={className} strokeWidth={1.75}>
      <path d="M4 8h2l1-2h10l1 2h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2z" />
      <circle cx="12" cy="14" r="3.25" />
    </Svg>
  );
}

export function SunIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <Svg className={className} strokeWidth={1.75}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </Svg>
  );
}

export function MoonIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <Svg className={className} strokeWidth={1.75}>
      <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 7 7 0 1 0 20 14.5z" />
    </Svg>
  );
}
