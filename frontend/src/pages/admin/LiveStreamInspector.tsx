import { useState, useEffect, useRef, useCallback } from 'react';
import { useSocket } from '../../contexts/SocketContext';
import { api } from '../../lib/api';
import { Replayer } from 'rrweb';
import 'rrweb/dist/style.css';
import {
  Radio, Users, Eye, RefreshCw, Search, Play, Pause, Clock, HardDrive,
  Globe, Activity, X, RotateCcw, CheckCircle2, ShoppingCart, Phone, Trash2, Database, ChevronDown,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, UserPlus, Mail, Store, Download,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface CheckoutInfo { fullName?: string; phone?: string; city?: string; filled: number; completed: boolean; }
interface SessionInfo { socketId: string; path: string; lastActive: number; checkout?: CheckoutInfo | null; }
interface CheckoutAttempt {
  id: string; sessionId: string; referralCode?: string; productName?: string;
  ip: string; path?: string; fullName?: string; phone?: string; city?: string; address?: string;
  fieldsFilled: number; completed: boolean; recordingId?: string | null; updatedAt: string; createdAt: string;
}
interface SignupAttempt {
  id: string; role?: string; fullName?: string; email?: string; phone?: string;
  maxStep: number; fieldsFilled: number; completed: boolean; ip: string;
  registeredLater?: boolean; updatedAt: string; createdAt: string;
}
interface StorageStats {
  recordings: number; totalBytes: number; oldestAt: string | null;
  attempts: { total: number; abandoned: number; converted: number };
  signups?: { total: number; abandoned: number; completed: number };
}
interface PlaybackTarget { id: string; ip: string; durationSec: number; }
interface ActiveUserItem {
  key: string;
  type: 'AUTHENTICATED' | 'ANONYMOUS';
  userUuid?: string;
  email?: string;
  fullName?: string;
  role?: string;
  ip: string;
  userAgent: string;
  tabsCount: number;
  pages: { path: string; count: number }[];
  sessions: SessionInfo[];
  lastActive: number;
}
interface SavedSession {
  id: string;
  userUuid?: string;
  ip: string;
  path?: string;
  durationSec: number;
  hasLead: boolean;
  createdAt: string;
}
interface WatchTarget { socketId: string; label: string; ip: string; path: string; }

// Slice events down to the last Meta(4)+FullSnapshot(2) so a Replayer bootstraps
// from a coherent DOM instead of replaying stale history.
function eventsFromLastSnapshot(events: any[]): any[] {
  let snap = -1;
  for (let i = events.length - 1; i >= 0; i--) if (events[i].type === 2) { snap = i; break; }
  if (snap < 0) return [];
  let start = snap;
  if (start > 0 && events[start - 1]?.type === 4) start -= 1;
  return events.slice(start);
}

// Scale the reconstructed page (recorded at the visitor's viewport size) to fit
// the admin's viewer box, preserving aspect ratio. `dims` (from rrweb's resize
// event) is the authoritative recorded viewport size — using it avoids fitting
// with stale fallback dimensions before the DOM is rebuilt (which clips the view).
function fitReplayer(
  replayer: Replayer,
  container: HTMLElement | null,
  dims?: { width: number; height: number },
) {
  const wrapper = (replayer as any).wrapper as HTMLElement | undefined;
  const iframe = (replayer as any).iframe as HTMLIFrameElement | undefined;
  if (!wrapper || !container) return;
  const wW = dims?.width || parseInt(wrapper.style.width) || (iframe && parseInt(iframe.getAttribute('width') || '')) || 1280;
  const wH = dims?.height || parseInt(wrapper.style.height) || (iframe && parseInt(iframe.getAttribute('height') || '')) || 720;
  const cW = container.clientWidth || 1;
  const cH = container.clientHeight || 1;
  const scale = Math.min(cW / wW, cH / wH, 1);
  wrapper.style.transformOrigin = 'top left';
  wrapper.style.transform = `scale(${scale})`;
  wrapper.style.position = 'absolute';
  wrapper.style.left = `${Math.max(0, (cW - wW * scale) / 2)}px`;
  wrapper.style.top = `${Math.max(0, (cH - wH * scale) / 2)}px`;
}

function PaginationControls({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}) {
  const [inputPage, setInputPage] = useState(String(currentPage));

  useEffect(() => {
    setInputPage(String(currentPage));
  }, [currentPage]);

  if (totalPages <= 1 && totalItems <= pageSize) {
    return (
      <div className="flex items-center justify-between pt-4 border-t border-gray-100 text-xs text-gray-400 font-medium">
        <span>Total: <strong className="text-gray-700">{totalItems}</strong> éléments</span>
      </div>
    );
  }

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible + 2) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      let start = Math.max(2, currentPage - 1);
      let end = Math.min(totalPages - 1, currentPage + 1);

      if (currentPage <= 3) {
        end = 4;
      } else if (currentPage >= totalPages - 2) {
        start = totalPages - 3;
      }

      if (start > 2) pages.push('...');
      for (let i = start; i <= end; i++) pages.push(i);
      if (end < totalPages - 1) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  };

  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  const handleJump = (e: React.FormEvent) => {
    e.preventDefault();
    const p = parseInt(inputPage, 10);
    if (!isNaN(p) && p >= 1 && p <= totalPages) {
      onPageChange(p);
    } else {
      setInputPage(String(currentPage));
    }
  };

  return (
    <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-4 border-t border-orange-100/60 bg-gradient-to-r from-orange-50/40 via-amber-50/20 to-orange-50/30 p-4 rounded-2xl border border-orange-100/80 shadow-xs">
      {/* Record info */}
      <div className="text-xs text-gray-600 font-medium">
        Affichage de <span className="font-black text-orange-600">{startItem}</span> à{' '}
        <span className="font-black text-orange-600">{endItem}</span> sur{' '}
        <span className="font-black text-gray-900">{totalItems.toLocaleString('fr-FR')}</span> enregistrements
      </div>

      {/* Pagination buttons */}
      <div className="flex items-center gap-1.5 flex-wrap justify-center">
        <button
          disabled={currentPage <= 1}
          onClick={() => onPageChange(1)}
          className="p-2 rounded-xl text-xs font-bold bg-white border border-gray-200 hover:border-orange-300 hover:bg-orange-50 text-gray-700 disabled:opacity-30 disabled:hover:bg-white disabled:hover:border-gray-200 transition-all shadow-xs"
          title="Première page"
        >
          <ChevronsLeft className="w-4 h-4" />
        </button>

        <button
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white border border-gray-200 hover:border-orange-300 hover:bg-orange-50 text-gray-700 disabled:opacity-30 disabled:hover:bg-white disabled:hover:border-gray-200 transition-all flex items-center gap-1.5 shadow-xs"
        >
          <ChevronLeft className="w-4 h-4 text-orange-500" /> Précédent
        </button>

        <div className="flex items-center gap-1">
          {getPageNumbers().map((p, idx) =>
            typeof p === 'number' ? (
              <button
                key={idx}
                onClick={() => onPageChange(p)}
                className={`w-8 h-8 rounded-xl text-xs font-black transition-all ${
                  currentPage === p
                    ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/30 scale-105'
                    : 'bg-white border border-gray-200 text-gray-700 hover:border-orange-300 hover:bg-orange-50'
                }`}
              >
                {p}
              </button>
            ) : (
              <span key={idx} className="px-1 text-xs text-gray-400 font-bold">
                ...
              </span>
            )
          )}
        </div>

        <button
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white border border-gray-200 hover:border-orange-300 hover:bg-orange-50 text-gray-700 disabled:opacity-30 disabled:hover:bg-white disabled:hover:border-gray-200 transition-all flex items-center gap-1.5 shadow-xs"
        >
          Suivant <ChevronRight className="w-4 h-4 text-orange-500" />
        </button>

        <button
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(totalPages)}
          className="p-2 rounded-xl text-xs font-bold bg-white border border-gray-200 hover:border-orange-300 hover:bg-orange-50 text-gray-700 disabled:opacity-30 disabled:hover:bg-white disabled:hover:border-gray-200 transition-all shadow-xs"
          title="Dernière page"
        >
          <ChevronsRight className="w-4 h-4" />
        </button>

        <form onSubmit={handleJump} className="flex items-center gap-1.5 ml-2 border-l border-gray-200 pl-3">
          <span className="text-[11px] text-gray-500 font-bold uppercase">Page</span>
          <input
            type="number"
            min={1}
            max={totalPages}
            value={inputPage}
            onChange={(e) => setInputPage(e.target.value)}
            className="w-12 px-2 py-1 text-center bg-white border border-gray-200 rounded-lg text-xs font-bold text-gray-800 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
          />
          <span className="text-xs text-gray-400 font-bold">/ {totalPages}</span>
          <button
            type="submit"
            className="px-2.5 py-1 bg-orange-500 hover:bg-orange-600 active:scale-95 text-white rounded-lg text-[10px] font-black uppercase transition-all shadow-xs"
          >
            Go
          </button>
        </form>
      </div>
    </div>
  );
}

