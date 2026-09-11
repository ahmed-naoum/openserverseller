import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { vendorStoreApi } from '../../../lib/api';
import { buildStoreUrl } from '../../../utils/referral';
import toast from 'react-hot-toast';
import { ArrowLeft, Plus, Edit2, Trash2, Layers, X, ShoppingBag, Check, ExternalLink } from 'lucide-react';
import { swal } from '../../../components/ui/SweetAlert';

export default function StoreCollections() {
  const [collections, setCollections] = useState<any[]>([]);
  const [store, setStore] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCollection, setEditingCollection] = useState<any>(null);

  const [availableProducts, setAvailableProducts] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    nameFr: '',
    nameAr: '',
    slug: '',
    description: '',
    imageUrl: '',
    productIds: [] as number[],
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [colRes, prodRes, storeRes] = await Promise.all([
        vendorStoreApi.getCollections(),
        // The shop catalogue, not the marketplace one. This used to call
        // /products/my-products, which does not exist — the picker was always
        // empty, so no collection could ever be given a product.
        vendorStoreApi.getStoreProducts({ limit: 100 }).catch(() => ({ data: { data: { products: [] } } })),
        vendorStoreApi.getMyStore().catch(() => ({ data: { data: { store: null } } })),
      ]);
      setCollections(colRes.data?.data?.collections || []);
      setAvailableProducts(prodRes.data?.data?.products || []);
      setStore(storeRes.data?.data?.store || null);
    } catch (err) {
      console.error('Failed to load collections:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openCreateModal = () => {
    setEditingCollection(null);
    setFormData({
      nameFr: '',
      nameAr: '',
      slug: '',
      description: '',
      imageUrl: '',
      productIds: [],
    });
    setModalOpen(true);
  };

  const openEditModal = (col: any) => {
    setEditingCollection(col);
    setFormData({
      nameFr: col.nameFr || '',
      nameAr: col.nameAr || '',
      slug: col.slug || '',
      description: col.description || '',
      imageUrl: col.imageUrl || '',
      productIds: col.products?.map((p: any) => p.id) || [],
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.nameFr.trim()) {
      toast.error('Le nom français est requis.');
      return;
    }

    try {
      if (editingCollection) {
        await vendorStoreApi.updateCollection(editingCollection.id, formData);
        toast.success('Collection mise à jour !');
      } else {
        await vendorStoreApi.createCollection(formData);
        toast.success('Collection créée avec succès !');
      }
      setModalOpen(false);
      loadData();
    } catch (err: any) {
      console.error('Save collection error:', err);
      toast.error(err?.response?.data?.message || 'Erreur lors de la sauvegarde.');
    }
  };

  const handleDelete = async (id: number) => {
    if (!(await swal.danger({ title: 'Supprimer cette collection ?', text: 'Cette action est irréversible.', confirmText: 'Supprimer' }))) return;
    try {
      await vendorStoreApi.deleteCollection(id);
      toast.success('Collection supprimée.');
      loadData();
    } catch (err: any) {
      console.error('Delete collection error:', err);
      toast.error('Erreur lors de la suppression.');
    }
  };

  const toggleProductSelection = (productId: number) => {
    setFormData((prev) => {
      const exists = prev.productIds.includes(productId);
      return {
        ...prev,
        productIds: exists ? prev.productIds.filter((id) => id !== productId) : [...prev.productIds, productId],
      };
    });
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link
          to="/dashboard/store"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Retour à l'aperçu boutique</span>
        </Link>

        <button
          onClick={openCreateModal}
          className="px-5 py-2.5 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>Nouvelle Collection</span>
        </button>
      </div>

      <div className="bg-white rounded-3xl border border-gray-100 p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex items-center gap-2.5 pb-4 border-b border-gray-100">
          <Layers className="w-5 h-5 text-blue-500" />
          <div>
            <h1 className="text-lg font-black text-gray-900">Catégories & Collections de la Boutique</h1>
            <p className="text-xs text-gray-500 mt-0.5">Organisez vos produits pour faciliter la navigation de vos clients.</p>
          </div>
        </div>

        {/* Collections List */}
        {collections.length === 0 ? (
          <div className="py-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-500 flex items-center justify-center mx-auto">
              <Layers className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-gray-900">Aucune collection créée</h3>
            <p className="text-xs text-gray-500 max-w-sm mx-auto">
              Créez votre première collection (ex: "Promotions", "Vêtements Homme", "Montres") pour organiser vos articles.
            </p>
            <button
              onClick={openCreateModal}
              className="mt-2 px-4 py-2 bg-gray-900 text-white font-bold text-xs rounded-xl"
            >
              Créer une collection
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {collections.map((col) => (
              <div
                key={col.id}
                className="p-5 rounded-2xl border border-gray-200/80 bg-gray-50/50 hover:bg-white hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-bold text-gray-900 text-base">{col.nameFr}</h3>
                    <div className="flex items-center gap-1">
                      <a
                        href={buildStoreUrl(`/collections/${col.slug}`, store?.user?.subdomain || store?.slug, store?.user?.customDomain, store?.user?.customDomainStatus)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 text-gray-400 hover:text-orange-600 rounded-lg hover:bg-orange-50 transition-colors"
                        title="Voir la collection"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                      <button
                        onClick={() => openEditModal(col)}
                        className="p-1.5 text-gray-400 hover:text-gray-900 rounded-lg hover:bg-gray-100"
                        title="Modifier"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(col.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-gray-100"
                        title="Supprimer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {col.nameAr && <p className="text-xs text-gray-500 font-arabic" dir="rtl">{col.nameAr}</p>}
                  {col.description && <p className="text-xs text-gray-600 mt-2 line-clamp-2">{col.description}</p>}
                </div>

                <div className="mt-4 pt-3 border-t border-gray-200/60 flex items-center justify-between text-xs text-gray-500">
                  <span>{col.products?.length || 0} produits</span>
                  <span className="font-mono text-[11px] text-gray-400">/{col.slug}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal: Create/Edit Collection */}
      {modalOpen && createPortal(
        <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="text-base font-black text-gray-900">
                {editingCollection ? 'Modifier la Collection' : 'Nouvelle Collection'}
              </h3>
              <button onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Nom (Français) *</label>
                <input
                  type="text"
                  required
                  value={formData.nameFr}
                  onChange={(e) => setFormData({ ...formData, nameFr: e.target.value })}
                  placeholder="Ex: Montres de Luxe"
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Nom (Arabe)</label>
                <input
                  type="text"
                  value={formData.nameAr}
                  onChange={(e) => setFormData({ ...formData, nameAr: e.target.value })}
                  placeholder="Ex: ساعات فاخرة"
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-500 font-arabic"
                  dir="rtl"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Slug URL</label>
                <input
                  type="text"
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  placeholder="Ex: montres-luxe"
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">URL de l'image de couverture</label>
                <input
                  type="text"
                  value={formData.imageUrl}
                  onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                  placeholder="https://..."
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Description affichée en haut de la page collection..."
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
                />
              </div>

              {/* Product selector for collection */}
              {availableProducts.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-gray-100">
                  <label className="block text-xs font-bold text-gray-700">
                    Associer des produits ({formData.productIds.length} sélectionnés)
                  </label>
                  <div className="max-h-48 overflow-y-auto divide-y divide-gray-100 border border-gray-200 rounded-xl p-2 bg-gray-50">
                    {availableProducts.map((p) => {
                      const isSelected = formData.productIds.includes(p.id);
                      return (
                        <div
                          key={p.id}
                          onClick={() => toggleProductSelection(p.id)}
                          className={`p-2 rounded-lg flex items-center justify-between cursor-pointer transition-colors ${
                            isSelected ? 'bg-orange-100/60 font-bold' : 'hover:bg-gray-100 text-gray-700'
                          }`}
                        >
                          <span className="text-xs truncate">{p.nameFr}</span>
                          {isSelected ? (
                            <Check className="w-4 h-4 text-orange-600 flex-shrink-0" />
                          ) : (
                            <span className="w-4 h-4 border border-gray-300 rounded flex-shrink-0" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

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
                  className="px-6 py-2 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-xl shadow-sm"
                >
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
