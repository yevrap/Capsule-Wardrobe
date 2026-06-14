import { useMemo, useState } from 'react';
import type { Garment, GarmentCategory } from '@/types';

export interface FilterState {
  search: string;
  categories: GarmentCategory[];
  tags: string[];
}

export function emptyFilter(): FilterState {
  return { search: '', categories: [], tags: [] };
}

export function useInventoryFilter(garments: Garment[] | undefined) {
  const [filter, setFilter] = useState<FilterState>(emptyFilter);

  // All unique tags present in this profile's wardrobe — used to populate
  // the tag filter chips. Derived from the live garment list.
  const allTags = useMemo(() => {
    const set = new Set<string>();
    garments?.forEach((g) => g.tags.forEach((t) => set.add(t)));
    return [...set].sort();
  }, [garments]);

  const filtered = useMemo(() => {
    if (!garments) return [];
    const { search, categories, tags } = filter;
    const q = search.trim().toLowerCase();

    return garments.filter((g) => {
      // Text search: name, brand, tags
      if (q) {
        const hit =
          g.name.toLowerCase().includes(q) ||
          (g.brand ?? '').toLowerCase().includes(q) ||
          g.tags.some((t) => t.includes(q)) ||
          g.colors.some((c) => c.includes(q));
        if (!hit) return false;
      }

      // Category filter: garment must match one of the selected categories
      if (categories.length > 0 && !categories.includes(g.category)) return false;

      // Tag filter: garment must have at least one of the selected tags
      if (tags.length > 0 && !tags.some((t) => g.tags.includes(t))) return false;

      return true;
    });
  }, [garments, filter]);

  const activeFilterCount =
    (filter.search ? 1 : 0) + filter.categories.length + filter.tags.length;

  function toggleCategory(cat: GarmentCategory) {
    setFilter((f) => ({
      ...f,
      categories: f.categories.includes(cat)
        ? f.categories.filter((c) => c !== cat)
        : [...f.categories, cat],
    }));
  }

  function toggleTag(tag: string) {
    setFilter((f) => ({
      ...f,
      tags: f.tags.includes(tag) ? f.tags.filter((t) => t !== tag) : [...f.tags, tag],
    }));
  }

  function clearAll() {
    setFilter(emptyFilter());
  }

  return {
    filter,
    setFilter,
    filtered,
    allTags,
    activeFilterCount,
    toggleCategory,
    toggleTag,
    clearAll,
  };
}
