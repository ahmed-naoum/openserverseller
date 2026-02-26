import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { productsApi, publicApi } from '../../lib/api';
import toast from 'react-hot-toast';

interface AddProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  isAdmin?: boolean;
}

export default function AddProductModal({ isOpen, onClose, onSuccess, isAdmin = false }: AddProductModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    sku: '',
    nameFr: '',
    nameAr: '',
    description: '',
    categoryId: '',
    baseCostMad: '',
    retailPriceMad: '',
    visibility: isAdmin ? 'REGULAR' : 'REGULAR', // Default visibility
  });

  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: () => publicApi.categories(),
  });

  const categories = categoriesData?.data?.data?.categories || [];

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      await productsApi.create({
        ...formData,
        categoryId: Number(formData.categoryId),
        baseCostMad: Number(formData.baseCostMad),
        retailPriceMad: Number(formData.retailPriceMad),
      });
      toast.success('Produit créé avec succès. Il est en attente d\'approbation.');
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erreur lors de la création du produit');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900">Ajouter un produit</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nom (Français)</label>
              <input
                type="text"
                required
                className="input-field"
                value={formData.nameFr}
                onChange={(e) => setFormData({ ...formData, nameFr: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nom (Arabe)</label>
              <input
                type="text"
                required
                className="input-field"
                value={formData.nameAr}
                onChange={(e) => setFormData({ ...formData, nameAr: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">SKU</label>
              <input
                type="text"
                required
                className="input-field"
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Catégorie</label>
              <select
                required
                className="input-field"
                value={formData.categoryId}
                onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
              >
                <option value="">Sélectionner une catégorie</option>
                {categories.map((cat: any) => (
                  <option key={cat.id} value={cat.id}>{cat.nameFr}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              required
              rows={3}
              className="input-field"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            ></textarea>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Coût de base (MAD)</label>
              <input
                type="number"
                required
                min="0"
                step="0.01"
                className="input-field"
                value={formData.baseCostMad}
                onChange={(e) => setFormData({ ...formData, baseCostMad: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Prix de détail suggéré (MAD)</label>
              <input
                type="number"
                required
                min="0"
                step="0.01"
                className="input-field"
                value={formData.retailPriceMad}
                onChange={(e) => setFormData({ ...formData, retailPriceMad: e.target.value })}
              />
            </div>
          </div>

          {isAdmin && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Visibilité sur la Marketplace</label>
              <select
                className="input-field"
                value={formData.visibility}
                onChange={(e) => setFormData({ ...formData, visibility: e.target.value })}
              >
                <option value="REGULAR">Normale (Grossellers, Vendeurs directs)</option>
                <option value="AFFILIATE">Affiliés Uniquement</option>
                <option value="NONE">Caché</option>
              </select>
            </div>
          )}

          <div className="pt-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
            >
              {loading ? 'Création...' : 'Soumettre le produit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
