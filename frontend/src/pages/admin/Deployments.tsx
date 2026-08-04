import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  GitBranch, GitCommit, RefreshCw, Rocket, CheckCircle2, XCircle,
  AlertTriangle, Clock, Terminal, Loader2, ShieldCheck, ShieldAlert,
  ChevronRight, User as UserIcon,
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import toast from 'react-hot-toast';
import { api } from '../../lib/api';
import { useSocket } from '../../contexts/SocketContext';

/**
 * Deployments — pull the latest commits from GitHub onto the server.
 *
 * The GitHub webhook only ever *notifies*; deploying is always an explicit
 * click. Auto-deploying on push would take the public site down unattended the
 * first time a bad commit lands, and the deploy touches the database.
 */

const STATUS_STYLES: Record<string, { chip: string; Icon: any; label: string }> = {
  SUCCESS: { chip: 'bg-emerald-50 text-emerald-700 border-emerald-200', Icon: CheckCircle2, label: 'Réussi' },
  FAILED:  { chip: 'bg-red-50 text-red-700 border-red-200',             Icon: XCircle,      label: 'Échoué' },
  RUNNING: { chip: 'bg-blue-50 text-blue-700 border-blue-200',          Icon: Loader2,      label: 'En cours' },
  TIMEOUT: { chip: 'bg-amber-50 text-amber-700 border-amber-200',       Icon: Clock,        label: 'Expiré' },
  UNKNOWN: { chip: 'bg-slate-100 text-slate-600 border-slate-200',      Icon: AlertTriangle,label: 'Indéterminé' },
  PENDING: { chip: 'bg-slate-100 text-slate-600 border-slate-200',      Icon: Clock,        label: 'En attente' },
};

