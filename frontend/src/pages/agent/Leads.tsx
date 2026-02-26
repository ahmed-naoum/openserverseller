import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { leadsApi } from '../../lib/api';
import toast from 'react-hot-toast';

export default function AgentLeads() {
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [statusUpdate, setStatusUpdate] = useState('');
  const [notes, setNotes] = useState('');
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['leads', { status: statusFilter }],
    queryFn: () => leadsApi.list({ status: statusFilter || undefined }),
  });

  const leads = data?.data?.data?.leads || [];

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => leadsApi.updateStatus(id, data),
    onSuccess: () => {
      toast.success('Statut mis à jour!');
      setSelectedLead(null);
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Erreur');
    },
  });

  const statusColors: Record<string, string> = {
    NEW: 'primary',
    ASSIGNED: 'purple',
    CONTACTED: 'warning',
    INTERESTED: 'success',
    NOT_INTERESTED: 'danger',
    CALLBACK_REQUESTED: 'orange',
    ORDERED: 'success',
    UNREACHABLE: 'gray',
    INVALID: 'danger',
  };

  const handleUpdateStatus = () => {
    if (!selectedLead || !statusUpdate) return;
    updateMutation.mutate({
      id: selectedLead.id,
      data: { status: statusUpdate, notes },
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mes Prospects</h1>
          <p className="text-gray-500 mt-1">{leads.length} prospects assignés</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {['', 'NEW', 'ASSIGNED', 'CONTACTED', 'INTERESTED', 'ORDERED'].map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-4 py-2 rounded-lg whitespace-nowrap text-sm font-medium transition-colors ${
              statusFilter === status ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {status || 'Tous'}
          </button>
        ))}
      </div>

      {/* Leads Grid */}
      {isLoading ? (
        <div className="text-center py-12">Chargement...</div>
      ) : leads.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">📞</span>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Aucun prospect assigné</h3>
          <p className="text-gray-500">Les prospects apparaîtront ici</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {leads.map((lead: any) => (
            <div key={lead.id} className="card-hover p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                    <span className="text-primary-700 font-semibold">{lead.fullName.charAt(0)}</span>
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">{lead.fullName}</div>
                    <div className="text-sm text-gray-500">{lead.city || 'Ville inconnue'}</div>
                  </div>
                </div>
                <span className={`badge-${statusColors[lead.status]}`}>{lead.status}</span>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span>📞</span>
                  <a href={`tel:${lead.phone}`} className="hover:text-primary-600">{lead.phone}</a>
                </div>
                {lead.whatsapp && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <span>💬</span>
                    <a href={`https://wa.me/${lead.phone.replace('+', '')}`} target="_blank" rel="noopener noreferrer" className="hover:text-green-600">
                      WhatsApp
                    </a>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <a
                  href={`tel:${lead.phone}`}
                  className="btn-primary btn-sm flex-1"
                >
                  📞 Appeler
                </a>
                <button
                  onClick={() => {
                    setSelectedLead(lead);
                    setStatusUpdate(lead.status);
                    setNotes(lead.notes || '');
                  }}
                  className="btn-secondary btn-sm"
                >
                  Modifier
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Status Update Modal */}
      {selectedLead && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900">Mettre à jour le prospect</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="label">Statut</label>
                <select
                  className="input"
                  value={statusUpdate}
                  onChange={(e) => setStatusUpdate(e.target.value)}
                >
                  <option value="NEW">Nouveau</option>
                  <option value="CONTACTED">Contacté</option>
                  <option value="INTERESTED">Intéressé</option>
                  <option value="NOT_INTERESTED">Pas intéressé</option>
                  <option value="CALLBACK_REQUESTED">Rappel demandé</option>
                  <option value="ORDERED">Commandé</option>
                  <option value="UNREACHABLE">Injoignable</option>
                  <option value="INVALID">Invalide</option>
                </select>
              </div>
              <div>
                <label className="label">Notes</label>
                <textarea
                  className="input"
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ajoutez des notes sur l'appel..."
                />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setSelectedLead(null)} className="btn-secondary flex-1">
                  Annuler
                </button>
                <button
                  onClick={handleUpdateStatus}
                  className="btn-primary flex-1"
                  disabled={updateMutation.isPending}
                >
                  {updateMutation.isPending ? 'Mise à jour...' : 'Enregistrer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
