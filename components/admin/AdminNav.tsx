"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type MouseEvent } from "react";
import { BrandLogo } from "@/components/BrandLogo";
import { CloseIcon, MenuIcon } from "@/components/admin/AdminIcons";
import { useUnsavedChangesOptional } from "@/components/admin/UnsavedChangesContext";
import { AGRO_APP_CLIENT_COOKIE } from "@/lib/admin-app-client";

const appLinks = [
  { href: "/admin", label: "Dashboard", exact: true },
  { href: "/admin/produtos", label: "Produtos" },
  { href: "/admin/pdv", label: "PDV" },
  { href: "/admin/clientes", label: "Clientes" },
  { href: "/admin/agendamentos", label: "Agendamentos" },
  { href: "/admin/categorias", label: "Categorias" },
  { href: "/admin/pedidos", label: "Vendas" },
  { href: "/admin/financeiro", label: "Financeiro", prefix: "/admin/financeiro" },
  { href: "/admin/notas", label: "Notas Fiscais", prefix: "/admin/notas" },
  { href: "/admin/fornecedores", label: "Fornecedores", prefix: "/admin/fornecedores" },
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

function readAppClientCookie(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie
    .split(";")
    .some((c) => c.trim().startsWith(`${AGRO_APP_CLIENT_COOKIE}=`));
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
  const [isApp, setIsApp] = useState(false);

  useEffect(() => {
    setIsApp(readAppClientCookie());
  }, [pathname]);

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

  const links = isApp ? appLinks : [];

  return (
    <div className="admin-nav__brand-row">
      <Link href="/admin" className="admin-nav__logo" onClick={handleLogoClick}>
        <BrandLogo size="sm" priority />
      </Link>

      {isApp ? (
        <nav className="admin-nav__links" aria-label="Administração">
          {links.map((link) => (
            <NavLink
              key={link.href}
              href={link.href}
              label={link.label}
              active={isActive(
                pathname,
                link.href,
                link.exact,
                link.prefix
              )}
            />
          ))}
        </nav>
      ) : (
        <p className="admin-nav__portal-hint">Download do Admin</p>
      )}

      {isApp && (
        <>
          <button
            type="button"
            className="admin-nav__menu-btn"
            aria-label={mobileOpen ? "Fechar menu" : "Abrir menu"}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((open) => !open)}
          >
            {mobileOpen ? (
              <CloseIcon className="h-5 w-5" />
            ) : (
              <MenuIcon className="h-5 w-5" />
            )}
          </button>

          {mobileOpen && (
            <>
              <button
                type="button"
                className="admin-nav__backdrop"
                aria-label="Fechar menu"
                onClick={() => setMobileOpen(false)}
              />
              <nav
                className="admin-nav__mobile"
                aria-label="Administração mobile"
              >
                {links.map((link) => (
                  <NavLink
                    key={link.href}
                    href={link.href}
                    label={link.label}
                    active={isActive(
                      pathname,
                      link.href,
                      link.exact,
                      link.prefix
                    )}
                    onNavigate={() => setMobileOpen(false)}
                  />
                ))}
              </nav>
            </>
          )}
        </>
      )}
    </div>
  );
}
