import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { brandsApi } from '../../lib/api';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

export default function VendorBrands() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    slogan: '',
    description: '',
    primaryColor: '#22c55e',
    secondaryColor: '#16a34a',
  });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['brands'],
    queryFn: () => brandsApi.list(),
  });

  const brands = data?.data?.data?.brands || [];

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await brandsApi.create(formData);
      toast.success('Marque créée avec succès!');
      setShowCreateModal(false);
      setFormData({ name: '', slogan: '', description: '', primaryColor: '#22c55e', secondaryColor: '#16a34a' });
      refetch();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erreur');
    }
  };

  const statusColors: Record<string, string> = {
    DRAFT: 'gray',
    PENDING_APPROVAL: 'warning',
    APPROVED: 'success',
    SUSPENDED: 'danger',
    REJECTED: 'danger',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mes Marques</h1>
          <p className="text-gray-500 mt-1">Gérez vos marques et leur identité visuelle</p>
        </div>
        <button onClick={() => setShowCreateModal(true)} className="btn-primary">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nouvelle marque
        </button>
      </div>

      {/* Brands Grid */}
      {isLoading ? (
        <div className="text-center py-12">Chargement...</div>
      ) : brands.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">🏷️</span>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Aucune marque</h3>
          <p className="text-gray-500 mb-6">Créez votre première marque pour commencer</p>
          <button onClick={() => setShowCreateModal(true)} className="btn-primary">
            Créer ma marque
          </button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {brands.map((brand: any) => (
            <div key={brand.id} className="card-hover overflow-hidden">
              <div 
                className="h-32 flex items-center justify-center"
                style={{ backgroundColor: brand.primaryColor || '#22c55e' }}
              >
                {brand.logoUrl ? (
                  <img src={brand.logoUrl} alt={brand.name} className="h-20 object-contain" />
                ) : (
                  <span className="text-white text-3xl font-bold">{brand.name.charAt(0)}</span>
                )}
              </div>
              <div className="p-5">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-gray-900">{brand.name}</h3>
                  <span className={`badge-${statusColors[brand.status] || 'gray'}`}>
                    {brand.status}
                  </span>
                </div>
                {brand.slogan && (
                  <p className="text-sm text-gray-500 mb-3">"{brand.slogan}"</p>
                )}
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <span>📦 {brand.stats?.orders || 0} commandes</span>
                  <span>📞 {brand.stats?.leads || 0} prospects</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900">Créer une nouvelle marque</h2>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="label">Nom de la marque *</label>
                <input
                  type="text"
                  className="input"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="label">Slogan</label>
                <input
                  type="text"
                  className="input"
                  value={formData.slogan}
                  onChange={(e) => setFormData({ ...formData, slogan: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Description</label>
                <textarea
                  className="input"
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Couleur principale</label>
                  <input
                    type="color"
                    className="w-full h-10 rounded-lg cursor-pointer"
                    value={formData.primaryColor}
                    onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">Couleur secondaire</label>
                  <input
                    type="color"
                    className="w-full h-10 rounded-lg cursor-pointer"
                    value={formData.secondaryColor}
                    onChange={(e) => setFormData({ ...formData, secondaryColor: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowCreateModal(false)} className="btn-secondary flex-1">
                  Annuler
                </button>
                <button type="submit" className="btn-primary flex-1">
                  Créer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
