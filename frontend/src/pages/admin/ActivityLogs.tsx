import React, { useState, useEffect } from 'react';
import { 
  History, 
  Search, 
  User as UserIcon, 
  Activity, 
  Calendar,
  ChevronLeft,
  ChevronRight,
  Eye,
  X,
  ArrowUpDown
} from 'lucide-react';
import { adminApi } from '../../lib/api';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const ActivityLogs = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [selectedLog, setSelectedLog] = useState<any>(null);

  useEffect(() => {
    fetchLogs();
  }, [page, search]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const res = await adminApi.getActivityLogs({ page, limit: 50, action: search });
      setLogs(res.data.data.logs);
      setTotalPages(res.data.data.pagination.totalPages);
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const getActionColor = (action: string) => {
    if (action.includes('POST')) return 'bg-emerald-50 text-emerald-700 border-emerald-100';
    if (action.includes('PUT') || action.includes('PATCH')) return 'bg-amber-50 text-amber-700 border-amber-100';
    if (action.includes('DELETE')) return 'bg-rose-50 text-rose-700 border-rose-100';
    return 'bg-slate-50 text-slate-700 border-slate-100';
  };

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <div className="p-2.5 bg-slate-900 text-white rounded-2xl shadow-lg shadow-slate-200">
              <History size={24} />
            </div>
            Journaux d'Activité
          </h1>
          <p className="text-slate-500 mt-2 font-medium">Surveillez chaque action effectuée sur la plateforme</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-slate-900 transition-colors" size={18} />
            <input
              type="text"
              placeholder="Rechercher une action..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl w-full md:w-80 focus:outline-none focus:ring-4 focus:ring-slate-900/5 focus:border-slate-900 transition-all font-medium text-sm shadow-sm"
            />
          </div>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-[32px] border border-slate-100 shadow-xl shadow-slate-200/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-6 py-5 text-[11px] font-black text-slate-400 uppercase tracking-wider">Utilisateur</th>
                <th className="px-6 py-5 text-[11px] font-black text-slate-400 uppercase tracking-wider">Action</th>
                <th className="px-6 py-5 text-[11px] font-black text-slate-400 uppercase tracking-wider">Modèle</th>
                <th className="px-6 py-5 text-[11px] font-black text-slate-400 uppercase tracking-wider">ID</th>
                <th className="px-6 py-5 text-[11px] font-black text-slate-400 uppercase tracking-wider text-right">Date & Heure</th>
                <th className="px-6 py-5 text-[11px] font-black text-slate-400 uppercase tracking-wider text-center">Détails</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={6} className="px-6 py-6"><div className="h-4 bg-slate-100 rounded-full w-full" /></td>
                  </tr>
                ))
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="p-4 bg-slate-50 rounded-full text-slate-300">
                        <Activity size={40} />
                      </div>
                      <p className="text-slate-500 font-bold">Aucun journal trouvé</p>
                    </div>
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-xs shrink-0">
                          {log.user?.profile?.fullName?.charAt(0) || 'U'}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900 leading-none">
                            {log.user?.profile?.fullName || log.user?.email || 'Système'}
                          </p>
                          <p className="text-[10px] text-slate-400 font-black uppercase mt-1 tracking-tight">
                            {log.user?.role?.name || 'Inconnu'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black border uppercase tracking-wider ${getActionColor(log.action)}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-bold text-slate-600">{log.modelType || '-'}</span>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-slate-400">
                      {log.modelId ? `#${log.modelId}` : '-'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="text-sm font-bold text-slate-900">
                        {format(new Date(log.createdAt), 'dd MMMM yyyy', { locale: fr })}
                      </div>
                      <div className="text-[11px] font-black text-slate-400 uppercase">
                        {format(new Date(log.createdAt), 'HH:mm:ss')}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="p-2 text-slate-400 hover:text-slate-900 hover:bg-white rounded-xl border border-transparent hover:border-slate-200 transition-all shadow-sm"
                      >
                        <Eye size={18} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-6 py-5 border-t border-slate-100 flex items-center justify-between bg-slate-50/30">
          <p className="text-xs font-bold text-slate-500">
            Page <span className="text-slate-900">{page}</span> sur {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <button
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
              className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 disabled:opacity-40 hover:bg-slate-50 transition-colors shadow-sm"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              disabled={page === totalPages}
              onClick={() => setPage(p => p + 1)}
              className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 disabled:opacity-40 hover:bg-slate-50 transition-colors shadow-sm"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Log Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setSelectedLog(null)} />
          <div className="relative bg-white rounded-[40px] shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white rounded-2xl shadow-sm border border-slate-100 text-slate-900">
                  <Activity size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">Détails de l'Activité</h3>
                  <p className="text-xs text-slate-400 font-black uppercase mt-1 tracking-wider">Log #{selectedLog.id}</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedLog(null)}
                className="p-3 hover:bg-white text-slate-400 hover:text-slate-900 rounded-2xl transition-all border border-transparent hover:border-slate-200"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-8 overflow-y-auto max-h-[70vh] space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="p-5 bg-slate-50 rounded-3xl border border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                    <UserIcon size={12} /> Utilisateur
                  </p>
                  <p className="font-bold text-slate-900">{selectedLog.user?.profile?.fullName || selectedLog.user?.email || 'Système'}</p>
                </div>
                <div className="p-5 bg-slate-50 rounded-3xl border border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                    <Calendar size={12} /> Date & Heure
                  </p>
                  <p className="font-bold text-slate-900">{format(new Date(selectedLog.createdAt), 'Pp', { locale: fr })}</p>
                </div>
              </div>

              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-3 px-1">Données de l'Action (Payload)</p>
                <div className="p-6 bg-slate-900 rounded-[32px] overflow-hidden relative group">
                  <pre className="text-xs font-mono text-emerald-400 overflow-x-auto">
                    {JSON.stringify(JSON.parse(selectedLog.changes || '{}'), null, 2)}
                  </pre>
                  <div className="absolute top-4 right-4 p-2 bg-white/10 rounded-lg text-white/40 text-[10px] font-black uppercase tracking-widest pointer-events-none">
                    JSON VIEW
                  </div>
                </div>
              </div>
            </div>

            <div className="p-8 border-t border-slate-100 bg-slate-50/50 text-center">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-8 py-3.5 bg-slate-900 text-white rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/20 active:scale-95"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ActivityLogs;
