"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/admin/financeiro", label: "Dashboard", exact: true },
  { href: "/admin/financeiro/receitas", label: "Receitas" },
  { href: "/admin/financeiro/despesas", label: "Despesas" },
  { href: "/admin/financeiro/fluxo-de-caixa", label: "Fluxo de Caixa" },
  { href: "/admin/financeiro/contas-a-receber", label: "Contas a Receber" },
  { href: "/admin/financeiro/contas-a-pagar", label: "Contas a Pagar" },
  { href: "/admin/financeiro/clientes", label: "Clientes" },
  { href: "/admin/financeiro/cobrancas", label: "Cobranças" },
  { href: "/admin/financeiro/configuracoes", label: "Configurações" },
];

function isActive(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function FinanceSubNav() {
  const pathname = usePathname();

  return (
    <nav className="finance-subnav" aria-label="Financeiro">
      <p className="finance-subnav__title">Financeiro</p>
      <ul className="finance-subnav__list">
        {links.map((link) => {
          const active = isActive(pathname, link.href, link.exact);
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                className={
                  active
                    ? "finance-subnav__link finance-subnav__link--active"
                    : "finance-subnav__link"
                }
              >
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
