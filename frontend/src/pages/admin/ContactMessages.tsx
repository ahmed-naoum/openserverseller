import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../lib/api';
import { format } from 'date-fns';
import {
  Mail, Search, Trash2, Eye, CheckCircle2, Inbox, 
  ChevronLeft, ChevronRight, X, User, Shield, Info, Calendar
} from 'lucide-react';
import toast from 'react-hot-toast';

const STATUS_COLORS: Record<string, string> = {
  UNREAD: 'bg-rose-100 text-rose-800 border-rose-200',
  READ: 'bg-blue-100 text-blue-800 border-blue-200',
  RESOLVED: 'bg-emerald-100 text-emerald-800 border-emerald-200',
};

const STATUS_LABELS: Record<string, string> = {
  UNREAD: 'Non lu',
  READ: 'Lu',
  RESOLVED: 'Résolu',
};

export default function ContactMessages() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [selectedMsg, setSelectedMsg] = useState<any>(null);

  const { data: messagesData, isLoading } = useQuery({
    queryKey: ['admin-contact-messages', page, search, status],
    queryFn: async () => {
      const res = await adminApi.getContactMessages({
        page,
        limit: 15,
        search: search || undefined,
        status: status === 'ALL' ? undefined : status,
      });
      return res.data.data;
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      adminApi.updateContactMessageStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-contact-messages'] });
      toast.success('Statut du message mis à jour avec succès.');
    },
    onError: () => {
      toast.error('Erreur lors de la mise à jour du statut.');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => adminApi.deleteContactMessage(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-contact-messages'] });
      toast.success('Message supprimé avec succès.');
      setSelectedMsg(null);
    },
    onError: () => {
      toast.error('Erreur lors de la suppression.');
    }
  });

  const messages = messagesData?.messages || [];
  const pagination = messagesData?.pagination || { page: 1, limit: 15, total: 0, totalPages: 1 };

  const handleUpdateStatus = (id: number, nextStatus: string) => {
    updateStatusMutation.mutate({ id, status: nextStatus });
    if (selectedMsg && selectedMsg.id === id) {
      setSelectedMsg({ ...selectedMsg, status: nextStatus });
    }
  };

  const handleDelete = (id: number) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer ce message ? Cette action est irréversible.')) {
      deleteMutation.mutate(id);
    }
  };

  const handleOpenDetails = (msg: any) => {
    setSelectedMsg(msg);
    if (msg.status === 'UNREAD') {
      handleUpdateStatus(msg.id, 'READ');
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header Banner */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 rounded-3xl p-8 text-white shadow-xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#ff5722]/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/3" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/10 text-[#ff5722] text-xs font-bold mb-4 backdrop-blur-sm">
              <Mail className="w-3.5 h-3.5" /> Messages de Contact
            </div>
            <h1 className="text-3xl font-black tracking-tight leading-none mb-2">Boîte de Réception</h1>
            <p className="text-base text-white/60 font-medium">Gérez et répondez aux messages soumis via le formulaire de contact public.</p>
          </div>
          
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-sm text-center">
            <p className="text-[10px] font-black text-white/40 uppercase tracking-wider">Total reçus</p>
            <p className="text-3xl font-black text-white">{pagination.total}</p>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
        {/* Search */}
        <div className="relative w-full md:max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher par nom, email, sujet..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-[#ff5722] transition-all font-medium text-sm"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>

        {/* Status Tab Chips */}
        <div className="flex gap-2 w-full md:w-auto justify-start md:justify-end overflow-x-auto">
          {['ALL', 'UNREAD', 'READ', 'RESOLVED'].map((s) => (
            <button
              key={s}
              onClick={() => {
                setStatus(s);
                setPage(1);
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                status === s
                  ? 'bg-slate-900 text-white border-slate-900 shadow-md'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {s === 'ALL' ? 'Tous' : STATUS_LABELS[s] || s}
            </button>
          ))}
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-10 h-10 border-4 border-[#ff5722] border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-sm font-medium text-slate-500">Chargement des messages...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-20">
            <Inbox className="w-16 h-16 mx-auto text-slate-200 mb-4" />
            <h3 className="text-lg font-bold text-slate-950">Aucun message de contact</h3>
            <p className="text-sm text-slate-400 max-w-sm mx-auto mt-1">Aucun message ne correspond à vos filtres ou boîte de réception vide.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-100">
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Expéditeur</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Sujet / Message</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Statut</th>
                    <th className="px-6 py-4 w-40"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {messages.map((msg: any) => (
                    <tr key={msg.id} className={`hover:bg-slate-50/30 transition-colors ${msg.status === 'UNREAD' ? 'bg-[#ff5722]/5 font-semibold' : ''}`}>
                      {/* Sender Details */}
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-slate-950 flex items-center gap-1">
                            <User size={14} className="text-slate-400" /> {msg.name}
                          </span>
                          <span className="text-[11px] text-slate-500 font-medium">{msg.email}</span>
                        </div>
                      </td>

                      {/* Subject & Preview */}
                      <td className="px-6 py-4">
                        <div className="flex flex-col max-w-md">
                          <span className="text-sm font-bold text-slate-800 truncate">{msg.subject}</span>
                          <span className="text-xs text-slate-400 font-medium truncate mt-0.5">{msg.message}</span>
                        </div>
                      </td>

                      {/* Date */}
                      <td className="px-6 py-4">
                        <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
                          <Calendar size={13} className="text-slate-400" />
                          {format(new Date(msg.createdAt), 'dd/MM/yyyy HH:mm')}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${STATUS_COLORS[msg.status] || 'bg-slate-100'}`}>
                          {STATUS_LABELS[msg.status] || msg.status}
                        </span>
                      </td>

                      {/* Quick Actions */}
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenDetails(msg)}
                            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-900 transition-colors"
                            title="Voir les détails"
                          >
                            <Eye size={16} />
                          </button>
                          {msg.status !== 'RESOLVED' && (
                            <button
                              onClick={() => handleUpdateStatus(msg.id, 'RESOLVED')}
                              className="p-1.5 hover:bg-emerald-50 rounded-lg text-slate-500 hover:text-emerald-600 transition-colors"
                              title="Marquer comme Résolu"
                            >
                              <CheckCircle2 size={16} />
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(msg.id)}
                            className="p-1.5 hover:bg-rose-50 rounded-lg text-slate-500 hover:text-rose-600 transition-colors"
                            title="Supprimer"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-4 bg-slate-50/50 border-t border-slate-100">
                <span className="text-xs text-slate-500 font-medium">
                  Affichage de la page {pagination.page} sur {pagination.totalPages}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    disabled={page === 1}
                    onClick={() => setPage(page - 1)}
                    className="p-2 border border-slate-200 rounded-xl hover:bg-white transition-all text-slate-600 disabled:opacity-40 disabled:hover:bg-transparent"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    disabled={page === pagination.totalPages}
                    onClick={() => setPage(page + 1)}
                    className="p-2 border border-slate-200 rounded-xl hover:bg-white transition-all text-slate-600 disabled:opacity-40 disabled:hover:bg-transparent"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Details Dialog / Modal */}
      {selectedMsg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-200">
            {/* Modal Header */}
            <div className="px-6 py-5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#ff5722]/10 text-[#ff5722] flex items-center justify-center">
                  <Mail size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-950 text-sm">Détails du message</h3>
                  <p className="text-[11px] text-slate-400 font-medium">Reçu le {format(new Date(selectedMsg.createdAt), 'dd/MM/yyyy à HH:mm')}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedMsg(null)}
                className="p-2 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-700 transition-all active:scale-95"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6">
              {/* Sender Info Block */}
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Expéditeur</span>
                  <p className="text-sm font-bold text-slate-950 mt-0.5">{selectedMsg.name}</p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Adresse E-mail</span>
                  <p className="text-sm font-bold text-[#ff5722] mt-0.5">
                    <a href={`mailto:${selectedMsg.email}`} className="hover:underline">{selectedMsg.email}</a>
                  </p>
                </div>
              </div>

              {/* Subject */}
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sujet / Objet</span>
                <p className="text-base font-bold text-slate-950">{selectedMsg.subject}</p>
              </div>

              {/* Message Content */}
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Message</span>
                <div className="bg-slate-50/50 rounded-2xl p-5 border border-slate-100/50 text-sm text-slate-700 leading-relaxed max-h-60 overflow-y-auto whitespace-pre-wrap">
                  {selectedMsg.message}
                </div>
              </div>

              {/* Meta Info (IP, User Agent) */}
              <div className="bg-slate-50/40 rounded-2xl p-4 border border-slate-100 flex items-start gap-3">
                <Info size={16} className="text-slate-400 mt-0.5 shrink-0" />
                <div className="text-[11px] text-slate-500 font-medium leading-relaxed space-y-1">
                  <div><b>Adresse IP :</b> <span className="text-slate-800">{selectedMsg.ip || 'Non disponible'}</span></div>
                  <div className="line-clamp-2"><b>Navigateur (User Agent) :</b> <span className="text-slate-800">{selectedMsg.userAgent || 'Non disponible'}</span></div>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-4">
              <button
                onClick={() => handleDelete(selectedMsg.id)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl text-xs font-bold transition-all"
              >
                <Trash2 size={14} /> Supprimer
              </button>
              
              <div className="flex gap-2">
                {selectedMsg.status !== 'RESOLVED' && (
                  <button
                    onClick={() => handleUpdateStatus(selectedMsg.id, 'RESOLVED')}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-100"
                  >
                    <CheckCircle2 size={14} /> Marquer Résolu
                  </button>
                )}
                <button
                  onClick={() => setSelectedMsg(null)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-all"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
