"use client";

type Category = { id: string; name: string; slug: string };

type CatalogFiltersBarProps = {
  categories: Category[];
  categoryId: string | null;
  onCategoryChange: (id: string | null) => void;
};

export function CatalogFiltersBar({
  categories,
  categoryId,
  onCategoryChange,
}: CatalogFiltersBarProps) {
  return (
    <section className="catalog-category-explore" aria-label="Filtros por categoria">
      <h2 className="catalog-category-explore__title">Explore por categoria</h2>
      <div className="catalog-category-explore__pills">
        <button
          type="button"
          onClick={() => onCategoryChange(null)}
          className={`catalog-filter-pill shrink-0 touch-manipulation ${
            !categoryId ? "catalog-filter-pill--active" : "catalog-filter-pill--idle"
          }`}
        >
          Todos
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onCategoryChange(c.id)}
            className={`catalog-filter-pill shrink-0 touch-manipulation ${
              categoryId === c.id
                ? "catalog-filter-pill--active"
                : "catalog-filter-pill--idle"
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>
    </section>
  );
}
