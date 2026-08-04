import { useState, useEffect } from 'react';
import { api } from '../../../lib/api';
import toast from 'react-hot-toast';
import { 
  GitBranch, GitCommit, Server, RefreshCw, Cpu, 
  Clock, CheckCircle2, XCircle, ChevronDown, ChevronUp, Loader2, Play
} from 'lucide-react';

const CARD_STYLE = 'bg-slate-900 rounded-2xl border border-slate-800 p-5';
const BADGE_STYLE = 'px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider';

interface DeploymentItem {
  id: string;
  commitHash?: string;
  commitMsg?: string;
  status: string;
  triggeredBy: string;
  logOutput?: string;
  createdAt: string;
  updatedAt: string;
}

export default function ModDeployments() {
  const [deployments, setDeployments] = useState<DeploymentItem[]>([]);
  const [statusData, setStatusData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [deploying, setDeploying] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadStatus = async () => {
    try {
      const res = await api.get('/admin/deployments/status');
      setStatusData(res.data.data);
    } catch (err) {
      console.warn('Failed to load status:', err);
    }
  };

  const loadDeployments = async () => {
    try {
      const res = await api.get('/admin/deployments');
      setDeployments(res.data.data || []);
      const hasPending = (res.data.data || []).some((d: any) => d.status === 'PENDING');
      setDeploying(hasPending);
    } catch (err) {
      console.warn('Failed to load deployments:', err);
    }
  };

  const loadData = async (initial = false) => {
    if (initial) setLoading(true);
    await Promise.all([loadStatus(), loadDeployments()]);
    if (initial) setLoading(false);
  };

  useEffect(() => {
    loadData(true);

    const timer = setInterval(() => {
      loadData(false);
    }, 8000);

    return () => {
      clearInterval(timer);
    };
  }, []);

  const handleDeploy = async () => {
    if (!window.confirm("Êtes-vous sûr de vouloir déclencher un déploiement ? Le serveur va se reconstruire et redémarrer, ce qui coupera temporairement la connexion.")) return;

    try {
      setDeploying(true);
      const res = await api.post('/admin/deployments/deploy');
      toast.success(res.data.message || 'Déploiement initié.');
      loadData(false);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erreur lors du déclenchement du déploiement');
      setDeploying(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-500">
        <Loader2 className="w-8 h-8 animate-spin text-sky-500" />
        <span className="text-xs font-semibold">Chargement du panneau de déploiement...</span>
      </div>
    );
  }

  const git = statusData?.git;
  const pm2 = statusData?.pm2;
  const metrics = statusData?.metrics;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        <div className={CARD_STYLE + ' space-y-4 border-t-2 border-t-sky-500'}>
          <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
            <Server size={14} className="text-sky-400" /> Processus PM2 (silacod-api)
          </h3>
          {pm2 ? (
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-850">
                <p className="text-[10px] text-slate-500 font-bold uppercase">Statut</p>
                <span className={`inline-block mt-1 font-bold ${
                  pm2.status === 'online' ? 'text-emerald-400' : 'text-rose-400'
                }`}>
                  ● {pm2.status}
                </span>
              </div>
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-850">
                <p className="text-[10px] text-slate-500 font-bold uppercase">Restarts</p>
                <p className="font-mono text-white font-bold mt-1">{pm2.restarts}</p>
              </div>
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-850">
                <p className="text-[10px] text-slate-500 font-bold uppercase">Mémoire</p>
                <p className="font-mono text-white font-bold mt-1">{Math.round(pm2.memory / 1024 / 1024)} MB</p>
              </div>
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-850">
                <p className="text-[10px] text-slate-500 font-bold uppercase">CPU</p>
                <p className="font-mono text-white font-bold mt-1">{pm2.cpu}%</p>
              </div>
            </div>
          ) : (
            <div className="text-slate-500 text-xs text-center py-4 bg-slate-950 rounded-xl border border-slate-850">
              PM2 Status non disponible
            </div>
          )}
        </div>

        <div className={CARD_STYLE + ' space-y-4 border-t-2 border-t-purple-500'}>
          <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
            <GitBranch size={14} className="text-purple-400" /> Dépôt Git Actuel
          </h3>
          {git ? (
            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center bg-slate-950 p-2 rounded-xl border border-slate-850">
                <span className="text-[10px] text-slate-500 font-bold uppercase">Branche</span>
                <span className="font-mono text-purple-400 font-bold flex items-center gap-1">
                  <GitBranch size={10} /> {git.branch}
                </span>
              </div>
              <div className="flex justify-between items-center bg-slate-950 p-2 rounded-xl border border-slate-850">
                <span className="text-[10px] text-slate-500 font-bold uppercase">Commit</span>
                <span className="font-mono text-emerald-400 font-bold flex items-center gap-1">
                  <GitCommit size={10} /> {git.hash}
                </span>
              </div>
              <div className="bg-slate-950 p-2 rounded-xl border border-slate-850">
                <span className="text-[10px] text-slate-500 font-bold uppercase">Message</span>
                <p className="text-[11px] text-white truncate font-medium mt-0.5">{git.msg}</p>
              </div>
            </div>
          ) : (
            <div className="text-slate-500 text-xs text-center py-4 bg-slate-950 rounded-xl border border-slate-850">
              Informations Git non disponibles
            </div>
          )}
        </div>

        <div className={CARD_STYLE + ' space-y-4 border-t-2 border-t-lime-500'}>
          <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
            <Cpu size={14} className="text-lime-400" /> Spécifications VM & Node
          </h3>
          {metrics ? (
            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center bg-slate-950 p-2 rounded-xl border border-slate-850">
                <span className="text-[10px] text-slate-500 font-bold uppercase">CPU Load</span>
                <span className="font-mono text-white font-bold">{metrics.cpu?.loadPct ?? 0}%</span>
              </div>
              <div className="flex justify-between items-center bg-slate-950 p-2 rounded-xl border border-slate-850">
                <span className="text-[10px] text-slate-500 font-bold uppercase">RAM Usage</span>
                <span className="font-mono text-white font-bold">{metrics.memory?.usedPct ?? 0}%</span>
              </div>
              <div className="flex justify-between items-center bg-slate-950 p-2 rounded-xl border border-slate-850">
                <span className="text-[10px] text-slate-500 font-bold uppercase">Version Node</span>
                <span className="font-mono text-white font-bold">{metrics.node?.version || 'N/A'}</span>
              </div>
            </div>
          ) : (
            <div className="text-slate-500 text-xs text-center py-4 bg-slate-950 rounded-xl border border-slate-850">
              Système info non disponible
            </div>
          )}
        </div>

      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="space-y-1 text-center sm:text-left">
          <h4 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-1.5 justify-center sm:justify-start">
            <RefreshCw size={14} className={deploying ? 'animate-spin text-sky-500' : 'text-slate-400'} />
            Déploiement Automatique
          </h4>
          <p className="text-[11px] text-slate-400 leading-relaxed max-w-xl">
            Cliquez sur Déployer pour exécuter le script de déploiement en arrière-plan. Cela tirera la branche actuelle de GitHub, installera les dépendances, synchronisera Prisma, reconstruira le frontend et relancera l'API.
          </p>
        </div>
        <button
          onClick={handleDeploy}
          disabled={deploying}
          className="flex items-center gap-1.5 px-6 py-3 bg-sky-500 hover:bg-sky-600 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 disabled:cursor-not-allowed rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-sky-500/10 active:scale-95 shrink-0"
        >
          {deploying ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Déploiement en cours...
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-slate-950 stroke-none" />
              Déployer la branche
            </>
          )}
        </button>
      </div>

      <div className={CARD_STYLE + ' p-0 overflow-hidden'}>
        <div className="p-5 border-b border-slate-850">
          <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
            <Clock size={14} className="text-sky-400" /> Historique des Déploiements ({deployments.length})
          </h3>
        </div>

        {deployments.length === 0 ? (
          <div className="text-center py-16 text-slate-500 text-xs">
            Aucun déploiement enregistré dans l'historique
          </div>
        ) : (
          <div className="divide-y divide-slate-850/40">
            {deployments.map((d) => {
              const isOpen = expandedId === d.id;
              const hasLogs = !!d.logOutput;
              return (
                <div key={d.id} className="hover:bg-slate-850/5 transition-colors">
                  
                  <div 
                    onClick={() => hasLogs && setExpandedId(isOpen ? null : d.id)}
                    className={`p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs ${
                      hasLogs ? 'cursor-pointer' : ''
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] text-slate-500">{new Date(d.createdAt).toLocaleString()}</span>
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                          Par {d.triggeredBy}
                        </span>
                      </div>
                      
                      {d.commitHash ? (
                        <p className="text-[11px] text-white font-medium flex items-center gap-1.5">
                          <span className="font-mono text-emerald-400 font-bold bg-emerald-500/10 px-1 py-0.5 rounded text-[10px]">
                            {d.commitHash}
                          </span>
                          {d.commitMsg}
                        </p>
                      ) : (
                        <p className="text-[11px] text-slate-500 font-medium italic">Aucun commit associé (PENDING ou ECHEC Git)</p>
                      )}
                    </div>

                    <div className="flex items-center gap-3 self-end md:self-auto">
                      <span className={`${BADGE_STYLE} ${
                        d.status === 'SUCCESS' 
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                          : d.status === 'FAILED'
                          ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 animate-pulse'
                      }`}>
                        {d.status === 'SUCCESS' && <CheckCircle2 size={10} className="inline mr-1 -mt-0.5" />}
                        {d.status === 'FAILED' && <XCircle size={10} className="inline mr-1 -mt-0.5" />}
                        {d.status === 'PENDING' && <Loader2 size={10} className="inline mr-1 -mt-0.5 animate-spin" />}
                        {d.status}
                      </span>

                      {hasLogs && (
                        <button className="text-slate-500 hover:text-white transition-colors">
                          {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                      )}
                    </div>
                  </div>

                  {isOpen && hasLogs && (
                    <div className="px-4 pb-4 animate-fadeIn">
                      <div className="bg-slate-950 border border-slate-850 rounded-xl p-4 font-mono text-[11px] text-slate-300 overflow-x-auto max-h-96 overflow-y-auto custom-scrollbar whitespace-pre">
                        {d.logOutput}
                      </div>
                    </div>
                  )}

                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
