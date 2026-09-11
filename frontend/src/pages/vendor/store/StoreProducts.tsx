/**
 * The shop catalogue screen.
 *
 * These products belong to the seller's storefront and nowhere else. They are
 * not the marketplace catalogue at /dashboard/products, which is what referral
 * links and landing pages are built from — a product created here has no link,
 * no /r/<code> page and never appears in the marketplace. The two are separate
 * on purpose, and the banner at the top of the page says so.
 *
 * Until a seller creates their first product the list shows the platform
 * starter catalogue read-only, so a new shop is never an empty shop.
 */
import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { vendorStoreApi, uploadApi } from '../../../lib/api';
import toast from 'react-hot-toast';
import {
  ArrowLeft,
  Plus,
  Edit2,
  Trash2,
  Package,
  X,
  Search,
  Copy,
  Sparkles,
  ImagePlus,
  EyeOff,
  Loader2,
  FolderTree,
} from 'lucide-react';
import { swal } from '../../../components/ui/SweetAlert';

interface CategoryNode {
  id: number;
  nameFr: string;
  slug: string;
  parentId: number | null;
  children: CategoryNode[];
}

const EMPTY_FORM = {
  nameFr: '',
  nameAr: '',
  description: '',
  longDescription: '',
  sku: '',
  priceMad: '',
  compareAtPriceMad: '',
  costMad: '',
  stockQuantity: '0',
  categoryIds: [] as number[],
  imageUrls: [] as string[],
  showInStore: true,
  isActive: true,
};

