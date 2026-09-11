/**
 * Categories and sub-categories for the seller's own shop.
 *
 * This tree belongs to one shop and drives its storefront navigation. It is not
 * the platform-wide category list used by the marketplace catalogue behind
 * /dashboard/products — sellers never edit that one, and nothing here touches
 * it. A category created on this page groups shop products only.
 *
 * A shop that has not created a product yet is still on the starter catalogue,
 * so it shows the starter tree read-only: there is nothing of its own to
 * organise yet, and editing shared rows would change every other new shop.
 */
import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { vendorStoreApi } from '../../../lib/api';
import toast from 'react-hot-toast';
import {
  ArrowLeft,
  Plus,
  Edit2,
  Trash2,
  FolderTree,
  X,
  Sparkles,
  Package,
  CornerDownRight,
  Loader2,
} from 'lucide-react';
import { swal } from '../../../components/ui/SweetAlert';

interface CategoryNode {
  id: number;
  nameFr: string;
  nameAr: string | null;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  sortOrder: number;
  isActive: boolean;
  isDefault: boolean;
  parentId: number | null;
  productsCount: number;
  children: CategoryNode[];
}

const EMPTY_FORM = {
  nameFr: '',
  nameAr: '',
  slug: '',
  description: '',
  imageUrl: '',
  parentId: '' as string,
  sortOrder: '0',
  isActive: true,
};

