import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";
import { CatalogFooterAccountLinks } from "@/components/store/CatalogFooterAccountLinks";
import {
  buildStoreNavigation,
  type StoreCategory,
} from "@/lib/catalog-navigation";

type CatalogFooterProps = {
  storeName: string;
  whatsapp: string | null;
  categories: StoreCategory[];
};

export function CatalogFooter({
  storeName,
  whatsapp,
  categories,
}: CatalogFooterProps) {
  const phone = whatsapp?.replace(/\D/g, "") ?? "";
  const waLink = phone
    ? `https://wa.me/${phone}?text=${encodeURIComponent(`Olá! Vim pelo catálogo da ${storeName}.`)}`
    : null;

  const navigation = buildStoreNavigation(categories);

  return (
    <footer className="catalog-footer mt-auto">
      <div className="catalog-footer__inner">
        <div className="catalog-footer__grid">
          <div>
            <Link href="/" className="catalog-footer__logo" aria-label={storeName}>
              <BrandLogo size="header" />
            </Link>
            <p className="catalog-footer__text">
              Sabonetes artesanais, sachês perfumados e sprays feitos com carinho.
            </p>
          </div>

          <div>
            <p className="catalog-footer__label">Navegação</p>
            <ul className="catalog-footer__links">
              {navigation.primary.map((link) => (
                <li key={`${link.label}-${link.href}`}>
                  <Link href={link.href}>{link.label}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="catalog-footer__label">Minha conta</p>
            <CatalogFooterAccountLinks links={navigation.utility} />
          </div>

          <div>
            <p className="catalog-footer__label">Contato</p>
            {waLink ? (
              <a
                href={waLink}
                target="_blank"
                rel="noopener noreferrer"
                className="catalog-footer__whatsapp"
              >
                Pedir pelo WhatsApp
              </a>
            ) : (
              <p className="catalog-footer__text">WhatsApp em breve</p>
            )}
          </div>
        </div>
        <p className="catalog-footer__copy">
          © {new Date().getFullYear()} {storeName}. Todos os direitos reservados.
        </p>
      </div>
    </footer>
  );
}
