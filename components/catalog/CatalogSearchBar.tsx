type CatalogSearchBarProps = {
  value: string;
  onChange: (value: string) => void;
};

export function CatalogSearchBar({ value, onChange }: CatalogSearchBarProps) {
  return (
    <section className="catalog-search" aria-label="Busca de produtos">
      <div className="catalog-search__inner">
        <label htmlFor="catalog-search-input" className="sr-only">
          Buscar produtos
        </label>
        <div className="catalog-search__field">
          <SearchIcon />
          <input
            id="catalog-search-input"
            type="search"
            placeholder="Buscar produtos..."
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="catalog-search__input"
            autoComplete="off"
          />
          {value && (
            <button
              type="button"
              onClick={() => onChange("")}
              className="catalog-search__clear"
              aria-label="Limpar busca"
            >
              <ClearIcon />
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

function SearchIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="catalog-search__icon"
      aria-hidden
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
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
      strokeWidth="2"
      className="h-4 w-4"
      aria-hidden
    >
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}
