import { useState, useEffect } from 'react';
import { adminApi } from '../../lib/api';
import { 
  CheckCircle2, 
  XCircle, 
  Search, 
  ExternalLink,
  Package,
  User as UserIcon,
  Calendar,
  Clock,
  Filter
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function AdminAffiliateClaims() {
  const [claims, setClaims] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('PENDING');
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchClaims();
  }, [statusFilter]);

  const fetchClaims = async () => {
    try {
      setIsLoading(true);
      const res = await adminApi.getAffiliateClaims({ status: statusFilter });
      setClaims(res.data.data);
    } catch (error) {
      toast.error('Erreur lors du chargement des demandes');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateStatus = async (id: number, status: string) => {
    try {
      await adminApi.updateAffiliateClaim(id, status);
      toast.success(`Demande ${status === 'APPROVED' ? 'approuvée' : 'refusée'} avec succès`);
      fetchClaims();
    } catch (error) {
      toast.error('Erreur lors de la mise à jour de la demande');
    }
  };

  const filteredClaims = claims.filter(claim => 
    claim.user?.profile?.fullName?.toLowerCase().includes(search.toLowerCase()) ||
    claim.product?.nameFr?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Demandes d'Affiliation</h1>
          <p className="text-sm text-gray-500 mt-1">Approuvez ou refusez les demandes des influenceurs pour promouvoir des produits.</p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher par influenceur ou produit..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          />
        </div>
        <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-gray-200">
          {['ALL', 'PENDING', 'APPROVED', 'REJECTED'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                statusFilter === status 
                  ? 'bg-gray-900 text-white shadow-md' 
                  : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              {status === 'ALL' ? 'Tous' : status === 'PENDING' ? 'En attente' : status === 'APPROVED' ? 'Approuvés' : 'Refusés'}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Influenceur</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Produit</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Date</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Statut</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              <AnimatePresence mode="popLayout">
                {isLoading ? (
                  [...Array(5)].map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={5} className="px-6 py-4"><div className="h-12 bg-gray-50 rounded-xl" /></td>
                    </tr>
                  ))
                ) : filteredClaims.length > 0 ? (
                  filteredClaims.map((claim) => (
                    <motion.tr
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      key={claim.id}
                      className="hover:bg-gray-50/50 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-bold overflow-hidden border border-blue-100">
                            {claim.user?.profile?.avatarUrl ? (
                              <img src={claim.user.profile.avatarUrl} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <UserIcon className="w-5 h-5" />
                            )}
                          </div>
                          <div>
                            <div className="text-sm font-bold text-gray-900">{claim.user?.profile?.fullName || 'Utilisateur'}</div>
                            <div className="text-xs text-gray-500">{claim.user?.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 overflow-hidden border border-gray-200">
                            {claim.product?.images?.[0]?.imageUrl ? (
                              <img src={claim.product.images[0].imageUrl} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <Package className="w-5 h-5" />
                            )}
                          </div>
                          <div>
                            <div className="text-sm font-bold text-gray-900 line-clamp-1">{claim.product?.nameFr}</div>
                            <div className="text-xs text-gray-500">{claim.product?.retailPriceMad} MAD</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-1.5 text-xs font-medium text-gray-600">
                            <Calendar className="w-3.5 h-3.5" />
                            {format(new Date(claim.claimedAt), 'dd MMM yyyy', { locale: fr })}
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] text-gray-400 mt-1">
                            <Clock className="w-3 h-3" />
                            {format(new Date(claim.claimedAt), 'HH:mm')}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          claim.status === 'APPROVED' ? 'bg-green-100 text-green-700' :
                          claim.status === 'REJECTED' ? 'bg-red-100 text-red-700' :
                          claim.status === 'REVOKED' ? 'bg-gray-100 text-gray-700' :
                          'bg-amber-100 text-amber-700'
                        }`}>
                          {claim.status === 'PENDING' ? 'En attente' : 
                           claim.status === 'APPROVED' ? 'Approuvé' : 
                           claim.status === 'REJECTED' ? 'Refusé' : claim.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {claim.status === 'PENDING' ? (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleUpdateStatus(claim.id, 'REJECTED')}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors group relative"
                              title="Refuser"
                            >
                              <XCircle className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => handleUpdateStatus(claim.id, 'APPROVED')}
                              className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors group relative"
                              title="Approuver"
                            >
                              <CheckCircle2 className="w-5 h-5" />
                            </button>
                          </div>
                        ) : claim.status === 'APPROVED' ? (
                           <button
                             onClick={() => handleUpdateStatus(claim.id, 'REVOKED')}
                             className="text-[10px] font-bold text-gray-400 hover:text-red-500 transition-colors uppercase"
                           >
                             Révoquer
                           </button>
                        ) : (
                          <button
                            onClick={() => handleUpdateStatus(claim.id, 'PENDING')}
                            className="text-[10px] font-bold text-gray-400 hover:text-blue-500 transition-colors uppercase"
                          >
                            Réinitialiser
                          </button>
                        )}
                      </td>
                    </motion.tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                      <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <Filter className="w-6 h-6 text-gray-300" />
                      </div>
                      <p className="font-bold">Aucune demande trouvée</p>
                      <p className="text-xs">Les demandes des influenceurs s'afficheront ici.</p>
                    </td>
                  </tr>
                )}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
