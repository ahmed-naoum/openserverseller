import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useStore } from '../../contexts/StoreContext';
import { storePublicApi } from '../../lib/api';
import StoreProductCard from '../../components/store/StoreProductCard';
import { unsplash, DEMO_CATEGORIES } from '../../lib/storeMedia';
import { ShoppingBag, ArrowRight, SlidersHorizontal } from 'lucide-react';

const SORTS = [
  { key: 'newest', label: 'Plus récents' },
  { key: 'price_asc', label: 'Prix croissant' },
  { key: 'price_desc', label: 'Prix décroissant' },
  { key: 'name', label: 'Nom (A-Z)' },
];

export default function StoreCollectionPage() {
  const { slug } = useParams<{ slug: string }>();
  const { store } = useStore();

  const [products, setProducts] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [sort, setSort] = useState('newest');
  const [loading, setLoading] = useState(true);

  const collection = store?.collections?.find((c) => c.slug === slug);
  const primaryColor = store?.primaryColor || '#f97316';

  useEffect(() => {
    if (!store?.id || !slug) return;

    setLoading(true);
    storePublicApi
      .getProducts({ storeId: store.id, collection: slug, limit: 24, sort })
      .then((res) => {
        setProducts(res.data?.data?.products || []);
        setTotal(res.data?.data?.total || 0);
      })
      .catch((err) => console.error('Failed to load collection products:', err))
      .finally(() => setLoading(false));
  }, [store?.id, slug, sort]);

  if (!store) return null;

  const siblings = (store.collections || []).filter((c) => c.slug !== slug);
  /** The seller's own artwork leads; the stock set keeps the banner from
   *  collapsing to a flat block on a collection they never illustrated. */
  const banner =
    collection?.imageUrl ||
    unsplash(
      DEMO_CATEGORIES[Math.abs((slug || '').length) % DEMO_CATEGORIES.length].id,
      1600,
      500,
      75
    );

  return (
    <div className="pb-16">
      {/* Image-led collection header */}
      <section className="relative h-56 sm:h-72 lg:h-80 overflow-hidden bg-gray-900">
        <img src={banner} alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-black/20" />
        <div className="absolute inset-0 flex items-center">
          <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8">
            <nav className="flex items-center gap-2 text-[11px] font-semibold text-white/70 mb-3">
              <Link to="/" className="hover:text-white">
                Accueil
              </Link>
              <span>/</span>
              <Link to="/products" className="hover:text-white">
                Produits
              </Link>
              <span>/</span>
              <span className="text-white">{collection?.nameFr || slug}</span>
            </nav>

            <span
              className="inline-block px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-widest text-white"
              style={{ backgroundColor: primaryColor }}
            >
              Collection
            </span>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight mt-3">
              {collection?.nameFr || slug}
            </h1>
            {collection?.nameAr && (
              <p className="text-base text-left text-white/70 mt-1 font-arabic" dir="rtl">
                {collection.nameAr}
              </p>
            )}
            {collection?.description && (
              <p className="text-sm text-gray-200 mt-2 max-w-xl leading-relaxed">{collection.description}</p>
            )}
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-7">
        {/* Result count + sort */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-gray-500">
            <strong className="text-gray-900 font-black">{total}</strong>{' '}
            {total > 1 ? 'articles disponibles' : 'article disponible'}
          </p>
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-gray-400" />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2"
              style={{ ['--tw-ring-color' as any]: primaryColor }}
              aria-label="Trier les produits"
            >
              {SORTS.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
              <div key={n} className="bg-white rounded-2xl p-4 border border-gray-100 animate-pulse space-y-3">
                <div className="aspect-square bg-gray-100 rounded-xl" />
                <div className="h-3 bg-gray-100 rounded w-1/2" />
                <div className="h-4 bg-gray-100 rounded w-3/4" />
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="bg-white rounded-3xl border border-gray-100 p-14 text-center">
            <ShoppingBag className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-gray-900">Aucun produit dans cette collection</h3>
            <p className="text-xs text-gray-500 mt-1">Revenez bientôt pour découvrir les nouveaux articles.</p>
            <Link
              to="/products"
              className="mt-6 inline-block px-6 py-2.5 text-xs font-bold text-white rounded-xl shadow-sm hover:opacity-90"
              style={{ backgroundColor: primaryColor }}
            >
              Voir les autres produits
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {products.map((p) => (
              <StoreProductCard key={p.id} product={p} />
            ))}
          </div>
        )}

        {/* 24 is the page size; past that the full catalogue does the paging. */}
        {total > products.length && !loading && (
          <div className="text-center pt-2">
            <Link
              to={`/products?collection=${encodeURIComponent(slug || '')}`}
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full text-white font-bold text-sm shadow-md hover:opacity-95 transition-opacity"
              style={{ backgroundColor: primaryColor }}
            >
              Voir les {total} articles <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        )}

        {/* Cross-sell into the shop's other collections */}
        {siblings.length > 0 && (
          <section className="pt-10 border-t border-gray-100">
            <h2 className="text-xl font-black text-gray-900 mb-5">Continuer la visite</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
              {siblings.slice(0, 5).map((c, i) => (
                <Link
                  key={c.id}
                  to={`/collections/${c.slug}`}
                  className="group relative rounded-2xl overflow-hidden aspect-[4/3] bg-gray-100"
                >
                  <img
                    src={c.imageUrl || unsplash(DEMO_CATEGORIES[i % DEMO_CATEGORIES.length].id, 400, 300)}
                    alt=""
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                  <span className="absolute inset-0 bg-gradient-to-t from-black/75 to-transparent flex items-end p-3">
                    <span className="text-white text-xs font-black leading-tight">{c.nameFr}</span>
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
