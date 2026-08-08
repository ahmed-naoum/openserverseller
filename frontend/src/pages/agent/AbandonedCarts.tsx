import { useState, useEffect, useCallback, useRef } from 'react';
import { leadsApi, api } from '../../lib/api';
import toast from 'react-hot-toast';
import { Replayer } from 'rrweb';
import 'rrweb/dist/style.css';
import {
  ShoppingCart, Phone, Search, RefreshCw, Globe, MapPin, Package,
  UserPlus, CheckCircle2, ChevronDown, Loader2, AlertTriangle,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Play, Pause, RotateCcw, X,
  PhoneOff, Lock, Timer, Eye, VolumeX,
} from 'lucide-react';
import { extractInputTimeline, type InputTimeline } from '../../lib/replayInputs';
import {
  ReplayInputTimeline, ReplayInputTicks, type CapturedField,
} from '../../components/common/ReplayInputTimeline';
import { checkPhoneCompleteness, maskPhone } from '../../utils/phoneCompleteness';

interface Cart {
  id: string;
  ip: string;
  phone?: string;
  fullName?: string;
  city?: string;
  address?: string;
  referralCode?: string;
  productName?: string;
  productImage?: string;
  sellerName?: string;
  fieldsFilled: number;
  /** This agent already owns a lead for this number. */
  alreadyHasLead?: boolean;
  /** The number already exists as a Lead anywhere in the database. */
  savedAsLead?: boolean;
  /** This cart was already converted into a lead from this page. */
  converted?: boolean;
  recordingId?: string;
  updatedAt: string;
}

type CartStatus = 'all' | 'unsaved' | 'converted';
type PhoneFilter = 'all' | 'complete' | 'incomplete';

interface Counts {
  all: number;
  unsaved: number;
  complete: number;
  incomplete: number;
  converted: number;
}

/**
 * A visitor who just walked away from the checkout is often still on the page,
 * or about to come back and finish on their own. Calling them in that window
 * costs a call and annoys a customer who was going to convert anyway — so the
 * number stays masked until the cart has been idle this long.
 */
const CALL_COOLDOWN_MS = 5 * 60 * 1000;