export default function StoreCategories() {
  const [tree, setTree] = useState<CategoryNode[]>([]);
  const [isDefaultCatalogue, setIsDefaultCatalogue] = useState(false);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CategoryNode | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await vendorStoreApi.getStoreCategories();
      const data = res.data?.data || {};
      setTree(data.categories || []);
      setIsDefaultCatalogue(Boolean(data.isDefaultCatalogue));
    } catch (err) {
      console.error('Failed to load store categories:', err);
      toast.error('Impossible de charger les catégories.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  /** Only top-level rows may be a parent — the storefront menu draws two levels. */
  const parentOptions = useMemo(
    () => tree.filter((c) => !c.isDefault && (!editing || c.id !== editing.id)),
    [tree, editing]
  );

  const openCreate = (parentId?: number) => {
    setEditing(null);
    setForm({ ...EMPTY_FORM, parentId: parentId ? String(parentId) : '' });
    setModalOpen(true);
  };

  const openEdit = (c: CategoryNode) => {
    setEditing(c);
    setForm({
      nameFr: c.nameFr || '',
      nameAr: c.nameAr || '',
      slug: c.slug || '',
      description: c.description || '',
      imageUrl: c.imageUrl || '',
      parentId: c.parentId ? String(c.parentId) : '',
      sortOrder: String(c.sortOrder ?? 0),
      isActive: c.isActive !== false,
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.nameFr.trim()) {
      toast.error('Le nom de la catégorie est requis.');
      return;
    }

    const payload = {
      nameFr: form.nameFr.trim(),
      nameAr: form.nameAr.trim() || null,
      slug: form.slug.trim() || undefined,
      description: form.description.trim() || null,
      imageUrl: form.imageUrl.trim() || null,
      parentId: form.parentId ? Number(form.parentId) : null,
      sortOrder: Number(form.sortOrder) || 0,
      isActive: form.isActive,
    };

    try {
      setSaving(true);
      if (editing) {
        await vendorStoreApi.updateStoreCategory(editing.id, payload);
        toast.success('Catégorie mise à jour.');
      } else {
        await vendorStoreApi.createStoreCategory(payload);
        toast.success('Catégorie créée.');
      }
      setModalOpen(false);
      loadData();
    } catch (err: any) {
      console.error('Save category error:', err);
      toast.error(err?.response?.data?.message || 'Erreur lors de la sauvegarde.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (c: CategoryNode) => {
    if (c.children?.length) {
      toast.error('Supprimez ou déplacez les sous-catégories avant.');
      return;
    }

    const ok = await swal.danger({
      title: `Supprimer "${c.nameFr}" ?`,
      text: c.productsCount
        ? `${c.productsCount} produit(s) perdront cette catégorie, mais ne seront pas supprimés.`
        : 'Cette action est irréversible.',
      confirmText: 'Supprimer',
    });
    if (!ok) return;

    try {
      await vendorStoreApi.deleteStoreCategory(c.id);
      toast.success('Catégorie supprimée.');
      loadData();
    } catch (err: any) {
      console.error('Delete category error:', err);
      toast.error(err?.response?.data?.message || 'Erreur lors de la suppression.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const readOnly = isDefaultCatalogue;

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <Link
          to="/dashboard/store"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Retour à l'aperçu boutique</span>
        </Link>

        {!readOnly && (
          <button
            onClick={() => openCreate()}
            className="px-5 py-2.5 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Nouvelle Catégorie</span>
          </button>
        )}
      </div>

      {readOnly && (
        <div className="rounded-3xl border border-amber-200 bg-amber-50/70 p-6">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-sm font-black text-amber-900">Arborescence de démarrage</h2>
              <p className="text-xs text-amber-800 leading-relaxed">
                Ces catégories accompagnent le catalogue de démonstration et sont partagées par toutes les nouvelles
                boutiques, donc en lecture seule.{' '}
                <Link to="/dashboard/store/products" className="font-bold underline">
                  Créez votre premier produit
                </Link>{' '}
                pour construire votre propre arborescence.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-3xl border border-gray-100 p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex items-center gap-2.5 pb-4 border-b border-gray-100">
          <FolderTree className="w-5 h-5 text-blue-500" />
          <div>
            <h1 className="text-lg font-black text-gray-900">Catégories & Sous-catégories</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Le menu de navigation de votre boutique en ligne. Sans lien avec vos pages de vente.
            </p>
          </div>
        </div>

        {tree.length === 0 ? (
          <div className="py-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-500 flex items-center justify-center mx-auto">
              <FolderTree className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-gray-900">Aucune catégorie</h3>
            <p className="text-xs text-gray-500 max-w-sm mx-auto">
              Créez une catégorie principale (ex: "Vêtements"), puis des sous-catégories (ex: "T-shirts", "Vestes").
            </p>
            {!readOnly && (
              <button
                onClick={() => openCreate()}
                className="mt-2 px-4 py-2 bg-gray-900 text-white font-bold text-xs rounded-xl"
              >
                Créer une catégorie
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {tree.map((parent) => (
              <div key={parent.id} className="rounded-2xl border border-gray-200/80 overflow-hidden">
                <div className="p-4 bg-gray-50/70 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-gray-900 text-sm truncate">{parent.nameFr}</h3>
                      {!parent.isActive && (
                        <span className="px-1.5 py-0.5 rounded bg-gray-200 text-gray-600 text-[10px] font-black">
                          MASQUÉE
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-500 mt-0.5 flex items-center gap-2">
                      <span className="font-mono text-gray-400">/{parent.slug}</span>
                      <span className="inline-flex items-center gap-1">
                        <Package className="w-3 h-3" />
                        {parent.productsCount}
                      </span>
                    </p>
                  </div>

                  {!readOnly && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => openCreate(parent.id)}
                        className="px-2.5 py-1.5 text-[11px] font-bold text-orange-700 bg-orange-50 hover:bg-orange-100 rounded-lg flex items-center gap-1"
                        title="Ajouter une sous-catégorie"
                      >
                        <Plus className="w-3 h-3" />
                        Sous-catégorie
                      </button>
                      <button
                        onClick={() => openEdit(parent)}
                        className="p-1.5 text-gray-400 hover:text-gray-900 rounded-lg hover:bg-gray-100"
                        title="Modifier"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(parent)}
                        className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-gray-100"
                        title="Supprimer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                {parent.children?.length > 0 && (
                  <div className="divide-y divide-gray-100">
                    {parent.children.map((child) => (
                      <div key={child.id} className="px-4 py-2.5 flex items-center justify-between gap-3 bg-white">
                        <div className="flex items-center gap-2 min-w-0">
                          <CornerDownRight className="w-3.5 h-3.5 text-gray-300 shrink-0" />
                          <span className="text-xs font-bold text-gray-800 truncate">{child.nameFr}</span>
                          <span className="text-[11px] text-gray-400 font-mono shrink-0">/{child.slug}</span>
                          <span className="text-[11px] text-gray-500 inline-flex items-center gap-1 shrink-0">
                            <Package className="w-3 h-3" />
                            {child.productsCount}
                          </span>
                        </div>

                        {!readOnly && (
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => openEdit(child)}
                              className="p-1.5 text-gray-400 hover:text-gray-900 rounded-lg hover:bg-gray-100"
                              title="Modifier"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(child)}
                              className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-gray-100"
                              title="Supprimer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {modalOpen &&
        createPortal(
          <div className="fixed inset-0 z-999999 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fadeIn">
            <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                <h3 className="text-base font-black text-gray-900">
                  {editing ? 'Modifier la Catégorie' : 'Nouvelle Catégorie'}
                </h3>
                <button onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSave} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Catégorie parente</label>
                  <select
                    value={form.parentId}
                    onChange={(e) => setForm({ ...form, parentId: e.target.value })}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="">— Catégorie principale —</option>
                    {parentOptions.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nameFr}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-gray-500 mt-1">
                    Choisissez une parente pour en faire une sous-catégorie.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Nom (Français) *</label>
                  <input
                    type="text"
                    required
                    value={form.nameFr}
                    onChange={(e) => setForm({ ...form, nameFr: e.target.value })}
                    placeholder="Ex: Vêtements"
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Nom (Arabe)</label>
                  <input
                    type="text"
                    value={form.nameAr}
                    onChange={(e) => setForm({ ...form, nameAr: e.target.value })}
                    placeholder="Ex: ملابس"
                    dir="rtl"
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-500 font-arabic"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Slug URL</label>
                    <input
                      type="text"
                      value={form.slug}
                      onChange={(e) => setForm({ ...form, slug: e.target.value })}
                      placeholder="vetements"
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Ordre d'affichage</label>
                    <input
                      type="number"
                      value={form.sortOrder}
                      onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Image de couverture (URL)</label>
                  <input
                    type="text"
                    value={form.imageUrl}
                    onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                    placeholder="https://..."
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Description</label>
                  <textarea
                    rows={2}
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
                  />
                </div>

                <label className="flex items-center gap-2 text-xs font-bold text-gray-700 cursor-pointer pt-2 border-t border-gray-100">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                    className="rounded accent-orange-600"
                  />
                  Visible dans le menu de la boutique
                </label>

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
