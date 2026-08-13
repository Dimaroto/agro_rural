"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BrandLogo } from "@/components/BrandLogo";
import { HeaderSearchResults } from "@/components/store/HeaderSearchResults";
import {
  buildStoreNavigation,
  isNavLinkActive,
  type NavLink,
  type StoreCategory,
} from "@/lib/catalog-navigation";
import { useCatalogSearch } from "@/lib/catalog-search-context";
import { useCustomerAuth } from "@/lib/customer-auth/provider";
import { useAccountModal } from "@/lib/customer-auth/account-modal";
import { forceUnlockBodyScroll } from "@/lib/body-scroll-lock";
import { getCartItemCount } from "@/lib/cartStorage";
import type { CatalogProduct } from "@/components/ProductCard";
import type { HeaderSearchProduct } from "@/lib/header-search-products";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
} from "@/components/icons/UiIcons";

type CatalogHeaderProps = {
  storeName: string;
  storeSlug: string;
  categories: StoreCategory[];
  products: CatalogProduct[] | HeaderSearchProduct[];
};

function HeaderSearchField({
  id,
  search,
  setSearch,
  products,
  categories,
  className = "",
  inputClassName = "",
  onAfterSelect,
}: {
  id?: string;
  search: string;
  setSearch: (value: string) => void;
  products: HeaderSearchProduct[];
  categories: StoreCategory[];
  className?: string;
  inputClassName?: string;
  onAfterSelect?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(e: MouseEvent | TouchEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function handleChange(value: string) {
    setSearch(value);
    setOpen(value.trim().length >= 2);
  }

  function handleClear() {
    setSearch("");
    setOpen(false);
  }

  const showResults = open && search.trim().length >= 2;

  return (
    <div ref={wrapRef} className={`catalog-header__search-wrap ${className}`}>
      <div className="catalog-header__search">
        {id && (
          <label htmlFor={id} className="sr-only">
            Buscar produtos
          </label>
        )}
        <SearchIcon />
        <input
          id={id}
          type="search"
          placeholder="Buscar produtos..."
          value={search}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => {
            if (search.trim().length >= 2) setOpen(true);
          }}
          className={`catalog-header__search-input ${inputClassName}`}
          autoComplete="off"
          role="combobox"
          aria-expanded={showResults}
          aria-controls={id ? `${id}-results` : undefined}
          // eslint-disable-next-line jsx-a11y/no-autofocus -- painel mobile aberto sob demanda
          autoFocus={Boolean(onAfterSelect)}
        />
        {search && (
          <button
            type="button"
            onClick={handleClear}
            className="catalog-header__search-clear"
            aria-label="Limpar busca"
          >
            <ClearIcon />
          </button>
        )}
      </div>
      {showResults && (
        <div id={id ? `${id}-results` : undefined}>
          <HeaderSearchResults
            query={search}
            products={products}
            categories={categories}
            onSelect={() => {
              setOpen(false);
              setSearch("");
              onAfterSelect?.();
            }}
          />
        </div>
      )}
    </div>
  );
}

export function CatalogHeader({
  storeName,
  storeSlug,
  categories,
  products,
}: CatalogHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { customer, logout, loading } = useCustomerAuth();
  const { openAccountModal } = useAccountModal();
  const { search, setSearch } = useCatalogSearch();
  const [cartCount, setCartCount] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const navigation = useMemo(
    () => buildStoreNavigation(categories),
    [categories]
  );

  function openLoginModal() {
    setMenuOpen(false);
    setSearchOpen(false);
    openAccountModal({ intent: "general", initialMode: "login" });
  }

  useEffect(() => {
    function refreshCount() {
      setCartCount(getCartItemCount(storeSlug));
    }
    refreshCount();
    window.addEventListener("storage", refreshCount);
    window.addEventListener("cart-updated", refreshCount);
    return () => {
      window.removeEventListener("storage", refreshCount);
      window.removeEventListener("cart-updated", refreshCount);
    };
  }, [storeSlug]);

  useEffect(() => {
    setMenuOpen(false);
    setSearchOpen(false);
  }, [pathname]);

  function goToCart() {
    forceUnlockBodyScroll();
    setMenuOpen(false);
    setSearchOpen(false);
    router.push("/carrinho");
  }

  function toggleMenu() {
    setMenuOpen((v) => !v);
    setSearchOpen(false);
  }

  function toggleSearch() {
    setSearchOpen((v) => !v);
    setMenuOpen(false);
  }

  const accountHref = "/meus-pedidos";

  const isStaticHeader = !(pathname === "/" || pathname === "/produtos");

  return (
    <div
      className={`catalog-header-wrap ${
        isStaticHeader ? "catalog-header-wrap--static" : ""
      }`}
    >
      <header className="catalog-header">
        <div className="catalog-header__inner">
          <div className="catalog-header__lead">
            <button
              type="button"
              className="catalog-header__menu-btn"
              onClick={toggleMenu}
              aria-expanded={menuOpen}
              aria-label="Menu"
            >
              <span className="catalog-header__menu-icon" />
            </button>

            <Link
              href="/"
              className="catalog-header__brand"
              aria-label={storeName}
            >
              <BrandLogo size="headerWide" />
            </Link>
          </div>

          <div
            className="catalog-header__divider-v hidden lg:block"
            aria-hidden
          />

          <div className="catalog-header__toolbar">
            <div className="catalog-header__center hidden lg:flex">
              <HeaderSearchField
                id="catalog-header-search"
                search={search}
                setSearch={setSearch}
                products={products}
                categories={categories}
                className="catalog-header__search-wrap--desktop"
              />
            </div>
          </div>

          <div className="catalog-header__actions">
              <button
                type="button"
                className={`catalog-header__icon-btn lg:hidden ${
                  searchOpen ? "catalog-header__icon-btn--active" : ""
                }`}
                onClick={toggleSearch}
                aria-expanded={searchOpen}
                aria-label="Buscar produtos"
              >
                <SearchIcon className="catalog-header__icon" />
              </button>

              {customer ? (
                <Link
                  href={accountHref}
                  className="catalog-header__icon-btn lg:hidden"
                  aria-label="Minha conta"
                  onClick={() => {
                    setMenuOpen(false);
                    setSearchOpen(false);
                  }}
                >
                  <UserIcon className="catalog-header__icon" />
                </Link>
              ) : (
                <button
                  type="button"
                  className="catalog-header__icon-btn lg:hidden"
                  aria-label="Entrar"
                  onClick={openLoginModal}
                >
                  <UserIcon className="catalog-header__icon" />
                </button>
              )}

              <Link
                href="/meus-pedidos"
                className="catalog-header__action hidden lg:inline-flex"
              >
                Meus pedidos
              </Link>
              {!loading &&
                (customer ? (
                  <div className="catalog-header__account hidden lg:flex lg:items-center lg:gap-2">
                    <span className="catalog-header__account-name truncate max-w-[9rem]">
                      {customer.name ?? customer.email.split("@")[0]}
                    </span>
                    <button
                      type="button"
                      onClick={() => void logout()}
                      className="catalog-header__action catalog-header__action--muted"
                    >
                      Sair
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={openLoginModal}
                    className="catalog-header__action hidden lg:inline-flex"
                  >
                    Entrar
                  </button>
                ))}
              <button
                type="button"
                onClick={goToCart}
                className="catalog-header__cart"
                aria-label="Carrinho"
              >
                <CartIcon />
                {cartCount > 0 && (
                  <span className="catalog-header__cart-badge">{cartCount}</span>
                )}
              </button>
            </div>

          <div className="catalog-header__nav-block hidden lg:flex">
            <nav className="catalog-header__nav-bar" aria-label="Categorias">
            <Link
              href={navigation.home.href}
              className={`catalog-header__link catalog-header__link--home catalog-header__link--fixed ${
                isNavLinkActive(pathname, navigation.home.href)
                  ? "catalog-header__link--active"
                  : ""
              }`}
            >
              <HomeIcon />
              <span>{navigation.home.label}</span>
            </Link>

            <Link
              href={navigation.all.href}
              className={`catalog-header__link catalog-header__link--fixed ${
                pathname === navigation.all.href
                  ? "catalog-header__link--active"
                  : ""
              }`}
            >
              {navigation.all.label}
            </Link>

            <HeaderCategoriesCarousel
              categories={navigation.categories}
              pathname={pathname}
            />
          </nav>
        </div>
        </div>

        {searchOpen && (
          <div className="catalog-header__mobile-search lg:hidden">
            <HeaderSearchField
              id="catalog-header-search-mobile"
              search={search}
              setSearch={setSearch}
              products={products}
              categories={categories}
              className="catalog-header__search-wrap--mobile"
              onAfterSelect={() => setSearchOpen(false)}
            />
          </div>
        )}

        <nav
          className={`catalog-header__mobile-nav lg:hidden ${
            menuOpen ? "catalog-header__mobile-nav--open" : ""
          }`}
          aria-label="Menu mobile"
        >
          {navigation.primary.map((link) => (
            <Link
              key={`${link.label}-${link.href}`}
              href={link.href}
              className={`catalog-header__mobile-link ${
                (link.href === "/produtos"
                  ? pathname === "/produtos"
                  : isNavLinkActive(pathname, link.href))
                  ? "catalog-header__mobile-link--active"
                  : ""
              }`}
              onClick={() => setMenuOpen(false)}
            >
              {link.label === "Home" ? (
                <span className="inline-flex items-center gap-2">
                  <HomeIcon />
                  Home
                </span>
              ) : (
                link.label
              )}
            </Link>
          ))}

          <div className="catalog-header__mobile-footer">
            {customer ? (
              <Link
                href={accountHref}
                className="catalog-header__mobile-link"
                onClick={() => setMenuOpen(false)}
              >
                Minha conta
              </Link>
            ) : (
              <button
                type="button"
                className="catalog-header__mobile-link w-full text-left"
                onClick={openLoginModal}
              >
                Entrar / Cadastrar
              </button>
            )}
            <Link
              href="/meus-pedidos"
              className="catalog-header__mobile-link"
              onClick={() => setMenuOpen(false)}
            >
              Meus pedidos
            </Link>
            <button
              type="button"
              className="catalog-header__mobile-link"
              onClick={goToCart}
            >
              Carrinho{cartCount > 0 ? ` (${cartCount})` : ""}
            </button>
          </div>
        </nav>
      </header>

      <div
        className={`catalog-drawer hidden lg:block ${
          menuOpen ? "catalog-drawer--open" : ""
        }`}
        aria-hidden={!menuOpen}
      >
        <button
          type="button"
          className="catalog-drawer__backdrop"
          onClick={() => setMenuOpen(false)}
          aria-label="Fechar menu"
          tabIndex={menuOpen ? 0 : -1}
        />
        <aside
          className="catalog-drawer__panel"
          role="dialog"
          aria-label="Menu de navegação"
        >
          <div className="catalog-drawer__head">
            <Link
              href="/"
              className="catalog-drawer__brand"
              onClick={() => setMenuOpen(false)}
              aria-label={storeName}
            >
              <BrandLogo size="header" />
            </Link>
            <button
              type="button"
              className="catalog-drawer__close"
              onClick={() => setMenuOpen(false)}
              aria-label="Fechar menu"
            >
              ×
            </button>
          </div>

          <nav className="catalog-drawer__nav flex-1" aria-label="Navegação">
            {navigation.primary.map((link) => (
              <Link
                key={`drawer-${link.label}-${link.href}`}
                href={link.href}
                className={`catalog-drawer__link ${
                  (link.href === "/produtos"
                    ? pathname === "/produtos"
                    : isNavLinkActive(pathname, link.href))
                    ? "catalog-drawer__link--active"
                    : ""
                }`}
                onClick={() => setMenuOpen(false)}
              >
                {link.label === "Home" ? (
                  <span className="inline-flex items-center gap-2">
                    <HomeIcon />
                    Home
                  </span>
                ) : (
                  link.label
                )}
              </Link>
            ))}
          </nav>

          <div className="catalog-drawer__footer">
            <Link
              href="/meus-pedidos"
              className="catalog-drawer__link"
              onClick={() => setMenuOpen(false)}
            >
              Meus pedidos
            </Link>
            {customer ? (
              <Link
                href={accountHref}
                className="catalog-drawer__link"
                onClick={() => setMenuOpen(false)}
              >
                Minha conta
              </Link>
            ) : (
              <button
                type="button"
                className="catalog-drawer__link w-full text-left"
                onClick={openLoginModal}
              >
                Entrar / Cadastrar
              </button>
            )}
            <button
              type="button"
              className="catalog-drawer__link"
              onClick={goToCart}
            >
              Carrinho{cartCount > 0 ? ` (${cartCount})` : ""}
            </button>
            {customer && (
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  void logout();
                }}
                className="catalog-drawer__link catalog-drawer__link--muted w-full text-left"
              >
                Sair
              </button>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function HeaderCategoriesCarousel({
  categories,
  pathname,
}: {
  categories: NavLink[];
  pathname: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);
  const [needsCarousel, setNeedsCarousel] = useState(false);

  const syncScrollState = useCallback(() => {
    const track = trackRef.current;
    const wrap = wrapRef.current;
    const nav = wrap?.closest(".catalog-header__nav-bar") as HTMLElement | null;
    if (!track) {
      setCanPrev(false);
      setCanNext(false);
      return;
    }

    if (nav) {
      const links = nav.querySelectorAll<HTMLElement>(".catalog-header__link");
      const styles = getComputedStyle(nav);
      const gap = parseFloat(styles.columnGap || styles.gap || "6") || 6;
      let contentWidth = 0;
      links.forEach((link, index) => {
        contentWidth += link.offsetWidth;
        if (index > 0) contentWidth += gap;
      });
      setNeedsCarousel(contentWidth > nav.clientWidth - 8);
    }

    const maxScroll = track.scrollWidth - track.clientWidth;
    const overflow = maxScroll > 2;
    setCanPrev(overflow && track.scrollLeft > 2);
    setCanNext(overflow && track.scrollLeft < maxScroll - 2);
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    const wrap = wrapRef.current;
    const nav = wrap?.closest(".catalog-header__nav-bar") as HTMLElement | null;
    if (!track) return;
    syncScrollState();
    const onResize = () => syncScrollState();
    window.addEventListener("resize", onResize);
    const ro =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => syncScrollState())
        : null;
    ro?.observe(track);
    if (nav) ro?.observe(nav);
    return () => {
      window.removeEventListener("resize", onResize);
      ro?.disconnect();
    };
  }, [categories.length, syncScrollState]);

  function scrollByPage(direction: -1 | 1) {
    const el = trackRef.current;
    if (!el) return;
    const amount = Math.max(120, el.clientWidth * 0.75) * direction;
    el.scrollBy({ left: amount, behavior: "smooth" });
  }

  if (categories.length === 0) return null;

  const showControls = needsCarousel;

  return (
    <div
      ref={wrapRef}
      className={`catalog-header__nav-carousel${
        needsCarousel ? "" : " catalog-header__nav-carousel--fit"
      }`}
    >
      {showControls ? (
        <button
          type="button"
          className="catalog-header__nav-arrow"
          aria-label="Categorias anteriores"
          disabled={!canPrev}
          onClick={() => scrollByPage(-1)}
        >
          <ArrowLeftIcon className="h-3.5 w-3.5" />
        </button>
      ) : null}

      <div
        ref={trackRef}
        className="catalog-header__nav-track"
        onScroll={syncScrollState}
        aria-label="Carrossel de categorias"
      >
        {categories.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`catalog-header__link ${
              isNavLinkActive(pathname, link.href)
                ? "catalog-header__link--active"
                : ""
            }`}
          >
            {link.label}
          </Link>
        ))}
      </div>

      {showControls ? (
        <button
          type="button"
          className="catalog-header__nav-arrow"
          aria-label="Próximas categorias"
          disabled={!canNext}
          onClick={() => scrollByPage(1)}
        >
          <ArrowRightIcon className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  );
}

function CartIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="catalog-header__cart-icon"
      aria-hidden
    >
      <circle cx="8" cy="21" r="1" />
      <circle cx="19" cy="21" r="1" />
      <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="catalog-header__home-icon"
      aria-hidden
    >
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function SearchIcon({ className = "catalog-header__search-icon" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function UserIcon({ className = "catalog-header__icon" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  );
}

function ClearIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="catalog-header__search-clear-icon"
      aria-hidden
    >
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}
