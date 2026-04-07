import { useState, useEffect, useCallback } from 'react';
import { webhooksApi } from '../../lib/api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  RefreshCw,
  Loader2,
  Webhook,
  CheckCircle2,
  XCircle,
  Clock,
  Trash2,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
} from 'lucide-react';

interface WebhookLog {
  id: number;
  provider: string;
  payload: any;
  processed: boolean;
  status: string | null;
  errorMsg: string | null;
  createdAt: string;
}

const statusColors: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
  RECEIVED: { bg: 'bg-blue-50 border-blue-100', text: 'text-blue-600', icon: <Clock className="w-4 h-4" /> },
  FAILED_TO_PROCESS: { bg: 'bg-red-50 border-red-100', text: 'text-red-600', icon: <XCircle className="w-4 h-4" /> },
};

function getStatusStyle(status: string | null, processed: boolean) {
  if (processed) {
    return { bg: 'bg-emerald-50 border-emerald-100', text: 'text-emerald-600', icon: <CheckCircle2 className="w-4 h-4" /> };
  }
  if (status && statusColors[status]) return statusColors[status];
  return { bg: 'bg-gray-50 border-gray-100', text: 'text-gray-500', icon: <AlertTriangle className="w-4 h-4" /> };
}

export default function WebhookLogs() {
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [clearConfirm, setClearConfirm] = useState(false);
  const [clearing, setClearing] = useState(false);
  const limit = 20;

  const fetchLogs = useCallback(async (p = page) => {
    setLoading(true);
    try {
      const res = await webhooksApi.getLogs({ page: p, limit });
      setLogs(res.data.data.logs);
      setTotal(res.data.data.pagination.total);
    } catch {
      toast.error('Erreur lors du chargement des logs');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleClearLogs = async () => {
    if (!clearConfirm) { setClearConfirm(true); return; }
    setClearing(true);
    try {
      await webhooksApi.clearLogs();
      setLogs([]);
      setTotal(0);
      setClearConfirm(false);
      toast.success('Tous les logs ont été supprimés');
    } catch {
      toast.error('Erreur lors de la suppression');
    } finally {
      setClearing(false);
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <Webhook className="w-6 h-6 text-indigo-500" />
            Logs Webhook Coliaty
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {total} notifications reçues au total. Les mises à jour de statut se font automatiquement.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setClearConfirm(false); fetchLogs(); }}
            className="p-2.5 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 rounded-xl transition-all"
          >
            <RefreshCw size={18} />
          </button>
          <button
            onClick={handleClearLogs}
            disabled={clearing || logs.length === 0}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-black rounded-xl transition-all disabled:opacity-40 ${
              clearConfirm
                ? 'bg-red-500 text-white hover:bg-red-600'
                : 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-100'
            }`}
          >
            {clearing ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            {clearConfirm ? 'CONFIRMER SUPPRESSION' : 'Vider les logs'}
          </button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total reçus', value: total, color: 'text-slate-800', bg: 'bg-slate-50' },
          { label: 'Traités', value: logs.filter(l => l.processed).length, color: 'text-emerald-700', bg: 'bg-emerald-50' },
          { label: 'Échecs', value: logs.filter(l => !l.processed && l.status === 'FAILED_TO_PROCESS').length, color: 'text-red-700', bg: 'bg-red-50' },
        ].map(stat => (
          <div key={stat.label} className={`${stat.bg} rounded-2xl px-6 py-4 border border-white shadow-sm`}>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{stat.label}</p>
            <p className={`text-3xl font-black ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Log List */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/40 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-20">
            <Webhook className="w-12 h-12 text-slate-200 mx-auto mb-4" />
            <p className="text-slate-400 font-bold">Aucun log webhook trouvé</p>
            <p className="text-slate-300 text-sm mt-1">Les événements Coliaty apparaîtront ici automatiquement.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
              <div className="col-span-2">Statut</div>
              <div className="col-span-2">Provider</div>
              <div className="col-span-3">Package Code</div>
              <div className="col-span-3">Date</div>
              <div className="col-span-2">Détails</div>
            </div>

            {logs.map(log => {
              const style = getStatusStyle(log.status, log.processed);
              const isExpanded = expandedId === log.id;
              const packageCode = log.payload?.package_code || log.payload?.tracking_code || '—';
              const coliatyStatus = log.payload?.status || log.payload?.statut || '—';

              return (
                <div key={log.id} className="hover:bg-slate-50/50 transition-colors">
                  <div className="grid grid-cols-12 gap-4 items-center px-6 py-4">
                    <div className="col-span-2">
                      <span className={`inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-tighter px-2.5 py-1 rounded-lg border ${style.bg} ${style.text}`}>
                        {style.icon}
                        {log.processed ? 'TRAITÉ' : (log.status?.replace(/_/g, ' ') || 'INCONNU')}
                      </span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md">
                        {log.provider}
                      </span>
                    </div>
                    <div className="col-span-3">
                      <p className="text-xs font-bold text-slate-700 font-mono">{packageCode}</p>
                      {coliatyStatus !== '—' && (
                        <p className="text-[10px] text-slate-400 mt-0.5">→ {coliatyStatus}</p>
                      )}
                    </div>
                    <div className="col-span-3">
                      <p className="text-xs font-semibold text-slate-600">
                        {format(new Date(log.createdAt), "dd MMM yyyy 'à' HH:mm", { locale: fr })}
                      </p>
                    </div>
                    <div className="col-span-2 flex justify-end">
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : log.id)}
                        className="flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-indigo-600 transition-colors"
                      >
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        {isExpanded ? 'Masquer' : 'Payload'}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Payload */}
                  {isExpanded && (
                    <div className="px-6 pb-5">
                      <div className="bg-slate-900 rounded-2xl p-4 text-left overflow-auto max-h-60">
                        <pre className="text-[11px] text-slate-300 font-mono leading-relaxed whitespace-pre-wrap">
                          {JSON.stringify(log.payload, null, 2)}
                        </pre>
                      </div>
                      {log.errorMsg && (
                        <div className="mt-3 p-3 bg-red-50 border border-red-100 rounded-xl">
                          <p className="text-xs font-bold text-red-600">❌ Erreur: {log.errorMsg}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
            <button
              key={p}
              onClick={() => { setPage(p); fetchLogs(p); }}
              className={`w-9 h-9 rounded-xl text-xs font-black transition-all ${
                p === page
                  ? 'bg-indigo-500 text-white shadow-md shadow-indigo-200'
                  : 'bg-white text-slate-500 border border-slate-100 hover:border-indigo-200 hover:text-indigo-600'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
