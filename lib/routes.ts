/** Rotas estáticas na raiz — não devem ser tratadas como slug de categoria. */
export const RESERVED_ROOT_PATHS = new Set([
  "admin",
  "api",
  "carrinho",
  "checkout",
  "conta",
  "meus-pedidos",
  "pedido",
  "pedido-personalizado",
  "produto",
  "produtos",
  "_next",
  "favicon.ico",
  "products",
  "uploads",
]);

export function isReservedRootPath(segment: string): boolean {
  return RESERVED_ROOT_PATHS.has(segment.toLowerCase());
}
