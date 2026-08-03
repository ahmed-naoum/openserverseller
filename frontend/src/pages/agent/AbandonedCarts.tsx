import { useState, useEffect, useCallback, useRef } from 'react';
import { leadsApi, api } from '../../lib/api';
import toast from 'react-hot-toast';
import { Replayer } from 'rrweb';
import 'rrweb/dist/style.css';
import {
  ShoppingCart, Phone, Search, RefreshCw, Globe, MapPin, Package,
  UserPlus, CheckCircle2, ChevronDown, Loader2, AlertTriangle,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Play, Pause, RotateCcw, X,
} from 'lucide-react';

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
  alreadyHasLead?: boolean;
  recordingId?: string;
  updatedAt: string;
}

interface PlaybackTarget {
  id: string;
  ip: string;
}

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

  // Session playback state
  const [playing, setPlaying] = useState<PlaybackTarget | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [progress, setProgress] = useState(0);

  const playbackContainerRef = useRef<HTMLDivElement>(null);
  const playbackReplayerRef = useRef<Replayer | null>(null);
  const playMetaRef = useRef<{ total: number }>({ total: 0 });
  const playBaselineRef = useRef<{ wallStart: number; offset: number }>({ wallStart: 0, offset: 0 });
  const progressTimerRef = useRef<any>(null);

  const load = useCallback(async (p = page, q = search) => {
    setLoading(true);
    try {
      const r = await leadsApi.abandonedCarts({ page: p, limit: 30, search: q || undefined });
      setCarts(r.data.attempts || []);
      setTotal(r.data.total || 0);
      setTotalPages(r.data.totalPages || 1);
      setPage(p);
      setScoped(r.data.scoped !== false);
    } catch {
      toast.error('Impossible de charger les paniers abandonnés');
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { load(1); /* eslint-disable-next-line */ }, []);

  useEffect(() => {
    const t = setInterval(() => load(page), 30000);
    return () => clearInterval(t);
  }, [load, page]);

  const convert = async (cart: Cart) => {
    setConverting(cart.id);
    try {
      await leadsApi.convertCart(cart.id);
      toast.success('Panier converti en lead ! Il est maintenant dans « Mes Leads ».');
      setCarts(prev => prev.filter(c => c.id !== cart.id));
      setTotal(t => Math.max(0, t - 1));
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
              onChange={(e) => setSearch(e.target.value)}
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

      {/* Count pill */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-red-50 text-red-600 text-sm font-black border border-red-100">
          <AlertTriangle className="w-4 h-4" /> {total} panier(s) à rappeler
        </span>
        {!scoped && (
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-slate-100 text-slate-500 text-xs font-bold">
            <Globe className="w-3.5 h-3.5" /> Tous les paniers (aucun vendeur assigné)
          </span>
        )}
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400 font-medium flex items-center justify-center gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-orange-500" /> Chargement…
        </div>
      ) : byIp.length === 0 ? (
        <div className="bg-white p-12 rounded-3xl border border-gray-100 shadow-xs text-center text-gray-400 font-medium">
          <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
          Aucun panier abandonné pour le moment. 🎉
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
                      {group.items.map((c) => (
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
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-red-100 text-red-700">Panier non validé</span>
                              {c.alreadyHasLead && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-blue-100 text-blue-700">Déjà dans vos leads</span>
                              )}
                            </div>
                            <div className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-gray-600">{c.productName || c.referralCode || '—'}</span>
                              {c.city && <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3 text-gray-400" />{c.city}</span>}
                              {c.sellerName && <span>• Vendeur : {c.sellerName}</span>}
                              <span>• {c.fieldsFilled}/4 champs • {new Date(c.updatedAt).toLocaleString('fr-FR')}</span>
                            </div>
                          </div>

                          {c.phone && (
                            <a href={`tel:${c.phone}`} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-black bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors">
                              <Phone className="w-4 h-4" /> {c.phone}
                            </a>
                          )}

                          {c.recordingId ? (
                            <button
                              onClick={() => openPlayback({ id: c.recordingId!, ip: c.ip })}
                              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black bg-orange-500 hover:bg-orange-600 active:scale-95 text-white transition-all shadow-xs"
                            >
                              <Play className="w-3.5 h-3.5 fill-current" /> Revoir
                            </button>
                          ) : (
                            <span className="text-[10px] text-gray-300 font-medium italic">pas d'enregistrement</span>
                          )}

                          <button
                            onClick={() => convert(c)}
                            disabled={converting === c.id}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black bg-gray-900 hover:bg-gray-800 active:scale-95 text-white disabled:opacity-50 transition-all shadow-xs"
                          >
                            {converting === c.id
                              ? <><Loader2 className="w-4 h-4 animate-spin" /> Conversion…</>
                              : <><UserPlus className="w-4 h-4" /> Convertir en Lead</>}
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
              </span>
              <button onClick={closePlayback} className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-gray-800 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 bg-black overflow-hidden relative">
              <div ref={playbackContainerRef} className="w-full h-full relative" />
            </div>

            {/* Controls */}
            <div className="p-4 bg-gray-950 border-t border-gray-800 space-y-3">
              <div className="h-1.5 bg-gray-700 rounded-full cursor-pointer" onClick={seek}>
                <div className="h-full bg-orange-500 rounded-full transition-all" style={{ width: `${progress * 100}%` }} />
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
