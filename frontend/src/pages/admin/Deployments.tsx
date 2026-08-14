import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  GitBranch, GitCommit, RefreshCw, Rocket, CheckCircle2, XCircle,
  Clock, Terminal, Loader2, ShieldCheck, ShieldAlert,
  User as UserIcon, Activity, Server, Check, Zap
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import toast from 'react-hot-toast';
import { api } from '../../lib/api';
import { useSocket } from '../../contexts/SocketContext';

const STATUS_STYLES: Record<string, { chip: string; Icon: any; label: string }> = {
  SUCCESS: { chip: 'bg-emerald-500/10 text-emerald-600 border-emerald-200', Icon: CheckCircle2, label: 'Déploiement Réussi' },
  FAILED:  { chip: 'bg-rose-500/10 text-rose-600 border-rose-200', Icon: XCircle, label: 'Échec du Déploiement' },
  RUNNING: { chip: 'bg-indigo-500/10 text-indigo-600 border-indigo-200', Icon: Loader2, label: 'Reconstruction...' },
  TIMEOUT: { chip: 'bg-amber-500/10 text-amber-600 border-amber-200', Icon: Clock, label: 'Délai Dépassé' },
  // Not a success. UNKNOWN means the outcome could not be determined — deploy.sh
  // prints its DEPLOY_RESULT marker after `pm2 restart`, by which point nothing is
  // reading the log. Styling it like SUCCESS told operators a deploy had worked
  // when nobody actually knew, so it gets its own neutral treatment.
  UNKNOWN: { chip: 'bg-slate-100 text-slate-600 border-slate-300', Icon: Activity, label: 'Indéterminé' },
  PENDING: { chip: 'bg-slate-100 text-slate-700 border-slate-200', Icon: Clock, label: 'En attente' },
};

