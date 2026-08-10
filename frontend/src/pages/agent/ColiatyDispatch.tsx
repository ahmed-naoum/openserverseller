import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { leadsApi, ordersApi } from '../../lib/api';
import toast from 'react-hot-toast';
import { Truck, Search, Loader2, CheckCircle2, Store, RotateCcw } from 'lucide-react';
import { format } from 'date-fns';

export default function ColiatyDispatch() {
  const queryClient = useQueryClient();
  const [selectedLeadIds, setSelectedLeadIds] = useState<number[]>([]);
  const [search, setSearch] = useState('');

  // Fetch pending dispatch leads (ORDERED status) - Force refetch on mount with staleTime: 0
  const { data: leadsData, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['agent-pending-dispatch', search],
    queryFn: () => leadsApi.list({ status: 'ORDERED', search, limit: 100 }), // Using list with ORDERED status
    refetchOnMount: 'always',
    staleTime: 0,
  });

  const leads = leadsData?.data?.data?.leads || [];

  const dispatchMutation = useMutation({
    mutationFn: async (leadIds: number[]) => {
      return ordersApi.bulkDispatch({ leadIds });
    },
    onSuccess: (res) => {
      toast.success(res.data.message || 'Expédition réussie');
      setSelectedLeadIds([]);
      queryClient.invalidateQueries({ queryKey: ['agent-pending-dispatch'] });
      
      const results = res.data.data.results;
      const successes = results.filter((r: any) => r.status === 'success').length;
      const errors = results.filter((r: any) => r.status === 'error').length;
      
      if (errors > 0) {
        toast.error(`${errors} expédition(s) ont échoué. Vérifiez les détails.`);
      } else {
        toast.success(`${successes} expédition(s) réussie(s).`);
      }
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Erreur lors de l\'expédition en lot');
    }
  });

  const toggleSelectAll = () => {
    if (selectedLeadIds.length === leads.length) {
      setSelectedLeadIds([]);
    } else {
      setSelectedLeadIds(leads.map((l: any) => l.id));
    }
  };

  const toggleSelect = (id: number) => {
    setSelectedLeadIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleDispatch = () => {
    if (selectedLeadIds.length === 0) return;
    dispatchMutation.mutate(selectedLeadIds);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto px-4">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 rounded-3xl p-6 md:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute inset-0 bg-white/5 backdrop-blur-[1px]"></div>
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-2xl"></div>
        <div className="relative z-10">
          <div className="inline-flex items-center gap-1 px-3 py-1 bg-white/20 rounded-full text-xs font-black uppercase tracking-wider mb-2">
            ⚡ Agent de saisie
          </div>
          <h1 className="text-xl md:text-2xl font-black tracking-tight flex items-center gap-2">
            <Truck className="w-6 h-6" />
            Liste d'attente Coliaty
          </h1>
          <p className="text-indigo-100 font-medium text-sm mt-2 max-w-2xl">
            Sélectionnez les leads que vous souhaitez expédier chez Coliaty en lot. Des frais de saisie seront facturés aux vendeurs respectifs.
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-xl overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2 flex-1 max-w-md w-full min-w-0">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher par nom, téléphone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border-none rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-100 transition-all animate-in fade-in"
              />
            </div>
            <button
              onClick={() => {
                refetch();
                toast.success('Données actualisées');
              }}
              disabled={isLoading || isFetching}
              className="p-2.5 bg-gray-50 text-gray-500 rounded-xl hover:bg-gray-100 hover:text-indigo-600 transition-all border-none focus:outline-none flex items-center justify-center shrink-0 active:scale-95 disabled:opacity-50"
              title="Actualiser la liste"
            >
              <RotateCcw className={`w-5 h-5 ${isLoading || isFetching ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-bold text-gray-500">
              {selectedLeadIds.length} sélectionné(s)
            </span>
            <button
              onClick={handleDispatch}
              disabled={selectedLeadIds.length === 0 || dispatchMutation.isPending}
              className={`px-6 py-2.5 rounded-xl font-black text-sm transition-all shadow-md flex items-center gap-2 ${
                selectedLeadIds.length === 0 || dispatchMutation.isPending
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed shadow-none'
                  : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-indigo-200 active:scale-95'
              }`}
            >
              {dispatchMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Truck className="w-4 h-4" />
              )}
              EXPÉDIER ({selectedLeadIds.length})
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50/50">
              <tr>
                <th className="p-4 w-12">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-gray-300"
                    checked={leads.length > 0 && selectedLeadIds.length === leads.length}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th className="p-4 font-black text-gray-500 uppercase text-[10px] tracking-widest">Client</th>
                <th className="p-4 font-black text-gray-500 uppercase text-[10px] tracking-widest">Contact</th>
                <th className="p-4 font-black text-gray-500 uppercase text-[10px] tracking-widest">Produit & Vendeur</th>
                <th className="p-4 font-black text-gray-500 uppercase text-[10px] tracking-widest text-right">Prix</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center">
                    <Loader2 className="w-6 h-6 text-indigo-500 animate-spin mx-auto" />
                  </td>
                </tr>
              ) : leads.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-500 font-medium">
                    Aucun lead en attente d'expédition.
                  </td>
                </tr>
              ) : (
                leads.map((lead: any) => (
                  <tr key={lead.id} className={`hover:bg-gray-50/50 transition-colors ${selectedLeadIds.includes(lead.id) ? 'bg-indigo-50/30' : ''}`}>
                    <td className="p-4">
                      <input
                        type="checkbox"
                        className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-gray-300"
                        checked={selectedLeadIds.includes(lead.id)}
                        onChange={() => toggleSelect(lead.id)}
                      />
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-gray-900">{lead.fullName}</span>
                        {lead.source === 'WHATSAPP' && (
                          <span className="inline-flex items-center justify-center p-0.5 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100" title="Lead WhatsApp">
                            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                            </svg>
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">{lead.city}</div>
                    </td>
                    <td className="p-4">
                      <div className="font-medium text-gray-900">{lead.phone}</div>
                      <div className="text-xs text-gray-500 mt-0.5">Ajouté le {format(new Date(lead.createdAt), 'dd/MM')}</div>
                    </td>
                    <td className="p-4">
                      <div className="font-bold text-gray-900 line-clamp-1">{lead.product?.name || 'Produit inconnu'}</div>
                      <div className="text-[10px] font-bold text-gray-400 uppercase flex items-center gap-1 mt-1">
                        <Store className="w-3 h-3" />
                        {lead.vendor?.fullName}
                      </div>
                    </td>
                    <td className="p-4 text-right">
                      <div className="font-black text-indigo-600">{lead.productPrice} MAD</div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
