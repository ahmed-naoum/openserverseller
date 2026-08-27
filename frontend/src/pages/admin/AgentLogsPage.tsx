/**
 * SUPER_ADMIN — « Journal de l'agent WhatsApp ».
 *
 * Ce que les deux autres pages de la section ne peuvent pas dire : ce que le
 * modèle a REÇU, ce qu'il a RÉPONDU, ce que WhatsApp en a fait, et où ça a
 * cassé. Une ligne par action, les deux process mélangés dans un seul fil
 * chronologique, parce qu'une panne se lit dans l'ordre où elle est arrivée et
 * pas process par process.
 *
 * TROIS CHOSES GUIDENT LA MISE EN PAGE :
 *
 *   La liste ne charge JAMAIS les payloads. Cinquante requêtes modèle, c'est
 *   plusieurs mégaoctets pour un écran qui n'en affiche qu'une ligne chacune.
 *   Le corps arrive quand on ouvre une ligne, jamais avant.
 *
 *   Le suivi en direct est incrémental. On ne recharge pas la page toutes les
 *   cinq secondes : on demande « ce qui est arrivé après l'id que j'ai déjà »,
 *   ce qui reste léger même sur un compte bavard.
 *
 *   La pagination est par curseur. La table grossit pendant qu'on la lit ; avec
 *   des numéros de page, une conversation active suffirait à faire réapparaître
 *   les mêmes lignes en page 2 en en cachant d'autres.
 *
 * Ces lignes contiennent des messages clients : la route est SUPER_ADMIN, comme
 * la boîte de réception du vendeur, et elles expirent (WA_LOG_RETENTION_DAYS).
 */

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  AlertOctagon,
  AlertTriangle,
  Bot,
  Brain,
  ChevronDown,
  Clock,
  Copy,
  Coins,
  Database,
  Info,
  Loader2,
  MessageSquare,
  Mic,
  PhoneCall,
  Play,
  Plug,
  RefreshCw,
  Search,
  Send,
  ServerCog,
  ScrollText,
  Gauge,
  Trash2,
  UserRound,
  Volume2,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import WaModelHealth from '../../components/admin/WaModelHealth';
import { waAdminApi } from '../../lib/waAgentApi';
import { formatDuration, jidToLabel, waLogsApi } from '../../lib/waLogsApi';
import type {
  WaLogCategory,
  WaLogDetail,
  WaLogFilters,
  WaLogLevel,
  WaLogList,
  WaLogRow,
  WaLogStats,
} from '../../lib/waLogsApi';

/* ------------------------------------------------------------------ */
/* constantes                                                          */
/* ------------------------------------------------------------------ */

const PAGE_SIZE = 60;

/** Toutes les 5 s en suivi live : la cadence du drain sortant du worker. */
const LIVE_INTERVAL_MS = 5000;

/**
 * Plafond de lignes gardées en mémoire par le suivi live.
 *
 * Sans lui, un onglet laissé ouvert une nuit sur un compte actif finit par
 * garder des dizaines de milliers de nœuds et fige l'onglet. Au-delà, les plus
 * anciennes sont oubliées — elles restent dans la base, il suffit de recharger.
 */
const MAX_ROWS = 600;

const LEVEL_META: Record<WaLogLevel, { label: string; tone: string; dot: string; icon: LucideIcon }> = {
  DEBUG: {
    label: 'Détail',
    tone: 'bg-gray-100 text-gray-500 border-gray-200',
    dot: 'bg-gray-300',
    icon: Info,
  },
  INFO: {
    label: 'Info',
    tone: 'bg-sky-50 text-sky-700 border-sky-200',
    dot: 'bg-sky-400',
    icon: Info,
  },
  WARN: {
    label: 'Attention',
    tone: 'bg-amber-50 text-amber-700 border-amber-200',
    dot: 'bg-amber-400',
    icon: AlertTriangle,
  },
  ERROR: {
    label: 'Erreur',
    tone: 'bg-rose-50 text-rose-700 border-rose-200',
    dot: 'bg-rose-500',
    icon: AlertOctagon,
  },
};

/**
 * Ce que chaque catégorie recouvre, en une phrase.
 *
 * `help` dit à quoi sert le filtre, pas ce que le mot veut dire : c'est la
 * différence entre « Cerveau » et « les allers-retours avec le modèle ».
 */
