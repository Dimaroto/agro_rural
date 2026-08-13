"use client";

import { useEffect, useState } from "react";

export function useFiltersSticky() {
  const [sticky, setSticky] = useState(false);

  useEffect(() => {
    function update() {
      const filters = document.querySelector(".catalog-filters-wrapper");
      if (!filters) {
        setSticky(window.scrollY > 120);
        return;
      }
      setSticky(filters.getBoundingClientRect().top <= 1);
    }

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  return sticky;
}
