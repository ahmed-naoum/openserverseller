import { useState, useEffect, useMemo, useRef, useCallback, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  Search,
  Package,
  FileText,
  Download,
  ChevronDown,
  User,
  Phone,
  MapPin,
  Clock,
  ShieldAlert,
  Truck,
  Trash2,
  RefreshCw,
  CheckCircle,
  CheckCircle2,
  Loader2,
  Printer,
  Copy,
  X,
  Keyboard,
  ScanLine,
  LayoutGrid,
  Rows3,
  Filter,
  ArrowUpDown,
  AlertTriangle,
  Layers,
  Check,
  Timer,
  Bell,
  BellOff,
  Volume2,
} from 'lucide-react';
import { ordersApi } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../contexts/SocketContext';
import toast from 'react-hot-toast';
import PageLoader from '../../components/PageLoader';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface ApiParcel {
  id: number;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  customerCity: string;
  coliatyPackageCode: string;
  coliatyPickupRef?: string;
  totalAmountMad: number;
  createdAt: string;
}

interface ApiProductGroup {
  id: number;
  name: string;
  sku: string;
  image?: string;
  pendingParcels: ApiParcel[];
}

interface ProductRef {
  id: number;
  name: string;
  sku: string;
  image?: string;
}

/**
 * One physical parcel. A single order can contain items from several products,
 * so the API returns it once per product — this shape collapses that back into
 * the one thing the packaging desk actually handles, with every product it holds.
 */
interface Parcel {
  code: string;
  orderId: number;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  customerCity: string;
  pickupRef?: string;
  amount: number;
  createdAt: string;
  products: ProductRef[];
  /** Pre-lowercased haystack so filtering 1000+ rows on each keystroke stays cheap. */
  search: string;
}

interface Bon {
  ref: string;
  parcels: Parcel[];
  date: string;
  products: ProductRef[];
}

type Tab = 'pending' | 'created' | 'collected';
type ViewMode = 'table' | 'cards';
type SortKey = 'recent' | 'oldest' | 'city' | 'customer' | 'amount' | 'product';

interface NewTicketAlert {
  count: number;
  tickets: {
    orderNumber: string;
    packageCode: string;
    customerName: string;
    customerCity: string;
    productName?: string | null;
    amountMad?: number | null;
  }[];
  actor: { name: string; role?: string | null };
  at: string;
}

const PAGE_SIZES = [50, 100, 200, 500, 1000];
const SERVER_LABEL_BATCH = 400; // must match MAX_BATCH_LABELS in order.routes.ts
const SERVER_DETAIL_BATCH = 120; // must match MAX_BATCH_PICKUP_DETAILS
const AUTO_REFRESH_MS = 60_000;

/** Emitted by the backend when an agent pushes leads to delivery. */
const TICKETS_NEW_EVENT = 'tickets:new';
const ALERT_SOUND = '/soundes/tick-notification-sound.mp3';

const SORT_LABELS: Record<SortKey, string> = {
  recent: 'Plus récents',
  oldest: 'Plus anciens',
  city: 'Ville (A-Z)',
  customer: 'Client (A-Z)',
  amount: 'Montant (élevé)',
  product: 'Produit (A-Z)',
};

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────

const base64ToBlob = (base64: string, type = 'application/pdf'): Blob => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type });
};

const saveBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
};

/**
 * Sends a PDF straight to the printer. The packaging desk prints all day, so
 * skipping the "download then open then Ctrl+P" detour saves real minutes.
 */
const printPdf = (blob: Blob) => {
  const url = URL.createObjectURL(blob);
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  iframe.src = url;

  const cleanup = () => {
    setTimeout(() => {
      URL.revokeObjectURL(url);
      iframe.remove();
    }, 60_000);
  };

  iframe.onload = () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      cleanup();
    } catch {
      // Some browsers refuse to print a cross-document iframe — fall back to a tab.
      window.open(url, '_blank');
      cleanup();
    }
  };

  document.body.appendChild(iframe);
};

/** Lowercases and strips accents so "Fes" matches "Fès" and vice versa. */
const normalize = (value: unknown): string =>
  String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

const readStored = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
};

/** useState mirrored into localStorage, so the desk keeps its layout between shifts. */
function usePersistentState<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(() => readStored(key, fallback));
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* quota or private mode — the UI still works, it just won't be remembered */
    }
  }, [key, value]);
  return [value, setValue] as const;
}

const chunk = <T,>(items: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
};

const errorMessage = (err: any, fallback: string): string => {
  if (err?.response?.status === 429) {
    return (
      err.response?.data?.message ||
      "Coliaty limite temporairement nos requêtes. Patientez une minute puis réessayez."
    );
  }
  return err?.response?.data?.message || err?.message || fallback;
};