const CATEGORY_META: Record<WaLogCategory, { label: string; icon: LucideIcon; tone: string; help: string }> = {
  SESSION: {
    label: 'Session',
    icon: Plug,
    tone: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    help: 'Connexion WhatsApp : QR, connexion, déconnexion, bannissement.',
  },
  INBOUND: {
    label: 'Reçu',
    icon: MessageSquare,
    tone: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    help: 'Les messages des clients, tels qu’ils entrent dans le système.',
  },
  OUTBOUND: {
    label: 'Envoyé',
    icon: Send,
    tone: 'bg-primary-50 text-primary-700 border-primary-100',
    help: 'Ce qui est réellement parti vers le client, et les échecs d’envoi.',
  },
  BRAIN: {
    label: 'Modèle',
    icon: Brain,
    tone: 'bg-violet-50 text-violet-700 border-violet-200',
    help: 'Les appels au modèle : ce qui lui est envoyé, ce qu’il répond, ses outils.',
  },
  STT: {
    label: 'Transcription',
    icon: Mic,
    tone: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    help: 'Les notes vocales des clients converties en texte.',
  },
  TTS: {
    label: 'Voix',
    icon: Volume2,
    tone: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200',
    help: 'La synthèse des réponses vocales et ses replis d’un moteur à l’autre.',
  },
  CREDITS: {
    label: 'Crédits',
    icon: Coins,
    tone: 'bg-amber-50 text-amber-700 border-amber-200',
    help: 'Débits de crédits IA et réponses bloquées faute de solde.',
  },
  LEAD: {
    label: 'Leads',
    icon: UserRound,
    tone: 'bg-teal-50 text-teal-700 border-teal-200',
    help: 'Les conversations confirmées promues en vrais leads.',
  },
  API: {
    label: 'Tableau de bord',
    icon: PhoneCall,
    tone: 'bg-slate-100 text-slate-700 border-slate-200',
    help: 'Ce qu’un humain a demandé depuis l’interface, et la réponse reçue.',
  },
  WORKER: {
    label: 'Worker',
    icon: ServerCog,
    tone: 'bg-gray-100 text-gray-600 border-gray-200',
    help: 'Le process lui-même : démarrages, arrêts, cycles en échec.',
  },
};

const PERIODS = [
  { key: '1', label: 'Dernière heure' },
  { key: '24', label: 'Dernières 24 h' },
  { key: '168', label: '7 derniers jours' },
  { key: 'all', label: 'Tout le journal' },
];

const LEVEL_FILTERS: { key: string; label: string }[] = [
  { key: 'all', label: 'Tout' },
  { key: 'problems', label: 'Problèmes' },
  { key: 'ERROR', label: 'Erreurs' },
  { key: 'INFO', label: 'Info' },
  { key: 'DEBUG', label: 'Détail' },
];

interface AccountOption {
  uuid: string;
  name: string;
  email: string;
}

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

const formatCount = (n: number): string => new Intl.NumberFormat('fr-FR').format(n || 0);

const clock = (iso: string): string => format(new Date(iso), 'HH:mm:ss', { locale: fr });
const day = (iso: string): string => format(new Date(iso), 'd MMM', { locale: fr });

/** « il y a 3 min ». Une heure exacte ne dit pas si le journal est vivant. */
function since(iso: string | null): string {
  if (!iso) return 'jamais';
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return `il y a ${seconds} s`;
  if (seconds < 3600) return `il y a ${Math.round(seconds / 60)} min`;
  if (seconds < 86_400) return `il y a ${Math.round(seconds / 3600)} h`;
  return `il y a ${Math.round(seconds / 86_400)} j`;
}

/** Le début d'une période, ou undefined pour « tout le journal ». */
function periodStart(hours: string): string | undefined {
  if (hours === 'all') return undefined;
  return new Date(Date.now() - Number(hours) * 3600 * 1000).toISOString();
}

/* ------------------------------------------------------------------ */
/* page                                                                */
/* ------------------------------------------------------------------ */