export default function LiveStreamInspector() {
  const { socket } = useSocket();
  const [activeTab, setActiveTab] = useState<'LIVE' | 'HISTORY' | 'CHECKOUTS' | 'SIGNUPS'>('LIVE');

  const [realtime, setRealtime] = useState<{
    anonymousCount: number; totalActive: number; activeUsersList: ActiveUserItem[];
  }>({ anonymousCount: 0, totalActive: 0, activeUsersList: [] });

  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [watchTarget, setWatchTarget] = useState<WatchTarget | null>(null);
  const [status, setStatus] = useState('En attente de sélection…');

  // Global auto-recording toggle
  const [recordingEnabled, setRecordingEnabled] = useState(false);
  const [togglingRecord, setTogglingRecord] = useState(false);

  // Live replayer
  const liveContainerRef = useRef<HTMLDivElement>(null);
  const liveReplayerRef = useRef<Replayer | null>(null);
  const liveBufferRef = useRef<any[]>([]);
  const resizeObsRef = useRef<ResizeObserver | null>(null);

  // History
  const [savedSessions, setSavedSessions] = useState<SavedSession[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalSaved, setTotalSaved] = useState(0);
  const [historySearch, setHistorySearch] = useState('');

  // Storage stats
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [purging, setPurging] = useState(false);

  // Abandoned checkouts
  const [attempts, setAttempts] = useState<CheckoutAttempt[]>([]);
  const [attemptsLoading, setAttemptsLoading] = useState(false);
  const [attemptFilter, setAttemptFilter] = useState<'abandoned' | 'completed' | 'all'>('abandoned');
  const [attemptSearch, setAttemptSearch] = useState('');

  // Abandoned sign-ups (/register funnel)
  const [signups, setSignups] = useState<SignupAttempt[]>([]);
  const [signupsLoading, setSignupsLoading] = useState(false);
  const [signupFilter, setSignupFilter] = useState<'abandoned' | 'completed' | 'all'>('abandoned');
  const [signupRole, setSignupRole] = useState<'ALL' | 'VENDOR' | 'INFLUENCER'>('ALL');
  const [signupSearch, setSignupSearch] = useState('');
  const [attemptPage, setAttemptPage] = useState(1);
  const [attemptTotalPages, setAttemptTotalPages] = useState(1);
  const [attemptTotal, setAttemptTotal] = useState(0);
  const [exportingAttempts, setExportingAttempts] = useState(false);

  // Collapsed IP groups (keys prefixed with 'hist:' / 'co:' so the two tabs don't clash).
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const toggleGroup = (key: string) =>
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  // Playback modal
  const [playing, setPlaying] = useState<PlaybackTarget | null>(null);
  const playbackContainerRef = useRef<HTMLDivElement>(null);
  const playbackReplayerRef = useRef<Replayer | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [progress, setProgress] = useState(0); // 0..1
  const playMetaRef = useRef({ total: 0 });
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const playBaselineRef = useRef({ wallStart: 0, offset: 0 });

  const destroyLiveReplayer = useCallback(() => {
    resizeObsRef.current?.disconnect();
    resizeObsRef.current = null;
    if (liveReplayerRef.current) {
      try { (liveReplayerRef.current as any).pause?.(); liveReplayerRef.current.destroy?.(); } catch { /* noop */ }
      liveReplayerRef.current = null;
    }
    if (liveContainerRef.current) liveContainerRef.current.innerHTML = '';
    liveBufferRef.current = [];
  }, []);

  // ── Presence + recording setting ─────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;
    socket.emit('realtime:request-counts');
    const onUsers = (data: any) => setRealtime({
      anonymousCount: data.anonymousCount || 0,
      totalActive: data.totalActive || 0,
      activeUsersList: data.activeUsersList || [],
    });
    socket.on('realtime:active-users', onUsers);
    return () => { socket.off('realtime:active-users', onUsers); };
  }, [socket]);

  useEffect(() => {
    api.get('/admin/session-recording-setting')
      .then((r) => setRecordingEnabled(!!r.data.enabled))
      .catch(() => {});
  }, []);

  const toggleRecording = async () => {
    setTogglingRecord(true);
    try {
      const next = !recordingEnabled;
      const r = await api.patch('/admin/session-recording-setting', { enabled: next });
      setRecordingEnabled(!!r.data.enabled);
      toast.success(next ? 'Enregistrement automatique activé' : 'Enregistrement automatique désactivé');
    } catch {
      toast.error('Impossible de modifier le réglage');
    } finally {
      setTogglingRecord(false);
    }
  };

  // ── Start / switch a live watch ──────────────────────────────────────────
  const startWatch = (user: ActiveUserItem) => {
    if (!socket) return;
    const session = [...user.sessions].sort((a, b) => b.lastActive - a.lastActive)[0];
    if (!session) { toast.error('Aucun onglet actif pour cet utilisateur'); return; }

    if (watchTarget) socket.emit('stream:unwatch', { socketId: watchTarget.socketId });
    destroyLiveReplayer();

    const target: WatchTarget = {
      socketId: session.socketId,
      label: user.fullName || user.email || `Visiteur ${user.ip}`,
      ip: user.ip,
      path: session.path,
    };
    setWatchTarget(target);
    setStatus('Connexion au flux en direct…');
    socket.emit('stream:watch', { socketId: session.socketId });
  };

  // ── Live stream event handling ───────────────────────────────────────────
  useEffect(() => {
    if (!socket || !watchTarget) return;
    const targetId = watchTarget.socketId;

    const tryInit = () => {
      if (liveReplayerRef.current || !liveContainerRef.current) return;
      const slice = eventsFromLastSnapshot(liveBufferRef.current);
      if (slice.length === 0) {
        setStatus(`Mise en mémoire tampon (${liveBufferRef.current.length})…`);
        return;
      }
      try {
        liveContainerRef.current.innerHTML = '';
        const replayer = new Replayer(slice, {
          root: liveContainerRef.current,
          liveMode: true,
          mouseTail: false,
        });
        replayer.startLive(slice[0].timestamp);
        liveReplayerRef.current = replayer;
        setStatus('🟢 Flux en direct actif');

        const refit = (dims?: { width: number; height: number }) => fitReplayer(replayer, liveContainerRef.current, dims);
        // rrweb reports the true recorded viewport via 'resize'; refit once the
        // DOM is actually rebuilt so we never scale against fallback dimensions.
        replayer.on('resize', (p: any) => refit(p));
        replayer.on('fullsnapshot-rebuilded', () => setTimeout(() => refit(), 0));
        setTimeout(() => refit(), 60);
        setTimeout(() => refit(), 400);
        const ro = new ResizeObserver(() => refit());
        if (liveContainerRef.current) ro.observe(liveContainerRef.current);
        resizeObsRef.current = ro;
      } catch (err) {
        console.error('[LiveStream] init error', err);
        setStatus('Erreur d\'initialisation du lecteur');
      }
    };

    const onSnapshot = (data: { socketId: string; events: any[] }) => {
      if (data.socketId !== targetId || !data.events?.length) return;
      liveBufferRef.current.push(...data.events);
      tryInit();
    };
    const onDelta = (data: { socketId: string; events: any[] }) => {
      if (data.socketId !== targetId || !data.events?.length) return;
      if (liveReplayerRef.current) {
        data.events.forEach((e) => { try { liveReplayerRef.current!.addEvent(e); } catch { /* noop */ } });
      } else {
        liveBufferRef.current.push(...data.events);
        tryInit();
      }
    };
    const onEnded = (data: { socketId: string }) => {
      if (data.socketId !== targetId) return;
      setStatus('⚫ La session du visiteur est terminée');
    };

    socket.on('stream:snapshot', onSnapshot);
    socket.on('stream:delta', onDelta);
    socket.on('stream:ended', onEnded);
    return () => {
      socket.off('stream:snapshot', onSnapshot);
      socket.off('stream:delta', onDelta);
      socket.off('stream:ended', onEnded);
    };
  }, [socket, watchTarget]);

  // Stop watching on unmount.
  useEffect(() => () => {
    if (socket && watchTarget) socket.emit('stream:unwatch', { socketId: watchTarget.socketId });
    destroyLiveReplayer();
  }, [socket, watchTarget, destroyLiveReplayer]);

  // ── History ──────────────────────────────────────────────────────────────
  const fetchHistory = async (page = 1, search = historySearch) => {
    setLoadingHistory(true);
    try {
      const r = await api.get('/admin/sessions', { params: { page, limit: 15, search: search || undefined } });
      setSavedSessions(r.data.recordings || []);
      setTotalPages(r.data.totalPages || 1);
      setTotalSaved(r.data.total || 0);
      setHistoryPage(page);
    } catch {
      toast.error("Impossible de charger l'historique des sessions");
    } finally {
      setLoadingHistory(false);
    }
  };

  const fetchStats = async () => {
    try { const r = await api.get('/admin/sessions/stats'); setStats(r.data); } catch { /* noop */ }
  };

  const fetchAttempts = async (page = 1, filter = attemptFilter, search = attemptSearch) => {
    setAttemptsLoading(true);
    try {
      const r = await api.get('/admin/checkout-attempts', { params: { page, limit: 30, filter, search: search || undefined } });
      setAttempts(r.data.attempts || []);
      setAttemptTotalPages(r.data.totalPages || 1);
      setAttemptTotal(r.data.total || r.data.attempts?.length || 0);
      setAttemptPage(page);
    } catch {
      toast.error('Impossible de charger les paniers');
    } finally {
      setAttemptsLoading(false);
    }
  };

  const exportAttemptsToExcel = async () => {
    setExportingAttempts(true);
    const loadToast = toast.loading('Préparation de l\'export...');
    try {
      // Fetch up to 5000 records matching current search + filter to capture all items
      const r = await api.get('/admin/checkout-attempts', {
        params: {
          page: 1,
          limit: 5000,
          filter: attemptFilter,
          search: attemptSearch || undefined
        }
      });
      const allAttempts = r.data.attempts || [];
      if (allAttempts.length === 0) {
        toast.error('Aucun panier à exporter');
        return;
      }

      const headers = ['IP', 'Nom Complet', 'Téléphone', 'Ville', 'Statut', 'Champs Remplis', 'Produit', 'Code Parrainage', 'Date'];
      const rows = allAttempts.map((a: any) => [
        a.ip || '',
        a.fullName || '',
        a.phone || '',
        a.city || '',
        a.completed ? 'Commande validée' : 'Lead incomplet',
        `${a.fieldsFilled}/4`,
        a.productName || '',
        a.referralCode || '',
        new Date(a.updatedAt).toLocaleString('fr-FR')
      ]);

      // Excel-friendly UTF-8 CSV with BOM and semicolon delimiter
      const csvContent = '\uFEFF' + [
        headers.join(';'),
        ...rows.map((row: any[]) => row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(';'))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.setAttribute('download', `paniers_abandonnes_${attemptFilter}_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success(`${allAttempts.length} paniers exportés avec succès !`);
    } catch (err) {
      toast.error('Erreur lors de l\'export des paniers');
    } finally {
      toast.dismiss(loadToast);
      setExportingAttempts(false);
    }
  };

  const fetchSignups = async (filter = signupFilter, role = signupRole, search = signupSearch) => {
    setSignupsLoading(true);
    try {
      const r = await api.get('/admin/signup-attempts', { params: { page: 1, limit: 50, filter, role, search: search || undefined } });
      setSignups(r.data.attempts || []);
    } catch {
      toast.error('Impossible de charger les inscriptions');
    } finally {
      setSignupsLoading(false);
    }
  };

  const purgeStorage = async (target: 'history' | 'checkouts' | 'signups' = 'history') => {
    let label = 'l\'historique des sessions enregistrées';
    if (target === 'checkouts') label = 'les paniers non validés';
    if (target === 'signups') label = 'les inscriptions non finalisées';

    if (!window.confirm(`Voulez-vous vraiment purger ${label} ?`)) return;
    setPurging(true);
    try {
      const res = await api.post('/admin/sessions/purge', { target });
      const { purgedAttempts, purgedSignups, purgedRecordings } = res.data || {};
      if (target === 'history') {
        toast.success(`Purger terminé: ${purgedRecordings || 0} enregistrements supprimés.`);
      } else if (target === 'checkouts') {
        toast.success(`Purger terminé: ${purgedAttempts || 0} paniers non validés supprimés.`);
      } else if (target === 'signups') {
        toast.success(`Purger terminé: ${purgedSignups || 0} inscriptions supprimées.`);
      }
      fetchStats();
      if (activeTab === 'HISTORY') fetchHistory(1);
      if (activeTab === 'CHECKOUTS') fetchAttempts(1);
      if (activeTab === 'SIGNUPS') fetchSignups();
    } catch {
      toast.error('Erreur lors du nettoyage');
    } finally {
      setPurging(false);
    }
  };

  useEffect(() => { fetchStats(); /* eslint-disable-next-line */ }, []);
  useEffect(() => { if (activeTab === 'HISTORY') { fetchHistory(1); fetchStats(); } /* eslint-disable-next-line */ }, [activeTab]);
  useEffect(() => { if (activeTab === 'CHECKOUTS') { fetchAttempts(1); fetchStats(); } /* eslint-disable-next-line */ }, [activeTab, attemptFilter]);
  useEffect(() => { if (activeTab === 'SIGNUPS') { fetchSignups(); fetchStats(); } /* eslint-disable-next-line */ }, [activeTab, signupFilter, signupRole]);

  const stopProgressTimer = () => {
    if (progressTimerRef.current) { clearInterval(progressTimerRef.current); progressTimerRef.current = null; }
  };
  const startProgressTimer = () => {
    stopProgressTimer();
    progressTimerRef.current = setInterval(() => {
      const { wallStart, offset } = playBaselineRef.current;
      const elapsed = offset + (Date.now() - wallStart) * speed;
      const total = playMetaRef.current.total || 1;
      const ratio = Math.min(1, elapsed / total);
      setProgress(ratio);
      if (ratio >= 1) { stopProgressTimer(); setIsPaused(true); }
    }, 200);
  };

  const openPlayback = async (target: PlaybackTarget) => {
    setPlaying(target);
    setIsPaused(false);
    setProgress(0);
    setSpeed(1);
    try {
      const r = await api.get(`/admin/sessions/${target.id}/events`);
      const events = r.data.events || [];
      setTimeout(() => {
        if (!playbackContainerRef.current || events.length < 2) return;
        playbackContainerRef.current.innerHTML = '';
        const replayer = new Replayer(events, {
          root: playbackContainerRef.current,
          speed: 1,
          mouseTail: false,
        });
        playbackReplayerRef.current = replayer;
        const meta = replayer.getMetaData();
        playMetaRef.current.total = meta.totalTime || 0;
        const refit = (dims?: { width: number; height: number }) => fitReplayer(replayer, playbackContainerRef.current, dims);
        replayer.on('resize', (p: any) => refit(p));
        replayer.on('fullsnapshot-rebuilded', () => setTimeout(() => refit(), 0));
        setTimeout(() => refit(), 60);
        setTimeout(() => refit(), 400);
        replayer.play();
        playBaselineRef.current = { wallStart: Date.now(), offset: 0 };
        startProgressTimer();
      }, 150);
    } catch {
      toast.error('Erreur lors du chargement de la session');
    }
  };

  const togglePlayback = () => {
    const r = playbackReplayerRef.current;
    if (!r) return;
    if (isPaused) {
      const offset = (playMetaRef.current.total || 0) * progress;
      r.play(offset);
      playBaselineRef.current = { wallStart: Date.now(), offset };
      startProgressTimer();
      setIsPaused(false);
    } else {
      r.pause();
      const { wallStart, offset } = playBaselineRef.current;
      playBaselineRef.current.offset = offset + (Date.now() - wallStart) * speed;
      stopProgressTimer();
      setIsPaused(true);
    }
  };

  const restartPlayback = () => {
    const r = playbackReplayerRef.current;
    if (!r) return;
    r.play(0);
    playBaselineRef.current = { wallStart: Date.now(), offset: 0 };
    setProgress(0);
    setIsPaused(false);
    startProgressTimer();
  };

  const changeSpeed = (s: number) => {
    const r = playbackReplayerRef.current;
    if (!r) return;
    // Freeze current elapsed before changing rate so the timer stays accurate.
    const { wallStart, offset } = playBaselineRef.current;
    const elapsed = isPaused ? offset : offset + (Date.now() - wallStart) * speed;
    setSpeed(s);
    try { r.setConfig({ speed: s }); } catch { /* noop */ }
    playBaselineRef.current = { wallStart: Date.now(), offset: elapsed };
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = playbackReplayerRef.current;
    if (!r) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const offset = (playMetaRef.current.total || 0) * ratio;
    r.play(offset);
    playBaselineRef.current = { wallStart: Date.now(), offset };
    setProgress(ratio);
    setIsPaused(false);
    startProgressTimer();
  };

  const closePlayback = () => {
    stopProgressTimer();
    if (playbackReplayerRef.current) {
      try { playbackReplayerRef.current.pause(); playbackReplayerRef.current.destroy?.(); } catch { /* noop */ }
      playbackReplayerRef.current = null;
    }
    setPlaying(null);
  };

  // ── Derived ──────────────────────────────────────────────────────────────
  const filteredUsers = realtime.activeUsersList.filter((u) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q ||
      (u.fullName || u.email || u.ip || '').toLowerCase().includes(q) ||
      u.pages.some((p) => p.path.toLowerCase().includes(q));
    const matchesRole = roleFilter === 'ALL' ||
      (roleFilter === 'ANONYMOUS' && u.type === 'ANONYMOUS') || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const fmtDuration = (s: number) => (s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`);
  const fmtBytes = (b: number) => {
    if (b < 1024) return `${b} o`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} Ko`;
    return `${(b / (1024 * 1024)).toFixed(2)} Mo`;
  };

  // Group abandoned/completed attempts by IP so multiple tabs from one visitor
  // appear together.
  const attemptsByIp = Object.values(
    attempts.reduce((acc, a) => {
      (acc[a.ip] = acc[a.ip] || { ip: a.ip, items: [] as CheckoutAttempt[] }).items.push(a);
      return acc;
    }, {} as Record<string, { ip: string; items: CheckoutAttempt[] }>),
  );

  // Group saved recordings by IP as well (a visitor's multiple sessions/tabs).
  const sessionsByIp = Object.values(
    savedSessions.reduce((acc, s) => {
      (acc[s.ip] = acc[s.ip] || { ip: s.ip, items: [] as SavedSession[] }).items.push(s);
      return acc;
    }, {} as Record<string, { ip: string; items: SavedSession[] }>),
  );

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-gray-100 shadow-xs">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-red-500/10 text-red-600 flex items-center justify-center shrink-0">
            <Radio className="w-7 h-7 animate-pulse" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-900">Streaming Direct & Replay</h1>
            <p className="text-sm text-gray-500 font-medium">
              Regardez les visiteurs en direct, ou rejouez les sessions enregistrées.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Auto-record toggle */}
          <button
            onClick={toggleRecording}
            disabled={togglingRecord}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold border transition-all ${
              recordingEnabled
                ? 'bg-red-50 border-red-200 text-red-700'
                : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'
            }`}
            title="Active/désactive l'enregistrement automatique de toutes les sessions"
          >
            <span className={`w-2.5 h-2.5 rounded-full ${recordingEnabled ? 'bg-red-500 animate-pulse' : 'bg-gray-300'}`} />
            {recordingEnabled ? 'Enregistrement AUTO : ON' : 'Enregistrement AUTO : OFF'}
          </button>

          <div className="flex items-center bg-gray-100 p-1.5 rounded-2xl shrink-0">
            <button
              onClick={() => setActiveTab('LIVE')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${activeTab === 'LIVE' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
            >
              <Radio className="w-4 h-4 text-red-500" /> En Direct ({realtime.totalActive})
            </button>
            <button
              onClick={() => setActiveTab('HISTORY')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${activeTab === 'HISTORY' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
            >
              <Clock className="w-4 h-4 text-blue-500" /> Historique ({totalSaved})
            </button>
            <button
              onClick={() => setActiveTab('CHECKOUTS')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${activeTab === 'CHECKOUTS' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
            >
              <ShoppingCart className="w-4 h-4 text-orange-500" /> Paniers ({stats?.attempts.abandoned ?? 0})
            </button>
            <button
              onClick={() => setActiveTab('SIGNUPS')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${activeTab === 'SIGNUPS' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
            >
              <UserPlus className="w-4 h-4 text-violet-500" /> Inscriptions ({stats?.signups?.abandoned ?? 0})
            </button>
          </div>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard icon={<Activity className="w-6 h-6" />} color="emerald" value={realtime.totalActive} label="En Ligne" />
        <MetricCard icon={<Users className="w-6 h-6" />} color="blue" value={realtime.totalActive - realtime.anonymousCount} label="Authentifiés" />
        <MetricCard icon={<Globe className="w-6 h-6" />} color="amber" value={realtime.anonymousCount} label="Anonymes" />
        <MetricCard icon={<HardDrive className="w-6 h-6" />} color="purple" value={stats?.recordings ?? totalSaved} label="Sessions Sauvées" />
      </div>

      {/* TAB 1: LIVE */}
      {activeTab === 'LIVE' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* User list */}
          <div className="lg:col-span-5 bg-white p-5 rounded-3xl border border-gray-100 shadow-xs flex flex-col h-[750px]">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-black text-gray-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-gray-400" /> Visiteurs En Direct
              </h2>
              <span className="text-xs font-bold text-gray-400">{filteredUsers.length}</span>
            </div>

            <div className="space-y-3 mb-4">
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
                <input
                  type="text" placeholder="Rechercher par nom, IP ou URL…"
                  value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-orange-500/20"
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {['ALL', 'ANONYMOUS', 'VENDOR', 'INFLUENCER', 'CALL_CENTER_AGENT', 'SUPER_ADMIN'].map((r) => (
                  <button key={r} onClick={() => setRoleFilter(r)}
                    className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase transition-all ${roleFilter === r ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                    {r === 'ALL' ? 'Tous' : r === 'ANONYMOUS' ? 'Invité' : r}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {filteredUsers.length === 0 ? (
                <div className="text-center py-12 text-gray-400 text-sm font-medium">Aucun visiteur actif.</div>
              ) : filteredUsers.map((user) => {
                const isSelected = watchTarget?.socketId && user.sessions.some((s) => s.socketId === watchTarget.socketId);
                const currentPath = [...user.sessions].sort((a, b) => b.lastActive - a.lastActive)[0]?.path || '/';
                const co = user.sessions.map((s) => s.checkout).find((c) => c && c.phone);
                return (
                  <div key={user.key} onClick={() => startWatch(user)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${isSelected ? 'border-red-500 bg-red-50/20 ring-2 ring-red-500/20' : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50/50'}`}>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${user.type === 'AUTHENTICATED' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                        {user.type === 'AUTHENTICATED' ? (user.fullName?.[0]?.toUpperCase() || 'U') : 'G'}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-gray-900 truncate">{user.fullName || user.email || `Visiteur ${user.ip}`}</span>
                          <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase bg-gray-100 text-gray-600">{user.role || 'Invité'}</span>
                          {user.tabsCount > 1 && <span className="text-[9px] font-bold text-gray-400">{user.tabsCount} onglets</span>}
                        </div>
                        <div className="text-[11px] text-gray-400 font-mono mt-0.5 truncate">
                          {user.ip} • <span className="text-gray-600 font-bold">{currentPath}</span>
                        </div>
                        {co && (
                          <div className={`mt-1.5 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-black ${co.completed ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                            <Phone className="w-3 h-3" />
                            {co.phone}
                            <span className="opacity-70">• {co.completed ? 'commandé' : 'panier non validé'}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    {isSelected
                      ? <span className="text-[10px] font-black text-red-600 bg-red-100 px-2 py-1 rounded-lg animate-pulse shrink-0">🔴 EN DIRECT</span>
                      : <Eye className="w-4 h-4 text-gray-300 shrink-0" />}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Live viewer */}
          <div className="lg:col-span-7 bg-gray-900 p-5 rounded-3xl border border-gray-800 shadow-xl flex flex-col h-[750px] relative overflow-hidden">
            {watchTarget ? (
              <>
                <div className="flex items-center justify-between pb-4 border-b border-gray-800 shrink-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-3 h-3 rounded-full bg-red-500 animate-ping shrink-0" />
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-white truncate">{watchTarget.label}</h3>
                      <p className="text-xs text-gray-400 font-mono truncate">{watchTarget.path} • {watchTarget.ip}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => { if (socket) { destroyLiveReplayer(); socket.emit('stream:watch', { socketId: watchTarget.socketId }); setStatus('Resynchronisation…'); } }}
                    className="px-3 py-1.5 bg-gray-800 text-gray-300 hover:text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Sync
                  </button>
                </div>
                <div className="flex-1 my-4 bg-black rounded-2xl overflow-hidden relative border border-gray-800">
                  <div className="absolute top-2 left-2 z-10 px-2 py-1 bg-black/70 rounded-lg text-[10px] text-gray-300 font-mono">{status}</div>
                  <div ref={liveContainerRef} className="w-full h-full relative" />
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                <div className="w-16 h-16 rounded-3xl bg-gray-800 text-gray-500 flex items-center justify-center mb-4"><Radio className="w-8 h-8" /></div>
                <h3 className="text-lg font-bold text-white mb-1">Aucune Session Sélectionnée</h3>
                <p className="text-xs text-gray-400 max-w-sm">Sélectionnez un visiteur à gauche pour démarrer le streaming en direct.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: HISTORY */}
      {activeTab === 'HISTORY' && (
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-xs space-y-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-lg font-black text-gray-900">Historique des Sessions</h2>
              <p className="text-xs text-gray-500">Sessions enregistrées (Gzip), purgées automatiquement après 7 jours.</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                <input
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') fetchHistory(1); }}
                  placeholder="IP, URL ou utilisateur…"
                  className="pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-orange-500/20"
                />
              </div>
              <button onClick={() => fetchHistory(1)} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl flex items-center gap-2">
                <RefreshCw className="w-3.5 h-3.5" /> Actualiser
              </button>
            </div>
          </div>

          {/* Storage management strip */}
          <div className="flex flex-wrap items-center gap-3 p-4 bg-gray-50 rounded-2xl">
            <StoragePill icon={<Database className="w-4 h-4" />} label="Enregistrements" value={String(stats?.recordings ?? 0)} />
            <StoragePill icon={<HardDrive className="w-4 h-4" />} label="Stockage" value={fmtBytes(stats?.totalBytes ?? 0)} />
            <StoragePill icon={<ShoppingCart className="w-4 h-4" />} label="Paniers abandonnés" value={String(stats?.attempts.abandoned ?? 0)} />
            <StoragePill icon={<CheckCircle2 className="w-4 h-4" />} label="Commandes validées" value={String(stats?.attempts.converted ?? 0)} />
            {stats?.oldestAt && (
              <span className="text-[11px] text-gray-400 font-medium">Plus ancien : {new Date(stats.oldestAt).toLocaleDateString('fr-FR')}</span>
            )}
            <button
              onClick={() => purgeStorage('history')}
              disabled={purging}
              className="ml-auto px-3.5 py-2 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold rounded-xl flex items-center gap-2 disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" /> {purging ? 'Nettoyage…' : 'Purger maintenant'}
            </button>
          </div>

          {loadingHistory ? (
            <div className="text-center py-12 text-gray-400 font-medium">Chargement…</div>
          ) : savedSessions.length === 0 ? (
            <div className="text-center py-12 text-gray-400 font-medium">Aucune session enregistrée.</div>
          ) : (
            <>
              <div className="space-y-4">
                {sessionsByIp.map((group) => {
                  const gkey = `hist:${group.ip}`;
                  const collapsed = collapsedGroups.has(gkey);
                  return (
                    <div key={group.ip} className="border border-orange-200/70 rounded-2xl overflow-hidden shadow-xs transition-all">
                      <button 
                        onClick={() => toggleGroup(gkey)} 
                        className="w-full flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-orange-50/80 via-amber-50/40 to-orange-50/20 border-b border-orange-100 hover:from-orange-100/90 hover:to-amber-100/70 transition-all text-left group"
                      >
                        <ChevronDown className={`w-4 h-4 text-orange-500 transition-transform duration-200 ${collapsed ? '-rotate-90' : ''}`} />
                        <div className="w-7 h-7 rounded-xl bg-orange-500/10 text-orange-600 flex items-center justify-center font-bold">
                          <Globe className="w-4 h-4 text-orange-600" />
                        </div>
                        <span className="font-mono font-black text-xs text-gray-900 group-hover:text-orange-600 transition-colors">{group.ip}</span>
                        <span className="ml-auto px-2.5 py-0.5 rounded-full text-[10px] font-black bg-orange-500 text-white shadow-xs">
                          {group.items.length} {group.items.length === 1 ? 'session' : 'sessions'}
                        </span>
                      </button>
                      {!collapsed && (
                        <div className="divide-y divide-gray-50 bg-white">
                          {group.items.map((s) => (
                            <div key={s.id} className="flex items-center gap-4 px-4 py-3 hover:bg-orange-50/30 transition-colors flex-wrap text-xs">
                              <span className="font-bold text-gray-700 truncate max-w-[240px] flex-1 min-w-[160px]">{s.path || '/'}</span>
                              {s.userUuid && <span className="font-mono text-gray-400 bg-gray-100 px-2 py-0.5 rounded-md text-[10px]">User {s.userUuid.slice(0, 8)}</span>}
                              <span className="font-bold text-gray-900 bg-gray-50 px-2 py-0.5 rounded-md">{fmtDuration(s.durationSec)}</span>
                              {s.hasLead && <span className="inline-flex items-center gap-1 text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100"><CheckCircle2 className="w-3.5 h-3.5" /> Lead</span>}
                              <span className="text-gray-400 text-[11px]">{new Date(s.createdAt).toLocaleString('fr-FR')}</span>
                              <button onClick={() => openPlayback(s)} className="ml-auto px-3.5 py-1.5 bg-orange-500 hover:bg-orange-600 active:scale-95 text-white rounded-xl font-bold text-xs inline-flex items-center gap-1.5 shadow-xs transition-all">
                                <Play className="w-3.5 h-3.5 fill-current" /> Revoir
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <PaginationControls
                currentPage={historyPage}
                totalPages={totalPages}
                totalItems={totalSaved}
                pageSize={15}
                onPageChange={(p) => fetchHistory(p)}
              />
            </>
          )}
        </div>
      )}

      {/* TAB 3: ABANDONED CHECKOUTS */}
      {activeTab === 'CHECKOUTS' && (
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-xs space-y-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-lg font-black text-gray-900">Paniers & Leads Incomplets</h2>
              <p className="text-xs text-gray-500">Données saisies dans le checkout — même sans validation. Groupé par IP.</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center bg-gray-100 p-1 rounded-xl">
                {(['abandoned', 'completed', 'all'] as const).map((f) => (
                  <button key={f} onClick={() => setAttemptFilter(f)}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${attemptFilter === f ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
                    {f === 'abandoned' ? 'Non validés' : f === 'completed' ? 'Validés' : 'Tous'}
                  </button>
                ))}
              </div>
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                <input
                  value={attemptSearch}
                  onChange={(e) => setAttemptSearch(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') fetchAttempts(1); }}
                  placeholder="Téléphone, nom, IP, code…"
                  className="pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-orange-500/20"
                />
              </div>
              <button onClick={() => fetchAttempts(1)} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl flex items-center gap-2 transition-all">
                <RefreshCw className="w-3.5 h-3.5" /> Actualiser
              </button>
              <button 
                onClick={exportAttemptsToExcel}
                disabled={exportingAttempts}
                className="px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 active:scale-95 text-white text-xs font-bold rounded-xl flex items-center gap-2 transition-all shadow-xs disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5" /> Exporter Excel
              </button>
            </div>
          </div>

          {/* Storage management strip */}
          <div className="flex flex-wrap items-center gap-3 p-4 bg-gray-50 rounded-2xl">
            <StoragePill icon={<Database className="w-4 h-4" />} label="Enregistrements" value={String(stats?.recordings ?? 0)} />
            <StoragePill icon={<HardDrive className="w-4 h-4" />} label="Stockage" value={fmtBytes(stats?.totalBytes ?? 0)} />
            <StoragePill icon={<ShoppingCart className="w-4 h-4" />} label="Paniers abandonnés" value={String(stats?.attempts.abandoned ?? 0)} />
            <StoragePill icon={<CheckCircle2 className="w-4 h-4" />} label="Commandes validées" value={String(stats?.attempts.converted ?? 0)} />
            {stats?.oldestAt && (
              <span className="text-[11px] text-gray-400 font-medium">Plus ancien : {new Date(stats.oldestAt).toLocaleDateString('fr-FR')}</span>
            )}
            <button
              onClick={() => purgeStorage('checkouts')}
              disabled={purging}
              className="ml-auto px-3.5 py-2 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold rounded-xl flex items-center gap-2 disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" /> {purging ? 'Nettoyage…' : 'Purger les paniers'}
            </button>
          </div>

          {attemptsLoading ? (
            <div className="text-center py-12 text-gray-400 font-medium">Chargement…</div>
          ) : attemptsByIp.length === 0 ? (
            <div className="text-center py-12 text-gray-400 font-medium">Aucun panier à afficher.</div>
          ) : (
            <>
              <div className="space-y-4">
                {attemptsByIp.map((group) => {
                  const gkey = `co:${group.ip}`;
                  const collapsed = collapsedGroups.has(gkey);
                  return (
                    <div key={group.ip} className="border border-orange-200/70 rounded-2xl overflow-hidden shadow-xs transition-all">
                      <button 
                        onClick={() => toggleGroup(gkey)} 
                        className="w-full flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-orange-50/80 via-amber-50/40 to-orange-50/20 border-b border-orange-100 hover:from-orange-100/90 hover:to-amber-100/70 transition-all text-left group"
                      >
                        <ChevronDown className={`w-4 h-4 text-orange-500 transition-transform duration-200 ${collapsed ? '-rotate-90' : ''}`} />
                        <div className="w-7 h-7 rounded-xl bg-orange-500/10 text-orange-600 flex items-center justify-center font-bold">
                          <Globe className="w-4 h-4 text-orange-600" />
                        </div>
                        <span className="font-mono font-black text-xs text-gray-900 group-hover:text-orange-600 transition-colors">{group.ip}</span>
                        <span className="ml-auto px-2.5 py-0.5 rounded-full text-[10px] font-black bg-orange-500 text-white shadow-xs">
                          {group.items.length} {group.items.length === 1 ? 'onglet' : 'onglets'}
                        </span>
                      </button>
                      {!collapsed && (
                        <div className="divide-y divide-gray-50 bg-white">
                          {group.items.map((a) => (
                            <div key={a.id} className="flex items-center gap-4 px-4 py-3 hover:bg-orange-50/30 transition-colors flex-wrap">
                              <div className="flex-1 min-w-[180px]">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-bold text-sm text-gray-900">{a.fullName || <span className="text-gray-400 font-medium">Nom non saisi</span>}</span>
                                  {a.completed
                                    ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-100 text-emerald-700"><CheckCircle2 className="w-3 h-3" /> Commande validée</span>
                                    : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-red-100 text-red-700">Lead incomplet</span>}
                                </div>
                                <div className="text-[11px] text-gray-400 mt-0.5">
                                  {a.productName || a.referralCode || a.path || '—'} • {a.fieldsFilled}/4 champs • {new Date(a.updatedAt).toLocaleString('fr-FR')}
                                </div>
                              </div>
                              {a.phone ? (
                                <a href={`tel:${a.phone}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-black bg-orange-50 text-orange-600 hover:bg-orange-100">
                                  <Phone className="w-4 h-4" /> {a.phone}
                                </a>
                              ) : <span className="text-xs text-gray-300">pas de numéro</span>}
                              {a.city && <span className="text-xs text-gray-500 font-medium">{a.city}</span>}
                              {a.recordingId ? (
                                <button onClick={() => openPlayback({ id: a.recordingId!, ip: a.ip, durationSec: 0 })}
                                  className="px-3.5 py-1.5 bg-orange-500 hover:bg-orange-600 active:scale-95 text-white rounded-xl font-bold text-xs inline-flex items-center gap-1.5 shadow-xs transition-all">
                                  <Play className="w-3.5 h-3.5 fill-current" /> Revoir
                                </button>
                              ) : <span className="text-[10px] text-gray-300 font-medium">pas d'enregistrement</span>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <PaginationControls
                currentPage={attemptPage}
                totalPages={attemptTotalPages}
                totalItems={attemptTotal}
                pageSize={30}
                onPageChange={(p) => fetchAttempts(p)}
              />
            </>
          )}
        </div>
      )}

      {/* TAB 4: ABANDONED SIGN-UPS (/register funnel) */}
      {activeTab === 'SIGNUPS' && (
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-xs space-y-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-lg font-black text-gray-900">Inscriptions Incomplètes</h2>
              <p className="text-xs text-gray-500">
                Visiteurs ayant commencé « Je suis Vendeur / Créateur » sans finaliser. Le mot de passe n'est jamais enregistré.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center bg-gray-100 p-1 rounded-xl">
                {(['abandoned', 'completed', 'all'] as const).map((f) => (
                  <button key={f} onClick={() => setSignupFilter(f)}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${signupFilter === f ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
                    {f === 'abandoned' ? 'Non finalisées' : f === 'completed' ? 'Finalisées' : 'Toutes'}
                  </button>
                ))}
              </div>
              <div className="flex items-center bg-gray-100 p-1 rounded-xl">
                {(['ALL', 'VENDOR', 'INFLUENCER'] as const).map((r) => (
                  <button key={r} onClick={() => setSignupRole(r)}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${signupRole === r ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
                    {r === 'ALL' ? 'Tous' : r === 'VENDOR' ? 'Vendeur' : 'Créateur'}
                  </button>
                ))}
              </div>
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                <input
                  value={signupSearch}
                  onChange={(e) => setSignupSearch(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') fetchSignups(); }}
                  placeholder="Email, téléphone, nom, IP…"
                  className="pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-orange-500/20"
                />
              </div>
              <button onClick={() => fetchSignups()} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl flex items-center gap-2">
                <RefreshCw className="w-3.5 h-3.5" /> Actualiser
              </button>
            </div>
          </div>

          {/* Storage management strip */}
          <div className="flex flex-wrap items-center gap-3 p-4 bg-gray-50 rounded-2xl">
            <StoragePill icon={<Database className="w-4 h-4" />} label="Enregistrements" value={String(stats?.recordings ?? 0)} />
            <StoragePill icon={<HardDrive className="w-4 h-4" />} label="Stockage" value={fmtBytes(stats?.totalBytes ?? 0)} />
            <StoragePill icon={<ShoppingCart className="w-4 h-4" />} label="Paniers abandonnés" value={String(stats?.attempts.abandoned ?? 0)} />
            <StoragePill icon={<CheckCircle2 className="w-4 h-4" />} label="Commandes validées" value={String(stats?.attempts.converted ?? 0)} />
            {stats?.oldestAt && (
              <span className="text-[11px] text-gray-400 font-medium">Plus ancien : {new Date(stats.oldestAt).toLocaleDateString('fr-FR')}</span>
            )}
            <button
              onClick={() => purgeStorage('signups')}
              disabled={purging}
              className="ml-auto px-3.5 py-2 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold rounded-xl flex items-center gap-2 disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" /> {purging ? 'Nettoyage…' : 'Purger les inscriptions'}
            </button>
          </div>

          {/* Funnel summary */}
          <div className="flex flex-wrap items-center gap-3 p-4 bg-gray-50/60 rounded-2xl border border-gray-100">
            <StoragePill icon={<UserPlus className="w-4 h-4" />} label="Inscriptions commencées" value={String(stats?.signups?.total ?? 0)} />
            <StoragePill icon={<Users className="w-4 h-4" />} label="Non finalisées" value={String(stats?.signups?.abandoned ?? 0)} />
            <StoragePill icon={<CheckCircle2 className="w-4 h-4" />} label="Comptes créés" value={String(stats?.signups?.completed ?? 0)} />
            {!!stats?.signups?.total && (
              <StoragePill
                icon={<Activity className="w-4 h-4" />}
                label="Taux de conversion"
                value={`${Math.round(((stats.signups.completed || 0) / stats.signups.total) * 100)}%`}
              />
            )}
          </div>

          {signupsLoading ? (
            <div className="text-center py-12 text-gray-400 font-medium">Chargement…</div>
          ) : signups.length === 0 ? (
            <div className="text-center py-12 text-gray-400 font-medium">Aucune inscription à afficher.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-100 text-[10px] font-black uppercase text-gray-400 tracking-wider">
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Visiteur</th>
                    <th className="py-3 px-4">Contact</th>
                    <th className="py-3 px-4">Étape atteinte</th>
                    <th className="py-3 px-4">Statut</th>
                    <th className="py-3 px-4">Dernière activité</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 text-xs">
                  {signups.map((s) => (
                    <tr key={s.id} className="hover:bg-gray-50/50">
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black ${
                          s.role === 'VENDOR' ? 'bg-orange-100 text-orange-700' : 'bg-violet-100 text-violet-700'
                        }`}>
                          {s.role === 'VENDOR' ? <Store className="w-3 h-3" /> : <Users className="w-3 h-3" />}
                          {s.role === 'VENDOR' ? 'Vendeur' : s.role === 'INFLUENCER' ? 'Créateur' : '—'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-gray-900">{s.fullName || <span className="text-gray-400 font-medium">Nom non saisi</span>}</div>
                        <div className="text-[10px] text-gray-400 font-mono">{s.ip}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        {s.email && (
                          <a href={`mailto:${s.email}`} className="flex items-center gap-1.5 text-blue-600 font-bold hover:underline">
                            <Mail className="w-3.5 h-3.5" /> {s.email}
                          </a>
                        )}
                        {s.phone && (
                          <a href={`tel:${s.phone}`} className="flex items-center gap-1.5 text-emerald-600 font-bold hover:underline mt-0.5">
                            <Phone className="w-3.5 h-3.5" /> {s.phone}
                          </a>
                        )}
                        {!s.email && !s.phone && <span className="text-gray-300">—</span>}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          {[1, 2, 3, 4].map((n) => (
                            <span key={n} className={`w-5 h-5 rounded-md flex items-center justify-center text-[9px] font-black ${
                              n <= s.maxStep ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-300'
                            }`}>{n}</span>
                          ))}
                          <span className="text-[10px] text-gray-400 ml-1">{s.maxStep}/4</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        {s.completed ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-100 text-emerald-700">
                            <CheckCircle2 className="w-3 h-3" /> Compte créé
                          </span>
                        ) : s.registeredLater ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-blue-100 text-blue-700">
                            Inscrit plus tard
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-red-100 text-red-700">
                            Abandonné
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-gray-400">{new Date(s.updatedAt).toLocaleString('fr-FR')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Playback modal */}
      {playing && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-gray-900 w-full max-w-5xl rounded-3xl border border-gray-800 overflow-hidden flex flex-col h-[85vh]">
            <div className="p-4 bg-gray-950 border-b border-gray-800 flex items-center justify-between text-white">
              <span className="font-bold text-sm flex items-center gap-2">
                <Play className="w-5 h-5 text-orange-500 fill-current" /> {playing.ip} • {fmtDuration(playing.durationSec)}
              </span>
              <button onClick={closePlayback} className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-gray-800"><X className="w-5 h-5" /></button>
            </div>

            <div className="flex-1 bg-black overflow-hidden relative">
              <div ref={playbackContainerRef} className="w-full h-full relative" />
            </div>

            {/* Controls */}
            <div className="p-4 bg-gray-950 border-t border-gray-800 space-y-3">
              <div className="h-1.5 bg-gray-700 rounded-full cursor-pointer" onClick={seek}>
                <div className="h-full bg-orange-500 rounded-full" style={{ width: `${progress * 100}%` }} />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button onClick={togglePlayback} className="p-2 rounded-lg bg-gray-800 text-white hover:bg-gray-700">
                    {isPaused ? <Play className="w-4 h-4 fill-current" /> : <Pause className="w-4 h-4" />}
                  </button>
                  <button onClick={restartPlayback} className="p-2 rounded-lg bg-gray-800 text-gray-300 hover:text-white"><RotateCcw className="w-4 h-4" /></button>
                </div>
                <div className="flex items-center gap-1">
                  {[0.5, 1, 2, 4, 8].map((s) => (
                    <button key={s} onClick={() => changeSpeed(s)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${speed === s ? 'bg-orange-500 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
                      {s}×
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({ icon, color, value, label }: { icon: React.ReactNode; color: string; value: number; label: string; }) {
  const colors: Record<string, string> = {
    emerald: 'bg-emerald-50 text-emerald-600',
    blue: 'bg-blue-50 text-blue-600',
    amber: 'bg-amber-50 text-amber-600',
    purple: 'bg-purple-50 text-purple-600',
  };
  return (
    <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-xs flex items-center gap-4">
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${colors[color]}`}>{icon}</div>
      <div>
        <div className="text-2xl font-black text-gray-900">{value}</div>
        <div className="text-xs font-bold text-gray-400 uppercase">{label}</div>
      </div>
    </div>
  );
}

function StoragePill({ icon, label, value }: { icon: React.ReactNode; label: string; value: string; }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-xl border border-gray-100">
      <span className="text-gray-400">{icon}</span>
      <div>
        <div className="text-sm font-black text-gray-900 leading-none">{value}</div>
        <div className="text-[10px] font-bold text-gray-400 uppercase mt-0.5">{label}</div>
      </div>
    </div>
  );
}