const fmtCountdown = (ms: number) => {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

/**
 * Silences a replay.
 *
 * Landing pages carry testimonial audio and video, and rrweb faithfully replays
 * them — an agent opening a session got a wall of sound. rrweb has no mute
 * option, so every media element inside the replay iframe is muted directly, and
 * an observer catches the ones rebuilt as playback advances.
 */
function muteReplayMedia(replayer: Replayer): () => void {
  const iframe = (replayer as any).iframe as HTMLIFrameElement | undefined;
  const doc = iframe?.contentDocument;
  if (!doc) return () => {};

  const silence = () => {
    doc.querySelectorAll('audio, video').forEach((el) => {
      const media = el as HTMLMediaElement;
      media.muted = true;
      media.defaultMuted = true;
      media.volume = 0;
    });
  };

  silence();
  const observer = new MutationObserver(silence);
  observer.observe(doc, { childList: true, subtree: true });
  // The replayer also re-creates nodes between mutations; a slow tick keeps
  // anything that slips through silent without burning a frame budget.
  const ticker = setInterval(silence, 500);

  return () => {
    observer.disconnect();
    clearInterval(ticker);
  };
}

interface PlaybackTarget {
  id: string;
  ip: string;
  /** The cart this replay belongs to, so watching it unlocks its conversion. */
  cartId: string;
  /** What the server stored for this cart, shown when the replay itself captured
   *  no keystrokes. */
  captured?: CapturedField[];
}

/** The four checkout fields the server persists, in form order. */
const capturedFieldsOf = (c: Cart): CapturedField[] => [
  { label: 'Nom', value: c.fullName },
  { label: 'Téléphone', value: c.phone },
  { label: 'Ville', value: c.city },
  { label: 'Adresse', value: c.address },
];

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
        <span>Total: <strong className="text-gray-700">{totalItems}</strong> paniers</span>
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
      <div className="text-xs text-gray-600 font-medium">
        Affichage de <span className="font-black text-orange-600">{startItem}</span> à{' '}
        <span className="font-black text-orange-600">{endItem}</span> sur{' '}
        <span className="font-black text-gray-900">{totalItems.toLocaleString('fr-FR')}</span> paniers abandonnés
      </div>

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

export default function AbandonedCarts() {
  const [carts, setCarts] = useState<Cart[]>([]);
  const [loading, setLoading] = useState(true);
  const [scoped, setScoped] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [converting, setConverting] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  // Default to the actionable queue: numbers not yet in the database.
  const [status, setStatus] = useState<CartStatus>('unsaved');
  const [phoneFilter, setPhoneFilter] = useState<PhoneFilter>('all');
  const [counts, setCounts] = useState<Counts>({
    all: 0, unsaved: 0, complete: 0, incomplete: 0, converted: 0,
  });

  // Numbers the agent has chosen to reveal, and the carts whose replay they have
  // opened — the two gates in front of calling and converting.
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [watched, setWatched] = useState<Set<string>>(new Set());
  // Ticks once a second so every countdown on the page stays live.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Session playback state
  const [playing, setPlaying] = useState<PlaybackTarget | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [progress, setProgress] = useState(0);
  // Where the visitor typed, derived from the same event stream the replayer uses.
  const [inputTimeline, setInputTimeline] = useState<InputTimeline | null>(null);

  const playbackContainerRef = useRef<HTMLDivElement>(null);
  const playbackReplayerRef = useRef<Replayer | null>(null);
  /** Tears down the mute observer when the replay closes. */
  const unmuteCleanupRef = useRef<(() => void) | null>(null);
  const playMetaRef = useRef<{ total: number }>({ total: 0 });
  const playBaselineRef = useRef<{ wallStart: number; offset: number }>({ wallStart: 0, offset: 0 });
  const progressTimerRef = useRef<any>(null);

  const load = useCallback(async (p = page, q = search, s = status, pq = phoneFilter) => {
    setLoading(true);
    try {
      const r = await leadsApi.abandonedCarts({
        page: p, limit: 30, search: q || undefined, status: s, phoneQuality: pq,
      });
      setCarts(r.data.attempts || []);
      setTotal(r.data.total || 0);
      setTotalPages(r.data.totalPages || 1);
      setPage(p);
      setScoped(r.data.scoped !== false);
      if (r.data.counts) setCounts(r.data.counts);
    } catch {
      toast.error('Impossible de charger les paniers abandonnés');
    } finally {
      setLoading(false);
    }
  }, [page, search, status, phoneFilter]);

  // Switching a filter always returns to page 1 — the old page may not exist anymore.
  const applyStatus = (s: CartStatus) => {
    setStatus(s);
    load(1, search, s, phoneFilter);
  };

  const applyPhoneFilter = (pq: PhoneFilter) => {
    setPhoneFilter(pq);
    load(1, search, status, pq);
  };

  useEffect(() => { load(1, '', 'unsaved', 'all'); /* eslint-disable-next-line */ }, []);

  // Search as you type. Enter still works; this just removes the need for it.
  const searchDebounceRef = useRef<any>(null);
  const onSearchChange = (value: string) => {
    setSearch(value);
    clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => load(1, value, status, phoneFilter), 400);
  };

  // Auto-refresh pauses while a replay is open: reloading under the agent would
  // re-render the modal's row and fight with playback.
  useEffect(() => {
    if (playing) return;
    const t = setInterval(() => load(page), 30000);
    return () => clearInterval(t);
  }, [load, page, playing]);

  const convert = async (cart: Cart) => {
    setConverting(cart.id);
    try {
      await leadsApi.convertCart(cart.id);
      // Say so plainly when the number still needs work — the lead is real but
      // not yet shippable, and that must not be discovered at push time.
      if (checkPhoneCompleteness(cart.phone).quality === 'incomplete') {
        toast('Lead créé avec un numéro incomplet — complétez-le dans « Mes Leads » avant de l\'expédier.', {
          icon: '⚠️',
          duration: 8000,
        });
      } else {
        toast.success('Panier converti en lead ! Il est maintenant dans « Mes Leads ».');
      }

      // The cart moves from the working queue to "Déjà converti": it drops out of
      // Non validé, and stays visible under Tous / Déjà converti.
      if (status === 'unsaved') {
        setCarts(prev => prev.filter(c => c.id !== cart.id));
        setTotal(t => Math.max(0, t - 1));
      } else {
        setCarts(prev => prev.map(c =>
          c.id === cart.id ? { ...c, converted: true, savedAsLead: true, alreadyHasLead: true } : c,
        ));
      }
      setCounts(prev => ({
        ...prev,
        converted: prev.converted + 1,
        unsaved: Math.max(0, prev.unsaved - 1),
      }));
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Erreur lors de la conversion');
    } finally {
      setConverting(null);
    }
  };

  const toggle = (ip: string) => setCollapsed(prev => {
    const n = new Set(prev); n.has(ip) ? n.delete(ip) : n.add(ip); return n;
  });

  // Playback timer controls
  const stopProgressTimer = () => {
    if (progressTimerRef.current) { clearInterval(progressTimerRef.current); progressTimerRef.current = null; }
  };
  const startProgressTimer = () => {
    stopProgressTimer();
    progressTimerRef.current = setInterval(() => {
      const { wallStart, offset } = playBaselineRef.current;
      const elapsed = offset + (Date.now() - wallStart) * speed;
      const totalTime = playMetaRef.current.total || 1;
      const ratio = Math.min(1, elapsed / totalTime);
      setProgress(ratio);
      if (ratio >= 1) { stopProgressTimer(); setIsPaused(true); }
    }, 200);
  };

  const openPlayback = async (target: PlaybackTarget) => {
    setPlaying(target);
    setIsPaused(false);
    setProgress(0);
    setSpeed(1);
    setInputTimeline(null);
    // Reviewing the session is what unlocks conversion for this cart.
    setWatched(prev => new Set(prev).add(target.cartId));
    try {
      const r = await api.get(`/admin/sessions/${target.id}/events`);
      const events = r.data.events || [];
      setInputTimeline(extractInputTimeline(events));
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
        // The iframe only exists once playback starts.
        unmuteCleanupRef.current?.();
        unmuteCleanupRef.current = muteReplayMedia(replayer);
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
      setIsPaused(false);
      startProgressTimer();
    } else {
      r.pause();
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
    const { wallStart, offset } = playBaselineRef.current;
    const elapsed = isPaused ? offset : offset + (Date.now() - wallStart) * speed;
    setSpeed(s);
    try { r.setConfig({ speed: s }); } catch { /* noop */ }
    playBaselineRef.current = { wallStart: Date.now(), offset: elapsed };
  };

  /** Jumps the replayer to an absolute offset in ms. */
  const seekToOffset = (offsetMs: number) => {
    const r = playbackReplayerRef.current;
    if (!r) return;
    const totalTime = playMetaRef.current.total || 0;
    const offset = Math.min(Math.max(0, offsetMs), totalTime);
    r.play(offset);
    playBaselineRef.current = { wallStart: Date.now(), offset };
    setProgress(totalTime > 0 ? offset / totalTime : 0);
    setIsPaused(false);
    startProgressTimer();
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    seekToOffset((playMetaRef.current.total || 0) * ratio);
  };

  const closePlayback = () => {
    stopProgressTimer();
    unmuteCleanupRef.current?.();
    unmuteCleanupRef.current = null;
    if (playbackReplayerRef.current) {
      try { playbackReplayerRef.current.pause(); playbackReplayerRef.current.destroy?.(); } catch { /* noop */ }
      playbackReplayerRef.current = null;
    }
    setPlaying(null);
    setInputTimeline(null);
  };

  // Leaving the page mid-replay must not leave an interval and an observer running.
  useEffect(() => () => {
    stopProgressTimer();
    unmuteCleanupRef.current?.();
    try { playbackReplayerRef.current?.destroy?.(); } catch { /* noop */ }
    /* eslint-disable-next-line */
  }, []);

  const byIp = Object.values(
    carts.reduce((acc, c) => {
      (acc[c.ip] = acc[c.ip] || { ip: c.ip, items: [] as Cart[] }).items.push(c);
      return acc;
    }, {} as Record<string, { ip: string; items: Cart[] }>),
  );

  return (
    <div className="p-6 max-w-[1200px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-gray-100 shadow-xs">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-orange-500/10 text-orange-600 flex items-center justify-center shrink-0">
            <ShoppingCart className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-900">Paniers Abandonnés</h1>
            <p className="text-sm text-gray-500 font-medium">
              Clients qui ont saisi leurs infos sans valider la commande. Rappelez-les et récupérez la vente.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
            <input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') load(1); }}
              placeholder="Téléphone, nom, ville…"
              className="pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-orange-500/20"
            />
          </div>
          <button onClick={() => load(1)} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl flex items-center gap-2 transition-all">
            <RefreshCw className="w-3.5 h-3.5" /> Actualiser
          </button>
        </div>
      </div>

      {/* Filters. Two independent axes — whether the number is already a lead,
          and whether it is dialable at all — so they read as separate groups
          instead of one row of tabs that look mutually exclusive but are not. */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-xs p-4 space-y-3">
        <div className="flex items-start gap-x-8 gap-y-3 flex-wrap">
          <div className="space-y-1.5">
            <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">Statut du panier</p>
            <div className="inline-flex items-center bg-gray-50 border border-gray-200 rounded-2xl p-1">
              {([
                { key: 'all', label: 'Tous', count: counts.all, icon: null, active: 'bg-gray-900 text-white' },
                { key: 'unsaved', label: 'Non validé', count: counts.unsaved, icon: null, active: 'bg-red-500 text-white' },
                { key: 'converted', label: 'Déjà converti', count: counts.converted, icon: UserPlus, active: 'bg-blue-500 text-white' },
              ] as const).map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.key}
                    onClick={() => applyStatus(tab.key)}
                    className={`px-3.5 py-1.5 rounded-xl text-[11px] font-black transition-all inline-flex items-center gap-1.5 ${
                      status === tab.key ? `${tab.active} shadow-xs` : 'text-gray-500 hover:text-gray-800'
                    }`}
                  >
                    {Icon && <Icon className="w-3 h-3" />}
                    {tab.label} ({tab.count})
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">Numéro de téléphone</p>
            <div className="inline-flex items-center bg-gray-50 border border-gray-200 rounded-2xl p-1">
              {([
                { key: 'all', label: 'Tous', count: counts.all, icon: null, active: 'bg-gray-900 text-white' },
                { key: 'complete', label: 'N° complet', count: counts.complete, icon: Phone, active: 'bg-emerald-500 text-white' },
                { key: 'incomplete', label: 'N° incomplet', count: counts.incomplete, icon: PhoneOff, active: 'bg-amber-500 text-white' },
              ] as const).map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.key}
                    onClick={() => applyPhoneFilter(tab.key)}
                    className={`px-3.5 py-1.5 rounded-xl text-[11px] font-black transition-all inline-flex items-center gap-1.5 ${
                      phoneFilter === tab.key ? `${tab.active} shadow-xs` : 'text-gray-500 hover:text-gray-800'
                    }`}
                  >
                    {Icon && <Icon className="w-3 h-3" />}
                    {tab.label} ({tab.count})
                  </button>
                );
              })}
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2 flex-wrap self-center">
            <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-2xl text-sm font-black border ${
              status === 'converted'
                ? 'bg-blue-50 text-blue-600 border-blue-100'
                : 'bg-red-50 text-red-600 border-red-100'
            }`}>
              {status === 'converted' ? <UserPlus className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
              {total} {total === 1 ? 'panier' : 'paniers'}
              {status === 'converted' ? ' convertis en lead' : status === 'all' ? ' au total' : ' à rappeler'}
            </span>
            {!scoped && (
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-slate-100 text-slate-500 text-xs font-bold">
                <Globe className="w-3.5 h-3.5" /> Tous les paniers (aucun vendeur assigné)
              </span>
            )}
          </div>
        </div>

        <p className="text-[11px] text-gray-400 font-medium flex items-center gap-1.5 pt-1 border-t border-gray-50">
          <Lock className="w-3 h-3 shrink-0" />
          Un panier reste verrouillé {CALL_COOLDOWN_MS / 60000} minutes après le dernier passage du client — numéro,
          enregistrement et conversion. Laissez-lui le temps de finaliser seul. Ensuite, la conversion s'ouvre une fois
          l'enregistrement visionné et le numéro complet.
        </p>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400 font-medium flex items-center justify-center gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-orange-500" /> Chargement…
        </div>
      ) : byIp.length === 0 ? (
        <div className="bg-white p-12 rounded-3xl border border-gray-100 shadow-xs text-center text-gray-400 font-medium">
          {status === 'converted'
            ? <UserPlus className="w-10 h-10 text-blue-300 mx-auto mb-2" />
            : phoneFilter === 'incomplete'
              ? <PhoneOff className="w-10 h-10 text-amber-300 mx-auto mb-2" />
              : <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-2" />}
          {status === 'converted'
            ? 'Aucun panier converti en lead pour le moment.'
            : phoneFilter === 'complete'
              ? 'Aucun panier avec un numéro complet pour ce filtre.'
              : phoneFilter === 'incomplete'
                ? 'Aucun numéro incomplet ici — tous les paniers sont appelables. 🎉'
                : status === 'unsaved'
                  ? 'Rien à rappeler. Tous les numéros sont déjà en base. 🎉'
                  : 'Aucun panier abandonné pour le moment. 🎉'}
          {(status !== 'all' || phoneFilter !== 'all') && (
            <button
              onClick={() => { setStatus('all'); setPhoneFilter('all'); load(1, search, 'all', 'all'); }}
              className="block mx-auto mt-3 text-xs font-black text-orange-600 hover:text-orange-700"
            >
              Voir tous les paniers
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="space-y-4">
            {byIp.map((group) => {
              const isCollapsed = collapsed.has(group.ip);
              return (
                <div key={group.ip} className="bg-white border border-orange-200/70 rounded-3xl overflow-hidden shadow-xs transition-all">
                  <button 
                    onClick={() => toggle(group.ip)} 
                    className="w-full flex items-center gap-3 px-5 py-3 bg-gradient-to-r from-orange-50/80 via-amber-50/40 to-orange-50/20 border-b border-orange-100 hover:from-orange-100/90 hover:to-amber-100/70 transition-all text-left group"
                  >
                    <ChevronDown className={`w-4 h-4 text-orange-500 transition-transform duration-200 ${isCollapsed ? '-rotate-90' : ''}`} />
                    <div className="w-7 h-7 rounded-xl bg-orange-500/10 text-orange-600 flex items-center justify-center font-bold">
                      <Globe className="w-4 h-4 text-orange-600" />
                    </div>
                    <span className="font-mono font-black text-xs text-gray-900 group-hover:text-orange-600 transition-colors">{group.ip}</span>
                    <span className="ml-auto px-2.5 py-0.5 rounded-full text-[10px] font-black bg-orange-500 text-white shadow-xs">
                      {group.items.length} {group.items.length === 1 ? 'panier' : 'paniers'}
                    </span>
                  </button>

                  {!isCollapsed && (
                    <div className="divide-y divide-gray-50">
                      {group.items.map((c) => {
                        const phone = checkPhoneCompleteness(c.phone);
                        const cooldownLeft = new Date(c.updatedAt).getTime() + CALL_COOLDOWN_MS - now;
                        const onCooldown = cooldownLeft > 0;
                        const isRevealed = revealed.has(c.id) && !onCooldown;
                        // Neither watching the replay nor a complete number gates
                        // conversion any more — both are surfaced as warnings so the
                        // agent decides. The cooldown is the only hard block left,
                        // so the customer keeps their five minutes to finish alone.
                        const canConvert = !onCooldown;
                        const incompletePhone = phone.quality === 'incomplete';

                        return (
                        <div key={c.id} className="flex items-center gap-4 px-5 py-4 hover:bg-orange-50/30 transition-colors flex-wrap">
                          {c.productImage ? (
                            <img src={c.productImage} alt="" className="w-11 h-11 rounded-xl object-cover border border-gray-100 shrink-0" />
                          ) : (
                            <div className="w-11 h-11 rounded-xl bg-orange-50/50 border border-orange-100 flex items-center justify-center shrink-0">
                              <Package className="w-5 h-5 text-orange-400" />
                            </div>
                          )}

                          <div className="flex-1 min-w-[180px]">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-sm text-gray-900">{c.fullName || <span className="text-gray-400 font-medium">Nom non saisi</span>}</span>
                              {/* Carts whose number is already a lead never reach
                                  this page, so the only two states left are "still
                                  to do" and "recovered from here". */}
                              {c.converted ? (
                                <span
                                  title="Ce panier a été converti en lead depuis cette page"
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-blue-100 text-blue-700"
                                >
                                  <UserPlus className="w-3 h-3" /> Déjà converti
                                </span>
                              ) : (
                                <span
                                  title="Ce numéro n'a pas encore été enregistré comme lead"
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-red-100 text-red-700"
                                >
                                  <AlertTriangle className="w-3 h-3" /> Panier non validé
                                </span>
                              )}
                              {phone.quality === 'incomplete' && (
                                <span
                                  title={phone.reason || 'Numéro incomplet'}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-amber-100 text-amber-700"
                                >
                                  <PhoneOff className="w-3 h-3" /> N° incomplet
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-gray-600">{c.productName || c.referralCode || '—'}</span>
                              {c.city && <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3 text-gray-400" />{c.city}</span>}
                              {c.sellerName && <span>• Vendeur : {c.sellerName}</span>}
                              <span className={c.fieldsFilled >= 4 ? 'font-bold text-emerald-600' : ''}>
                                • {c.fieldsFilled}/4 champs
                              </span>
                              <span>• {new Date(c.updatedAt).toLocaleString('fr-FR')}</span>
                            </div>
                          </div>

                          {/* The number is the point of the page, so it is also the
                              thing most worth protecting: masked during the cooldown,
                              then revealed on a deliberate click. */}
                          {phone.quality === 'incomplete' ? (
                            <span
                              title={phone.reason || 'Numéro incomplet'}
                              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-black bg-amber-50 text-amber-600 border border-amber-100 cursor-help"
                            >
                              <PhoneOff className="w-4 h-4" />
                              <span className="font-mono">{c.phone || '—'}</span>
                            </span>
                          ) : onCooldown ? (
                            <span
                              title="Le client vient de quitter le tunnel — laissez-le finaliser seul avant de rappeler."
                              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-black bg-gray-100 text-gray-500 border border-gray-200 tabular-nums"
                            >
                              <Timer className="w-4 h-4" />
                              <span className="font-mono">{maskPhone(c.phone)}</span>
                              <span className="text-[11px] text-gray-400">· {fmtCountdown(cooldownLeft)}</span>
                            </span>
                          ) : isRevealed ? (
                            <a
                              href={`tel:${phone.e164 || c.phone}`}
                              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-black bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors"
                            >
                              <Phone className="w-4 h-4" /> {c.phone}
                            </a>
                          ) : (
                            <button
                              onClick={() => setRevealed(prev => new Set(prev).add(c.id))}
                              title="Afficher le numéro"
                              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-black bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors"
                            >
                              <Eye className="w-4 h-4" />
                              <span className="font-mono">{maskPhone(c.phone)}</span>
                            </button>
                          )}

                          {c.recordingId ? (
                            <button
                              onClick={() => openPlayback({ id: c.recordingId!, ip: c.ip, cartId: c.id, captured: capturedFieldsOf(c) })}
                              disabled={onCooldown}
                              title={
                                onCooldown
                                  ? `Enregistrement disponible dans ${fmtCountdown(cooldownLeft)} — le client est peut-être encore sur la page.`
                                  : watched.has(c.id) ? 'Revoir cet enregistrement' : "Voir l'enregistrement de la session"
                              }
                              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black transition-all ${
                                onCooldown
                                  ? 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed tabular-nums'
                                  : watched.has(c.id)
                                    ? 'bg-orange-100 text-orange-700 hover:bg-orange-200 active:scale-95 shadow-xs'
                                    : 'bg-orange-500 hover:bg-orange-600 text-white active:scale-95 shadow-xs'
                              }`}
                            >
                              {onCooldown ? (
                                <><Lock className="w-3.5 h-3.5" /> {fmtCountdown(cooldownLeft)}</>
                              ) : (
                                <><Play className="w-3.5 h-3.5 fill-current" /> {watched.has(c.id) ? 'Revu' : 'Revoir'}</>
                              )}
                            </button>
                          ) : (
                            <span className="text-[10px] text-gray-300 font-medium italic">pas d'enregistrement</span>
                          )}

                          {c.converted ? (
                            <span
                              title="Ce panier a déjà été converti en lead"
                              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black bg-emerald-50 text-emerald-600 border border-emerald-100"
                            >
                              <CheckCircle2 className="w-4 h-4" /> Déjà converti
                            </span>
                          ) : (
                            <button
                              onClick={() => convert(c)}
                              disabled={converting === c.id || !canConvert}
                              title={
                                onCooldown
                                  ? `Disponible dans ${fmtCountdown(cooldownLeft)} — laissez le client finaliser seul.`
                                  : incompletePhone
                                    ? `Numéro incomplet (${phone.reason}) — le lead sera créé tel quel et devra être complété avant expédition.`
                                    : 'Convertir ce panier en lead'
                              }
                              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black transition-all shadow-xs ${
                                !canConvert
                                  ? 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed shadow-none'
                                  : incompletePhone
                                    // Convertible, but the number still needs work —
                                    // amber so it never looks like a clean recovery.
                                    ? 'bg-amber-500 hover:bg-amber-600 active:scale-95 text-white'
                                    : 'bg-gray-900 hover:bg-gray-800 active:scale-95 text-white'
                              } disabled:opacity-100`}
                            >
                              {converting === c.id
                                ? <><Loader2 className="w-4 h-4 animate-spin" /> Conversion…</>
                                : onCooldown
                                  ? <><Lock className="w-4 h-4" /> {fmtCountdown(cooldownLeft)}</>
                                  : incompletePhone
                                    ? <><AlertTriangle className="w-4 h-4" /> Convertir (n° à compléter)</>
                                    : <><UserPlus className="w-4 h-4" /> Convertir en Lead</>}
                            </button>
                          )}
                        </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <PaginationControls
            currentPage={page}
            totalPages={totalPages}
            totalItems={total}
            pageSize={30}
            onPageChange={(p) => load(p)}
          />
        </div>
      )}

      {/* Session Replay Modal */}
      {playing && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-gray-900 w-full max-w-5xl rounded-3xl border border-gray-800 overflow-hidden flex flex-col h-[85vh]">
            <div className="p-4 bg-gray-950 border-b border-gray-800 flex items-center justify-between text-white">
              <span className="font-bold text-sm flex items-center gap-2">
                <Play className="w-5 h-5 text-orange-500 fill-current" /> Session Replay • {playing.ip}
                <span
                  title="Le son de la page est coupé pendant la relecture"
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-gray-800 text-gray-400 text-[10px] font-black uppercase tracking-wide"
                >
                  <VolumeX className="w-3 h-3" /> Muet
                </span>
              </span>
              <button onClick={closePlayback} className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-gray-800 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 bg-black overflow-hidden relative">
              <div ref={playbackContainerRef} className="w-full h-full relative" />
            </div>

            {/* Where the visitor typed — lets an agent jump straight to the first
                keystroke instead of scrubbing the whole session. */}
            <ReplayInputTimeline
              timeline={inputTimeline}
              captured={playing.captured}
              onSeek={seekToOffset}
            />

            {/* Controls */}
            <div className="p-4 bg-gray-950 border-t border-gray-800 space-y-3">
              <div className="relative h-1.5 bg-gray-700 rounded-full cursor-pointer" onClick={seek}>
                <div className="h-full bg-orange-500 rounded-full transition-all" style={{ width: `${progress * 100}%` }} />
                {/* One tick per keystroke, so typing bursts are visible at a glance. */}
                <ReplayInputTicks timeline={inputTimeline} />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button onClick={togglePlayback} className="p-2 rounded-lg bg-gray-800 text-white hover:bg-gray-700 transition-colors">
                    {isPaused ? <Play className="w-4 h-4 fill-current" /> : <Pause className="w-4 h-4" />}
                  </button>
                  <button onClick={restartPlayback} className="p-2 rounded-lg bg-gray-800 text-gray-300 hover:text-white transition-colors">
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex items-center gap-1">
                  {[0.5, 1, 2, 4, 8].map((s) => (
                    <button
                      key={s}
                      onClick={() => changeSpeed(s)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                        speed === s ? 'bg-orange-500 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
                      }`}
                    >
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