export default function AgentLogsPage() {
  const [rows, setRows] = useState<WaLogRow[]>([]);
  const [stats, setStats] = useState<WaLogStats | null>(null);
  const [accounts, setAccounts] = useState<AccountOption[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState<number | null>(null);

  // Filtres
  const [searchInput, setSearchInput] = useState('');
  const [q, setQ] = useState('');
  const [account, setAccount] = useState('all');
  const [level, setLevel] = useState('all');
  const [category, setCategory] = useState('all');
  const [source, setSource] = useState('all');
  const [period, setPeriod] = useState('24');

  /**
   * Deux lectures du MÊME journal, pas deux pages.
   *
   * « Journal » répond à « qu'est-ce qui s'est passé, dans l'ordre ». « Modèles »
   * répond à « lequel de mes moteurs marche ». Les deux se lisent avec la même
   * période et le même compte, donc les filtres sont partagés plutôt que
   * dupliqués : changer de vue ne doit pas changer ce qu'on regarde.
   */
  const [view, setView] = useState<'journal' | 'models'>('journal');

  /**
   * Le bouton « Actualiser » de l'en-tête sert les DEUX vues.
   *
   * La vue Modèles va chercher son propre agrégat — elle a sa propre source et
   * son propre coût de requête — donc on ne peut pas l'actualiser en appelant
   * load(). Un jeton qu'on incrémente est ce qui relie un bouton unique à deux
   * chargements distincts, plutôt que deux boutons pour la même intention.
   */
  const [modelsReload, setModelsReload] = useState(0);

  const [live, setLive] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [detail, setDetail] = useState<WaLogDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [purging, setPurging] = useState(false);
  const [confirmPurge, setConfirmPurge] = useState(false);

  /**
   * L'id le plus récent déjà affiché.
   *
   * Une ref et pas un state : le timer du suivi live le lit à chaque tick, et
   * en state il fermerait sur une valeur périmée à chaque re-render.
   */
  const newestId = useRef<number>(0);

  const filters: WaLogFilters = useMemo(
    () => ({
      account,
      level,
      category,
      source,
      q: q || undefined,
      from: periodStart(period),
    }),
    [account, level, category, source, q, period]
  );

  const filtered =
    q !== '' || account !== 'all' || level !== 'all' || category !== 'all' || source !== 'all';

  /* ---------------- recherche différée ---------------- */

  useEffect(() => {
    const timer = setTimeout(() => setQ(searchInput.trim()), 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  /* ---------------- chargement ---------------- */

  const load = useCallback(
    async (silent = false) => {
      if (silent) setRefreshing(true);
      else setLoading(true);
      setError(null);

      try {
        const [listRes, statsRes] = await Promise.all([
          waLogsApi.list({ ...filters, limit: PAGE_SIZE }),
          waLogsApi.stats({ hours: period === 'all' ? 168 : Number(period), account }),
        ]);

        const payload = listRes.data.data as WaLogList;
        setRows(payload.logs || []);
        setCursor(payload.nextCursor);
        newestId.current = payload.newestId || 0;
        setStats(statsRes.data.data as WaLogStats);
      } catch (err: any) {
        setError(err?.response?.data?.message || "Le journal n'a pas pu être chargé.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [filters, period, account]
  );

  useEffect(() => {
    void load();
    // Une ligne ouverte n'a plus de sens quand la liste sous elle a changé.
    setExpanded(null);
    setDetail(null);
  }, [load]);

  /* ---------------- comptes, pour le filtre ---------------- */

  useEffect(() => {
    void (async () => {
      try {
        const res = await waAdminApi.accounts({ status: 'enabled', limit: 100 });
        const payload = res.data.data as { accounts?: { uuid: string; name: string; email: string }[] };
        setAccounts(
          (payload.accounts || []).map((a) => ({ uuid: a.uuid, name: a.name, email: a.email }))
        );
      } catch {
        // Le filtre par compte devient indisponible, le journal reste lisible :
        // pas de quoi bloquer la page.
      }
    })();
  }, []);

  /* ---------------- suivi en direct ---------------- */

  useEffect(() => {
    // Le suivi live alimente la LISTE. Sur la vue Modèles il n'y a pas de liste
    // à alimenter, et laisser le timer tourner ferait une requête toutes les
    // cinq secondes pour un écran qui ne les affiche pas.
    if (!live || loading || view !== 'journal') return;

    const tick = async () => {
      try {
        const res = await waLogsApi.list({ ...filters, limit: PAGE_SIZE, after: newestId.current });
        const payload = res.data.data as WaLogList;
        const fresh = payload.logs || [];
        if (!fresh.length) return;

        newestId.current = Math.max(newestId.current, payload.newestId || 0);
        setRows((current) => {
          // Dédoublonnage : un tick lancé pendant un rechargement manuel peut
          // rapporter des lignes déjà présentes.
          const seen = new Set(current.map((r) => r.id));
          const merged = [...fresh.filter((r) => !seen.has(r.id)), ...current];
          return merged.length > MAX_ROWS ? merged.slice(0, MAX_ROWS) : merged;
        });
      } catch {
        // Un tick raté n'est pas une panne : le suivant reprendra au même id.
      }
    };

    const timer = setInterval(() => void tick(), LIVE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [live, loading, filters, view]);

  /* ---------------- pagination ---------------- */

  const loadMore = async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await waLogsApi.list({ ...filters, limit: PAGE_SIZE, before: cursor });
      const payload = res.data.data as WaLogList;
      setRows((current) => [...current, ...(payload.logs || [])]);
      setCursor(payload.nextCursor);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Impossible de charger la suite du journal.');
    } finally {
      setLoadingMore(false);
    }
  };

  /* ---------------- détail d'une ligne ---------------- */

  const toggleRow = async (row: WaLogRow) => {
    if (expanded === row.id) {
      setExpanded(null);
      setDetail(null);
      return;
    }

    setExpanded(row.id);
    setDetail(null);
    setDetailLoading(true);
    try {
      const res = await waLogsApi.detail(row.id);
      setDetail(res.data.data as WaLogDetail);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Le détail de cette ligne est introuvable.');
      setExpanded(null);
    } finally {
      setDetailLoading(false);
    }
  };

  /* ---------------- entretien ---------------- */

  const runPrune = async () => {
    setPurging(true);
    try {
      const res = await waLogsApi.prune();
      const removed = (res.data.data as { removed: number })?.removed ?? 0;
      toast.success(
        removed
          ? `${formatCount(removed)} ligne(s) expirée(s) supprimée(s).`
          : 'Rien à supprimer : aucune ligne n’a dépassé la rétention.'
      );
      await load(true);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'La purge a échoué.');
    } finally {
      setPurging(false);
    }
  };

  const runPurge = async () => {
    setPurging(true);
    try {
      const res = await waLogsApi.purge(filters);
      const removed = (res.data.data as { removed: number })?.removed ?? 0;
      toast.success(`${formatCount(removed)} ligne(s) supprimée(s).`);
      setConfirmPurge(false);
      await load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'La suppression a échoué.');
    } finally {
      setPurging(false);
    }
  };

  /* ---------------- rendu ---------------- */

  const errors = stats?.byLevel?.ERROR ?? 0;
  const warnings = stats?.byLevel?.WARN ?? 0;

  return (
    <div className="space-y-6 p-1">
      {/* En-tête */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black text-slate-900 tracking-tight">
            <ScrollText className="h-6 w-6 text-primary-500" />
            Journal de l&apos;agent WhatsApp
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Chaque action de l&apos;agent, dans l&apos;ordre : le message du client, ce qui a été
            envoyé au modèle, ce qu&apos;il a répondu, ce qui est parti sur WhatsApp — et les
            erreurs.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded-xl border border-gray-200 bg-white p-1">
            {[
              { key: 'journal' as const, label: 'Journal', icon: ScrollText },
              { key: 'models' as const, label: 'Modèles', icon: Gauge },
            ].map((tab) => {
              const TabIcon = tab.icon;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setView(tab.key)}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                    view === tab.key
                      ? 'bg-slate-900 text-white'
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  <TabIcon size={14} />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {view === 'journal' && (
          <button
            type="button"
            onClick={() => setLive((v) => !v)}
            title={live ? 'Arrêter le suivi en direct' : 'Suivre le journal en direct'}
            className={`inline-flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold rounded-xl border transition-colors ${
              live
                ? 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700'
                : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
            }`}
          >
            <span className="relative flex h-2 w-2">
              {live && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
              )}
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${live ? 'bg-white' : 'bg-gray-400'}`}
              />
            </span>
            {live ? 'En direct' : 'En pause'}
          </button>
          )}

          <button
            type="button"
            onClick={() => (view === 'models' ? setModelsReload((n) => n + 1) : void load(true))}
            disabled={refreshing}
            title="Actualiser"
            className="p-2.5 bg-white border border-gray-200 text-gray-500 rounded-xl hover:text-primary-600 hover:border-primary-100 transition-all shadow-sm disabled:opacity-50"
          >
            <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
          </button>

          {view === 'journal' && (
          <button
            type="button"
            onClick={() => void runPrune()}
            disabled={purging}
            title="Appliquer la rétention maintenant (supprime les lignes expirées)"
            className="p-2.5 bg-white border border-gray-200 text-gray-500 rounded-xl hover:text-amber-600 hover:border-amber-100 transition-all shadow-sm disabled:opacity-50"
          >
            {purging ? <Loader2 size={18} className="animate-spin" /> : <Database size={18} />}
          </button>
          )}
        </div>
      </div>

      {/* ============================== MODÈLES ============================== */}
      {view === 'models' && (
        <>
          {/*
            Le même compte et la même période que le journal, mais sans le reste
            de la barre de filtres : chercher un texte ou un niveau n'a pas de
            sens sur un agrégat par modèle, et un filtre qui ne fait rien est
            pire qu'un filtre absent.
          */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="flex flex-col lg:flex-row gap-3">
              <select
                value={account}
                onChange={(e) => setAccount(e.target.value)}
                className="input lg:w-72"
                aria-label="Filtrer par compte"
              >
                <option value="all">Tous les comptes</option>
                {accounts.map((a) => (
                  <option key={a.uuid} value={a.uuid}>
                    {a.name}
                  </option>
                ))}
              </select>

              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="input lg:w-52"
                aria-label="Filtrer par période"
              >
                {PERIODS.map((pp) => (
                  <option key={pp.key} value={pp.key}>
                    {pp.label}
                  </option>
                ))}
              </select>

              <p className="flex-1 self-center text-xs leading-relaxed text-gray-500">
                Ces chiffres ne comptent que les lignes du journal, donc rien avant le{' '}
                {stats?.oldestStoredAt ? day(stats.oldestStoredAt) : 'début de la rétention'} :
                un modèle retiré de la circulation avant cette date n&apos;apparaît pas ici.
              </p>
            </div>
          </div>

          <WaModelHealth
            hours={period === 'all' ? 168 : Number(period)}
            account={account}
            periodLabel={(PERIODS.find((pp) => pp.key === period)?.label || '').toLowerCase()}
            reloadToken={modelsReload}
          />
        </>
      )}

      {/* ============================== JOURNAL ============================== */}
      {view === 'journal' && (
      <>
      {/* Totaux */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        <StatCard
          icon={ScrollText}
          label="Événements"
          value={formatCount(stats?.total ?? 0)}
          hint={
            period === 'all'
              ? 'Sur les 7 derniers jours'
              : `Sur ${PERIODS.find((p) => p.key === period)?.label.toLowerCase() ?? 'la période'}`
          }
          tone="bg-indigo-50 text-indigo-600"
        />
        <StatCard
          icon={AlertOctagon}
          label="Erreurs"
          value={formatCount(errors)}
          hint={errors ? 'À regarder en premier' : 'Rien à signaler'}
          tone={errors ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}
          alert={errors > 0}
        />
        <StatCard
          icon={AlertTriangle}
          label="Avertissements"
          value={formatCount(warnings)}
          hint="Replis, réessais, envois différés"
          tone="bg-amber-50 text-amber-600"
        />
        <StatCard
          icon={Clock}
          label="Dernier événement"
          value={since(stats?.lastEventAt ?? null)}
          hint={
            stats?.storedRows
              ? `${formatCount(stats.storedRows)} ligne(s) conservées${
                  stats.oldestStoredAt ? ` depuis le ${day(stats.oldestStoredAt)}` : ''
                }`
              : 'Journal vide'
          }
          tone="bg-sky-50 text-sky-600"
          alert={!stats?.lastEventAt}
        />
      </div>

      {/* Comptes qui produisent les erreurs */}
      {!!stats?.topErrorAccounts?.length && (
        <div className="bg-white rounded-2xl border border-rose-100 shadow-sm p-4">
          <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest">
            Comptes en erreur sur la période
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {stats.topErrorAccounts.map((a) => (
              <button
                key={a.userId}
                type="button"
                onClick={() => a.uuid && setAccount(a.uuid)}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-xs font-semibold hover:bg-rose-100 transition-colors"
              >
                <Bot size={12} />
                {a.name}
                <span className="tabular-nums font-black">{formatCount(a.errors)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Filtres */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute start-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Rechercher un message, un événement, une erreur, un numéro…"
              className="input ps-11 pe-10"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => setSearchInput('')}
                title="Effacer la recherche"
                className="absolute end-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 rounded-lg transition-colors"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <select
            value={account}
            onChange={(e) => setAccount(e.target.value)}
            className="input lg:w-60"
            aria-label="Filtrer par compte"
          >
            <option value="all">Tous les comptes</option>
            {accounts.map((a) => (
              <option key={a.uuid} value={a.uuid}>
                {a.name}
              </option>
            ))}
          </select>

          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="input lg:w-52"
            aria-label="Filtrer par catégorie"
          >
            <option value="all">Toutes les catégories</option>
            {(Object.keys(CATEGORY_META) as WaLogCategory[]).map((key) => (
              <option key={key} value={key}>
                {CATEGORY_META[key].label}
              </option>
            ))}
          </select>

          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="input lg:w-44"
            aria-label="Filtrer par période"
          >
            {PERIODS.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {LEVEL_FILTERS.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setLevel(option.key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                level === option.key
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
              }`}
            >
              {option.label}
            </button>
          ))}

          <span className="mx-1 h-5 w-px bg-gray-200" />

          {[
            { key: 'all', label: 'Les deux process' },
            { key: 'worker', label: 'Worker' },
            { key: 'api', label: 'Tableau de bord' },
          ].map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setSource(option.key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                source === option.key
                  ? 'bg-primary-600 text-white border-primary-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
              }`}
            >
              {option.label}
            </button>
          ))}

          {filtered && (
            <button
              type="button"
              onClick={() => setConfirmPurge(true)}
              className="ms-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-rose-200 bg-white text-rose-600 hover:bg-rose-50 transition-colors"
            >
              <Trash2 size={13} />
              Supprimer ces lignes
            </button>
          )}
        </div>

        {category !== 'all' && (
          <p className="text-xs text-gray-500">{CATEGORY_META[category as WaLogCategory]?.help}</p>
        )}
      </div>

      {/* Journal */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <LogSkeleton />
        ) : error ? (
          <div className="px-6 py-16 text-center">
            <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <AlertOctagon size={30} />
            </div>
            <h3 className="text-base font-black text-gray-900">Journal indisponible</h3>
            <p className="mt-1.5 text-sm text-gray-500">{error}</p>
          </div>
        ) : rows.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4 text-gray-400">
              <ScrollText size={30} />
            </div>
            <h3 className="text-base font-black text-gray-900">Aucun événement</h3>
            <p className="mt-1.5 text-sm text-gray-500 max-w-md mx-auto leading-relaxed">
              {filtered
                ? 'Rien ne correspond à ces filtres sur cette période. Élargissez la période ou remettez le niveau sur « Tout ».'
                : "L'agent n'a encore rien fait, ou le worker WhatsApp n'est pas démarré. Le niveau « Détail » (WA_LOG_LEVEL) montre aussi les allers-retours avec le modèle."}
            </p>
          </div>
        ) : (
          <div className={`transition-opacity ${refreshing ? 'opacity-60' : ''}`}>
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60 text-[10px] font-black uppercase tracking-widest text-gray-400">
                  <th className="py-3.5 ps-6 pe-3 text-start w-28">Heure</th>
                  <th className="py-3.5 px-3 text-start w-32">Niveau</th>
                  <th className="py-3.5 px-3 text-start w-36">Catégorie</th>
                  <th className="py-3.5 px-3 text-start">Événement</th>
                  <th className="py-3.5 px-3 text-start w-52">Compte / conversation</th>
                  <th className="py-3.5 ps-3 pe-6 text-end w-32">Durée</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((row) => {
                  const isOpen = expanded === row.id;
                  const levelMeta = LEVEL_META[row.level] ?? LEVEL_META.INFO;
                  const categoryMeta = CATEGORY_META[row.category];
                  const CategoryIcon = categoryMeta?.icon ?? Bot;

                  return (
                    <Fragment key={row.id}>
                      <tr
                        onClick={() => void toggleRow(row)}
                        className={`cursor-pointer transition-colors ${
                          isOpen
                            ? 'bg-primary-50/40'
                            : row.level === 'ERROR'
                              ? 'bg-rose-50/40 hover:bg-rose-50/70'
                              : 'hover:bg-gray-50/70'
                        }`}
                      >
                        <td className="py-3 ps-6 pe-3 align-top">
                          <p className="text-xs font-bold text-gray-700 tabular-nums">
                            {clock(row.createdAt)}
                          </p>
                          <p className="text-[10px] text-gray-400 tabular-nums">{day(row.createdAt)}</p>
                        </td>

                        <td className="py-3 px-3 align-top">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest border ${levelMeta.tone}`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${levelMeta.dot}`} />
                            {levelMeta.label}
                          </span>
                        </td>

                        <td className="py-3 px-3 align-top">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest border ${
                              categoryMeta?.tone ?? 'bg-gray-100 text-gray-600 border-gray-200'
                            }`}
                          >
                            <CategoryIcon size={10} />
                            {categoryMeta?.label ?? row.category}
                          </span>
                          <p className="mt-1 text-[10px] text-gray-400 font-mono truncate max-w-[9rem]">
                            {row.event}
                          </p>
                        </td>

                        <td className="py-3 px-3 align-top">
                          <div className="flex items-start gap-2">
                            <ChevronDown
                              size={14}
                              className={`mt-0.5 text-gray-300 shrink-0 transition-transform ${
                                isOpen ? 'rotate-180 text-primary-500' : ''
                              }`}
                            />
                            <div className="min-w-0">
                              <p className="text-sm text-gray-800 leading-snug">{row.message}</p>
                              {row.errorText && (
                                <p className="mt-1 text-xs text-rose-600 font-medium leading-snug line-clamp-2">
                                  {row.errorText}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-3 align-top">
                          {row.account ? (
                            <p className="text-xs font-bold text-gray-700 truncate max-w-[12rem]">
                              {row.account.name}
                            </p>
                          ) : (
                            <p className="text-xs font-semibold text-gray-400">Plateforme</p>
                          )}
                          {(row.contactName || row.contactJid) && (
                            <p className="text-[11px] text-gray-500 truncate max-w-[12rem]">
                              {row.contactName || jidToLabel(row.contactJid)}
                            </p>
                          )}
                          <span className="mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-widest bg-gray-50 border border-gray-200 text-gray-400">
                            {row.source === 'worker' ? 'Worker' : 'API'}
                          </span>
                        </td>

                        <td className="py-3 ps-3 pe-6 align-top text-end">
                          <p className="text-xs font-bold text-gray-700 tabular-nums">
                            {formatDuration(row.durationMs)}
                          </p>
                          {(row.inputTokens || row.outputTokens) && (
                            <p className="text-[10px] text-gray-400 tabular-nums">
                              {formatCount(row.inputTokens || 0)} ↓ / {formatCount(row.outputTokens || 0)} ↑
                            </p>
                          )}
                        </td>
                      </tr>

                      {isOpen && (
                        <tr className="bg-gray-50/70">
                          <td colSpan={6} className="p-0">
                            <LogDetailPanel loading={detailLoading} detail={detail} row={row} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/60">
              <p className="text-xs text-gray-500 tabular-nums">
                {formatCount(rows.length)} ligne(s) affichée(s)
                {live && <span className="ms-2 text-emerald-600 font-semibold">· suivi en direct</span>}
              </p>
              {cursor ? (
                <button
                  type="button"
                  onClick={() => void loadMore()}
                  disabled={loadingMore}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-40"
                >
                  {loadingMore ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                  Charger plus ancien
                </button>
              ) : (
                <p className="text-xs text-gray-400">Début du journal atteint.</p>
              )}
            </div>
          </div>
        )}
      </div>
      </>
      )}

      {/* Confirmation de suppression */}
      {confirmPurge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 w-full max-w-md overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100">
              <h3 className="text-base font-black text-gray-900">Supprimer ces lignes ?</h3>
              <p className="mt-1 text-sm text-gray-500">
                Seules les lignes correspondant aux filtres actuels sont supprimées. C&apos;est
                définitif — le journal n&apos;est pas un registre d&apos;audit, rien ne le
                reconstruira.
              </p>
            </div>
            <div className="px-6 py-4 flex items-center justify-end gap-2 bg-gray-50/60">
              <button
                type="button"
                onClick={() => setConfirmPurge(false)}
                className="px-3.5 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => void runPurge()}
                disabled={purging}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-rose-600 border border-rose-600 rounded-xl hover:bg-rose-700 disabled:opacity-50"
              >
                {purging ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* le détail d'une ligne                                               */
/* ------------------------------------------------------------------ */

/**
 * Ce qui est parti, ce qui est revenu, et le fil de la conversation autour.
 *
 * Les trois payloads sont montrés bruts. C'est délibéré : une mise en forme
 * « jolie » d'un appel modèle cache exactement ce qu'on vient y chercher — le
 * champ en trop, le bloc vide, l'outil appelé avec un argument inattendu.
 */
function LogDetailPanel({
  loading,
  detail,
  row,
}: {
  loading: boolean;
  detail: WaLogDetail | null;
  row: WaLogRow;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-gray-400">
        <Loader2 size={16} className="animate-spin" />
        <span className="text-sm">Chargement du détail…</span>
      </div>
    );
  }

  if (!detail) {
    return <div className="py-10 text-center text-sm text-gray-400">Détail indisponible.</div>;
  }

  const { log, contact, context } = detail;

  return (
    <div className="p-6 space-y-5 border-t border-gray-100">
      {/* Identité de la ligne */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetaCell label="Événement" value={log.event} mono />
        <MetaCell
          label="Horodatage"
          value={format(new Date(log.createdAt), 'd MMMM yyyy, HH:mm:ss', { locale: fr })}
        />
        <MetaCell label="Process" value={log.source === 'worker' ? 'Worker WhatsApp' : 'API / tableau de bord'} />
        <MetaCell label="Durée" value={formatDuration(log.durationMs)} />
        {log.account && <MetaCell label="Compte" value={`${log.account.name} · ${log.account.email}`} />}
        {contact && (
          <MetaCell
            label="Conversation"
            value={`${contact.pushName || 'Client'} · ${contact.phone || jidToLabel(contact.jid)}`}
          />
        )}
        {log.turnId && <MetaCell label="Tour" value={`#${log.turnId}`} mono />}
        {log.messageWaId && <MetaCell label="Message WhatsApp" value={log.messageWaId} mono />}
        {(log.inputTokens || log.outputTokens) && (
          <MetaCell
            label="Jetons"
            value={`${formatCount(log.inputTokens || 0)} entrée / ${formatCount(log.outputTokens || 0)} sortie`}
          />
        )}
      </div>

      {log.errorText && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
          <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest">Erreur</p>
          <p className="mt-1.5 text-sm text-rose-800 leading-relaxed break-words">{log.errorText}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <JsonBlock title="Requête" subtitle="Ce qui est parti" value={log.request} />
        <JsonBlock title="Réponse" subtitle="Ce qui est revenu" value={log.response} />
      </div>

      {!!log.meta && <JsonBlock title="Contexte technique" subtitle="Modèle, tentative, statut" value={log.meta} />}

      {/* Le fil de la conversation */}
      {!!context.length && (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/60">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
              Autour de cette ligne, sur la même conversation
            </p>
          </div>
          <ul className="divide-y divide-gray-100">
            {context.map((item) => {
              const meta = LEVEL_META[item.level] ?? LEVEL_META.INFO;
              return (
                <li key={item.id} className="flex items-start gap-3 px-4 py-2.5">
                  <span className={`mt-1.5 h-1.5 w-1.5 rounded-full shrink-0 ${meta.dot}`} />
                  <span className="text-[11px] text-gray-400 tabular-nums shrink-0 w-16">
                    {clock(item.createdAt)}
                  </span>
                  <span className="text-[11px] font-mono text-gray-400 shrink-0 w-32 truncate">
                    {item.event}
                  </span>
                  <span className="text-xs text-gray-700 leading-snug">{item.message}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {row.contactId && (
        <p className="text-xs text-gray-400">
          Conversation #{row.contactId} — filtrez sur ce compte pour voir tout son fil.
        </p>
      )}
    </div>
  );
}

function MetaCell({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-3 py-2">
      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{label}</p>
      <p className={`mt-0.5 text-xs text-gray-800 break-words ${mono ? 'font-mono' : 'font-semibold'}`}>
        {value}
      </p>
    </div>
  );
}

/**
 * Un payload JSON, copiable.
 *
 * Le bouton « copier » n'est pas décoratif : ces objets partent dans un ticket
 * ou dans une conversation avec le fournisseur du modèle, et les re-saisir à la
 * main est exactement là où on perd le champ qui expliquait la panne.
 */
function JsonBlock({ title, subtitle, value }: { title: string; subtitle: string; value: unknown }) {
  const text = useMemo(() => {
    if (value === null || value === undefined) return null;
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }, [value]);

  const copy = async () => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copié.');
    } catch {
      toast.error('Copie impossible depuis ce navigateur.');
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-gray-100 bg-gray-50/60">
        <div>
          <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{title}</p>
          <p className="text-[10px] text-gray-400">{subtitle}</p>
        </div>
        {text && (
          <button
            type="button"
            onClick={() => void copy()}
            title="Copier"
            className="p-1.5 text-gray-400 hover:text-primary-600 rounded-lg transition-colors"
          >
            <Copy size={14} />
          </button>
        )}
      </div>
      {text ? (
        <pre className="max-h-96 overflow-auto p-4 text-[11px] leading-relaxed text-gray-700 font-mono whitespace-pre-wrap break-words">
          {text}
        </pre>
      ) : (
        <p className="px-4 py-6 text-xs text-gray-400 text-center">
          Rien enregistré ici — l&apos;événement n&apos;en portait pas, ou WA_LOG_PAYLOADS est sur
          false.
        </p>
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone,
  alert,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint?: string;
  tone: string;
  alert?: boolean;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className={`p-2.5 rounded-xl ${tone}`}>
          <Icon size={18} />
        </div>
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{label}</p>
      </div>
      <p className="mt-4 text-3xl font-black text-gray-900 tabular-nums">{value}</p>
      {hint && (
        <p className={`mt-1 text-xs font-medium ${alert ? 'text-rose-500' : 'text-gray-400'}`}>{hint}</p>
      )}
    </div>
  );
}

function LogSkeleton() {
  return (
    <div className="divide-y divide-gray-100">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-6 py-4 animate-pulse">
          <div className="h-3 w-16 bg-gray-100 rounded" />
          <div className="h-4 w-20 bg-gray-100 rounded-md" />
          <div className="h-4 w-24 bg-gray-100 rounded-md" />
          <div className="h-3 flex-1 bg-gray-100 rounded" />
          <div className="h-3 w-24 bg-gray-100 rounded" />
        </div>
      ))}
    </div>
  );
}
