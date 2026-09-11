import { useState, useEffect, useCallback, useMemo } from 'react';
import { vendorCartsApi } from '../../lib/api';
import toast from 'react-hot-toast';
import {
  ShoppingCart, Search, Trash2, FileSpreadsheet, Headphones, RefreshCw, X,
  AlertTriangle, PhoneOff, MapPin, Package, ChevronLeft, ChevronRight,
  CheckCircle2, Wallet, Zap, Loader2,
} from 'lucide-react';
import { swal } from '../../components/ui/SweetAlert';

/**
 * The seller's own abandoned checkouts.
 *
 * Every row here is a phone number a visitor typed into one of this seller's
 * landing pages and then walked away from. The page exists to do three things
 * with them — push to Google Sheets, hand to the call centre, or delete — and
 * the first of those spends real money, so the cost is on the button rather
 * than buried in a settings page.
 */

interface Cart {
  id: string;
  referralCode: string | null;
  productName: string | null;
  fullName: string | null;
  phone: string | null;
  city: string | null;
  address: string | null;
  fieldsFilled: number;
  phoneComplete: boolean;
  sentLeadId: number | null;
  sentAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Meta {
  sheet: { connected: boolean; enabled: boolean; autoCarts: boolean };
  pricing: {
    currency: string;
    autoCents: number;
    manualCents: number;
    unitCents: number;
    unitLabel: string;
    balanceCents: number;
    balanceLabel: string;
    affordable: number;
  };
}

type Counts = { all: number; complete: number; incomplete: number; sent: number; pending: number };

const money = (cents: number, currency = '$') => {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  return `${sign}${currency}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
};

export default function VendorAbandonedCarts() {
  const [carts, setCarts] = useState<Cart[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [counts, setCounts] = useState<Counts>({ all: 0, complete: 0, incomplete: 0, sent: 0, pending: 0 });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);

  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [status, setStatus] = useState<'all' | 'pending' | 'sent'>('all');
  const [quality, setQuality] = useState<'all' | 'complete' | 'incomplete'>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Debounced so typing a phone number does not fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await vendorCartsApi.list({
        page, limit,
        search: search || undefined,
        status,
        phoneQuality: quality,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      });
      const d = res.data.data;
      setCarts(d.attempts);
      setCounts(d.counts);
      setMeta({ sheet: d.sheet, pricing: d.pricing });
      setTotalPages(d.totalPages);
      setTotal(d.total);
      // Drop selections that are no longer on screen, so a bulk action can
      // never act on a row the seller can no longer see.
      setSelected((prev) => {
        const visible = new Set(d.attempts.map((a: Cart) => a.id));
        return new Set([...prev].filter((id) => visible.has(id)));
      });
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Chargement impossible');
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, status, quality, dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  const allVisibleSelected = carts.length > 0 && carts.every((c) => selected.has(c.id));
  const toggleAll = () =>
    setSelected(allVisibleSelected ? new Set() : new Set(carts.map((c) => c.id)));
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const ids = useMemo(() => [...selected], [selected]);

  // Only carts not already sent cost anything, so the quote counts those.
  const unsentSelected = useMemo(
    () => carts.filter((c) => selected.has(c.id) && !c.sentLeadId).length,
    [carts, selected],
  );
  const quote = meta ? unsentSelected * meta.pricing.unitCents : 0;

  const run = async (key: string, fn: () => Promise<any>, ok: string) => {
    setBusy(key);
    try {
      const res = await fn();
      const d = res?.data?.data;
      toast.success(
        d?.alreadySent
          ? `${ok} (${d.alreadySent} déjà envoyé${d.alreadySent > 1 ? 's' : ''})`
          : ok,
      );
      setSelected(new Set());
      await load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Action impossible');
    } finally {
      setBusy(null);
    }
  };

  const confirmSheet = async (count: number) => {
    if (!meta) return false;
    if (!meta.sheet.enabled) {
      toast.error("L'envoi vers Google Sheets n'est pas activé sur votre compte.");
      return false;
    }
    if (!meta.sheet.connected) {
      toast.error('Aucune feuille Google connectée. Connectez-en une dans Intégrations.');
      return false;
    }
    const cost = count * meta.pricing.unitCents;
    return swal.confirm({
      title: `Envoyer ${count} panier${count > 1 ? 's' : ''} vers Google Sheets ?`,
      text:
        `Coût : ${money(cost, meta.pricing.currency)} (${meta.pricing.unitLabel} par panier)\n` +
        `Solde actuel : ${meta.pricing.balanceLabel}\n\n` +
        `Chaque panier devient un lead dans votre liste.`,
      confirmText: 'Envoyer',
    });
  };

  const toggleAuto = async () => {
    if (!meta) return;
    const next = !meta.sheet.autoCarts;
    setBusy('auto');
    try {
      const res = await vendorCartsApi.setAutoCarts(next);
      setMeta((m) => (m ? { ...m, ...res.data.data } : m));
      toast.success(
        next
          ? `Envoi automatique activé — ${money(res.data.data.pricing.autoCents, res.data.data.pricing.currency)} par panier`
          : 'Envoi automatique désactivé',
      );
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Modification impossible');
    } finally {
      setBusy(null);
    }
  };

  const resetFilters = () => {
    setSearchInput(''); setSearch(''); setStatus('all'); setQuality('all');
    setDateFrom(''); setDateTo(''); setPage(1);
  };
  const filtersActive = !!(search || status !== 'all' || quality !== 'all' || dateFrom || dateTo);

  return (
    <div className="max-w-[1400px] mx-auto space-y-6">

      {/* ───────────────────────────────────────────────────────── header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-primary-700 via-primary-600 to-accent-500 text-white flex items-center justify-center shadow-lg shadow-primary-600/25 shrink-0">
            <ShoppingCart className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Paniers abandonnés</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Les clients qui ont saisi leur numéro sur vos pages sans valider la commande.
            </p>
          </div>
        </div>

        {meta && (
          <div className="flex items-center gap-2 flex-wrap">
            <div className="h-11 px-3.5 rounded-2xl bg-white/80 border border-white/80 shadow-[0_10px_30px_-18px_rgba(17,19,68,0.3)] flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-600 inline-flex items-center justify-center">
                <Wallet className="w-3.5 h-3.5" />
              </span>
              <div className="leading-tight">
                <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">Solde</div>
                <div className="text-sm font-bold text-slate-900 tabular-nums">{meta.pricing.balanceLabel}</div>
              </div>
            </div>
            <div className="h-11 px-3.5 rounded-2xl bg-white/80 border border-white/80 shadow-[0_10px_30px_-18px_rgba(17,19,68,0.3)] flex items-center leading-tight">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">Tarif actuel</div>
                <div className="text-sm font-bold text-slate-900 tabular-nums">
                  {meta.pricing.unitLabel} <span className="font-medium text-slate-400">/ panier</span>
                </div>
              </div>
            </div>
            <button
              onClick={toggleAuto}
              disabled={busy === 'auto'}
              title={`Automatique : ${money(meta.pricing.autoCents, meta.pricing.currency)} par panier. Manuel : ${money(meta.pricing.manualCents, meta.pricing.currency)}.`}
              className={`h-11 px-4 rounded-2xl text-sm font-semibold border transition-all flex items-center gap-2 disabled:opacity-50 ${
                meta.sheet.autoCarts
                  ? 'bg-orange-500 text-white border-transparent'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Zap className="w-4 h-4" />
              Envoi auto {meta.sheet.autoCarts ? 'activé' : 'désactivé'}
            </button>
            <button
              onClick={load}
              className="h-11 w-11 rounded-2xl bg-white border border-slate-200 hover:bg-slate-50 inline-flex items-center justify-center"
              title="Rafraîchir"
            >
              <RefreshCw className={`w-4 h-4 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        )}
      </div>

      {/* Auto-send is what makes the cheaper tier reachable, so say so once. */}
      {meta && !meta.sheet.autoCarts && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-amber-50 border border-amber-100 text-sm text-amber-800 flex items-start gap-2">
          <Zap className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            Activez l'envoi automatique pour payer{' '}
            <b>{money(meta.pricing.autoCents, meta.pricing.currency)}</b> par panier au lieu de{' '}
            <b>{money(meta.pricing.manualCents, meta.pricing.currency)}</b>. Les paniers partent
            alors vers votre feuille dès qu'ils sont abandonnés.
          </span>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────── tiles ── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-5">
        {([
          ['Total', counts.all, 'text-gray-900', 'all', null],
          ['N° complets', counts.complete, 'text-emerald-600', 'quality', 'complete'],
          ['N° incomplets', counts.incomplete, 'text-amber-600', 'quality', 'incomplete'],
          ['À traiter', counts.pending, 'text-orange-600', 'status', 'pending'],
          ['Déjà envoyés', counts.sent, 'text-blue-600', 'status', 'sent'],
        ] as const).map(([label, value, color, kind, val]) => (
          <button
            key={label}
            onClick={() => {
              setPage(1);
              if (kind === 'quality') setQuality(quality === val ? 'all' : (val as any));
              else if (kind === 'status') setStatus(status === val ? 'all' : (val as any));
              else resetFilters();
            }}
            className={`p-4 rounded-2xl border text-left transition-all ${
              (kind === 'quality' && quality === val) || (kind === 'status' && status === val)
                ? 'bg-gradient-to-br from-primary-700 via-primary-600 to-accent-500 border-transparent text-white shadow-lg shadow-primary-600/25'
                : 'bg-white/80 border-white/80 shadow-[0_10px_30px_-18px_rgba(17,19,68,0.3)] hover:bg-white hover:-translate-y-px'
            }`}
          >
            <div className={`text-[10px] font-semibold uppercase tracking-[0.12em] ${
              (kind === 'quality' && quality === val) || (kind === 'status' && status === val) ? 'text-white/70' : 'text-slate-400'
            }`}>{label}</div>
            <div className={`text-2xl font-bold tabular-nums mt-1 ${
              (kind === 'quality' && quality === val) || (kind === 'status' && status === val) ? 'text-white' : color
            }`}>{value}</div>
          </button>
        ))}
      </div>

      {/* ───────────────────────────────────────────────────────── filters ── */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Téléphone, nom, ville, produit, code…"
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200"
            />
          </div>

          <select
            value={quality}
            onChange={(e) => { setQuality(e.target.value as any); setPage(1); }}
            className="px-3 py-2 rounded-xl border border-gray-200 text-sm font-medium"
          >
            <option value="all">Tous les numéros</option>
            <option value="complete">Numéros complets</option>
            <option value="incomplete">Numéros incomplets</option>
          </select>

          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value as any); setPage(1); }}
            className="px-3 py-2 rounded-xl border border-gray-200 text-sm font-medium"
          >
            <option value="all">Tous les états</option>
            <option value="pending">À traiter</option>
            <option value="sent">Déjà envoyés</option>
          </select>

          <input
            type="date" value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
            className="px-3 py-2 rounded-xl border border-gray-200 text-sm"
          />
          <input
            type="date" value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
            className="px-3 py-2 rounded-xl border border-gray-200 text-sm"
          />

          <select
            value={limit}
            onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
            className="px-3 py-2 rounded-xl border border-gray-200 text-sm font-medium"
          >
            {[25, 50, 100].map((n) => <option key={n} value={n}>{n} / page</option>)}
          </select>

          {filtersActive && (
            <button
              onClick={resetFilters}
              className="px-3 py-2 rounded-xl border border-gray-200 text-sm font-bold text-gray-500 hover:bg-gray-50 flex items-center gap-1"
            >
              <X className="w-4 h-4" /> Réinitialiser
            </button>
          )}
        </div>
      </div>

      {/* ────────────────────────────────────────────────── bulk actions ── */}
      {selected.size > 0 && (
        <div className="sticky top-2 z-10 mb-4 bg-gray-900 text-white rounded-2xl px-4 py-3 flex items-center gap-3 flex-wrap shadow-lg">
          <span className="font-bold text-sm">
            {selected.size} sélectionné{selected.size > 1 ? 's' : ''}
          </span>
          {meta && unsentSelected > 0 && (
            <span className="text-xs text-gray-300">
              · coût estimé <b className="text-white">{money(quote, meta.pricing.currency)}</b>
            </span>
          )}
          <div className="flex-1" />
          <button
            disabled={!!busy}
            onClick={() => {
              if (!confirmSheet(unsentSelected || selected.size)) return;
              run('bulk-sheet', () => vendorCartsApi.sendToSheetMany(ids), 'Paniers envoyés vers Google Sheets');
            }}
            className="px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-sm font-bold flex items-center gap-2 disabled:opacity-50"
          >
            {busy === 'bulk-sheet' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
            Google Sheets
          </button>
          <button
            disabled={!!busy}
            onClick={async () =>
              (await swal.confirm({ title: `Envoyer ${selected.size} panier(s) au call center ?`, text: 'Chacun devient un lead que le call center pourra appeler.', confirmText: 'Envoyer' })) &&
              run('bulk-cc', () => vendorCartsApi.sendToCallCenterMany(ids), 'Paniers envoyés au call center')
            }
            className="px-3 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 text-sm font-bold flex items-center gap-2 disabled:opacity-50"
          >
            {busy === 'bulk-cc' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Headphones className="w-4 h-4" />}
            Call center
          </button>
          <button
            disabled={!!busy}
            onClick={async () =>
              (await swal.danger({ title: `Supprimer ${selected.size} panier(s) ?`, text: 'Cette action est définitive.', confirmText: 'Supprimer' })) &&
              run('bulk-del', () => vendorCartsApi.removeMany(ids), 'Paniers supprimés')
            }
            className="px-3 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-sm font-bold flex items-center gap-2 disabled:opacity-50"
          >
            {busy === 'bulk-del' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            Supprimer
          </button>
          <button onClick={() => setSelected(new Set())} className="p-2 rounded-xl hover:bg-white/10">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────── list ── */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-3 bg-gray-50/50">
          <input
            type="checkbox"
            checked={allVisibleSelected}
            onChange={toggleAll}
            className="w-4 h-4 rounded accent-orange-500"
            aria-label="Tout sélectionner"
          />
          <span className="text-xs font-bold text-gray-500 uppercase">
            {total} panier{total > 1 ? 's' : ''}
          </span>
        </div>

        {loading ? (
          <div className="p-16 text-center text-gray-400">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-3" />
            Chargement…
          </div>
        ) : carts.length === 0 ? (
          <div className="p-16 text-center">
            <ShoppingCart className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="font-bold text-gray-500">Aucun panier abandonné</p>
            <p className="text-sm text-gray-400 mt-1">
              {filtersActive
                ? 'Aucun résultat pour ces filtres.'
                : 'Les paniers apparaîtront ici dès qu’un visiteur saisira son numéro sans commander.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {carts.map((c) => (
              <div
                key={c.id}
                className={`flex items-center gap-4 px-5 py-4 flex-wrap transition-colors ${
                  selected.has(c.id) ? 'bg-orange-50/50' : 'hover:bg-gray-50/50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selected.has(c.id)}
                  onChange={() => toggle(c.id)}
                  className="w-4 h-4 rounded accent-orange-500 shrink-0"
                />

                <div className="w-11 h-11 rounded-xl bg-orange-50/50 border border-orange-100 flex items-center justify-center shrink-0">
                  <Package className="w-5 h-5 text-orange-400" />
                </div>

                <div className="flex-1 min-w-[200px]">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm text-gray-900">
                      {c.fullName || <span className="text-gray-400 font-medium">Nom non saisi</span>}
                    </span>
                    {c.sentLeadId ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-blue-100 text-blue-700">
                        <CheckCircle2 className="w-3 h-3" /> Envoyé · lead #{c.sentLeadId}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-red-100 text-red-700">
                        <AlertTriangle className="w-3 h-3" /> À traiter
                      </span>
                    )}
                    {!c.phoneComplete && (
                      <span
                        title="Numéro incomplet tel que saisi par le client"
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-amber-100 text-amber-700"
                      >
                        <PhoneOff className="w-3 h-3" /> N° incomplet
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-gray-600">{c.productName || c.referralCode || '—'}</span>
                    {c.city && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-gray-400" />{c.city}
                      </span>
                    )}
                    <span className={c.fieldsFilled >= 4 ? 'font-bold text-emerald-600' : ''}>
                      • {c.fieldsFilled}/4 champs
                    </span>
                    <span>• {new Date(c.updatedAt).toLocaleString('fr-FR')}</span>
                  </div>
                </div>

                <a
                  href={c.phoneComplete ? `tel:${c.phone}` : undefined}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-black border font-mono ${
                    c.phoneComplete
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-100'
                      : 'bg-amber-50 text-amber-600 border-amber-100 cursor-help'
                  }`}
                >
                  {!c.phoneComplete && <PhoneOff className="w-4 h-4" />}
                  {c.phone || '—'}
                </a>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    disabled={!!busy || !!c.sentLeadId}
                    title={c.sentLeadId ? 'Déjà envoyé' : `Envoyer vers Google Sheets (${meta?.pricing.unitLabel})`}
                    onClick={() => {
                      if (!confirmSheet(1)) return;
                      run(`sheet-${c.id}`, () => vendorCartsApi.sendToSheet(c.id), 'Envoyé vers Google Sheets');
                    }}
                    className="p-2 rounded-xl border border-gray-200 hover:bg-emerald-50 hover:border-emerald-200 disabled:opacity-30 disabled:hover:bg-transparent"
                  >
                    {busy === `sheet-${c.id}`
                      ? <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                      : <FileSpreadsheet className="w-4 h-4 text-emerald-600" />}
                  </button>
                  <button
                    disabled={!!busy || !!c.sentLeadId}
                    title={c.sentLeadId ? 'Déjà envoyé' : 'Envoyer au call center'}
                    onClick={async () =>
                      (await swal.confirm({ title: 'Envoyer ce panier au call center ?', text: 'Il devient un lead que le call center pourra appeler.', confirmText: 'Envoyer' })) &&
                      run(`cc-${c.id}`, () => vendorCartsApi.sendToCallCenter(c.id), 'Envoyé au call center')
                    }
                    className="p-2 rounded-xl border border-gray-200 hover:bg-blue-50 hover:border-blue-200 disabled:opacity-30 disabled:hover:bg-transparent"
                  >
                    {busy === `cc-${c.id}`
                      ? <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                      : <Headphones className="w-4 h-4 text-blue-600" />}
                  </button>
                  <button
                    disabled={!!busy}
                    title="Supprimer"
                    onClick={async () =>
                      (await swal.danger({ title: 'Supprimer ce panier ?', text: 'Cette action est définitive.', confirmText: 'Supprimer' })) &&
                      run(`del-${c.id}`, () => vendorCartsApi.remove(c.id), 'Panier supprimé')
                    }
                    className="p-2 rounded-xl border border-gray-200 hover:bg-red-50 hover:border-red-200 disabled:opacity-30"
                  >
                    {busy === `del-${c.id}`
                      ? <Loader2 className="w-4 h-4 animate-spin text-red-600" />
                      : <Trash2 className="w-4 h-4 text-red-500" />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ───────────────────────────────────────────────── pagination ── */}
        {totalPages > 1 && (
          <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between bg-gray-50/50">
            <span className="text-xs font-bold text-gray-500">
              Page {page} sur {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-2 rounded-xl border border-gray-200 bg-white disabled:opacity-30 hover:bg-gray-50"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="p-2 rounded-xl border border-gray-200 bg-white disabled:opacity-30 hover:bg-gray-50"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
