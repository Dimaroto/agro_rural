type IconProps = {
  className?: string;
};

function IconBase({
  className = "h-5 w-5",
  children,
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {children}
    </svg>
  );
}

export function SalesIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </IconBase>
  );
}

export function OrdersIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M6 6h15l-1.5 9h-12z" />
      <path d="M6 6 5 3H2" />
      <circle cx="9" cy="20" r="1" />
      <circle cx="18" cy="20" r="1" />
    </IconBase>
  );
}

export function TicketIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M4 7h16v10H4z" />
      <path d="M8 7v10M16 7v10" />
    </IconBase>
  );
}

export function TopProductIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 2l2.4 4.8 5.4.8-3.9 3.8.9 5.3L12 14.8 7.2 16.7l.9-5.3L4.2 7.6l5.4-.8z" />
    </IconBase>
  );
}

export function ProductsIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M4 7h16v12H4z" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </IconBase>
  );
}

export function LowStockIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
      <path d="M10.3 3.6 2.6 17.2A2 2 0 0 0 4.4 20h15.2a2 2 0 0 0 1.8-2.8L13.7 3.6a2 2 0 0 0-3.4 0z" />
    </IconBase>
  );
}

export function PixIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </IconBase>
  );
}

export function OutOfStockIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 8l8 8" />
    </IconBase>
  );
}

export function MenuIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </IconBase>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M6 6l12 12M18 6 6 18" />
    </IconBase>
  );
}

/** Ícone de colar (clipboard). */
export function PasteIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
      <path d="M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1H9V5z" />
      <path d="M9 12h6M9 16h4" />
    </IconBase>
  );
}
