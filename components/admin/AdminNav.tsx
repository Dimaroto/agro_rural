"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type MouseEvent } from "react";
import { BrandLogo } from "@/components/BrandLogo";
import { CloseIcon, MenuIcon } from "@/components/admin/AdminIcons";
import { useUnsavedChangesOptional } from "@/components/admin/UnsavedChangesContext";

const links = [
  { href: "/admin", label: "Dashboard", exact: true },
  { href: "/admin/produtos", label: "Produtos" },
  { href: "/admin/pdv", label: "PDV" },
  { href: "/admin/clientes", label: "Clientes" },
  { href: "/admin/categorias", label: "Categorias" },
  { href: "/admin/pedidos", label: "Vendas" },
  { href: "/admin/financeiro", label: "Financeiro", prefix: "/admin/financeiro" },
];

function isActive(
  pathname: string,
  href: string,
  exact?: boolean,
  prefix?: string
) {
  if (prefix) {
    return pathname === prefix || pathname.startsWith(`${prefix}/`);
  }
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({
  href,
  label,
  active,
  onNavigate,
}: {
  href: string;
  label: string;
  active: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const unsaved = useUnsavedChangesOptional();

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    if (unsaved?.isDirty && href !== pathname) {
      event.preventDefault();
      unsaved.requestNavigation({ type: "href", href });
      onNavigate?.();
      return;
    }
    onNavigate?.();
  }

  return (
    <Link
      href={href}
      onClick={handleClick}
      className={
        active
          ? "admin-nav__link admin-nav__link--active"
          : "admin-nav__link"
      }
    >
      {label}
    </Link>
  );
}

export function AdminNav() {
  const pathname = usePathname();
  const unsaved = useUnsavedChangesOptional();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  function handleLogoClick(event: MouseEvent<HTMLAnchorElement>) {
    if (unsaved?.isDirty && pathname !== "/admin") {
      event.preventDefault();
      unsaved.requestNavigation({ type: "href", href: "/admin" });
    }
  }

  return (
    <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-3">
        <Link href="/admin" className="shrink-0" onClick={handleLogoClick}>
          <BrandLogo size="sm" priority />
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Administração">
          {links.map((link) => (
            <NavLink
              key={link.href}
              href={link.href}
              label={link.label}
              active={isActive(pathname, link.href, link.exact, link.prefix)}
            />
          ))}
        </nav>
      </div>

      <button
        type="button"
        className="admin-nav__menu-btn shrink-0 md:hidden"
        aria-label={mobileOpen ? "Fechar menu" : "Abrir menu"}
        aria-expanded={mobileOpen}
        onClick={() => setMobileOpen((open) => !open)}
      >
        {mobileOpen ? <CloseIcon className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
      </button>

      {mobileOpen && (
        <>
          <button
            type="button"
            className="admin-nav__backdrop md:hidden"
            aria-label="Fechar menu"
            onClick={() => setMobileOpen(false)}
          />
          <nav
            className="admin-nav__mobile md:hidden"
            aria-label="Administração mobile"
          >
            {links.map((link) => (
              <NavLink
                key={link.href}
                href={link.href}
                label={link.label}
                active={isActive(pathname, link.href, link.exact, link.prefix)}
                onNavigate={() => setMobileOpen(false)}
              />
            ))}
          </nav>
        </>
      )}
    </div>
  );
}
