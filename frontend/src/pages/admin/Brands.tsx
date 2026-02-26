import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../lib/api';
import toast from 'react-hot-toast';

export default function AdminBrands() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin-brands'],
    queryFn: () => fetch('/api/v1/brands').then((r) => r.json()),
  });

  const { data: pendingData } = useQuery({
    queryKey: ['brands', { status: 'PENDING_APPROVAL' }],
    queryFn: () => fetch('/api/v1/brands?status=PENDING_APPROVAL').then((r) => r.json()),
  });

  const brands = data?.data?.brands || [];
  const pendingBrands = pendingData?.data?.brands || [];

  const approveMutation = useMutation({
    mutationFn: (id: string) => adminApi.approveBrand(id),
    onSuccess: () => {
      toast.success('Marque approuvée!');
      queryClient.invalidateQueries({ queryKey: ['brands'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Erreur');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => adminApi.rejectBrand(id),
    onSuccess: () => {
      toast.success('Marque rejetée');
      queryClient.invalidateQueries({ queryKey: ['brands'] });
    },
  });

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
          <h1 className="text-2xl font-bold text-gray-900">Marques</h1>
          <p className="text-gray-500 mt-1">{pendingBrands.length} en attente d'approbation</p>
        </div>
      </div>

      {/* Pending Brands */}
      {pendingBrands.length > 0 && (
        <div className="card border-yellow-200 bg-yellow-50">
          <div className="p-5 border-b border-yellow-200">
            <h3 className="font-semibold text-yellow-800">⏳ Marques en attente ({pendingBrands.length})</h3>
          </div>
          <div className="divide-y divide-yellow-200">
            {pendingBrands.map((brand: any) => (
              <div key={brand.id} className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div
                    className="w-12 h-12 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: brand.primaryColor || '#22c55e' }}
                  >
                    {brand.logoUrl ? (
                      <img src={brand.logoUrl} alt={brand.name} className="h-8 object-contain" />
                    ) : (
                      <span className="text-white font-bold">{brand.name.charAt(0)}</span>
                    )}
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">{brand.name}</div>
                    <div className="text-sm text-gray-500">{brand.vendor?.fullName || brand.vendor?.email}</div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => rejectMutation.mutate(brand.id)}
                    className="btn-danger btn-sm"
                    disabled={rejectMutation.isPending}
                  >
                    Rejeter
                  </button>
                  <button
                    onClick={() => approveMutation.mutate(brand.id)}
                    className="btn-primary btn-sm"
                    disabled={approveMutation.isPending}
                  >
                    Approuver
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All Brands */}
      {isLoading ? (
        <div className="text-center py-12">Chargement...</div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {brands.map((brand: any) => (
            <div key={brand.id} className="card overflow-hidden">
              <div
                className="h-20 flex items-center justify-center"
                style={{ backgroundColor: brand.primaryColor || '#22c55e' }}
              >
                {brand.logoUrl ? (
                  <img src={brand.logoUrl} alt={brand.name} className="h-12 object-contain" />
                ) : (
                  <span className="text-white text-2xl font-bold">{brand.name.charAt(0)}</span>
                )}
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-gray-900">{brand.name}</h3>
                  <span className={`badge-${statusColors[brand.status] || 'gray'}`}>
                    {brand.status}
                  </span>
                </div>
                <div className="text-sm text-gray-500">
                  Vendeur: {brand.vendor?.fullName || 'N/A'}
                </div>
                <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                  <span>📦 {brand.stats?.orders || 0} commandes</span>
                  <span>📞 {brand.stats?.leads || 0} prospects</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