function StatusChip({ status }: { status: string }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.UNKNOWN;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-bold ${s.chip}`}>
      <s.Icon className={`w-3.5 h-3.5 ${status === 'RUNNING' ? 'animate-spin' : ''}`} />
      {s.label}
    </span>
  );
}

export default function Deployments() {
  const queryClient = useQueryClient();
  const { socket } = useSocket();
  const [logLines, setLogLines] = useState<string[]>([]);
  const [deploying, setDeploying] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  const { data: status, isLoading, refetch } = useQuery({
    queryKey: ['deploy-status'],
    queryFn: async () => (await api.get('/deploy/status')).data.data,
    // Polling is the fallback for the socket, and the only signal while the API
    // is restarting at the end of a deploy.
    refetchInterval: (q) => ((q.state.data as any)?.deploying ? 3000 : 30000),
  });

  const { data: history } = useQuery({
    queryKey: ['deploy-history'],
    queryFn: async () => (await api.get('/deploy/history?limit=10')).data.data,
    refetchInterval: 30000,
  });

  // Keep the log scrolled to the newest line.
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logLines]);

  useEffect(() => {
    if (!socket) return;

    socket.emit('deploy:subscribe');

    const onLog = (p: { line: string }) => {
      setLogLines((prev) => [...prev.slice(-800), p.line]);
    };
    const onStatus = (p: { status: string }) => {
      if (p.status === 'RUNNING') setDeploying(true);
      else {
        setDeploying(false);
        queryClient.invalidateQueries({ queryKey: ['deploy-status'] });
        queryClient.invalidateQueries({ queryKey: ['deploy-history'] });
        if (p.status === 'SUCCESS') toast.success('Déploiement réussi');
        else toast.error(`Déploiement ${p.status === 'TIMEOUT' ? 'expiré' : 'échoué'}`);
      }
    };
    const onPending = (p: { pendingCount: number; pushed: number }) => {
      toast(`${p.pushed} nouveau(x) commit(s) sur GitHub`, { icon: '📦' });
      queryClient.invalidateQueries({ queryKey: ['deploy-status'] });
    };

    socket.on('deploy:log', onLog);
    socket.on('deploy:status', onStatus);
    socket.on('deploy:pending', onPending);

    return () => {
      socket.emit('deploy:unsubscribe');
      socket.off('deploy:log', onLog);
      socket.off('deploy:status', onStatus);
      socket.off('deploy:pending', onPending);
    };
  }, [socket, queryClient]);

  const runDeploy = useCallback(async () => {
    setConfirmOpen(false);
    setLogLines([]);
    setDeploying(true);
    try {
      await api.post('/deploy/run');
      toast.success('Déploiement lancé');
    } catch (err: any) {
      setDeploying(false);
      toast.error(err?.response?.data?.message || 'Échec du lancement');
    }
  }, []);

  const pending = status?.pendingCommits || status?.pending || [];
  const isBusy = deploying || status?.deploying;
  const canDeploy = !isBusy && !isLoading;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 rounded-3xl p-8 text-white shadow-xl">
        <div className="absolute -top-16 -right-10 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-20 left-10 w-72 h-72 bg-[#ff5722]/10 rounded-full blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-6">
          <div>
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-[11px] font-bold tracking-widest uppercase">
              <Rocket className="w-3.5 h-3.5" /> Déploiement
            </span>
            <h1 className="mt-3 text-3xl font-black">Déployer le site</h1>
            <p className="mt-1 text-slate-300 text-sm max-w-xl">
              Récupère les derniers commits depuis GitHub, reconstruit le backend et le
              frontend, puis redémarre l'API. Le site reste en ligne pendant la
              reconstruction.
            </p>
          </div>

          <div className="flex flex-col items-end gap-3">
            <button
              onClick={() => setConfirmOpen(true)}
              disabled={!canDeploy}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-[#ff5722] hover:bg-[#ff6f3d] disabled:bg-slate-600 disabled:cursor-not-allowed font-bold shadow-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              {isBusy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Rocket className="w-5 h-5" />}
              {isBusy ? 'Déploiement en cours…' : 'Déployer maintenant'}
            </button>
            <button
              onClick={() => refetch()}
              className="inline-flex items-center gap-1.5 text-xs text-slate-300 hover:text-white transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Actualiser
            </button>
          </div>
        </div>
      </div>

      {/* Webhook not configured warning */}
      {status && !status.webhookConfigured && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-900">
            <p className="font-bold">Webhook GitHub non configuré</p>
            <p className="mt-1 text-amber-800">
              Renseignez <code className="px-1 py-0.5 bg-amber-100 rounded font-mono text-xs">GITHUB_WEBHOOK_SECRET</code> dans
              {' '}<a href="/admin/secrets" className="underline font-semibold">Variables &amp; Secrets</a>, puis ajoutez le webhook
              sur GitHub. Tant que ce secret est vide, toutes les requêtes du webhook sont
              refusées — le déploiement manuel reste disponible.
            </p>
          </div>
        </div>
      )}

      {/* Git state */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Branche</p>
          <p className="mt-2 flex items-center gap-2 text-lg font-black text-slate-800">
            <GitBranch className="w-4 h-4 text-slate-400" />
            {isLoading ? '…' : status?.branch}
          </p>
          {status?.dirty && (
            <p className="mt-2 text-[11px] font-semibold text-amber-600 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> Modifications locales non commitées
            </p>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Version déployée</p>
          <p className="mt-2 font-mono text-lg font-black text-slate-800">
            {isLoading ? '…' : status?.local?.sha?.slice(0, 7) || '—'}
          </p>
          <p className="mt-1 text-xs text-slate-500 line-clamp-1">{status?.local?.message}</p>
        </div>

        <div className={`rounded-2xl border shadow-sm p-5 ${status?.upToDate ? 'bg-white border-slate-100' : 'bg-indigo-50 border-indigo-200'}`}>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">En attente</p>
          <p className="mt-2 text-lg font-black text-slate-800">
            {isLoading ? '…' : status?.upToDate ? 'À jour' : `${status?.behind ?? pending.length} commit(s)`}
          </p>
          {status?.upToDate && (
            <p className="mt-1 text-xs text-emerald-600 font-semibold flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" /> Rien à déployer
            </p>
          )}
        </div>
      </div>

      {status?.error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-sm text-red-800">
          <span className="font-bold">Git :</span> {status.error}
        </div>
      )}

      {/* Pending commits */}
      {pending.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="font-black text-slate-800 flex items-center gap-2">
              <GitCommit className="w-4 h-4 text-slate-400" />
              Commits à déployer
            </h2>
          </div>
          <ul className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
            {pending.map((c: any) => (
              <li key={c.sha} className="px-6 py-3 flex items-start gap-3 hover:bg-slate-50/60">
                <code className="mt-0.5 px-2 py-0.5 bg-slate-100 rounded font-mono text-[11px] font-bold text-slate-600 shrink-0">
                  {(c.shortSha || c.sha || '').slice(0, 7)}
                </code>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-800 truncate">
                    {String(c.message || '').split('\n')[0]}
                  </p>
                  {c.author && (
                    <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                      <UserIcon className="w-3 h-3" /> {c.author}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Live log */}
      {(isBusy || logLines.length > 0) && (
        <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-sm overflow-hidden">
          <div className="px-6 py-3 border-b border-slate-800 flex items-center justify-between">
            <h2 className="font-black text-slate-200 text-sm flex items-center gap-2">
              <Terminal className="w-4 h-4 text-slate-500" /> Journal
            </h2>
            {isBusy && (
              <span className="text-[11px] font-bold text-blue-400 flex items-center gap-1.5">
                <Loader2 className="w-3 h-3 animate-spin" /> en cours
              </span>
            )}
          </div>
          <div ref={logRef} className="max-h-96 overflow-y-auto px-6 py-4 font-mono text-[12px] leading-relaxed text-slate-300">
            {logLines.length === 0 ? (
              <p className="text-slate-500">En attente de sortie…</p>
            ) : (
              logLines.map((line, i) => (
                <div key={i} className={
                  /error|failed|❌/i.test(line) ? 'text-red-400'
                  : /✅|success|complete/i.test(line) ? 'text-emerald-400'
                  : /⚠️|warn/i.test(line) ? 'text-amber-400'
                  : ''
                }>{line}</div>
              ))
            )}
          </div>
          {isBusy && (
            <div className="px-6 py-2.5 bg-slate-800/60 text-[11px] text-slate-400 border-t border-slate-800">
              L'API redémarre à la fin du déploiement : le flux peut s'interrompre quelques
              secondes. Le résultat final est enregistré dans l'historique.
            </div>
          )}
        </div>
      )}

      {/* History */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-black text-slate-800">Historique</h2>
        </div>
        {!history?.items?.length ? (
          <div className="px-6 py-12 text-center">
            <Rocket className="w-10 h-10 text-slate-200 mx-auto" />
            <p className="mt-3 text-sm text-slate-400">Aucun déploiement enregistré</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/60">
                  {['Statut', 'Commit', 'Déclenché par', 'Durée', 'Date'].map((h) => (
                    <th key={h} className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {history.items.map((d: any) => (
                  <tr key={d.id} className="hover:bg-slate-50/60">
                    <td className="px-6 py-3"><StatusChip status={d.status} /></td>
                    <td className="px-6 py-3">
                      <code className="font-mono text-[11px] text-slate-600">{d.commitSha?.slice(0, 7) || '—'}</code>
                      <p className="text-xs text-slate-500 truncate max-w-xs">{d.commitMessage}</p>
                    </td>
                    <td className="px-6 py-3 text-xs text-slate-600">
                      {d.triggeredBy || (d.trigger === 'WEBHOOK' ? 'GitHub' : '—')}
                    </td>
                    <td className="px-6 py-3 text-xs text-slate-500 tabular-nums">
                      {d.durationMs ? `${Math.round(d.durationMs / 1000)}s` : '—'}
                    </td>
                    <td className="px-6 py-3 text-xs text-slate-500 whitespace-nowrap">
                      {format(new Date(d.createdAt), 'dd MMM HH:mm', { locale: fr })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Confirm */}
      {confirmOpen && (
        <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-7">
            <div className="w-12 h-12 rounded-2xl bg-[#ff5722]/10 flex items-center justify-center">
              <Rocket className="w-6 h-6 text-[#ff5722]" />
            </div>
            <h3 className="mt-4 text-xl font-black text-slate-900">Déployer maintenant ?</h3>
            <p className="mt-2 text-sm text-slate-600">
              {pending.length > 0
                ? `${pending.length} commit(s) seront déployés en production.`
                : "Le serveur est déjà à jour — le déploiement va reconstruire l'application."}
            </p>
            <ul className="mt-4 space-y-1.5 text-xs text-slate-500">
              <li className="flex gap-2"><ChevronRight className="w-3.5 h-3.5 shrink-0 mt-0.5" />L'API redémarre, les sessions actives sont brièvement interrompues.</li>
              <li className="flex gap-2"><ChevronRight className="w-3.5 h-3.5 shrink-0 mt-0.5" />Le site public reste en ligne : la nouvelle version est basculée à la fin.</li>
              <li className="flex gap-2"><ChevronRight className="w-3.5 h-3.5 shrink-0 mt-0.5" />Durée habituelle : 2 à 4 minutes.</li>
            </ul>
            <div className="mt-6 flex gap-3">
              <button onClick={() => setConfirmOpen(false)} className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 font-bold text-sm text-slate-600 hover:bg-slate-50">
                Annuler
              </button>
              <button onClick={runDeploy} className="flex-1 px-4 py-2.5 rounded-xl bg-[#ff5722] hover:bg-[#ff6f3d] text-white font-bold text-sm">
                Déployer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
