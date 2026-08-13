export type StoreCategory = {
  id: string;
  name: string;
  slug: string;
  sortOrder?: number;
  imageUrl?: string | null;
};

export type NavLink = {
  label: string;
  href: string;
};

export type StoreNavigation = {
  home: NavLink;
  all: NavLink;
  categories: NavLink[];
  utility: NavLink[];
  primary: NavLink[];
};

export function buildStoreNavigation(
  categories: StoreCategory[]
): StoreNavigation {
  const home: NavLink = { label: "Home", href: "/" };
  const all: NavLink = { label: "Todos", href: "/produtos" };

  const categoryLinks: NavLink[] = [...categories]
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .map((cat) => ({
      label: cat.name,
      href: `/produtos/${cat.slug}`,
    }));

  const utility: NavLink[] = [
    { label: "Carrinho", href: "/carrinho" },
    { label: "Meus pedidos", href: "/meus-pedidos" },
    { label: "Minha conta", href: "/conta/login" },
  ];

  return {
    home,
    all,
    categories: categoryLinks,
    utility,
    primary: [home, all, ...categoryLinks],
  };
}

export function isNavLinkActive(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === "/";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}