export default function StoreProducts() {
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<CategoryNode[]>([]);
  const [isDefaultCatalogue, setIsDefaultCatalogue] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [adopting, setAdopting] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await vendorStoreApi.getCatalogue({ limit: 100, search: search || undefined });
      const data = res.data?.data || {};
      setProducts(data.products || []);
      setCategories(data.categories || []);
      setIsDefaultCatalogue(Boolean(data.isDefaultCatalogue));
    } catch (err) {
      console.error('Failed to load store catalogue:', err);
      toast.error('Impossible de charger le catalogue.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = setTimeout(loadData, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  /** Parents and their children in one list, indented, for the picker. */
  const flatCategories = useMemo(() => {
    const out: { id: number; label: string; depth: number }[] = [];
    const walk = (nodes: CategoryNode[], depth: number) => {
      for (const n of nodes) {
        out.push({ id: n.id, label: n.nameFr, depth });
        if (n.children?.length) walk(n.children, depth + 1);
      }
    };
    walk(categories, 0);
    return out;
  }, [categories]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setModalOpen(true);
  };

  const openEdit = (p: any) => {
    setEditing(p);
    setForm({
      nameFr: p.nameFr || '',
      nameAr: p.nameAr || '',
      description: p.description || '',
      longDescription: p.longDescription || '',
      sku: p.sku || '',
      priceMad: String(p.retailPriceMad ?? ''),
      compareAtPriceMad: p.compareAtPriceMad != null ? String(p.compareAtPriceMad) : '',
      costMad: p.costMad != null ? String(p.costMad) : '',
      stockQuantity: String(p.stockQuantity ?? 0),
      categoryIds: (p.categories || []).map((c: any) => c.id),
      imageUrls: (p.images || []).map((i: any) => i.url),
      showInStore: p.showInStore !== false,
      isActive: p.isActive !== false,
    });
    setModalOpen(true);
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const fd = new FormData();
    Array.from(files).slice(0, 10).forEach((f) => fd.append('images', f));

    try {
      setUploading(true);
      const res = await uploadApi.productImages(fd);
      const urls = (res.data?.data?.images || []).map((i: any) => i.url);
      setForm((prev) => ({ ...prev, imageUrls: [...prev.imageUrls, ...urls] }));
      toast.success(`${urls.length} image(s) ajoutée(s)`);
    } catch (err: any) {
      console.error('Upload error:', err);
      toast.error(err?.response?.data?.message || "Erreur lors de l'envoi des images.");
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.nameFr.trim()) {
      toast.error('Le nom du produit est requis.');
      return;
    }
    const price = Number(form.priceMad);
    if (isNaN(price) || price <= 0) {
      toast.error('Indiquez un prix de vente valide.');
      return;
    }

    const payload = {
      nameFr: form.nameFr.trim(),
      nameAr: form.nameAr.trim() || null,
      description: form.description.trim() || null,
      longDescription: form.longDescription.trim() || null,
      sku: form.sku.trim() || null,
      priceMad: price,
      compareAtPriceMad: form.compareAtPriceMad === '' ? null : Number(form.compareAtPriceMad),
      costMad: form.costMad === '' ? null : Number(form.costMad),
      stockQuantity: Number(form.stockQuantity) || 0,
      categoryIds: form.categoryIds,
      imageUrls: form.imageUrls,
      showInStore: form.showInStore,
      isActive: form.isActive,
    };

    try {
      setSaving(true);
      if (editing) {
        await vendorStoreApi.updateStoreProduct(editing.id, payload);
        toast.success('Produit mis à jour.');
      } else {
        await vendorStoreApi.createStoreProduct(payload);
        toast.success(
          isDefaultCatalogue
            ? 'Produit créé. Votre boutique affiche désormais uniquement vos produits.'
            : 'Produit créé.'
        );
      }
      setModalOpen(false);
      loadData();
    } catch (err: any) {
      console.error('Save product error:', err);
      toast.error(err?.response?.data?.message || 'Erreur lors de la sauvegarde.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (p: any) => {
    const ok = await swal.danger({
      title: `Supprimer "${p.nameFr}" ?`,
      text: 'Le produit sera retiré de votre boutique.',
      confirmText: 'Supprimer',
    });
    if (!ok) return;

    try {
      await vendorStoreApi.deleteStoreProduct(p.id);
      toast.success('Produit supprimé.');
      loadData();
    } catch (err: any) {
      console.error('Delete product error:', err);
      toast.error(err?.response?.data?.message || 'Erreur lors de la suppression.');
    }
  };

  const handleAdopt = async () => {
    const ok = await swal.confirm({
      title: 'Copier ce catalogue ?',
      text: "Les produits de démarrage seront copiés dans votre boutique. Vous pourrez ensuite modifier les prix, les photos et les stocks, et supprimer ceux que vous ne vendez pas.",
      confirmText: 'Copier',
    });
    if (!ok) return;

    try {
      setAdopting(true);
      const res = await vendorStoreApi.adoptDefaults();
      toast.success(res.data?.message || 'Catalogue copié.');
      loadData();
    } catch (err: any) {
      console.error('Adopt defaults error:', err);
      toast.error(err?.response?.data?.message || 'Erreur lors de la copie.');
    } finally {
      setAdopting(false);
    }
  };

  const toggleCategory = (id: number) => {
    setForm((prev) => ({
      ...prev,
      categoryIds: prev.categoryIds.includes(id)
        ? prev.categoryIds.filter((c) => c !== id)
        : [...prev.categoryIds, id],
    }));
  };

  if (loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <Link
          to="/dashboard/store"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Retour à l'aperçu boutique</span>
        </Link>

        <button
          onClick={openCreate}
          className="px-5 py-2.5 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>Nouveau Produit</span>
        </button>
      </div>

      {/* The starter catalogue notice. It is the whole rule of this screen, so
          it sits above the list rather than in a tooltip. */}
      {isDefaultCatalogue && (
        <div className="rounded-3xl border border-amber-200 bg-amber-50/70 p-6 space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-sm font-black text-amber-900">Catalogue de démarrage</h2>
              <p className="text-xs text-amber-800 leading-relaxed">
                Votre boutique affiche pour l'instant les produits de démonstration de la plateforme, pour qu'elle ne
                soit jamais vide. <strong>Dès que vous créez votre premier produit, ils disparaissent</strong> et votre
                boutique n'affiche plus que vos propres produits — vous en êtes alors entièrement responsable (prix,
                stock, livraison).
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pl-12">
            <button
              onClick={openCreate}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl"
            >
              Créer mon premier produit
            </button>
            <button
              onClick={handleAdopt}
              disabled={adopting}
              className="px-4 py-2 bg-white border border-amber-300 hover:bg-amber-100 text-amber-900 font-bold text-xs rounded-xl flex items-center gap-1.5 disabled:opacity-60"
            >
              {adopting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Copy className="w-3.5 h-3.5" />}
              <span>Copier ce catalogue dans ma boutique</span>
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-3xl border border-gray-100 p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <Package className="w-5 h-5 text-orange-500" />
            <div>
              <h1 className="text-lg font-black text-gray-900">Produits de la Boutique</h1>
              <p className="text-xs text-gray-500 mt-0.5">
                Indépendants de vos pages de vente et de vos liens d'affiliation.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/dashboard/store/categories"
              className="px-3 py-2 text-xs font-bold text-gray-600 hover:text-gray-900 border border-gray-200 rounded-xl flex items-center gap-1.5"
            >
              <FolderTree className="w-3.5 h-3.5" />
              <span>Catégories</span>
            </Link>
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher..."
                className="pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-orange-500 w-44"
              />
            </div>
          </div>
        </div>

        {products.length === 0 ? (
          <div className="py-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-orange-50 text-orange-500 flex items-center justify-center mx-auto">
              <Package className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-gray-900">Aucun produit</h3>
            <p className="text-xs text-gray-500 max-w-sm mx-auto">
              Ajoutez les articles que vous vendez sur votre boutique en ligne.
            </p>
            <button onClick={openCreate} className="mt-2 px-4 py-2 bg-gray-900 text-white font-bold text-xs rounded-xl">
              Créer un produit
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {products.map((p) => (
              <div
                key={p.id}
                className="rounded-2xl border border-gray-200/80 bg-gray-50/50 hover:bg-white hover:shadow-md transition-all overflow-hidden flex flex-col"
              >
                <div className="aspect-4/3 bg-gray-100 relative">
                  {p.images?.[0]?.url ? (
                    <img src={p.images[0].url} alt={p.nameFr} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300">
                      <Package className="w-8 h-8" />
                    </div>
                  )}

                  <div className="absolute top-2 left-2 flex flex-col gap-1">
                    {p.isDefault && (
                      <span className="px-2 py-0.5 rounded-lg bg-amber-500 text-white text-[10px] font-black">
                        DÉMARRAGE
                      </span>
                    )}
                    {!p.isDefault && p.showInStore === false && (
                      <span className="px-2 py-0.5 rounded-lg bg-gray-800 text-white text-[10px] font-black flex items-center gap-1">
                        <EyeOff className="w-2.5 h-2.5" /> MASQUÉ
                      </span>
                    )}
                    {!p.isDefault && p.isActive === false && (
                      <span className="px-2 py-0.5 rounded-lg bg-red-600 text-white text-[10px] font-black">
                        INACTIF
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-4 flex-1 flex flex-col">
                  <h3 className="font-bold text-gray-900 text-sm line-clamp-2">{p.nameFr}</h3>
                  {p.categories?.length > 0 && (
                    <p className="text-[11px] text-gray-500 mt-1 truncate">
                      {p.categories.map((c: any) => c.nameFr).join(' · ')}
                    </p>
                  )}

                  <div className="mt-3 flex items-end justify-between">
                    <div>
                      <span className="text-base font-black text-gray-900">{p.retailPriceMad} DH</span>
                      {p.compareAtPriceMad ? (
                        <span className="ml-1.5 text-xs text-gray-400 line-through">{p.compareAtPriceMad} DH</span>
                      ) : null}
                    </div>
                    <span
                      className={`text-[11px] font-bold ${
                        p.stockQuantity > 0 ? 'text-emerald-600' : 'text-red-500'
                      }`}
                    >
                      {p.stockQuantity} en stock
                    </span>
                  </div>

                  <div className="mt-4 pt-3 border-t border-gray-200/60 flex items-center justify-end gap-1">
                    {p.isDefault ? (
                      <span className="text-[11px] text-gray-400 mr-auto">Lecture seule</span>
                    ) : (
                      <>
                        <button
                          onClick={() => openEdit(p)}
                          className="p-1.5 text-gray-400 hover:text-gray-900 rounded-lg hover:bg-gray-100"
                          title="Modifier"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(p)}
                          className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-gray-100"
                          title="Supprimer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {modalOpen &&
        createPortal(
          <div className="fixed inset-0 z-999999 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fadeIn">
            <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                <h3 className="text-base font-black text-gray-900">
                  {editing ? 'Modifier le Produit' : 'Nouveau Produit'}
                </h3>
                <button onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSave} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Nom (Français) *</label>
                    <input
                      type="text"
                      required
                      value={form.nameFr}
                      onChange={(e) => setForm({ ...form, nameFr: e.target.value })}
                      placeholder="Ex: Montre Acier Classic"
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Nom (Arabe)</label>
                    <input
                      type="text"
                      value={form.nameAr}
                      onChange={(e) => setForm({ ...form, nameAr: e.target.value })}
                      dir="rtl"
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-500 font-arabic"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Prix (DH) *</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      required
                      value={form.priceMad}
                      onChange={(e) => setForm({ ...form, priceMad: e.target.value })}
                      className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Prix barré</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.compareAtPriceMad}
                      onChange={(e) => setForm({ ...form, compareAtPriceMad: e.target.value })}
                      className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Coût</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.costMad}
                      onChange={(e) => setForm({ ...form, costMad: e.target.value })}
                      className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Stock</label>
                    <input
                      type="number"
                      min="0"
                      value={form.stockQuantity}
                      onChange={(e) => setForm({ ...form, stockQuantity: e.target.value })}
                      className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Description courte</label>
                  <textarea
                    rows={2}
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
                  />
                </div>

                {/* images */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-gray-700">Photos</label>
                  <div className="flex flex-wrap gap-2">
                    {form.imageUrls.map((url, i) => (
                      <div key={url + i} className="relative w-20 h-20 rounded-xl overflow-hidden border border-gray-200">
                        <img src={url} alt="" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() =>
                            setForm((prev) => ({ ...prev, imageUrls: prev.imageUrls.filter((_, k) => k !== i) }))
                          }
                          className="absolute top-0.5 right-0.5 w-5 h-5 rounded-lg bg-black/60 text-white flex items-center justify-center"
                        >
                          <X className="w-3 h-3" />
                        </button>
                        {i === 0 && (
                          <span className="absolute bottom-0 inset-x-0 bg-orange-600 text-white text-[9px] font-black text-center">
                            PRINCIPALE
                          </span>
                        )}
                      </div>
                    ))}

                    <label className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center cursor-pointer hover:border-orange-400 hover:bg-orange-50/50 transition-colors">
                      {uploading ? (
                        <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
                      ) : (
                        <ImagePlus className="w-5 h-5 text-gray-400" />
                      )}
                      <span className="text-[10px] text-gray-500 font-bold mt-1">Ajouter</span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(e) => handleUpload(e.target.files)}
                      />
                    </label>
                  </div>
                </div>

                {/* categories */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-gray-700">
                    Catégories ({form.categoryIds.length} sélectionnée{form.categoryIds.length > 1 ? 's' : ''})
                  </label>
                  {flatCategories.length === 0 ? (
                    <p className="text-xs text-gray-500">
                      Aucune catégorie.{' '}
                      <Link to="/dashboard/store/categories" className="text-orange-600 font-bold underline">
                        Créez-en une
                      </Link>{' '}
                      pour organiser votre boutique.
                    </p>
                  ) : (
                    <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-xl p-2 bg-gray-50 space-y-0.5">
                      {flatCategories.map((c) => {
                        const selected = form.categoryIds.includes(c.id);
                        return (
                          <div
                            key={c.id}
                            onClick={() => toggleCategory(c.id)}
                            style={{ paddingLeft: `${8 + c.depth * 16}px` }}
                            className={`py-1.5 pr-2 rounded-lg text-xs cursor-pointer transition-colors ${
                              selected ? 'bg-orange-100/70 font-bold text-orange-900' : 'hover:bg-gray-100 text-gray-700'
                            }`}
                          >
                            {c.depth > 0 && <span className="text-gray-300 mr-1">└</span>}
                            {c.label}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-4 pt-2 border-t border-gray-100">
                  <label className="flex items-center gap-2 text-xs font-bold text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.showInStore}
                      onChange={(e) => setForm({ ...form, showInStore: e.target.checked })}
                      className="rounded accent-orange-600"
                    />
                    Visible dans la boutique
                  </label>
                  <label className="flex items-center gap-2 text-xs font-bold text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.isActive}
                      onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                      className="rounded accent-orange-600"
                    />
                    Produit actif
                  </label>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="px-4 py-2 text-xs font-bold text-gray-500 hover:text-gray-800"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-6 py-2 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-xl shadow-sm disabled:opacity-60 flex items-center gap-2"
                  >
                    {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Enregistrer
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
