import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useStore } from '../../contexts/StoreContext';
import { storePublicApi } from '../../lib/api';
import StoreProductCard from '../../components/store/StoreProductCard';
import { Search, SlidersHorizontal, ShoppingBag, X, ChevronLeft, ChevronRight } from 'lucide-react';

export default function StoreProductsPage() {
  const { store } = useStore();
  const [searchParams, setSearchParams] = useSearchParams();

  const currentSearch = searchParams.get('search') || '';
  const currentCollection = searchParams.get('collection') || '';
  const currentCategory = searchParams.get('category') || '';
  const currentSort = searchParams.get('sort') || 'newest';
  const currentPage = parseInt(searchParams.get('page') || '1', 10);

  const [products, setProducts] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState(currentSearch);
  const searchRef = useRef<HTMLInputElement>(null);

  /**
   * The mobile bar's search entry lands here with `?focus=search`. Focusing the
   * real field (and dropping the flag so a reload does not re-open the
   * keyboard) is what makes that button a search rather than a page jump.
   */
  useEffect(() => {
    if (searchParams.get('focus') !== 'search') return;
    searchRef.current?.focus();
    const next = new URLSearchParams(searchParams);
    next.delete('focus');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const primaryColor = store?.primaryColor || '#f97316';
  const activeCollection = store?.collections?.find((c) => c.slug === currentCollection) || null;

  /**
   * The selected branch of the category tree. A parent shows its children as a
   * second row of chips; picking a child narrows within it. Selecting a parent
   * still lists everything under it — the API resolves descendants — so the
   * sub-chips refine rather than being the only way to see anything.
   */
  const categories = store?.categories || [];
  const activeParent =
    categories.find((c) => c.slug === currentCategory) ||
    categories.find((c) => c.children?.some((k) => k.slug === currentCategory)) ||
    null;

  /* Flattened out of `activeParent` so the markup below never has to re-check
     it for null on every field it reads. */
  const subCategories = activeParent?.children ?? [];
  const activeParentSlug = activeParent?.slug ?? '';
  const activeParentName = activeParent?.nameFr ?? '';

  useEffect(() => {
    if (!store?.id) return;

    setLoading(true);
    storePublicApi
      .getProducts({
        storeId: store.id,
        page: currentPage,
        limit: 12,
        collection: currentCollection || undefined,
        category: currentCategory || undefined,
        search: currentSearch || undefined,
        sort: currentSort,
      })
      .then((res) => {
        const data = res.data?.data;
        setProducts(data?.products || []);
        setTotal(data?.total || 0);
        setTotalPages(data?.totalPages || 1);
      })
      .catch((err) => console.error('Failed to load products:', err))
      .finally(() => setLoading(false));
  }, [store?.id, currentSearch, currentCollection, currentCategory, currentSort, currentPage]);

  const updateFilters = (newParams: Record<string, string | null>) => {
    const updated = new URLSearchParams(searchParams);
    Object.entries(newParams).forEach(([k, v]) => {
      if (v === null || v === '') {
        updated.delete(k);
      } else {
        updated.set(k, v);
      }
    });
    // Reset page to 1 on filter changes
    if (newParams.page === undefined) {
      updated.delete('page');
    }
    setSearchParams(updated);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateFilters({ search: searchInput.trim() || null });
  };

  if (!store) return null;

  /** First page, last page, and the current page's neighbours; `null` is a gap. */
  const pageWindow: Array<number | null> = [];
  for (let n = 1; n <= totalPages; n++) {
    const keep = n === 1 || n === totalPages || Math.abs(n - currentPage) <= 1;
    if (keep) pageWindow.push(n);
    else if (pageWindow[pageWindow.length - 1] !== null) pageWindow.push(null);
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8">
      {/* Header & Title */}
      <div>
        <nav className="flex items-center gap-2 text-xs font-semibold text-gray-500 mb-3">
          <Link to="/" className="hover:text-gray-900">
            Accueil
          </Link>
          <span>/</span>
          <span className="text-gray-900">Produits</span>
        </nav>
        <h1 className="text-3xl sm:text-4xl font-black text-gray-900 tracking-tight">
          {activeCollection ? activeCollection.nameFr : currentSearch ? `Résultats pour « ${currentSearch} »` : 'Tous nos Produits'}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {total} {total > 1 ? 'produits disponibles' : 'produit disponible'}
        </p>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          {/* Search Box */}
          <form onSubmit={handleSearchSubmit} className="relative w-full md:max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              ref={searchRef}
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Rechercher par mot-clé..."
              className="w-full pl-10 pr-10 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 text-gray-900"
              style={{ ['--tw-ring-color' as any]: primaryColor }}
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => {
                  setSearchInput('');
                  updateFilters({ search: null });
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </form>

          {/* Sort Dropdown */}
          <div className="flex items-center gap-2 w-full md:w-auto justify-end">
            <SlidersHorizontal className="w-4 h-4 text-gray-400" />
            <select
              value={currentSort}
              onChange={(e) => updateFilters({ sort: e.target.value })}
              className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2"
              style={{ ['--tw-ring-color' as any]: primaryColor }}
            >
              <option value="newest">Plus récents</option>
              <option value="price_asc">Prix : Croissant</option>
              <option value="price_desc">Prix : Décroissant</option>
              <option value="name">Nom (A-Z)</option>
            </select>
          </div>
        </div>

        {/* Category chips: the shop's own tree, parents first. */}
        {categories.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-gray-100">
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
              <button
                onClick={() => updateFilters({ category: null, page: null })}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  !currentCategory ? 'text-white shadow-xs' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
                style={!currentCategory ? { backgroundColor: primaryColor } : {}}
              >
                Toutes les catégories
              </button>
              {categories.map((cat) => {
                const isSelected = activeParent?.id === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => updateFilters({ category: isSelected ? null : cat.slug, page: null })}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                      isSelected ? 'text-white shadow-xs' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                    style={isSelected ? { backgroundColor: primaryColor } : {}}
                  >
                    {cat.nameFr}
                  </button>
                );
              })}
            </div>

            {subCategories.length > 0 && (
              <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none pl-1">
                <button
                  onClick={() => updateFilters({ category: activeParentSlug, page: null })}
                  className={`px-3 py-1 rounded-lg text-[11px] font-bold border transition-all whitespace-nowrap ${
                    currentCategory === activeParentSlug
                      ? 'border-transparent text-white'
                      : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                  }`}
                  style={currentCategory === activeParentSlug ? { backgroundColor: primaryColor } : {}}
                >
                  Tout {activeParentName}
                </button>
                {subCategories.map((sub) => {
                  const isSub = currentCategory === sub.slug;
                  return (
                    <button
                      key={sub.id}
                      onClick={() => updateFilters({ category: isSub ? activeParentSlug : sub.slug, page: null })}
                      className={`px-3 py-1 rounded-lg text-[11px] font-bold border transition-all whitespace-nowrap ${
                        isSub ? 'border-transparent text-white' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                      style={isSub ? { backgroundColor: primaryColor } : {}}
                    >
                      {sub.nameFr}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Collection Filter Chips */}
        {store.collections && store.collections.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none pt-2 border-t border-gray-100">
            <button
              onClick={() => updateFilters({ collection: null })}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                !currentCollection
                  ? 'text-white shadow-xs'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              style={!currentCollection ? { backgroundColor: primaryColor } : {}}
            >
              Tous
            </button>
            {store.collections.map((col) => {
              const isSelected = currentCollection === col.slug;
              return (
                <button
                  key={col.id}
                  onClick={() => updateFilters({ collection: isSelected ? null : col.slug })}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                    isSelected
                      ? 'text-white shadow-xs'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                  style={isSelected ? { backgroundColor: primaryColor } : {}}
                >
                  {col.nameFr}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Products Grid */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
            <div key={n} className="bg-white rounded-2xl p-4 border border-gray-100 animate-pulse space-y-3">
              <div className="aspect-square bg-gray-100 rounded-xl" />
              <div className="h-4 bg-gray-100 rounded w-3/4" />
              <div className="h-4 bg-gray-100 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="bg-white rounded-3xl border border-gray-100 p-16 text-center">
          <ShoppingBag className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-gray-900">Aucun produit ne correspond à vos critères</h3>
          <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
            Essayez de modifier votre recherche ou de sélectionner une autre catégorie.
          </p>
          <button
            onClick={() => {
              setSearchInput('');
              updateFilters({ search: null, collection: null, category: null });
            }}
            className="mt-6 px-6 py-2.5 text-xs font-bold text-white rounded-xl shadow-sm hover:opacity-90"
            style={{ backgroundColor: primaryColor }}
          >
            Réinitialiser les filtres
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
          {products.map((p) => (
            <StoreProductCard key={p.id} product={p} />
          ))}
        </div>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 pt-6 flex-wrap">
          <button
            onClick={() => updateFilters({ page: String(currentPage - 1) })}
            disabled={currentPage <= 1}
            className="w-10 h-10 rounded-xl bg-white border border-gray-200 text-gray-700 flex items-center justify-center hover:bg-gray-50 disabled:opacity-40 disabled:hover:bg-white transition-colors"
            aria-label="Page précédente"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {pageWindow.map((pageNumber, i) =>
            pageNumber === null ? (
              <span key={`gap-${i}`} className="w-6 text-center text-gray-400 font-bold">
                …
              </span>
            ) : (
              <button
                key={pageNumber}
                onClick={() => updateFilters({ page: String(pageNumber) })}
                className={`w-10 h-10 rounded-xl text-xs font-bold transition-all ${
                  currentPage === pageNumber
                    ? 'text-white shadow-md'
                    : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
                style={currentPage === pageNumber ? { backgroundColor: primaryColor } : {}}
                aria-current={currentPage === pageNumber ? 'page' : undefined}
              >
                {pageNumber}
              </button>
            )
          )}

          <button
            onClick={() => updateFilters({ page: String(currentPage + 1) })}
            disabled={currentPage >= totalPages}
            className="w-10 h-10 rounded-xl bg-white border border-gray-200 text-gray-700 flex items-center justify-center hover:bg-gray-50 disabled:opacity-40 disabled:hover:bg-white transition-colors"
            aria-label="Page suivante"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
