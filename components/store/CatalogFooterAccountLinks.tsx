"use client";

import Link from "next/link";
import { useAccountModal } from "@/lib/customer-auth/account-modal";
import { useCustomerAuth } from "@/lib/customer-auth/provider";
import type { NavLink } from "@/lib/catalog-navigation";

type CatalogFooterAccountLinksProps = {
  links: NavLink[];
};

export function CatalogFooterAccountLinks({
  links,
}: CatalogFooterAccountLinksProps) {
  const { customer } = useCustomerAuth();
  const { openAccountModal } = useAccountModal();

  return (
    <ul className="catalog-footer__links">
      {links.map((link) => {
        const isAccount =
          link.href === "/conta/login" || link.label === "Minha conta";

        if (isAccount && !customer) {
          return (
            <li key={link.href}>
              <button
                type="button"
                className="text-left"
                onClick={() =>
                  openAccountModal({
                    intent: "general",
                    initialMode: "login",
                  })
                }
              >
                Entrar
              </button>
            </li>
          );
        }

        if (isAccount && customer) {
          return (
            <li key={link.href}>
              <Link href="/meus-pedidos">Minha conta</Link>
            </li>
          );
        }

        return (
          <li key={link.href}>
            <Link href={link.href}>{link.label}</Link>
          </li>
        );
      })}
    </ul>
  );
}
