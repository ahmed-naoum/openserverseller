import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../../lib/api';
import { Search, User, MapPin, Phone, ShoppingBag, Calendar, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function AdminCustomers() {
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data: customersData, isLoading } = useQuery({
    queryKey: ['admin-customers', { page, search: searchTerm }],
    queryFn: () => adminApi.getCustomers({ page, limit, search: searchTerm }),
  });

  const customers = customersData?.data?.data?.customers || [];
  const pagination = customersData?.data?.data?.pagination || { totalPages: 1 };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
          <p className="text-gray-500 mt-1">Gérez et consultez les informations de vos clients.</p>
        </div>
      </div>

      <div className="card p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="relative w-full md:w-96">
            <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Rechercher par nom, téléphone ou ville..."
              className="input pl-10 focus:ring-primary-500 w-full"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-gray-500">Chargement des clients...</div>
        ) : customers.length > 0 ? (
          <div className="overflow-x-auto border rounded-xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Client</th>
                  <th className="py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Coordonnées</th>
                  <th className="py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider text-center">Commandes</th>
                  <th className="py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider text-right">Total Dépensé</th>
                  <th className="py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider text-right">Dernière Commande</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {customers.map((customer: any) => (
                  <tr key={customer.phone} className="hover:bg-gray-50 transition-colors group">
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary-50 flex items-center justify-center text-primary-600 flex-shrink-0">
                          <User className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{customer.fullName || 'Client sans nom'}</p>
                          <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                            <MapPin className="w-3 h-3" />
                            <span>{customer.city || 'Ville inconnue'}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2 text-sm text-gray-700">
                          <Phone className="w-4 h-4 text-gray-400" />
                          <span className="font-mono">{customer.phone}</span>
                        </div>
                        <p className="text-xs text-gray-400 line-clamp-1 truncate max-w-[200px]" title={customer.address}>
                          {customer.address}
                        </p>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold">
                        <ShoppingBag className="w-3.5 h-3.5" />
                        {customer.totalOrders}
                      </div>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <p className="font-bold text-gray-900">{Number(customer.totalSpent).toLocaleString()} MAD</p>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <div className="flex flex-col items-end gap-1">
                        <div className="flex items-center gap-1.5 text-xs text-gray-500">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>
                            {format(new Date(customer.lastOrderDate), 'dd MMM yyyy', { locale: fr })}
                          </span>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
              <User className="w-8 h-8" />
            </div>
            <p className="text-gray-900 font-medium">Aucun client trouvé</p>
            <p className="text-gray-500 text-sm mt-1">Essayez d'ajuster votre recherche.</p>
          </div>
        )}

        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between mt-6">
            <p className="text-sm text-gray-500">
              Page {page} sur {pagination.totalPages}
            </p>
            <div className="flex gap-2">
              <button
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
                className="btn-secondary py-1 px-3 disabled:opacity-50"
              >
                Précédent
              </button>
              <button
                disabled={page === pagination.totalPages}
                onClick={() => setPage(p => p + 1)}
                className="btn-secondary py-1 px-3 disabled:opacity-50"
              >
                Suivant
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