const PARCEL_STATUS: Record<string, { label: string; color: string }> = {
  NEW_PARCEL: { label: 'Nouveau', color: 'bg-slate-100 text-slate-600 border-slate-200' },
  WAITING_PICKUP: { label: 'Attente Collecte', color: 'bg-amber-50 text-amber-600 border-amber-100' },
  PICKED_UP: { label: 'Collecté', color: 'bg-blue-50 text-blue-600 border-blue-100' },
  SENT: { label: 'Expédié', color: 'bg-violet-50 text-violet-600 border-violet-100' },
  RECEIVED: { label: 'Reçu', color: 'bg-indigo-50 text-indigo-600 border-indigo-100' },
  DISTRIBUTION: { label: 'En livraison', color: 'bg-cyan-50 text-cyan-600 border-cyan-100' },
  DELIVERED: { label: 'Livré', color: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
  RETURNED: { label: 'Retourné', color: 'bg-orange-50 text-orange-600 border-orange-100' },
  CANCELED: { label: 'Annulé', color: 'bg-red-50 text-red-600 border-red-100' },
};

const statusBadge = (status: string) =>
  PARCEL_STATUS[status] || { label: status || '—', color: 'bg-slate-50 text-slate-500 border-slate-200' };

const isBonCollected = (detail: any): boolean => {
  const note = detail?.pickup_note;
  if (!note) return false;
  return Boolean(
    note.is_complete ||
      (note.picked_up_parcels > 0 && note.picked_up_parcels === note.total_parcels)
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Small building blocks
// ─────────────────────────────────────────────────────────────────────────────

function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  tone = 'primary',
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  tone?: 'primary' | 'danger';
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Enter') onConfirm();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onConfirm, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-md w-full p-8 animate-in zoom-in-95 duration-200">
        <div
          className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-5 ${
            tone === 'danger' ? 'bg-red-50 text-red-500' : 'bg-primary-50 text-primary-600'
          }`}
        >
          {tone === 'danger' ? <AlertTriangle size={26} /> : <Truck size={26} />}
        </div>
        <h3 className="text-xl font-black text-slate-900 mb-2">{title}</h3>
        <p className="text-sm text-slate-500 font-medium leading-relaxed mb-8">{message}</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-5 py-3 rounded-2xl bg-slate-100 text-slate-600 font-black text-sm hover:bg-slate-200 transition-all active:scale-95"
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            autoFocus
            className={`flex-1 px-5 py-3 rounded-2xl text-white font-black text-sm transition-all active:scale-95 shadow-lg ${
              tone === 'danger'
                ? 'bg-red-500 hover:bg-red-600 shadow-red-200'
                : 'bg-slate-900 hover:bg-black shadow-slate-200'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

const SHORTCUTS: { keys: string; label: string }[] = [
  { keys: '/', label: 'Aller à la recherche' },
  { keys: 'S', label: 'Activer le champ scan (douchette)' },
  { keys: 'A', label: 'Tout sélectionner (résultats filtrés)' },
  { keys: 'X', label: 'Vider la sélection' },
  { keys: 'B', label: 'Créer un bon avec la sélection' },
  { keys: 'D', label: 'Télécharger les tickets sélectionnés' },
  { keys: 'P', label: 'Imprimer les tickets sélectionnés' },
  { keys: 'R', label: 'Actualiser les données' },
  { keys: 'G', label: 'Grouper / dégrouper par produit' },
  { keys: '1 · 2 · 3', label: 'Basculer entre les onglets' },
  { keys: 'Maj + clic', label: 'Sélectionner une plage de lignes' },
  { keys: 'Échap', label: 'Fermer / effacer la recherche' },
  { keys: 'N', label: 'Activer / couper les alertes sonores' },
  { keys: '?', label: 'Afficher cette aide' },
];

function ShortcutsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-lg w-full p-8 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-slate-900 rounded-xl text-white">
              <Keyboard size={20} />
            </div>
            <h3 className="text-xl font-black text-slate-900">Raccourcis clavier</h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-all"
          >
            <X size={20} />
          </button>
        </div>
        <div className="space-y-1.5">
          {SHORTCUTS.map((s) => (
            <div key={s.keys} className="flex items-center justify-between py-2 px-3 rounded-xl hover:bg-slate-50">
              <span className="text-sm font-medium text-slate-600">{s.label}</span>
              <kbd className="px-2.5 py-1 bg-slate-100 border border-slate-200 rounded-lg text-[11px] font-black text-slate-700 tracking-wide">
                {s.keys}
              </kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ImageLightbox({
  image,
  onClose,
}: {
  image: { src: string; name: string; sub?: string } | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!image) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [image, onClose]);

  if (!image) return null;

  return (
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center p-6 bg-slate-900/70 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-6 right-6 p-3 rounded-2xl bg-white/10 text-white hover:bg-white/20 transition-all active:scale-95"
      >
        <X size={22} />
      </button>
      <div
        className="flex flex-col items-center gap-5 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={image.src}
          alt={image.name}
          className="max-w-[88vw] max-h-[76vh] object-contain rounded-3xl bg-white shadow-2xl"
        />
        <div className="text-center">
          <p className="text-lg font-black text-white">{image.name}</p>
          {image.sub && (
            <p className="text-[11px] font-bold text-white/60 uppercase tracking-wider mt-1">{image.sub}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
  tone: string;
}) {
  return (
    <div className="bg-white px-5 py-4 rounded-2xl border border-slate-100 flex items-center gap-4 shadow-sm">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${tone}`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5">{label}</p>
        <p className="text-xl font-black text-slate-900 leading-none truncate">{value}</p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function HelperTickets() {
  const { user } = useAuth();
  const { socket } = useSocket();

  // Data
  const [rawProducts, setRawProducts] = useState<ApiProductGroup[]>([]);
  const [bonDetails, setBonDetails] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  // Persisted preferences
  const [activeTab, setActiveTab] = usePersistentState<Tab>('helper_tickets_tab', 'pending');
  const [viewMode, setViewMode] = usePersistentState<ViewMode>('helper_tickets_view', 'table');
  const [groupByProduct, setGroupByProduct] = usePersistentState('helper_tickets_group', false);
  const [sortKey, setSortKey] = usePersistentState<SortKey>('helper_tickets_sort', 'recent');
  const [pageSize, setPageSize] = usePersistentState<number>('helper_tickets_page_size', 100);
  const [autoRefresh, setAutoRefresh] = usePersistentState('helper_tickets_auto_refresh', false);
  const [downloadedBons, setDownloadedBons] = usePersistentState<string[]>('downloaded_bons', []);
  const [alertsEnabled, setAlertsEnabled] = usePersistentState('helper_tickets_alerts', true);
  const [alertVolume, setAlertVolume] = usePersistentState('helper_tickets_alert_volume', 0.9);

  // Session UI state
  const [searchQuery, setSearchQuery] = useState('');
  const [productFilter, setProductFilter] = useState<number | 'all'>('all');
  const [cityFilter, setCityFilter] = useState<string>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [visibleCount, setVisibleCount] = useState(pageSize);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<number>>(new Set());
  const [expandedBon, setExpandedBon] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{ src: string; name: string; sub?: string } | null>(null);

  // Busy flags
  const [creatingBon, setCreatingBon] = useState(false);
  const [busyLabel, setBusyLabel] = useState<string | null>(null);
  const [downloadingCode, setDownloadingCode] = useState<string | null>(null);
  const [bonBusy, setBonBusy] = useState<string | null>(null);
  const [removingParcel, setRemovingParcel] = useState<string | null>(null);

  // Overlays
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [confirmCreate, setConfirmCreate] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<{ ref: string; code: string } | null>(null);

  // Scan mode
  const [scanMode, setScanMode] = useState(false);
  const [scanValue, setScanValue] = useState('');
  const [scanFeedback, setScanFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  // Live "new ticket" alerts. Tracked by parcel code rather than as a bare
  // counter so a flag lives exactly as long as the parcel it belongs to sits in
  // "En attente" — putting it on a bon de ramassage is what clears it. Persisted
  // because an F5 (or a crashed tab) must not lose track of what still needs
  // packing; stored as an array since a Set doesn't survive JSON.
  const [newCodeList, setNewCodeList] = usePersistentState<string[]>('helper_tickets_new_codes', []);
  const [bannerHidden, setBannerHidden] = useState(false);
  const [lastAlert, setLastAlert] = useState<NewTicketAlert | null>(null);
  const newCodes = useMemo(() => new Set(newCodeList), [newCodeList]);
  const pendingAlerts = newCodes.size;

  const searchRef = useRef<HTMLInputElement>(null);
  const scanRef = useRef<HTMLInputElement>(null);
  const lastClickedIndex = useRef<number | null>(null);
  const alertAudioRef = useRef<HTMLAudioElement | null>(null);
  const knownCodesRef = useRef<Set<string> | null>(null);
  /** Codes the socket already toasted, so the refresh behind it stays quiet. */
  const announcedCodesRef = useRef<Set<string>>(new Set());
  const alertsEnabledRef = useRef(alertsEnabled);
  const alertVolumeRef = useRef(alertVolume);

  const canAccess = !(user?.role === 'HELPER' && !user?.canManageTickets);

  // ───────────────────────────────────────────────────────────── data loading

  /** Loads every open bon's live status in as few round-trips as possible. */
  const loadBonDetails = useCallback(async (refs: string[], refresh = false) => {
    if (refs.length === 0) {
      setBonDetails({});
      return;
    }
    const merged: Record<string, any> = {};
    for (const batch of chunk(refs, SERVER_DETAIL_BATCH)) {
      try {
        const res = await ordersApi.getPickupNotesDetails(batch, refresh);
        Object.assign(merged, res.data?.data?.details || {});
      } catch (err) {
        console.error('Batch pickup-note detail failed:', err);
      }
    }
    setBonDetails(merged);
  }, []);

  const fetchData = useCallback(
    async (opts: { silent?: boolean; refreshDetails?: boolean } = {}) => {
      const { silent = false, refreshDetails = false } = opts;
      if (silent) setRefreshing(true);
      else setLoading(true);

      try {
        const res = await ordersApi.getProductsWithParcels();
        const data: ApiProductGroup[] = res.data?.data || [];
        setRawProducts(data);

        const refs = new Set<string>();
        data.forEach((p) =>
          p.pendingParcels.forEach((parcel) => {
            if (parcel.coliatyPickupRef) refs.add(parcel.coliatyPickupRef);
          })
        );
        await loadBonDetails([...refs], refreshDetails);
        setLastSync(new Date());
      } catch (err: any) {
        toast.error(errorMessage(err, 'Erreur lors de la récupération des tickets'));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [loadBonDetails]
  );

  useEffect(() => {
    if (canAccess) fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAccess]);

  useEffect(() => {
    if (!autoRefresh || !canAccess) return;
    const id = setInterval(() => fetchData({ silent: true }), AUTO_REFRESH_MS);
    return () => clearInterval(id);
  }, [autoRefresh, canAccess, fetchData]);

  // ───────────────────────────────────────────────── live new-ticket alerts

  // Read inside callbacks that are registered once — a ref avoids re-subscribing
  // the socket every time the desk nudges the volume slider.
  useEffect(() => {
    alertsEnabledRef.current = alertsEnabled;
  }, [alertsEnabled]);
  useEffect(() => {
    alertVolumeRef.current = alertVolume;
  }, [alertVolume]);

  /**
   * Browsers refuse to play audio until the user has interacted with the page.
   * Prime the element on the first click/keypress so the very first alert of the
   * shift is audible instead of silently rejected.
   */
  useEffect(() => {
    if (!canAccess) return;

    const audio = new Audio(ALERT_SOUND);
    audio.preload = 'auto';
    alertAudioRef.current = audio;

    let unlocked = false;
    const unlock = () => {
      if (unlocked) return;
      unlocked = true;
      audio.volume = 0;
      audio
        .play()
        .then(() => {
          audio.pause();
          audio.currentTime = 0;
        })
        .catch(() => {
          /* still blocked — the next real alert will try again */
        });
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };

    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);

    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      audio.pause();
      alertAudioRef.current = null;
    };
  }, [canAccess]);

  const playAlertSound = useCallback(() => {
    if (!alertsEnabledRef.current) return;
    try {
      const audio = alertAudioRef.current ?? new Audio(ALERT_SOUND);
      audio.currentTime = 0;
      audio.volume = Math.min(1, Math.max(0, alertVolumeRef.current));
      audio.play().catch((err) => console.warn('Alerte sonore bloquée par le navigateur:', err));
    } catch (err) {
      console.warn('Alerte sonore indisponible:', err);
    }
  }, []);

  /**
   * Sound + toast + (when the tab is in the background) a system notification.
   * Deliberately does not touch the "+N" badge: that is derived from the pending
   * list, so it can only clear once the parcels have left "En attente".
   */
  const notifyArrivals = useCallback(
    (count: number, actorName?: string, preview?: NewTicketAlert['tickets']) => {
      if (count <= 0) return;

      setBannerHidden(false);
      playAlertSound();

      const headline =
        count === 1
          ? '1 nouveau colis à emballer'
          : `${count} nouveaux colis à emballer`;
      const detail = actorName ? `Envoyé par ${actorName}` : 'Envoyé à la livraison';

      toast.custom(
        (t) => (
          <div
            className={`bg-white rounded-2xl shadow-2xl border border-emerald-200 px-5 py-4 flex items-center gap-4 min-w-[320px] ${
              t.visible ? 'animate-in slide-in-from-top-4' : 'animate-out fade-out'
            }`}
          >
            <div className="w-11 h-11 rounded-xl bg-emerald-500 text-white flex items-center justify-center flex-shrink-0">
              <Truck size={22} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-black text-slate-900 leading-none mb-1">{headline}</p>
              <p className="text-[11px] font-bold text-slate-400 truncate">
                {detail}
                {preview?.[0]?.customerCity ? ` · ${preview[0].customerCity}` : ''}
              </p>
            </div>
            <button
              onClick={() => {
                setActiveTab('pending');
                toast.dismiss(t.id);
              }}
              className="px-3 py-2 rounded-lg bg-slate-900 text-white text-[11px] font-black hover:bg-black transition-all flex-shrink-0"
            >
              Voir
            </button>
          </div>
        ),
        { duration: 6000, position: 'top-right' }
      );

      // The desk often has the tab in the background while printing — surface it
      // at the OS level too, when the user has granted permission.
      try {
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted' && document.hidden) {
          new Notification(headline, {
            body: detail,
            icon: '/logo-icon.svg',
            tag: 'silacod-new-tickets',
          });
        }
      } catch {
        /* Notification API unavailable — the in-app toast already covered it */
      }
    },
    [playAlertSound, setActiveTab]
  );

  useEffect(() => {
    if (!socket || !canAccess) return;

    const onNewTickets = (payload: NewTicketAlert) => {
      const count = Number(payload?.count) || payload?.tickets?.length || 0;
      if (count <= 0) return;

      setLastAlert(payload);

      // Toast straight away for instant feedback, and note which codes it covered
      // so the refresh below doesn't announce the same arrivals a second time.
      payload.tickets?.forEach((t) => {
        if (t.packageCode) announcedCodesRef.current.add(t.packageCode);
      });

      notifyArrivals(count, payload.actor?.name, payload.tickets);
      fetchData({ silent: true });
    };

    socket.on(TICKETS_NEW_EVENT, onNewTickets);
    return () => {
      socket.off(TICKETS_NEW_EVENT, onNewTickets);
    };
  }, [socket, canAccess, notifyArrivals, fetchData]);

  // ───────────────────────────────────────────────────────────── derived data

  /** Flattens the product-grouped API payload into one row per physical parcel. */
  const parcels = useMemo<Parcel[]>(() => {
    const byCode = new Map<string, Parcel>();

    rawProducts.forEach((product) => {
      const productRef: ProductRef = {
        id: product.id,
        name: product.name,
        sku: product.sku,
        image: product.image,
      };

      product.pendingParcels.forEach((p) => {
        if (!p.coliatyPackageCode) return;
        const existing = byCode.get(p.coliatyPackageCode);

        if (existing) {
          if (!existing.products.some((pr) => pr.id === product.id)) {
            existing.products.push(productRef);
            existing.search += ` ${normalize(product.name)} ${normalize(product.sku)}`;
          }
          return;
        }

        byCode.set(p.coliatyPackageCode, {
          code: p.coliatyPackageCode,
          orderId: p.id,
          orderNumber: p.orderNumber,
          customerName: p.customerName,
          customerPhone: p.customerPhone,
          customerCity: p.customerCity,
          pickupRef: p.coliatyPickupRef || undefined,
          amount: Number(p.totalAmountMad) || 0,
          createdAt: p.createdAt,
          products: [productRef],
          search: [
            p.coliatyPackageCode,
            p.orderNumber,
            p.customerName,
            p.customerPhone,
            p.customerCity,
            p.coliatyPickupRef,
            product.name,
            product.sku,
          ]
            .map(normalize)
            .join(' '),
        });
      });
    });

    return [...byCode.values()];
  }, [rawProducts]);

  const pendingParcels = useMemo(() => parcels.filter((p) => !p.pickupRef), [parcels]);

  /**
   * Single owner of the "+N nouveau" flag, and the fallback for when the socket
   * is down: any code that turns up in "En attente" and wasn't there before is a
   * new arrival, and any flagged code that leaves the list has been dealt with —
   * which is precisely what "Créer bon de ramassage" does to it.
   */
  useEffect(() => {
    if (loading) return;

    const codes = new Set(pendingParcels.map((p) => p.code));
    const previous = knownCodesRef.current;
    knownCodesRef.current = codes;

    // First load: nothing on screen counts as an arrival, but the flags restored
    // from localStorage still need reconciling — anything bagged in the meantime
    // (another tab, another helper, a previous session) is no longer new.
    if (previous === null) {
      setNewCodeList((prev) => {
        const kept = prev.filter((code) => codes.has(code));
        return kept.length === prev.length ? prev : kept;
      });
      return;
    }

    const fresh = [...codes].filter((code) => !previous.has(code));
    const gone = [...previous].filter((code) => !codes.has(code));
    if (fresh.length === 0 && gone.length === 0) return;

    gone.forEach((code) => announcedCodesRef.current.delete(code));

    setNewCodeList((prev) => {
      const goneSet = new Set(gone);
      const next = prev.filter((code) => !goneSet.has(code));
      fresh.forEach((code) => {
        if (!next.includes(code)) next.push(code);
      });
      return next.length === prev.length && next.every((code, i) => code === prev[i]) ? prev : next;
    });

    // Arrivals the socket already toasted must not be toasted again.
    const unannounced = fresh.filter((code) => !announcedCodesRef.current.has(code));
    if (unannounced.length > 0) notifyArrivals(unannounced.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingParcels, loading]);

  const bons = useMemo<Bon[]>(() => {
    const map = new Map<string, Bon>();
    parcels.forEach((parcel) => {
      if (!parcel.pickupRef) return;
      let bon = map.get(parcel.pickupRef);
      if (!bon) {
        bon = { ref: parcel.pickupRef, parcels: [], date: parcel.createdAt, products: [] };
        map.set(parcel.pickupRef, bon);
      }
      bon.parcels.push(parcel);
      if (new Date(parcel.createdAt) > new Date(bon.date)) bon.date = parcel.createdAt;
      parcel.products.forEach((pr) => {
        if (!bon!.products.some((x) => x.id === pr.id)) bon!.products.push(pr);
      });
    });
    return [...map.values()].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [parcels]);

  const activeBons = useMemo(() => bons.filter((b) => !isBonCollected(bonDetails[b.ref])), [bons, bonDetails]);
  const collectedBons = useMemo(() => bons.filter((b) => isBonCollected(bonDetails[b.ref])), [bons, bonDetails]);

  const productOptions = useMemo(() => {
    const counts = new Map<number, { product: ProductRef; count: number }>();
    pendingParcels.forEach((parcel) =>
      parcel.products.forEach((pr) => {
        const entry = counts.get(pr.id);
        if (entry) entry.count += 1;
        else counts.set(pr.id, { product: pr, count: 1 });
      })
    );
    return [...counts.values()].sort((a, b) => b.count - a.count);
  }, [pendingParcels]);

  const cityOptions = useMemo(() => {
    const counts = new Map<string, number>();
    pendingParcels.forEach((p) => {
      const city = p.customerCity || '—';
      counts.set(city, (counts.get(city) || 0) + 1);
    });
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [pendingParcels]);

  /** Pending parcels after search + filters + sort — the list every action works on. */
  const filteredPending = useMemo(() => {
    const needle = normalize(searchQuery.trim());
    let list = pendingParcels;

    if (needle) list = list.filter((p) => p.search.includes(needle));
    if (productFilter !== 'all') list = list.filter((p) => p.products.some((pr) => pr.id === productFilter));
    if (cityFilter !== 'all') list = list.filter((p) => (p.customerCity || '—') === cityFilter);

    const sorted = [...list];
    sorted.sort((a, b) => {
      switch (sortKey) {
        case 'oldest':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'city':
          return (a.customerCity || '').localeCompare(b.customerCity || '', 'fr');
        case 'customer':
          return (a.customerName || '').localeCompare(b.customerName || '', 'fr');
        case 'amount':
          return b.amount - a.amount;
        case 'product':
          return (a.products[0]?.name || '').localeCompare(b.products[0]?.name || '', 'fr');
        case 'recent':
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });
    return sorted;
  }, [pendingParcels, searchQuery, productFilter, cityFilter, sortKey]);

  const visiblePending = useMemo(() => filteredPending.slice(0, visibleCount), [filteredPending, visibleCount]);

  // Shift+click needs the row's position in the visible list. Grouped rendering
  // breaks that order up, so keep a lookup instead of scanning the array per row.
  const visibleIndexByCode = useMemo(() => {
    const map = new Map<string, number>();
    visiblePending.forEach((parcel, index) => map.set(parcel.code, index));
    return map;
  }, [visiblePending]);

  const groupedPending = useMemo(() => {
    if (!groupByProduct) return [];
    const groups = new Map<number, { product: ProductRef; parcels: Parcel[] }>();
    visiblePending.forEach((parcel) => {
      const pr = parcel.products[0];
      if (!pr) return;
      const entry = groups.get(pr.id);
      if (entry) entry.parcels.push(parcel);
      else groups.set(pr.id, { product: pr, parcels: [parcel] });
    });
    return [...groups.values()].sort((a, b) => b.parcels.length - a.parcels.length);
  }, [visiblePending, groupByProduct]);

  // Selection is stored by code, so it survives filtering. Actions must only ever
  // act on codes that are still pending — never on one that already joined a bon.
  const selectableCodes = useMemo(() => new Set(pendingParcels.map((p) => p.code)), [pendingParcels]);

  const selectedCodes = useMemo(
    () => [...selected].filter((code) => selectableCodes.has(code)),
    [selected, selectableCodes]
  );

  const selectedCount = selectedCodes.length;
  const filteredSelectedCount = useMemo(
    () => filteredPending.reduce((acc, p) => acc + (selected.has(p.code) ? 1 : 0), 0),
    [filteredPending, selected]
  );
  const allFilteredSelected = filteredPending.length > 0 && filteredSelectedCount === filteredPending.length;

  useEffect(() => setVisibleCount(pageSize), [pageSize, searchQuery, productFilter, cityFilter, sortKey]);

  // Drop selected codes that were consumed by a bon on the last refresh.
  useEffect(() => {
    setSelected((prev) => {
      if (prev.size === 0) return prev;
      const next = new Set([...prev].filter((code) => selectableCodes.has(code)));
      return next.size === prev.size ? prev : next;
    });
  }, [selectableCodes]);

  // ───────────────────────────────────────────────────────────── selection

  const toggleCode = useCallback((code: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }, []);

  /** Shift+click selects everything between the previous click and this one. */
  const handleRowClick = useCallback(
    (index: number, code: string, shiftKey: boolean) => {
      if (shiftKey && lastClickedIndex.current !== null) {
        const [from, to] = [lastClickedIndex.current, index].sort((a, b) => a - b);
        const range = visiblePending.slice(from, to + 1).map((p) => p.code);
        setSelected((prev) => {
          const next = new Set(prev);
          range.forEach((c) => next.add(c));
          return next;
        });
      } else {
        toggleCode(code);
      }
      lastClickedIndex.current = index;
    },
    [visiblePending, toggleCode]
  );

  const selectAllFiltered = useCallback(() => {
    setSelected((prev) => {
      const next = new Set(prev);
      const isFull = filteredPending.every((p) => next.has(p.code));
      if (isFull) filteredPending.forEach((p) => next.delete(p.code));
      else filteredPending.forEach((p) => next.add(p.code));
      return next;
    });
  }, [filteredPending]);

  const clearSelection = useCallback(() => {
    setSelected(new Set());
    lastClickedIndex.current = null;
  }, []);

  // ───────────────────────────────────────────────────────────── ticket actions

  /**
   * Fetches labels for many codes as a single merged PDF. The server does the
   * merging and paces its own calls to Coliaty, so a 300-ticket print run is one
   * request from here instead of 300.
   */
  const fetchMergedLabels = useCallback(async (codes: string[], toastId: string): Promise<Blob | null> => {
    const batches = chunk(codes, SERVER_LABEL_BATCH);
    const pdfs: string[] = [];
    let merged = 0;
    const failures: { code: string; message: string }[] = [];

    for (let i = 0; i < batches.length; i++) {
      if (batches.length > 1) {
        toast.loading(`Lot ${i + 1}/${batches.length} — ${merged}/${codes.length} tickets prêts...`, { id: toastId });
      }
      const res = await ordersApi.getParcelLabelsBatch(batches[i]);
      const payload = res.data?.data;
      if (payload?.pdf) {
        pdfs.push(payload.pdf);
        merged += payload.merged || 0;
      }
      if (Array.isArray(payload?.failed)) failures.push(...payload.failed);
    }

    if (pdfs.length === 0) return null;

    if (failures.length > 0) {
      console.warn('Étiquettes indisponibles:', failures);
      toast(`${failures.length} ticket(s) indisponible(s) — voir la console`, { icon: '⚠️' });
    }

    if (pdfs.length === 1) return base64ToBlob(pdfs[0]);

    // More than one server batch: stitch the parts together client-side.
    const { PDFDocument } = await import('pdf-lib');
    const out = await PDFDocument.create();
    for (const part of pdfs) {
      const doc = await PDFDocument.load(part);
      const pages = await out.copyPages(doc, doc.getPageIndices());
      pages.forEach((page) => out.addPage(page));
    }
    const bytes = await out.save();
    return new Blob([bytes as any], { type: 'application/pdf' });
  }, []);

  const runBulkLabels = useCallback(
    async (codes: string[], action: 'download' | 'print', filename: string) => {
      if (codes.length === 0) {
        toast.error('Aucun ticket sélectionné');
        return;
      }
      setBusyLabel(action);
      const toastId = toast.loading(`Préparation de ${codes.length} ticket(s)...`);
      try {
        const blob = await fetchMergedLabels(codes, toastId);
        if (!blob) {
          toast.error("Aucune étiquette n'a pu être récupérée.", { id: toastId });
          return;
        }
        if (action === 'print') {
          printPdf(blob);
          toast.success(`${codes.length} ticket(s) envoyés à l'impression`, { id: toastId });
        } else {
          saveBlob(blob, filename);
          toast.success(`${codes.length} ticket(s) téléchargés`, { id: toastId });
        }
      } catch (err: any) {
        toast.error(errorMessage(err, 'Erreur lors de la génération des tickets'), { id: toastId });
      } finally {
        setBusyLabel(null);
      }
    },
    [fetchMergedLabels]
  );

  const handleSingleLabel = useCallback(async (code: string, action: 'download' | 'print') => {
    setDownloadingCode(code);
    try {
      const res = await ordersApi.getParcelLabel(code);
      const base64 = res.data?.data?.pdf;
      if (!base64) throw new Error('Données PDF manquantes');
      const blob = base64ToBlob(base64);
      if (action === 'print') {
        printPdf(blob);
        toast.success(`Ticket ${code} envoyé à l'impression`);
      } else {
        saveBlob(blob, `ticket-${code}.pdf`);
        toast.success('Ticket téléchargé');
      }
    } catch (err: any) {
      toast.error(errorMessage(err, 'Erreur lors du téléchargement'));
    } finally {
      setDownloadingCode(null);
    }
  }, []);

  const copyCode = useCallback(async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      toast.success(`${code} copié`);
    } catch {
      toast.error('Copie impossible');
    }
  }, []);

  // ───────────────────────────────────────────────────────────── bon actions

  const createBon = useCallback(async () => {
    const codes = selectedCodes;
    if (codes.length === 0) {
      toast.error('Sélectionnez au moins un colis');
      return;
    }

    setCreatingBon(true);
    const toastId = toast.loading(`Création du bon pour ${codes.length} colis...`);

    try {
      const createRes = await ordersApi.createPickupNote();
      const ref = createRes.data?.data?.reference;
      if (!ref) throw new Error('Impossible de créer la référence du bon');

      toast.loading(`Ajout de ${codes.length} colis au bon ${ref}...`, { id: toastId });
      const addRes = await ordersApi.addParcelsToPickup({ pickup_note_reference: ref, parcel_codes: codes });

      const successParcels = addRes.data?.data?.success_parcels;
      const successCount = Array.isArray(successParcels)
        ? successParcels.length
        : Object.keys(successParcels || {}).length;

      const errorParcels = addRes.data?.data?.error_parcels || {};
      const errorCodes = Object.keys(errorParcels);
      const alreadyInBon = errorCodes.some((code) =>
        String(errorParcels[code]?.message || '').includes('déjà dans un bon')
      );

      if (successCount === 0) {
        if (alreadyInBon) {
          toast.success('Colis déjà rattachés à un bon existant — synchronisation…', { id: toastId });
          clearSelection();
          await fetchData({ silent: true, refreshDetails: true });
          return;
        }
        const first = errorCodes.length > 0 ? errorParcels[errorCodes[0]] : null;
        throw new Error(
          `Aucun colis ajouté${first?.message ? `: ${first.message}` : ` (${errorCodes.length} erreurs)`}`
        );
      }

      toast.success(
        `Bon ${ref} créé avec ${successCount} colis${errorCodes.length ? ` (${errorCodes.length} ignorés)` : ''}`,
        { id: toastId }
      );

      clearSelection();
      setActiveTab('created');
      await fetchData({ silent: true, refreshDetails: true });
    } catch (err: any) {
      toast.error(errorMessage(err, 'Erreur lors de la création du bon'), { id: toastId });
    } finally {
      setCreatingBon(false);
    }
  }, [selectedCodes, clearSelection, fetchData, setActiveTab]);

  const markBonDownloaded = useCallback(
    (ref: string) => {
      setDownloadedBons((prev) => (prev.includes(ref) ? prev : [...prev, ref]));
    },
    [setDownloadedBons]
  );

  const handleBonLabels = useCallback(
    async (ref: string, action: 'download' | 'print') => {
      setBonBusy(ref);
      const toastId = toast.loading(`Génération du bon ${ref}...`);
      try {
        const res = await ordersApi.generatePickupLabels(ref);
        const base64 = res.data?.data?.pdf || (typeof res.data?.data === 'string' ? res.data.data : null);
        if (!base64) throw new Error('Données PDF manquantes dans la réponse');

        const blob = base64ToBlob(base64);
        if (action === 'print') {
          printPdf(blob);
          toast.success(`Bon ${ref} envoyé à l'impression`, { id: toastId });
        } else {
          saveBlob(blob, `bon-ramassage-${ref}.pdf`);
          toast.success(`Bon ${ref} téléchargé`, { id: toastId });
        }
        markBonDownloaded(ref);
      } catch (err: any) {
        toast.error(errorMessage(err, 'Erreur lors de la génération du PDF'), { id: toastId });
      } finally {
        setBonBusy(null);
      }
    },
    [markBonDownloaded]
  );

  const refreshBon = useCallback(
    async (ref: string) => {
      setBonBusy(ref);
      try {
        const res = await ordersApi.getPickupNoteDetail(ref, true);
        setBonDetails((prev) => ({ ...prev, [ref]: res.data?.data ?? res.data }));
      } catch (err: any) {
        toast.error(errorMessage(err, 'Erreur lors de la récupération du détail'));
      } finally {
        setBonBusy(null);
      }
    },
    []
  );

  const removeParcelFromBon = useCallback(
    async (ref: string, code: string) => {
      setRemovingParcel(code);
      try {
        await ordersApi.removeParcelsFromPickup({ pickup_note_reference: ref, parcel_codes: [code] });

        // It is about to reappear in "En attente" — pre-register it so the
        // new-ticket watcher doesn't announce the desk's own action as an arrival.
        knownCodesRef.current?.add(code);

        toast.success(`Colis ${code} retiré du bon ${ref}`);
        await refreshBon(ref);
        await fetchData({ silent: true });
      } catch (err: any) {
        toast.error(errorMessage(err, 'Erreur lors du retrait'));
      } finally {
        setRemovingParcel(null);
        setConfirmRemove(null);
      }
    },
    [refreshBon, fetchData]
  );

  const toggleBon = useCallback(
    (ref: string) => {
      setExpandedBon((prev) => (prev === ref ? null : ref));
      if (!bonDetails[ref]) refreshBon(ref);
    },
    [bonDetails, refreshBon]
  );

  // ───────────────────────────────────────────────────────────── scan mode

  const handleScanSubmit = useCallback(
    (raw: string) => {
      const code = raw.trim();
      if (!code) return;

      const match = pendingParcels.find(
        (p) =>
          p.code.toLowerCase() === code.toLowerCase() ||
          p.orderNumber?.toLowerCase() === code.toLowerCase()
      );

      if (!match) {
        const inBon = parcels.find((p) => p.code.toLowerCase() === code.toLowerCase());
        setScanFeedback({
          ok: false,
          text: inBon ? `${code} est déjà dans le bon ${inBon.pickupRef}` : `${code} introuvable`,
        });
        setScanValue('');
        return;
      }

      setSelected((prev) => {
        const next = new Set(prev);
        next.add(match.code);
        return next;
      });
      setScanFeedback({ ok: true, text: `${match.code} · ${match.customerName} · ${match.customerCity}` });
      setScanValue('');
    },
    [pendingParcels, parcels]
  );

  useEffect(() => {
    if (!scanFeedback) return;
    const id = setTimeout(() => setScanFeedback(null), 2500);
    return () => clearTimeout(id);
  }, [scanFeedback]);

  useEffect(() => {
    if (scanMode) scanRef.current?.focus();
  }, [scanMode]);

  // ───────────────────────────────────────────────────────────── shortcuts

  useEffect(() => {
    if (!canAccess) return;

    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable);

      if (e.key === 'Escape') {
        if (showShortcuts) return setShowShortcuts(false);
        if (confirmCreate || confirmRemove) return;
        if (typing) {
          (target as HTMLElement).blur();
          if (target === searchRef.current) setSearchQuery('');
          return;
        }
        clearSelection();
        return;
      }

      if (typing || lightbox || e.ctrlKey || e.metaKey || e.altKey) return;

      switch (e.key) {
        case '/':
          e.preventDefault();
          searchRef.current?.focus();
          break;
        case '?':
          e.preventDefault();
          setShowShortcuts(true);
          break;
        case '1':
          setActiveTab('pending');
          break;
        case '2':
          setActiveTab('created');
          break;
        case '3':
          setActiveTab('collected');
          break;
        case 's':
        case 'S':
          e.preventDefault();
          setScanMode(true);
          setTimeout(() => scanRef.current?.focus(), 50);
          break;
        case 'a':
        case 'A':
          if (activeTab === 'pending') {
            e.preventDefault();
            selectAllFiltered();
          }
          break;
        case 'x':
        case 'X':
          clearSelection();
          break;
        case 'g':
        case 'G':
          setGroupByProduct((v) => !v);
          break;
        case 'r':
        case 'R':
          fetchData({ silent: true, refreshDetails: true });
          break;
        case 'n':
        case 'N': {
          const next = !alertsEnabledRef.current;
          setAlertsEnabled(next);
          if (next) playAlertSound();
          break;
        }
        case 'b':
        case 'B':
          if (selectedCount > 0 && !creatingBon) setConfirmCreate(true);
          break;
        case 'd':
        case 'D':
          if (selectedCount > 0 && !busyLabel) {
            runBulkLabels(selectedCodes, 'download', `tickets-${selectedCount}pcs.pdf`);
          }
          break;
        case 'p':
        case 'P':
          if (selectedCount > 0 && !busyLabel) runBulkLabels(selectedCodes, 'print', '');
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    canAccess,
    activeTab,
    showShortcuts,
    confirmCreate,
    confirmRemove,
    lightbox,
    selectedCount,
    selectedCodes,
    creatingBon,
    busyLabel,
    clearSelection,
    selectAllFiltered,
    runBulkLabels,
    fetchData,
    setActiveTab,
    setGroupByProduct,
    setAlertsEnabled,
    playAlertSound,
  ]);

  // ───────────────────────────────────────────────────────────── guards

  if (!canAccess) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center px-4">
        <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-3xl flex items-center justify-center mb-6">
          <ShieldAlert size={40} />
        </div>
        <h2 className="text-2xl font-black text-slate-800 mb-2">Accès Non Autorisé</h2>
        <p className="text-slate-500 max-w-md mb-8">
          Vous n'avez pas la permission de gérer les tickets. Veuillez contacter un administrateur pour obtenir l'accès.
        </p>
        <Link
          to="/helper"
          className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all shadow-xl shadow-slate-200"
        >
          Retour au Tableau de Bord
        </Link>
      </div>
    );
  }

  if (loading) return <PageLoader />;

  // ───────────────────────────────────────────────────────────── renderers

  const renderTableRow = (parcel: Parcel, index: number) => {
    const isSelected = selected.has(parcel.code);
    const isNewArrival = newCodes.has(parcel.code);
    return (
      <tr
        key={parcel.code}
        onClick={(e) => handleRowClick(index, parcel.code, e.shiftKey)}
        className={`cursor-pointer transition-colors select-none ${
          isSelected
            ? 'bg-primary-50/70'
            : isNewArrival
              ? 'bg-emerald-50/70 hover:bg-emerald-100/70'
              : 'hover:bg-slate-50'
        }`}
      >
        {/* Inset shadow rather than a border: <tr>/<td> borders collapse away. */}
        <td className={`px-4 py-2.5 ${isNewArrival ? 'shadow-[inset_3px_0_0_0_#10b981]' : ''}`}>
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => {}}
            onClick={(e) => {
              e.stopPropagation();
              handleRowClick(index, parcel.code, e.shiftKey);
            }}
            className="w-4 h-4 rounded border-2 border-slate-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
          />
        </td>
        <td className="px-4 py-2.5">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-xs font-bold text-slate-800">{parcel.code}</span>
            {isNewArrival && (
              <span className="px-1.5 py-0.5 rounded-md bg-emerald-500 text-white text-[9px] font-black uppercase tracking-wider whitespace-nowrap">
                Nouveau
              </span>
            )}
          </div>
          <span className="block text-[10px] font-bold text-slate-400">#{parcel.orderNumber}</span>
        </td>
        <td className="px-4 py-2.5">
          <span className="text-xs font-black text-slate-800 block truncate max-w-[180px]">{parcel.customerName}</span>
          <span className="text-[10px] font-bold text-slate-400">{parcel.customerPhone}</span>
        </td>
        <td className="px-4 py-2.5">
          <span className="text-xs font-bold text-slate-600">{parcel.customerCity}</span>
        </td>
        <td className="px-4 py-2.5">
          <div className="flex items-center gap-2">
            {parcel.products[0]?.image ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setLightbox({
                    src: parcel.products[0].image!,
                    name: parcel.products[0].name,
                    sub: parcel.code,
                  });
                }}
                title="Agrandir l'image"
                className="flex-shrink-0 rounded-xl overflow-hidden hover:ring-2 hover:ring-primary-300 transition-all active:scale-95 cursor-zoom-in"
              >
                <img src={parcel.products[0].image} alt={parcel.products[0].name} className="w-11 h-11 object-cover block" />
              </button>
            ) : (
              <div className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0 text-slate-300">
                <Package size={20} />
              </div>
            )}
            <span className="text-xs font-bold text-slate-600 truncate max-w-[200px]">
              {parcel.products.map((p) => p.name).join(' + ') || '—'}
            </span>
          </div>
        </td>
        <td className="px-4 py-2.5 text-right">
          <span className="text-xs font-black text-slate-800">{parcel.amount} MAD</span>
        </td>
        <td className="px-4 py-2.5 whitespace-nowrap">
          <span className="text-[10px] font-bold text-slate-400">
            {new Date(parcel.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
          </span>
        </td>
        <td className="px-4 py-2.5">
          <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => copyCode(parcel.code)}
              className="p-1.5 rounded-lg text-slate-300 hover:text-slate-700 hover:bg-slate-100 transition-all"
              title="Copier le code"
            >
              <Copy size={14} />
            </button>
            <button
              onClick={() => handleSingleLabel(parcel.code, 'print')}
              disabled={downloadingCode === parcel.code}
              className="p-1.5 rounded-lg text-slate-400 hover:text-primary-600 hover:bg-primary-50 transition-all disabled:opacity-40"
              title="Imprimer le ticket"
            >
              <Printer size={14} />
            </button>
            <button
              onClick={() => handleSingleLabel(parcel.code, 'download')}
              disabled={downloadingCode === parcel.code}
              className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-all disabled:opacity-40"
              title="Télécharger le ticket"
            >
              {downloadingCode === parcel.code ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Download size={14} />
              )}
            </button>
          </div>
        </td>
      </tr>
    );
  };

  const renderCard = (parcel: Parcel, index: number) => {
    const isSelected = selected.has(parcel.code);
    const isNewArrival = newCodes.has(parcel.code);
    return (
      <div
        key={parcel.code}
        onClick={(e) => handleRowClick(index, parcel.code, e.shiftKey)}
        className={`rounded-2xl p-4 border-2 transition-all cursor-pointer select-none ${
          isSelected
            ? 'border-primary-500 bg-white shadow-lg shadow-primary-500/10'
            : isNewArrival
              ? 'border-emerald-400 bg-emerald-50/60 hover:shadow-md'
              : 'bg-white border-slate-100 hover:border-primary-200 hover:shadow-md'
        }`}
      >
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => {}}
              onClick={(e) => {
                e.stopPropagation();
                handleRowClick(index, parcel.code, e.shiftKey);
              }}
              className="w-4 h-4 rounded border-2 border-slate-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
            />
            <span className="font-mono text-[11px] font-black text-slate-700">{parcel.code}</span>
            {isNewArrival && (
              <span className="px-1.5 py-0.5 rounded-md bg-emerald-500 text-white text-[9px] font-black uppercase tracking-wider whitespace-nowrap">
                Nouveau
              </span>
            )}
          </div>
          <span className="text-[10px] font-black text-slate-400">#{parcel.orderNumber}</span>
        </div>

        <div className="space-y-2 mb-3">
          <div className="flex items-center gap-2">
            <User size={13} className="text-slate-300 flex-shrink-0" />
            <span className="text-xs font-black text-slate-800 truncate">{parcel.customerName}</span>
          </div>
          <div className="flex items-center gap-2">
            <Phone size={13} className="text-slate-300 flex-shrink-0" />
            <span className="text-[11px] font-bold text-slate-500">{parcel.customerPhone}</span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin size={13} className="text-slate-300 flex-shrink-0" />
            <span className="text-[11px] font-bold text-slate-500 truncate">{parcel.customerCity}</span>
          </div>
          <div className="flex items-center gap-2">
            <Package size={13} className="text-slate-300 flex-shrink-0" />
            <span className="text-[11px] font-bold text-slate-500 truncate">
              {parcel.products.map((p) => p.name).join(' + ') || '—'}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-slate-100" onClick={(e) => e.stopPropagation()}>
          <span className="text-sm font-black text-primary-600">{parcel.amount} MAD</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => copyCode(parcel.code)}
              className="p-1.5 rounded-lg text-slate-300 hover:text-slate-700 hover:bg-slate-100 transition-all"
              title="Copier le code"
            >
              <Copy size={14} />
            </button>
            <button
              onClick={() => handleSingleLabel(parcel.code, 'print')}
              disabled={downloadingCode === parcel.code}
              className="p-1.5 rounded-lg text-slate-400 hover:text-primary-600 hover:bg-primary-50 transition-all disabled:opacity-40"
              title="Imprimer le ticket"
            >
              <Printer size={14} />
            </button>
            <button
              onClick={() => handleSingleLabel(parcel.code, 'download')}
              disabled={downloadingCode === parcel.code}
              className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-all disabled:opacity-40"
              title="Télécharger le ticket"
            >
              {downloadingCode === parcel.code ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Download size={14} />
              )}
            </button>
          </div>
        </div>
      </div>
    );
  };

  /**
   * `checked`/`onToggle` are passed in so a grouped table's header toggles only
   * that product's rows, while the flat table's header toggles every filtered row.
   */
  const renderTableHeader = (checked: boolean, onToggle: () => void, title: string) => (
    <thead className="bg-slate-50 sticky top-0 z-10">
      <tr>
        <th className="px-4 py-3 text-left w-12">
          <input
            type="checkbox"
            checked={checked}
            onChange={onToggle}
            className="w-4 h-4 rounded border-2 border-slate-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
            title={title}
          />
        </th>
        <th className="px-4 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Code</th>
        <th className="px-4 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Client</th>
        <th className="px-4 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Ville</th>
        <th className="px-4 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Produit</th>
        <th className="px-4 py-3 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Montant</th>
        <th className="px-4 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</th>
        <th className="px-4 py-3 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Actions</th>
      </tr>
    </thead>
  );

  const emptyPending = (
    <div className="bg-white rounded-3xl p-16 text-center border-2 border-dashed border-slate-200">
      <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-5 text-slate-300">
        <Package size={40} />
      </div>
      <h2 className="text-xl font-black text-slate-900 mb-2">
        {pendingParcels.length === 0 ? 'Aucun colis en attente' : 'Aucun résultat'}
      </h2>
      <p className="text-slate-400 text-sm max-w-md mx-auto">
        {pendingParcels.length === 0
          ? 'Tous les colis ont été rattachés à un bon de ramassage.'
          : 'Aucun colis ne correspond à votre recherche ou à vos filtres.'}
      </p>
      {pendingParcels.length > 0 && (
        <button
          onClick={() => {
            setSearchQuery('');
            setProductFilter('all');
            setCityFilter('all');
          }}
          className="mt-6 px-6 py-3 bg-slate-900 text-white rounded-xl font-black text-xs hover:bg-black transition-all"
        >
          Réinitialiser les filtres
        </button>
      )}
    </div>
  );

  const pendingContent =
    filteredPending.length === 0 ? (
      emptyPending
    ) : (
      <div className="space-y-4">
        {viewMode === 'table' ? (
          groupByProduct ? (
            <div className="space-y-4">
              {groupedPending.map((group) => {
                const collapsed = collapsedGroups.has(group.product.id);
                const groupCodes = group.parcels.map((p) => p.code);
                const allSelected = groupCodes.every((c) => selected.has(c));
                return (
                  <div key={group.product.id} className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
                    <div className="px-5 py-4 flex items-center gap-4 bg-slate-50/60 border-b border-slate-100">
                      <button
                        onClick={() =>
                          setCollapsedGroups((prev) => {
                            const next = new Set(prev);
                            if (next.has(group.product.id)) next.delete(group.product.id);
                            else next.add(group.product.id);
                            return next;
                          })
                        }
                        className={`p-1.5 rounded-lg text-slate-400 hover:bg-white transition-all ${collapsed ? '' : 'rotate-180'}`}
                      >
                        <ChevronDown size={18} />
                      </button>
                      {group.product.image ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setLightbox({
                              src: group.product.image!,
                              name: group.product.name,
                              sub: group.product.sku,
                            });
                          }}
                          title="Agrandir l'image"
                          className="flex-shrink-0 rounded-2xl overflow-hidden border border-slate-100 hover:ring-2 hover:ring-primary-300 transition-all active:scale-95 cursor-zoom-in"
                        >
                          <img
                            src={group.product.image}
                            alt={group.product.name}
                            className="w-[100px] h-[100px] object-cover block"
                          />
                        </button>
                      ) : (
                        <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-300 flex-shrink-0">
                          <Package size={26} />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-black text-slate-800 truncate">{group.product.name}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          {group.product.sku} · {group.parcels.length} colis
                        </p>
                      </div>
                      <button
                        onClick={() =>
                          setSelected((prev) => {
                            const next = new Set(prev);
                            if (allSelected) groupCodes.forEach((c) => next.delete(c));
                            else groupCodes.forEach((c) => next.add(c));
                            return next;
                          })
                        }
                        className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-[11px] font-black text-slate-600 hover:border-primary-300 hover:text-primary-600 transition-all"
                      >
                        {allSelected ? 'Désélectionner' : 'Sélectionner tout'}
                      </button>
                    </div>
                    {!collapsed && (
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          {renderTableHeader(
                            allSelected,
                            () =>
                              setSelected((prev) => {
                                const next = new Set(prev);
                                if (allSelected) groupCodes.forEach((c) => next.delete(c));
                                else groupCodes.forEach((c) => next.add(c));
                                return next;
                              }),
                            'Sélectionner les colis de ce produit'
                          )}
                          <tbody className="divide-y divide-slate-50">
                            {group.parcels.map((parcel) =>
                              renderTableRow(parcel, visibleIndexByCode.get(parcel.code) ?? 0)
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
              <div className="overflow-auto max-h-[calc(100vh-22rem)] min-h-[20rem]">
                <table className="w-full">
                  {renderTableHeader(
                    allFilteredSelected,
                    selectAllFiltered,
                    'Tout sélectionner (résultats filtrés)'
                  )}
                  <tbody className="divide-y divide-slate-50">
                    {visiblePending.map((parcel, index) => renderTableRow(parcel, index))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {visiblePending.map((parcel, index) => renderCard(parcel, index))}
          </div>
        )}

        {visibleCount < filteredPending.length && (
          <div className="flex items-center justify-center gap-3 py-4">
            <button
              onClick={() => setVisibleCount((v) => v + pageSize)}
              className="px-6 py-3 bg-white border border-slate-200 rounded-xl font-black text-xs text-slate-600 hover:border-primary-300 hover:text-primary-600 transition-all shadow-sm"
            >
              Afficher {Math.min(pageSize, filteredPending.length - visibleCount)} de plus
            </button>
            <button
              onClick={() => setVisibleCount(filteredPending.length)}
              className="px-6 py-3 bg-slate-900 text-white rounded-xl font-black text-xs hover:bg-black transition-all shadow-sm"
            >
              Tout afficher ({filteredPending.length})
            </button>
          </div>
        )}
      </div>
    );

  const renderBons = (list: Bon[], collectedTab: boolean) => {
    const needle = normalize(searchQuery.trim());
    const filtered = needle
      ? list.filter(
          (bon) =>
            normalize(bon.ref).includes(needle) ||
            bon.products.some((p) => normalize(p.name).includes(needle) || normalize(p.sku).includes(needle)) ||
            bon.parcels.some((p) => p.search.includes(needle))
        )
      : list;

    if (filtered.length === 0) {
      return (
        <div className="bg-white rounded-3xl p-16 text-center border-2 border-dashed border-slate-200">
          <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-5 text-slate-300">
            <CheckCircle size={40} />
          </div>
          <h2 className="text-xl font-black text-slate-900 mb-2">Aucun bon trouvé</h2>
          <p className="text-slate-400 text-sm max-w-md mx-auto">
            {searchQuery
              ? `Aucun bon ne correspond à "${searchQuery}".`
              : collectedTab
                ? "Aucun bon n'a encore été entièrement collecté."
                : "Aucun bon de ramassage actif. Sélectionnez des colis dans l'onglet « En attente » pour en créer un."}
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {filtered.map((bon) => {
          const detail = bonDetails[bon.ref];
          const note = detail?.pickup_note;
          const remoteParcels: any[] = detail?.parcels || [];
          const isExpanded = expandedBon === bon.ref;
          const isBusy = bonBusy === bon.ref;
          const isNew = !downloadedBons.includes(bon.ref) && !collectedTab;
          const total = note?.total_parcels ?? bon.parcels.length;
          const pickedUp = note?.picked_up_parcels ?? 0;

          return (
            <div
              key={bon.ref}
              className={`bg-white rounded-2xl border transition-all ${
                isExpanded
                  ? `${collectedTab ? 'border-blue-200 ring-blue-100' : 'border-emerald-200 ring-emerald-100'} shadow-xl ring-1`
                  : isNew
                    ? 'border-violet-300 shadow-[0_0_16px_rgba(139,92,246,0.12)]'
                    : 'border-slate-100 shadow-sm hover:shadow-md hover:border-slate-200'
              }`}
            >
              <div
                className="p-5 flex flex-col lg:flex-row lg:items-center gap-4 cursor-pointer"
                onClick={() => toggleBon(bon.ref)}
              >
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 relative ${
                    note?.is_complete
                      ? 'bg-emerald-500 text-white'
                      : note?.is_closed
                        ? 'bg-slate-400 text-white'
                        : collectedTab
                          ? 'bg-blue-50 text-blue-600'
                          : 'bg-emerald-50 text-emerald-600'
                  }`}
                >
                  <FileText size={22} />
                  {isNew && (
                    <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-violet-500 border-2 border-white" />
                    </span>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <h3 className="text-base font-mono font-black text-slate-900">{bon.ref}</h3>
                    {isNew && (
                      <span className="px-2 py-0.5 bg-violet-600 text-white rounded-full text-[9px] font-black uppercase tracking-wider">
                        Nouveau
                      </span>
                    )}
                    {!detail && (
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-400 rounded-full text-[9px] font-black uppercase tracking-wider">
                        Statut non chargé
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2.5 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-[10px] font-black uppercase tracking-wider border border-emerald-100">
                      {total} Colis
                    </span>
                    {note && (
                      <span className="px-2.5 py-1 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-black uppercase tracking-wider border border-blue-100">
                        {pickedUp}/{total} Collectés
                      </span>
                    )}
                    {note?.total_amount > 0 && (
                      <span className="px-2.5 py-1 bg-amber-50 text-amber-600 rounded-lg text-[10px] font-black uppercase tracking-wider border border-amber-100">
                        {note.total_amount} MAD
                      </span>
                    )}
                    <span className="px-2.5 py-1 bg-slate-50 text-slate-500 rounded-lg text-[10px] font-black uppercase tracking-wider border border-slate-100 flex items-center gap-1">
                      <Clock size={10} />
                      {new Date(bon.date).toLocaleString('fr-FR', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    {note?.is_complete && (
                      <span className="px-2.5 py-1 bg-emerald-500 text-white rounded-lg text-[10px] font-black uppercase tracking-wider">
                        ✓ Complet
                      </span>
                    )}
                    {note?.is_closed && !note?.is_complete && (
                      <span className="px-2.5 py-1 bg-slate-500 text-white rounded-lg text-[10px] font-black uppercase tracking-wider">
                        Fermé
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => refreshBon(bon.ref)}
                    disabled={isBusy}
                    className="p-2.5 bg-white text-slate-400 rounded-xl border border-slate-200 hover:text-emerald-600 hover:border-emerald-200 transition-all disabled:opacity-40"
                    title="Rafraîchir le statut"
                  >
                    <RefreshCw size={16} className={isBusy ? 'animate-spin' : ''} />
                  </button>
                  <button
                    onClick={() => handleBonLabels(bon.ref, 'print')}
                    disabled={isBusy}
                    className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-black hover:border-primary-300 hover:text-primary-600 transition-all disabled:opacity-40"
                    title="Imprimer le bon"
                  >
                    <Printer size={15} />
                    Imprimer
                  </button>
                  <button
                    onClick={() => handleBonLabels(bon.ref, 'download')}
                    disabled={isBusy}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black text-white transition-all shadow-lg active:scale-95 disabled:opacity-40 ${
                      isNew ? 'bg-violet-600 hover:bg-violet-700 shadow-violet-200' : 'bg-slate-900 hover:bg-black shadow-slate-200'
                    }`}
                  >
                    {isBusy ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                    Télécharger
                  </button>
                  <button
                    onClick={() => toggleBon(bon.ref)}
                    className={`p-2.5 rounded-xl transition-all ${
                      isExpanded ? 'bg-slate-900 text-white rotate-180' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
                    }`}
                  >
                    <ChevronDown size={18} />
                  </button>
                </div>
              </div>

              {isExpanded && (
                <div className="px-5 pb-6 border-t border-slate-100 pt-5">
                  {note && total > 0 && (
                    <div className="mb-5 p-4 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          Progression collecte
                        </span>
                        <span className="text-xs font-black text-slate-700">
                          {pickedUp}/{total}
                        </span>
                      </div>
                      <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${
                            collectedTab ? 'bg-blue-500' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${total ? (pickedUp / total) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {isBusy && remoteParcels.length === 0 ? (
                    <div className="flex items-center justify-center py-10 gap-3">
                      <Loader2 className="animate-spin text-slate-400" size={22} />
                      <span className="text-sm font-bold text-slate-400">Chargement depuis Coliaty...</span>
                    </div>
                  ) : remoteParcels.length > 0 ? (
                    <div className="overflow-x-auto rounded-xl border border-slate-100">
                      <table className="w-full">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="px-4 py-2.5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Statut</th>
                            <th className="px-4 py-2.5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Code</th>
                            <th className="px-4 py-2.5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Client</th>
                            <th className="px-4 py-2.5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Ville</th>
                            <th className="px-4 py-2.5 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Prix</th>
                            <th className="px-4 py-2.5 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {remoteParcels.map((parcel: any) => {
                            const badge = statusBadge(parcel.parcel_status);
                            return (
                              <tr key={parcel.parcel_code} className="hover:bg-slate-50/60 transition-colors">
                                <td className="px-4 py-2.5">
                                  <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider border ${badge.color}`}>
                                    {badge.label}
                                  </span>
                                </td>
                                <td className="px-4 py-2.5 font-mono text-xs font-bold text-slate-700">
                                  {parcel.parcel_code}
                                </td>
                                <td className="px-4 py-2.5">
                                  <span className="text-xs font-black text-slate-800 block truncate max-w-[160px]">
                                    {parcel.receiver}
                                  </span>
                                  <span className="text-[10px] font-bold text-slate-400">{parcel.phone}</span>
                                </td>
                                <td className="px-4 py-2.5 text-xs font-bold text-slate-600">{parcel.city_name}</td>
                                <td className="px-4 py-2.5 text-right text-xs font-black text-slate-800">
                                  {parcel.price} MAD
                                </td>
                                <td className="px-4 py-2.5">
                                  <div className="flex items-center justify-end gap-1">
                                    <button
                                      onClick={() => copyCode(parcel.parcel_code)}
                                      className="p-1.5 rounded-lg text-slate-300 hover:text-slate-700 hover:bg-slate-100 transition-all"
                                      title="Copier le code"
                                    >
                                      <Copy size={14} />
                                    </button>
                                    <button
                                      onClick={() => handleSingleLabel(parcel.parcel_code, 'print')}
                                      disabled={downloadingCode === parcel.parcel_code}
                                      className="p-1.5 rounded-lg text-slate-400 hover:text-primary-600 hover:bg-primary-50 transition-all disabled:opacity-40"
                                      title="Imprimer le ticket"
                                    >
                                      <Printer size={14} />
                                    </button>
                                    <button
                                      onClick={() => handleSingleLabel(parcel.parcel_code, 'download')}
                                      disabled={downloadingCode === parcel.parcel_code}
                                      className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-all disabled:opacity-40"
                                      title="Télécharger le ticket"
                                    >
                                      {downloadingCode === parcel.parcel_code ? (
                                        <Loader2 size={14} className="animate-spin" />
                                      ) : (
                                        <Download size={14} />
                                      )}
                                    </button>
                                    <button
                                      onClick={() => setConfirmRemove({ ref: bon.ref, code: parcel.parcel_code })}
                                      disabled={removingParcel === parcel.parcel_code}
                                      className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all disabled:opacity-40"
                                      title="Retirer du bon"
                                    >
                                      {removingParcel === parcel.parcel_code ? (
                                        <Loader2 size={14} className="animate-spin" />
                                      ) : (
                                        <Trash2 size={14} />
                                      )}
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-amber-600 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
                        <AlertTriangle size={16} />
                        <p className="text-xs font-bold">
                          Détail Coliaty indisponible — affichage des données locales.
                        </p>
                      </div>
                      <div className="overflow-x-auto rounded-xl border border-slate-100">
                        <table className="w-full">
                          <thead className="bg-slate-50">
                            <tr>
                              <th className="px-4 py-2.5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Code</th>
                              <th className="px-4 py-2.5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Client</th>
                              <th className="px-4 py-2.5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Ville</th>
                              <th className="px-4 py-2.5 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Montant</th>
                              <th className="px-4 py-2.5 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {bon.parcels.map((parcel) => (
                              <tr key={parcel.code} className="hover:bg-slate-50/60 transition-colors">
                                <td className="px-4 py-2.5 font-mono text-xs font-bold text-slate-700">{parcel.code}</td>
                                <td className="px-4 py-2.5 text-xs font-black text-slate-800">{parcel.customerName}</td>
                                <td className="px-4 py-2.5 text-xs font-bold text-slate-600">{parcel.customerCity}</td>
                                <td className="px-4 py-2.5 text-right text-xs font-black text-slate-800">
                                  {parcel.amount} MAD
                                </td>
                                <td className="px-4 py-2.5">
                                  <div className="flex items-center justify-end gap-1">
                                    <button
                                      onClick={() => handleSingleLabel(parcel.code, 'print')}
                                      className="p-1.5 rounded-lg text-slate-400 hover:text-primary-600 hover:bg-primary-50 transition-all"
                                      title="Imprimer le ticket"
                                    >
                                      <Printer size={14} />
                                    </button>
                                    <button
                                      onClick={() => handleSingleLabel(parcel.code, 'download')}
                                      className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-all"
                                      title="Télécharger le ticket"
                                    >
                                      <Download size={14} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-2 mt-5">
                    <button
                      onClick={() =>
                        runBulkLabels(
                          (remoteParcels.length > 0
                            ? remoteParcels.map((p: any) => p.parcel_code)
                            : bon.parcels.map((p) => p.code)) as string[],
                          'print',
                          ''
                        )
                      }
                      disabled={busyLabel !== null}
                      className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-700 hover:border-primary-300 hover:text-primary-600 transition-all disabled:opacity-40"
                    >
                      <Printer size={15} />
                      Imprimer tous les tickets ({remoteParcels.length || bon.parcels.length})
                    </button>
                    <button
                      onClick={() =>
                        runBulkLabels(
                          (remoteParcels.length > 0
                            ? remoteParcels.map((p: any) => p.parcel_code)
                            : bon.parcels.map((p) => p.code)) as string[],
                          'download',
                          `tickets-bon-${bon.ref}.pdf`
                        )
                      }
                      disabled={busyLabel !== null}
                      className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-700 hover:border-emerald-300 hover:text-emerald-600 transition-all disabled:opacity-40"
                    >
                      <Download size={15} />
                      Télécharger tous les tickets
                    </button>
                    <div className="flex items-center gap-2 flex-wrap ml-auto">
                      {bon.products.map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100"
                        >
                          {p.image ? (
                            <img src={p.image} alt="" className="w-5 h-5 rounded object-cover" />
                          ) : (
                            <Package size={12} className="text-slate-300" />
                          )}
                          <span className="text-[11px] font-bold text-slate-600">{p.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const totalPendingAmount = filteredPending.reduce((acc, p) => acc + p.amount, 0);

  // ───────────────────────────────────────────────────────────── render

  return (
    <div className="p-4 lg:p-6 max-w-[1800px] mx-auto space-y-5 pb-32">
      {/* Header */}
      <div className="bg-white p-5 lg:p-6 rounded-3xl shadow-sm border border-slate-100">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary-600 rounded-2xl shadow-lg shadow-primary-200">
              <FileText className="text-white w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-none mb-1.5">
                Poste Emballage
              </h1>
              <p className="text-slate-400 text-xs font-bold flex items-center gap-2 flex-wrap">
                <span>{pendingParcels.length} colis en attente · {activeBons.length} bons actifs</span>
                {lastSync && (
                  <span className="text-slate-300">
                    · Sync {lastSync.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div
              className={`flex items-center rounded-xl transition-all ${
                alertsEnabled ? 'bg-emerald-500 shadow-lg shadow-emerald-200' : 'bg-white border border-slate-200'
              }`}
            >
              <button
                onClick={() => {
                  const next = !alertsEnabled;
                  setAlertsEnabled(next);
                  if (next) {
                    // The click is the user gesture both the audio and the
                    // Notification permission prompt need.
                    playAlertSound();
                    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
                      Notification.requestPermission().catch(() => {});
                    }
                  }
                }}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all ${
                  alertsEnabled ? 'text-white' : 'text-slate-600 hover:text-emerald-600'
                }`}
                title={
                  alertsEnabled
                    ? 'Alertes sonores activées — cliquez pour couper le son'
                    : 'Alertes sonores coupées — cliquez pour activer'
                }
              >
                {alertsEnabled ? <Bell size={16} /> : <BellOff size={16} />}
                Alertes
              </button>
              {alertsEnabled && (
                <div className="flex items-center gap-1.5 pr-3 pl-1">
                  <Volume2 size={13} className="text-white/70" />
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.1}
                    value={alertVolume}
                    onChange={(e) => setAlertVolume(Number(e.target.value))}
                    onMouseUp={() => playAlertSound()}
                    className="w-16 h-1 accent-white cursor-pointer"
                    title="Volume de l'alerte"
                  />
                </div>
              )}
            </div>

            <button
              onClick={() => setScanMode((v) => !v)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all ${
                scanMode
                  ? 'bg-primary-600 text-white shadow-lg shadow-primary-200'
                  : 'bg-white border border-slate-200 text-slate-600 hover:border-primary-300 hover:text-primary-600'
              }`}
              title="Mode douchette (S)"
            >
              <ScanLine size={16} />
              Scan
            </button>

            <button
              onClick={() => setAutoRefresh((v) => !v)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all ${
                autoRefresh
                  ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200'
                  : 'bg-white border border-slate-200 text-slate-600 hover:border-emerald-300 hover:text-emerald-600'
              }`}
              title="Actualisation automatique toutes les 60 s"
            >
              <Timer size={16} />
              Auto
            </button>

            <button
              onClick={() => fetchData({ silent: true, refreshDetails: true })}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-600 hover:border-primary-300 hover:text-primary-600 transition-all disabled:opacity-40"
              title="Actualiser (R)"
            >
              <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
              Actualiser
            </button>

            <button
              onClick={() => setShowShortcuts(true)}
              className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-slate-700 hover:border-slate-300 transition-all"
              title="Raccourcis clavier (?)"
            >
              <Keyboard size={16} />
            </button>
          </div>
        </div>

        {/* Scan bar */}
        {scanMode && (
          <div className="mt-5 pt-5 border-t border-slate-100">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleScanSubmit(scanValue);
              }}
              className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3"
            >
              <div className="relative flex-1">
                <ScanLine className="absolute left-4 top-1/2 -translate-y-1/2 text-primary-500" size={20} />
                <input
                  ref={scanRef}
                  value={scanValue}
                  onChange={(e) => setScanValue(e.target.value)}
                  placeholder="Scannez ou saisissez un code colis puis Entrée..."
                  autoComplete="off"
                  className="w-full pl-12 pr-4 py-3.5 bg-primary-50/60 border-2 border-primary-200 rounded-xl focus:bg-white focus:border-primary-500 outline-none transition-all font-mono font-bold text-sm text-slate-800 placeholder:text-slate-400 placeholder:font-sans"
                />
              </div>
              {scanFeedback && (
                <div
                  className={`flex items-center gap-2 px-4 py-3 rounded-xl text-xs font-black ${
                    scanFeedback.ok
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-red-50 text-red-600 border border-red-200'
                  }`}
                >
                  {scanFeedback.ok ? <Check size={16} /> : <X size={16} />}
                  <span className="truncate max-w-xs">{scanFeedback.text}</span>
                </div>
              )}
            </form>
            <p className="text-[11px] font-bold text-slate-400 mt-2.5">
              Chaque code scanné est ajouté à la sélection. Utilisez ensuite « Créer bon » ou « Imprimer ».
            </p>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          icon={<Package size={20} />}
          label="En attente"
          value={pendingParcels.length}
          tone="bg-orange-50 text-orange-500"
        />
        <StatCard
          icon={<Layers size={20} />}
          label="Sélectionnés"
          value={selectedCount}
          tone="bg-primary-50 text-primary-600"
        />
        <StatCard
          icon={<Truck size={20} />}
          label="Bons actifs"
          value={activeBons.length}
          tone="bg-emerald-50 text-emerald-600"
        />
        <StatCard
          icon={<CheckCircle2 size={20} />}
          label="Bons collectés"
          value={collectedBons.length}
          tone="bg-blue-50 text-blue-600"
        />
      </div>

      {/* Tabs + toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="flex bg-slate-50 p-1 rounded-xl overflow-x-auto">
            {(
              [
                { key: 'pending' as Tab, icon: <Package size={15} />, label: 'En attente', count: pendingParcels.length, color: 'text-primary-600' },
                { key: 'created' as Tab, icon: <CheckCircle size={15} />, label: 'Bons créés', count: activeBons.length, color: 'text-violet-600' },
                { key: 'collected' as Tab, icon: <CheckCircle2 size={15} />, label: 'Bons collectés', count: collectedBons.length, color: 'text-emerald-600' },
              ]
            ).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`relative flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-black whitespace-nowrap transition-all ${
                  activeTab === tab.key ? `bg-white shadow-sm ${tab.color}` : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {tab.icon}
                {tab.label} ({tab.count})
                {tab.key === 'pending' && pendingAlerts > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 flex h-5 min-w-5 px-1 items-center justify-center">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
                    <span className="relative inline-flex h-5 min-w-5 px-1 items-center justify-center rounded-full bg-emerald-500 text-white text-[10px] font-black border-2 border-white">
                      +{pendingAlerts}
                    </span>
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
            <input
              ref={searchRef}
              type="text"
              placeholder="Rechercher : code, client, téléphone, ville, produit, bon...   ( / )"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-10 py-2.5 bg-slate-50 border-2 border-transparent rounded-xl focus:bg-white focus:border-primary-500 outline-none transition-all font-bold text-sm text-slate-700 placeholder:text-slate-400 placeholder:font-medium"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X size={15} />
              </button>
            )}
          </div>
        </div>

        {activeTab === 'pending' && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <div className="flex items-center gap-2 pr-3 mr-1 border-r border-slate-100">
              <button
                onClick={() => setViewMode('table')}
                className={`p-2 rounded-lg transition-all ${
                  viewMode === 'table' ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-400 hover:text-slate-700'
                }`}
                title="Vue liste (dense)"
              >
                <Rows3 size={16} />
              </button>
              <button
                onClick={() => setViewMode('cards')}
                className={`p-2 rounded-lg transition-all ${
                  viewMode === 'cards' ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-400 hover:text-slate-700'
                }`}
                title="Vue cartes"
              >
                <LayoutGrid size={16} />
              </button>
            </div>

            <button
              onClick={() => setGroupByProduct((v) => !v)}
              disabled={viewMode !== 'table'}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] font-black transition-all disabled:opacity-30 ${
                groupByProduct && viewMode === 'table'
                  ? 'bg-primary-50 text-primary-600 border border-primary-200'
                  : 'bg-slate-50 text-slate-500 border border-transparent hover:text-slate-700'
              }`}
              title="Grouper par produit (G)"
            >
              <Layers size={14} />
              Par produit
            </button>

            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={13} />
              <select
                value={productFilter}
                onChange={(e) => setProductFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                className="pl-8 pr-8 py-2 bg-slate-50 rounded-lg text-[11px] font-black text-slate-600 outline-none focus:ring-2 focus:ring-primary-500 appearance-none cursor-pointer max-w-[220px] truncate"
              >
                <option value="all">Tous les produits ({pendingParcels.length})</option>
                {productOptions.map(({ product, count }) => (
                  <option key={product.id} value={product.id}>
                    {product.name} ({count})
                  </option>
                ))}
              </select>
            </div>

            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={13} />
              <select
                value={cityFilter}
                onChange={(e) => setCityFilter(e.target.value)}
                className="pl-8 pr-8 py-2 bg-slate-50 rounded-lg text-[11px] font-black text-slate-600 outline-none focus:ring-2 focus:ring-primary-500 appearance-none cursor-pointer max-w-[180px] truncate"
              >
                <option value="all">Toutes les villes</option>
                {cityOptions.map(([city, count]) => (
                  <option key={city} value={city}>
                    {city} ({count})
                  </option>
                ))}
              </select>
            </div>

            <div className="relative">
              <ArrowUpDown className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={13} />
              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as SortKey)}
                className="pl-8 pr-8 py-2 bg-slate-50 rounded-lg text-[11px] font-black text-slate-600 outline-none focus:ring-2 focus:ring-primary-500 appearance-none cursor-pointer"
              >
                {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
                  <option key={key} value={key}>
                    {SORT_LABELS[key]}
                  </option>
                ))}
              </select>
            </div>

            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="px-3 py-2 bg-slate-50 rounded-lg text-[11px] font-black text-slate-600 outline-none focus:ring-2 focus:ring-primary-500 appearance-none cursor-pointer"
              title="Nombre de lignes affichées"
            >
              {PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size} / page
                </option>
              ))}
            </select>

            <button
              onClick={selectAllFiltered}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 text-[11px] font-black text-slate-600 hover:text-primary-600 transition-all"
              title="Tout sélectionner (A)"
            >
              <CheckCircle size={14} />
              {allFilteredSelected ? 'Désélectionner tout' : `Sélectionner tout (${filteredPending.length})`}
            </button>

            <div className="ml-auto flex items-center gap-3 text-[11px] font-black text-slate-400">
              <span>
                {Math.min(visibleCount, filteredPending.length)} / {filteredPending.length} affichés
              </span>
              <span className="text-slate-300">·</span>
              <span>{totalPendingAmount.toLocaleString('fr-FR')} MAD</span>
            </div>
          </div>
        )}
      </div>

      {/* Live arrival banner */}
      {pendingAlerts > 0 && !bannerHidden && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-2xl px-5 py-4 animate-in slide-in-from-top-2 duration-300">
          <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center flex-shrink-0">
            <Truck size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black text-emerald-800 leading-none mb-1">
              {pendingAlerts === 1
                ? '1 nouveau colis vient d’arriver'
                : `${pendingAlerts} nouveaux colis viennent d’arriver`}
            </p>
            <p className="text-[11px] font-bold text-emerald-600/80 truncate">
              {lastAlert?.actor?.name ? `Envoyé à la livraison par ${lastAlert.actor.name}` : 'Envoyé à la livraison'}
              {lastAlert?.tickets?.[0]?.customerCity ? ` · ${lastAlert.tickets[0].customerCity}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {activeTab !== 'pending' && (
              <button
                onClick={() => setActiveTab('pending')}
                className="px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-black hover:bg-emerald-700 transition-all"
              >
                Voir les colis
              </button>
            )}
            <button
              onClick={() => setBannerHidden(true)}
              className="p-2.5 rounded-xl text-emerald-600 hover:bg-emerald-100 transition-all"
              title="Masquer le bandeau (le badge reste jusqu’au bon de ramassage)"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      {activeTab === 'pending'
        ? pendingContent
        : activeTab === 'created'
          ? renderBons(activeBons, false)
          : renderBons(collectedBons, true)}

      {/* Sticky bulk action bar */}
      {activeTab === 'pending' && selectedCount > 0 && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-2rem)] max-w-4xl animate-in slide-in-from-bottom-4 duration-300">
          <div className="bg-slate-900 rounded-2xl shadow-2xl shadow-slate-900/25 px-5 py-4 flex flex-col sm:flex-row items-center gap-4">
            <div className="flex items-center gap-3 flex-shrink-0">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white font-black text-sm">
                {selectedCount}
              </div>
              <div>
                <p className="text-white font-black text-sm leading-none">colis sélectionnés</p>
                <button
                  onClick={clearSelection}
                  className="text-[11px] font-bold text-slate-400 hover:text-white transition-colors mt-1"
                >
                  Effacer la sélection (X)
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2 sm:ml-auto">
              <button
                onClick={() => runBulkLabels(selectedCodes, 'print', '')}
                disabled={busyLabel !== null}
                className="flex items-center gap-2 px-4 py-2.5 bg-white/10 text-white rounded-xl text-xs font-black hover:bg-white/20 transition-all disabled:opacity-40"
                title="Imprimer (P)"
              >
                {busyLabel === 'print' ? <Loader2 size={15} className="animate-spin" /> : <Printer size={15} />}
                Imprimer
              </button>
              <button
                onClick={() => runBulkLabels(selectedCodes, 'download', `tickets-${selectedCount}pcs.pdf`)}
                disabled={busyLabel !== null}
                className="flex items-center gap-2 px-4 py-2.5 bg-white/10 text-white rounded-xl text-xs font-black hover:bg-white/20 transition-all disabled:opacity-40"
                title="Télécharger (D)"
              >
                {busyLabel === 'download' ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                Télécharger
              </button>
              <button
                onClick={() => setConfirmCreate(true)}
                disabled={creatingBon}
                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 text-white rounded-xl text-xs font-black hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-40"
                title="Créer un bon (B)"
              >
                {creatingBon ? <Loader2 size={15} className="animate-spin" /> : <Truck size={15} />}
                Créer bon de ramassage
              </button>
            </div>
          </div>
        </div>
      )}

      <ShortcutsModal open={showShortcuts} onClose={() => setShowShortcuts(false)} />

      <ImageLightbox image={lightbox} onClose={() => setLightbox(null)} />

      <ConfirmDialog
        open={confirmCreate}
        title="Créer un bon de ramassage"
        message={`${selectedCount} colis seront rattachés à un nouveau bon de ramassage Coliaty. Cette action est définitive côté transporteur.`}
        confirmLabel={`Créer le bon (${selectedCount})`}
        onCancel={() => setConfirmCreate(false)}
        onConfirm={() => {
          setConfirmCreate(false);
          createBon();
        }}
      />

      <ConfirmDialog
        open={confirmRemove !== null}
        tone="danger"
        title="Retirer le colis du bon"
        message={`Le colis ${confirmRemove?.code} sera retiré du bon ${confirmRemove?.ref} et redeviendra disponible dans « En attente ».`}
        confirmLabel="Retirer le colis"
        onCancel={() => setConfirmRemove(null)}
        onConfirm={() => {
          if (confirmRemove) removeParcelFromBon(confirmRemove.ref, confirmRemove.code);
        }}
      />
    </div>
  );
}