function StatusChip({ status }: { status: string }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.UNKNOWN;
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-bold ${s.chip}`}>
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

  // Past-deployment log viewer.
  const [logModal, setLogModal] = useState<{ id: string; sha?: string } | null>(null);
  const [pastLog, setPastLog] = useState<string | null>(null);
  const [pastLogAvailable, setPastLogAvailable] = useState(true);
  const [loadingPastLog, setLoadingPastLog] = useState(false);

  // How many history rows to request. The endpoint caps at 50.
  const [historyLimit, setHistoryLimit] = useState(10);

  const openPastLog = useCallback(async (id: string, sha?: string) => {
    setLogModal({ id, sha });
    setPastLog(null);
    setPastLogAvailable(true);
    setLoadingPastLog(true);
    try {
      const { data } = await api.get(`/deploy/${id}/log`);
      setPastLog(data.data.log || '');
      setPastLogAvailable(data.data.available !== false);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Impossible de charger le journal.');
      setLogModal(null);
    } finally {
      setLoadingPastLog(false);
    }
  }, []);

  const { data: status, dataUpdatedAt, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['deploy-status'],
    queryFn: async () => (await api.get('/deploy/status')).data.data,
    refetchInterval: (q) => ((q.state.data as any)?.deploying ? 3000 : 20000),
  });

  // Wall-clock of the last successful POST /deploy/run, used to ignore status
  // snapshots that predate it.
  const deployStartedAt = useRef(0);

  const { data: history } = useQuery({
    queryKey: ['deploy-history', historyLimit],
    queryFn: async () => (await api.get(`/deploy/history?limit=${historyLimit}`)).data.data,
    refetchInterval: 20000,
  });

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logLines]);

  // Backfill the live log after a reload.
  //
  // logLines only accumulates from the deploy:log socket stream, so reloading (or
  // navigating away and back) during a deploy left the panel blank while the build
  // was still running — the operator could not tell whether anything was happening.
  // Fetch what the runner has written so far, once, then let the socket append.
  const backfilledFor = useRef<string | null>(null);
  useEffect(() => {
    const activeId = status?.activeDeploymentId;
    if (!activeId || !status?.deploying) return;
    if (backfilledFor.current === activeId) return;
    backfilledFor.current = activeId;

    api
      .get(`/deploy/${activeId}/log`)
      .then(({ data }) => {
        const text: string = data?.data?.log || '';
        if (!text) return;
        // Only seed when nothing has streamed in yet, so we never duplicate lines
        // that the socket already delivered.
        setLogLines((prev) => (prev.length ? prev : text.split('\n').slice(-800)));
      })
      .catch(() => {
        /* the panel simply stays empty until the next streamed line */
      });
  }, [status?.activeDeploymentId, status?.deploying]);

  useEffect(() => {
    if (!socket) return;

    // Re-subscribe on every (re)connect, not just once.
    //
    // Room membership is per-connection server-side (index.ts: socket.join
    // ('deploy:watchers')), and deploy.sh ends with `pm2 restart silacod-api`
    // — so the deploy being watched drops the websocket. socket.io reconnects,
    // but SocketContext reuses the same Socket object, so this effect never
    // re-runs and the old code never re-joined the room. The tab then went
    // permanently deaf to deploy:log / deploy:status for the rest of the
    // session, which is why the live log stopped appearing after the first
    // deploy.
    const subscribe = () => socket.emit('deploy:subscribe');
    subscribe();
    socket.on('connect', subscribe);

    const onLog = (p: { line: string }) => {
      setLogLines((prev) => [...prev.slice(-800), p.line]);
    };
    const onStatus = (p: { status: string }) => {
      if (p.status === 'RUNNING') setDeploying(true);
      else {
        setDeploying(false);
        queryClient.invalidateQueries({ queryKey: ['deploy-status'] });
        queryClient.invalidateQueries({ queryKey: ['deploy-history'] });
        if (p.status === 'SUCCESS') toast.success('Déploiement réussi avec succès !');
        else toast.error(`Déploiement ${p.status === 'TIMEOUT' ? 'expiré' : 'échoué'}`);
      }
    };
    const onPending = (p: { pendingCount: number; pushed: number }) => {
      toast(`${p.pushed} nouveau(x) commit(s) sur GitHub`, { icon: '🚀' });
      queryClient.invalidateQueries({ queryKey: ['deploy-status'] });
    };

    socket.on('deploy:log', onLog);
    socket.on('deploy:status', onStatus);
    socket.on('deploy:pending', onPending);

    return () => {
      socket.emit('deploy:unsubscribe');
      socket.off('connect', subscribe);
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
      deployStartedAt.current = Date.now();
      toast.success('Déploiement initialisé');
      queryClient.invalidateQueries({ queryKey: ['deploy-status'] });
    } catch (err: any) {
      setDeploying(false);
      toast.error(err?.response?.data?.message || 'Échec du lancement');
    }
  }, [queryClient]);

  /**
   * Clears the local `deploying` latch from server truth.
   *
   * The terminal deploy:status event usually never arrives: deploy.sh restarts
   * the API as its last step, killing the process that owns the runner's stdout
   * pipe, so child.on('exit') -> finish() never runs in any live process. The
   * latch was therefore only ever set, never cleared, leaving the Deploy button
   * disabled forever after the first run.
   *
   * The dataUpdatedAt guard rejects the cached pre-click status (which still
   * says deploying:false) so the latch cannot clear the instant it is set.
   */
  useEffect(() => {
    if (!deploying) return;
    if (status?.deploying) return;
    if (dataUpdatedAt <= deployStartedAt.current) return;

    setDeploying(false);
    queryClient.invalidateQueries({ queryKey: ['deploy-history'] });
    // Deliberately "terminé", not "réussi": the settled row is often UNKNOWN
    // because deploy.sh prints DEPLOY_RESULT after the pm2 restart, with no
    // live reader for the log. Point the operator at the log instead.
    toast.success('Déploiement terminé — ouvrez le journal dans l’historique.');
  }, [deploying, status?.deploying, dataUpdatedAt, queryClient]);

  const currentLocalSha = (status?.local?.sha || '').slice(0, 7);
  const rawPending = status?.pendingCommits || status?.pending || [];
  const pending = rawPending.filter((c: any) => {
    const sha = (c.shortSha || c.sha || '').slice(0, 7);
    return sha && currentLocalSha ? sha !== currentLocalSha : true;
  });
  const isBusy = deploying || status?.deploying;
  const canDeploy = !isBusy && !isLoading;
  const hasPendingCommits = pending.length > 0 && !isBusy;

  return (
    <div className="space-y-8 font-['Inter'] max-w-7xl mx-auto pb-12">
      {/* Sleek Hero Header */}
      <div className="relative overflow-hidden rounded-3xl bg-slate-900 border border-slate-800 p-8 text-white shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-indigo-500/20 via-purple-500/10 to-transparent rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[11px] font-bold uppercase tracking-wider">
                <Server className="w-3.5 h-3.5 text-indigo-400" /> Infrastructure Live
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold uppercase tracking-wider">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" /> Serveur Actif
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[11px] font-bold uppercase tracking-wider">
                <Zap className="w-3.5 h-3.5 text-purple-400 animate-pulse" /> Déploiement Auto sur Push
              </span>
            </div>

            <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white">
              Centre de Déploiement SILACOD
            </h1>
            <p className="text-slate-400 text-sm max-w-2xl leading-relaxed">
              Mettez à jour instantanément la plateforme avec les derniers commits GitHub. Le déploiement s'exécute en arrière-plan sans aucune interruption pour vos utilisateurs.
            </p>
          </div>

          {/* Deploy Primary Action Button */}
          <div className="flex flex-col items-stretch md:items-end gap-3 shrink-0">
            <button
              onClick={() => setConfirmOpen(true)}
              disabled={!canDeploy}
              className={`relative group inline-flex items-center justify-center gap-3 px-8 py-4 rounded-2xl font-black text-sm tracking-wide transition-all shadow-xl ${
                isBusy
                  ? 'bg-slate-800 text-slate-400 cursor-not-allowed border border-slate-700'
                  : hasPendingCommits
                  ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 text-white hover:scale-[1.02] active:scale-95 shadow-orange-500/25'
                  : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:scale-[1.02] active:scale-95 shadow-indigo-500/25'
              }`}
            >
              {isBusy ? (
                <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
              ) : (
                <Rocket className="w-5 h-5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              )}
              {isBusy ? 'Reconstruction du site en cours...' : hasPendingCommits ? `Mettre à jour (${pending.length} commit${pending.length > 1 ? 's' : ''})` : 'Déployer la version actuelle'}
            </button>

            <button
              onClick={() => refetch()}
              disabled={isRefetching}
              className="inline-flex items-center justify-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors py-1"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefetching ? 'animate-spin text-indigo-400' : ''}`} />
              {isRefetching ? 'Vérification GitHub...' : 'Vérifier les mises à jour'}
            </button>
          </div>
        </div>
      </div>

      {/* Warning Alert if Secret Missing */}
      {status && !status.webhookConfigured && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5 flex items-start gap-4 shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-600 shrink-0">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div className="space-y-1 text-sm text-slate-700">
            <h4 className="font-bold text-amber-900 flex items-center gap-2">
              Webhook GitHub non synchronisé
            </h4>
            <p className="text-slate-600 leading-relaxed text-xs">
              Pour activer la notification automatique lors des nouveaux commits, configurez la clé <code className="px-1.5 py-0.5 bg-white border border-amber-200 rounded font-mono text-[11px] font-bold text-amber-800">GITHUB_WEBHOOK_SECRET</code> dans <a href="/admin/secrets" className="text-amber-700 font-bold underline hover:text-amber-900">Variables & Secrets</a>. Les déploiements manuels fonctionnent normalement.
            </p>
          </div>
        </div>
      )}

      {/* Infrastructure Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Branch Card */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-2 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">Branche Git</span>
            <GitBranch className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="flex items-center gap-2 text-xl font-black text-slate-900">
            <span className="px-2.5 py-1 bg-slate-100 rounded-lg font-mono text-sm text-slate-800 border border-slate-200">
              {isLoading ? '...' : status?.branch || 'master'}
            </span>
          </div>
          <p className="text-xs text-slate-500">Branche principale connectée à GitHub</p>
        </div>

        {/* Currently Deployed Version */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-2 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">Version Active en Production</span>
            <GitCommit className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="flex items-center gap-2 text-xl font-black text-slate-900">
            <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg font-mono text-sm">
              {isLoading ? '...' : status?.local?.sha?.slice(0, 7) || '—'}
            </span>
          </div>
          <p className="text-xs text-slate-500 truncate" title={status?.local?.message}>
            {status?.local?.message || 'Dernière version compilée'}
          </p>
        </div>

        {/* Sync Status Card */}
        <div className={`rounded-2xl border shadow-sm p-6 space-y-2 hover:shadow-md transition-shadow ${
          isBusy
            ? 'bg-indigo-50/50 border-indigo-200/80'
            : hasPendingCommits
            ? 'bg-amber-50/60 border-amber-200/80'
            : 'bg-emerald-50/50 border-emerald-200/80'
        }`}>
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">État de Synchronisation</span>
            {isBusy ? <Loader2 className="w-4 h-4 text-indigo-600 animate-spin" /> : hasPendingCommits ? <Activity className="w-4 h-4 text-amber-600 animate-pulse" /> : <ShieldCheck className="w-4 h-4 text-emerald-600" />}
          </div>
          <div className="flex items-center gap-2 text-xl font-black">
            {isBusy ? (
              <span className="text-indigo-900 font-black flex items-center gap-2">
                <Loader2 className="w-5 h-5 text-indigo-600 animate-spin" /> Reconstruction...
              </span>
            ) : hasPendingCommits ? (
              <span className="text-amber-800 font-black">{pending.length} nouveau{pending.length > 1 ? 'x' : ''} commit{pending.length > 1 ? 's' : ''} disponible{pending.length > 1 ? 's' : ''}</span>
            ) : (
              <span className="text-emerald-800 font-black flex items-center gap-2">
                <Check className="w-5 h-5 text-emerald-600" /> Plateforme à Jour
              </span>
            )}
          </div>
          <p className={`text-xs ${isBusy ? 'text-indigo-700 font-medium' : hasPendingCommits ? 'text-amber-700 font-medium' : 'text-emerald-700 font-medium'}`}>
            {isBusy ? 'Compilation du frontend & redémarrage API...' : hasPendingCommits ? 'Prêt à être déployé sur silacod.com' : 'Votre serveur exécute les tout derniers changements'}
          </p>
        </div>
      </div>

      {/* Commits Timeline Section */}
      {hasPendingCommits && (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-md overflow-hidden">
          <div className="px-7 py-5 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600">
                <GitCommit className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-black text-slate-900 text-base">Nouveaux Commits à Déployer</h3>
                <p className="text-xs text-slate-500">Modifications prêtes sur GitHub non encore installées en production</p>
              </div>
            </div>
            <span className="px-3 py-1 bg-amber-100 text-amber-800 font-black text-xs rounded-full border border-amber-200">
              {pending.length} commit{pending.length > 1 ? 's' : ''}
            </span>
          </div>

          <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
            {pending.map((c: any) => (
              <div key={c.sha} className="p-5 flex items-start gap-4 hover:bg-slate-50/80 transition-colors">
                <span className="px-2.5 py-1 bg-slate-100 border border-slate-200 rounded-lg font-mono text-xs font-bold text-slate-700 shrink-0">
                  {(c.shortSha || c.sha || '').slice(0, 7)}
                </span>
                <div className="flex-1 min-w-0 space-y-1">
                  <p className="text-sm font-bold text-slate-900 leading-snug">
                    {String(c.message || '').split('\n')[0]}
                  </p>
                  {c.author && (
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <UserIcon className="w-3 h-3 text-slate-400" />
                      <span>{c.author}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Terminal Realtime Execution Output Log */}
      {(isBusy || logLines.length > 0) && (
        <div className="bg-slate-950 rounded-3xl border border-slate-800 shadow-2xl overflow-hidden">
          <div className="px-6 py-4 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-rose-500/80" />
                <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
              </div>
              <span className="text-xs font-mono text-slate-400 font-bold ml-2 flex items-center gap-2">
                <Terminal className="w-4 h-4 text-indigo-400" /> Terminal de Déploiement Live
              </span>
            </div>

            {isBusy && (
              <span className="px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 text-xs font-bold flex items-center gap-2 animate-pulse">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Execution en cours...
              </span>
            )}
          </div>

          <div ref={logRef} className="max-h-[420px] overflow-y-auto p-6 font-mono text-xs leading-relaxed text-slate-300 bg-slate-950 space-y-1">
            {logLines.length === 0 ? (
              <p className="text-slate-600 italic">Connexion au flux du serveur...</p>
            ) : (
              logLines.map((line, i) => (
                <div key={i} className={
                  /error|failed|❌/i.test(line) ? 'text-rose-400 font-semibold bg-rose-950/20 px-2 py-0.5 rounded'
                  : /✅|success|complete/i.test(line) ? 'text-emerald-400 font-semibold bg-emerald-950/20 px-2 py-0.5 rounded'
                  : /⚠️|warn/i.test(line) ? 'text-amber-400'
                  : 'text-slate-300'
                }>{line}</div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Deployments History Table */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-7 py-5 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-black text-slate-900 text-base">Historique des Déploiements</h3>
            <p className="text-xs text-slate-500">Journal des précédentes reconstructions de la plateforme</p>
          </div>
        </div>

        {!history?.items?.length ? (
          <div className="px-6 py-16 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <Rocket className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-slate-500">Aucun déploiement récent trouvé</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60">
                  <th className="px-7 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Résultat</th>
                  <th className="px-7 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Commit Deployé</th>
                  <th className="px-7 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Déclenché Par</th>
                  <th className="px-7 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Durée</th>
                  <th className="px-7 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date & Heure</th>
                  <th className="px-7 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Journal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {history.items.map((d: any) => (
                  <tr key={d.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-7 py-4">
                      <StatusChip status={d.status} />
                    </td>
                    <td className="px-7 py-4">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 rounded font-mono text-xs font-bold text-slate-700">
                          {d.commitSha?.slice(0, 7) || '—'}
                        </span>
                        <span className="text-xs font-medium text-slate-700 truncate max-w-sm" title={d.commitMessage}>
                          {d.commitMessage || 'Mise à jour du système'}
                        </span>
                      </div>
                    </td>
                    <td className="px-7 py-4 text-xs text-slate-600 font-medium">
                      {d.triggeredBy || (d.trigger === 'WEBHOOK' ? 'GitHub Webhook' : 'Administrateur')}
                    </td>
                    <td className="px-7 py-4 text-xs text-slate-500 tabular-nums">
                      {d.durationMs ? `${Math.round(d.durationMs / 1000)}s` : '—'}
                    </td>
                    <td className="px-7 py-4 text-xs text-slate-500 whitespace-nowrap">
                      {d.createdAt ? format(new Date(d.createdAt), 'dd MMMM yyyy à HH:mm', { locale: fr }) : '—'}
                    </td>
                    <td className="px-7 py-4 text-right">
                      <button
                        onClick={() => openPastLog(d.id, d.commitSha)}
                        title="Voir le journal complet de ce déploiement"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 text-xs font-bold transition-colors"
                      >
                        <Terminal className="w-3.5 h-3.5" />
                        Voir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* The endpoint caps limit at 50; stop offering more once we have it all. */}
            {history.pagination && history.items.length < history.pagination.total && (
              <div className="px-7 py-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs text-slate-500 font-medium">
                  {history.items.length} sur {history.pagination.total} déploiements
                </span>
                <button
                  onClick={() => setHistoryLimit((n) => Math.min(50, n + 10))}
                  disabled={historyLimit >= 50}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {historyLimit >= 50 ? 'Maximum affiché (50)' : 'Afficher plus'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Past deployment log */}
      {logModal && (
        <div
          className="fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md"
          onClick={() => setLogModal(null)}
        >
          <div
            className="bg-slate-900 rounded-3xl shadow-2xl max-w-4xl w-full border border-slate-800 overflow-hidden flex flex-col max-h-[85vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5 text-white">
                <Terminal className="w-4 h-4 text-indigo-400" />
                <span className="font-black text-sm">Journal du déploiement</span>
                {logModal.sha && (
                  <span className="px-2 py-0.5 bg-slate-800 rounded font-mono text-[11px] text-slate-300">
                    {logModal.sha.slice(0, 7)}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {pastLog && (
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(pastLog).then(
                        () => toast.success('Journal copié'),
                        () => toast.error('Copie impossible')
                      );
                    }}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white text-xs font-bold"
                  >
                    Copier
                  </button>
                )}
                <button
                  onClick={() => setLogModal(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 font-mono text-xs leading-relaxed text-slate-300 bg-slate-950">
              {loadingPastLog ? (
                <div className="flex items-center gap-2 text-slate-500">
                  <Loader2 className="w-4 h-4 animate-spin" /> Chargement du journal…
                </div>
              ) : !pastLogAvailable || !pastLog ? (
                <p className="text-slate-500">
                  Aucun journal disponible pour ce déploiement. Le fichier a été supprimé,
                  ou ce déploiement est antérieur à l'enregistrement des journaux.
                </p>
              ) : (
                pastLog.split('\n').map((line, i) => (
                  <div
                    key={i}
                    className={`whitespace-pre-wrap break-all ${
                      /error|failed|❌|DEPLOY_RESULT=FAILED/i.test(line)
                        ? 'text-rose-400'
                        : /warning|⚠️/i.test(line)
                          ? 'text-amber-400'
                          : /✅|DEPLOY_RESULT=SUCCESS/i.test(line)
                            ? 'text-emerald-400'
                            : ''
                    }`}
                  >
                    {line || ' '}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmOpen && (
        <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-8 border border-slate-100 space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/30">
                <Rocket className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900">Lancer le Déploiement Production ?</h3>
                <p className="text-xs text-slate-500">Mise à jour en direct de la plateforme silacod.com</p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-slate-500 font-medium">Commits prêts :</span>
                <span className="font-bold text-slate-900">{pending.length} commit(s)</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500 font-medium">Branche :</span>
                <span className="font-bold font-mono text-indigo-600">{status?.branch || 'master'}</span>
              </div>
            </div>

            <div className="space-y-2 text-xs text-slate-600">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>Le site web reste <strong>totalement accessible</strong> pour vos utilisateurs pendant la compilation.</span>
              </div>
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>La nouvelle version s'applique automatiquement dès la fin de la reconstruction.</span>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setConfirmOpen(false)}
                className="flex-1 py-3.5 rounded-2xl border border-slate-200 font-bold text-sm text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={runDeploy}
                className="flex-1 py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold text-sm shadow-lg shadow-indigo-500/25 transition-all"
              >
                Confirmer & Déployer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
