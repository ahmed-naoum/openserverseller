import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  Copy,
  DollarSign,
  ExternalLink,
  LayoutTemplate,
  Link2Off,
  Loader2,
  Lock,
  MinusCircle,
  Send,
  Settings2,
  ShieldAlert,
  Sparkles,
  Wallet,
  XCircle,
  Zap,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useLanguage } from '../../contexts/LanguageContext';
import { googleSheetsApi } from '../../lib/api';
import { formatMoney } from '../../lib/sheetMoney';
import ConfirmationModal from '../ui/ConfirmationModal';
import googleSheetsLogo from '../../assets/google-sheets-logo.svg';

/**
 * The seller's own Google Sheet, written INTO — the mirror image of
 * GoogleSheetsLeads.tsx, which reads orders OUT of a sheet. It lives in its own
 * file because Leads.tsx (where it renders) is already ~2100 lines, and it owns
 * its react-query state rather than taking props: the page around it is
 * deliberately plain useState + loadData(), and threading this through would
 * have meant converting the whole page.
 *
 * The sharing instructions in the disconnected state are the single
 * highest-support-volume moment of this feature — a sheet the service account
 * cannot open is by far the most common reason a connect attempt fails — so
 * they are rendered up front rather than behind a "help" link, and rendered
 * again as an error callout when the server answers NOT_SHARED.
 */

const DEFAULT_TAB = 'SILACOD Leads';

/** Rows per page in the "Envois récents" table. */
const JOBS_PAGE_SIZE = 10;

/**
 * Mirror of OUTBOUND_COLUMNS on the server, used ONLY to draw the preview when an
 * older status payload comes back without `columns`. The server stays the source
 * of truth — a column added there must not need a frontend deploy to show up.
 */
const TEMPLATE_COLUMNS = [
  'Date',
  'Lead ID',
  'Client',
  'Téléphone',
  'Ville',
  'Adresse',
  'Produit',
  'Quantité',
  'Prix (MAD)',
  'Source',
  'Statut',
];

/**
 * The dashboard routers do not agree on an envelope — `{ status: 'success', data }`
 * on some, `{ success: true, data }` on others — so unwrap both without asserting
 * a shape (strictNullChecks is off here, narrowing on a flag would not hold).
 */
const unwrap = (res: any) => res?.data?.data ?? res?.data ?? null;

/** The one query key both this panel and the leads table read the status from. */
export const OUTBOUND_STATUS_KEY = ['gs-outbound-status'];

/**
 * Places the template popover next to its trigger, in viewport coordinates.
 *
 * It is portalled to document.body — the panel's Shell is `overflow-hidden`, so an
 * absolutely-positioned dropdown would be clipped at the card's bottom edge. That
 * means position:fixed and doing the edge-avoidance by hand:
 *   - open upwards when there is not enough room below;
 *   - clamp horizontally so it never runs off either edge;
 *   - cap the height to whatever space exists and let the body scroll.
 */
function popoverStyle(rect: DOMRect, isRtl: boolean): any {
  const GAP = 8;
  const MARGIN = 12;
  const width = Math.min(window.innerWidth - MARGIN * 2, window.innerWidth < 640 ? 300 : 420);

  const spaceBelow = window.innerHeight - rect.bottom - GAP - MARGIN;
  const spaceAbove = rect.top - GAP - MARGIN;
  const openUp = spaceBelow < 260 && spaceAbove > spaceBelow;

  const style: any = {
    position: 'fixed',
    width,
    maxHeight: Math.max(200, openUp ? spaceAbove : spaceBelow),
  };

  if (openUp) style.bottom = window.innerHeight - rect.top + GAP;
  else style.top = rect.bottom + GAP;

  if (isRtl) {
    // Align the popover's right edge with the trigger's right edge.
    style.right = Math.max(MARGIN, Math.min(window.innerWidth - rect.right, window.innerWidth - width - MARGIN));
  } else {
    style.left = Math.max(MARGIN, Math.min(rect.left, window.innerWidth - width - MARGIN));
  }

  return style;
}

/**
 * Shared so the panel and the send-to-sheet buttons in Leads.tsx cannot disagree.
 *
 * They both read the same react-query key, and react-query stores whatever the
 * FIRST mounted queryFn returned. When the two defined their own queryFn, one
 * cached the raw axios response and the other expected the unwrapped payload, so
 * whichever lost the race silently read `undefined` — which showed up as a panel
 * saying "not enabled" on an account that plainly was.
 */
export function useOutboundStatus(enabled = true) {
  return useQuery({
    queryKey: OUTBOUND_STATUS_KEY,
    queryFn: async () => unwrap(await googleSheetsApi.getOutboundStatus()),
    enabled,
    staleTime: 12000,
    retry: false,
  });
}

/** Every state a job row can be in, with the tone the seller reads it by. */
const JOB_TONES: Record<string, { tone: string; icon: any }> = {
  SENT: { tone: 'bg-emerald-50 text-emerald-600 border-emerald-100', icon: CheckCircle2 },
  SENDING: { tone: 'bg-blue-50 text-blue-600 border-blue-100', icon: Loader2 },
  PENDING: { tone: 'bg-amber-50 text-amber-600 border-amber-100', icon: Clock },
  BLOCKED_NO_CREDITS: { tone: 'bg-amber-50 text-amber-700 border-amber-200', icon: DollarSign },
  FAILED: { tone: 'bg-rose-50 text-rose-600 border-rose-100', icon: XCircle },
  SKIPPED: { tone: 'bg-slate-50 text-slate-500 border-slate-100', icon: MinusCircle },
};

// ─── Presentational pieces ───────────────────────────────────────────────────
// Module scope, not nested in the component: a component declared inside a render
// is a new type on every render, so React would remount the subtree on each
// keystroke and the URL field would lose focus mid-paste.

function Shell({ children }: { children: any }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="h-1 w-full bg-gradient-to-r from-emerald-400 to-emerald-600" />
      <div className="p-5">{children}</div>
    </div>
  );
}

function Heading({ t, muted }: { t: (k: string, ns?: any, f?: string) => string; muted?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={`w-11 h-11 rounded-2xl p-2 flex items-center justify-center shrink-0 border ${
          muted ? 'bg-slate-50 border-slate-100 grayscale opacity-60' : 'bg-emerald-500/10 border-emerald-500/20'
        }`}
      >
        <img src={googleSheetsLogo} alt="Google Sheets" className="w-full h-full object-contain" />
      </div>
      <div className="min-w-0">
        <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider">
          {t('gso_title', 'leads', 'Envoi vers Google Sheets')}
        </h3>
        <p className="text-[11px] font-medium text-gray-500 mt-0.5 leading-relaxed">
          {/* No tariff quoted here on purpose: the heading also renders before the
              status payload has a price to quote. */}
          {t('gso_description', 'leads', 'Poussez vos leads directement dans votre propre feuille Google. Chaque ligne écrite est débitée de votre solde.')}
        </p>
      </div>
    </div>
  );
}

/**
 * The two ways a seller can grant access. Rendered plain under the connect form,
 * and again in rose when the server answered NOT_SHARED — the same two steps, so
 * the seller never has to hunt for them a second time.
 */
function SharingSteps({
  t,
  email,
  copied,
  onCopy,
  variant,
}: {
  t: (k: string, ns?: any, f?: string) => string;
  email: string;
  copied: boolean;
  onCopy: (email: string) => void;
  variant?: 'error';
}) {
  const isError = variant === 'error';
  const badge = isError ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white';

  return (
    <div className={`rounded-2xl border p-4 space-y-3 ${isError ? 'bg-rose-50/60 border-rose-200' : 'bg-emerald-50/50 border-emerald-100'}`}>
      <p className={`text-[11px] font-black uppercase tracking-wider flex items-center gap-2 ${isError ? 'text-rose-700' : 'text-emerald-700'}`}>
        {isError && <ShieldAlert className="w-3.5 h-3.5 shrink-0" />}
        {isError
          ? t('gso_not_shared_title', 'leads', "Nous n'avons pas accès à votre feuille")
          : t('gso_share_title', 'leads', 'Deux façons de nous donner accès :')}
      </p>

      <div className="flex gap-2.5">
        <span className={`w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5 ${badge}`}>1</span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold text-slate-700 leading-relaxed">
            {t('gso_share_step1', 'leads', "Partagez la feuille avec cette adresse en tant qu'Éditeur :")}
          </p>
          {email ? (
            <div className="mt-1.5 flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2">
              {/* dir=ltr: the app runs RTL in Arabic and an email renders unreadably otherwise. */}
              <code dir="ltr" className="flex-1 text-[10px] font-mono font-bold text-slate-700 break-all text-left">
                {email}
              </code>
              <button
                type="button"
                onClick={() => onCopy(email)}
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-all text-[10px] font-black shrink-0"
              >
                {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                {copied ? t('gso_copied', 'leads', 'Copié !') : t('gso_copy', 'leads', 'Copier')}
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex gap-2.5">
        <span className={`w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5 ${badge}`}>2</span>
        <p className="text-[11px] font-bold text-slate-700 leading-relaxed">
          {t('gso_share_step2', 'leads', 'Ou passez le partage sur « Tous les utilisateurs disposant du lien — Éditeur ».')}
        </p>
      </div>
    </div>
  );
}

function Switch({ checked, onChange, disabled }: { checked: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onChange}
      disabled={disabled}
      className={`relative w-9 h-5 rounded-full transition-all shrink-0 disabled:opacity-50 disabled:cursor-not-allowed ${
        checked ? 'bg-emerald-500' : 'bg-slate-200'
      }`}
    >
      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${checked ? 'left-[18px]' : 'left-0.5'}`} />
    </button>
  );
}

// ─── Panel ───────────────────────────────────────────────────────────────────

export default function GoogleSheetOutboundPanel() {
  const { t, language } = useLanguage();
  const queryClient = useQueryClient();

  const [sheetUrl, setSheetUrl] = useState('');
  const [tab, setTab] = useState(DEFAULT_TAB);
  const [copied, setCopied] = useState(false);
  const [showJobs, setShowJobs] = useState(false);
  const [jobsPage, setJobsPage] = useState(1);
  const [headerOpen, setHeaderOpen] = useState(false);
  /**
   * The template popover is rendered through a portal, anchored to this button.
   *
   * It cannot be an absolutely-positioned child: the panel's Shell is
   * `overflow-hidden` (it clips the rounded gradient bar at the top), so a
   * dropdown inside it gets cut off at the card's bottom edge. Escaping to
   * document.body means measuring the trigger ourselves.
   */
  const headerBtnRef = useRef<HTMLButtonElement>(null);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const [disconnectOpen, setDisconnectOpen] = useState(false);
  // Set only by a failed connect: the reason code plus the address the server
  // says the sheet has to be shared with (it can differ from the one in status).
  const [connectError, setConnectError] = useState<{ reason?: string; email?: string; message?: string } | null>(null);

  const measureAnchor = () => {
    const el = headerBtnRef.current;
    if (el) setAnchorRect(el.getBoundingClientRect());
  };

  const toggleHeaderMenu = () => {
    if (headerOpen) {
      setHeaderOpen(false);
      return;
    }
    measureAnchor();
    setHeaderOpen(true);
  };

  // A fixed-position portal does not travel with the page, so re-measure while it
  // is open. `capture: true` on scroll catches scrolling inside any ancestor, not
  // just the window.
  useEffect(() => {
    if (!headerOpen) return;
    const onViewportChange = () => measureAnchor();
    window.addEventListener('scroll', onViewportChange, true);
    window.addEventListener('resize', onViewportChange);
    return () => {
      window.removeEventListener('scroll', onViewportChange, true);
      window.removeEventListener('resize', onViewportChange);
    };
  }, [headerOpen]);

  const { data, isLoading, isError } = useOutboundStatus();

  // Lazy: nothing is requested until the seller opens the list.
  const { data: jobsRes, isLoading: jobsLoading, isFetching: jobsFetching } = useQuery({
    queryKey: ['gs-outbound-jobs', jobsPage],
    // NOT unwrap(): the pagination block is a sibling of `data` in the envelope,
    // so this one keeps the whole body and picks both out below.
    queryFn: async () => (await googleSheetsApi.getOutboundJobs({ page: jobsPage, limit: JOBS_PAGE_SIZE }))?.data,
    // Keeps the current page on screen while the next one loads, instead of
    // collapsing the table to its empty state on every click.
    placeholderData: (previous: any) => previous,
    enabled: showJobs,
    staleTime: 15000,
    retry: false,
  });

  /** Both keys: the panel repaints and so does the "$" chip in the dashboard header. */
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['gs-outbound-status'] });
    queryClient.invalidateQueries({ queryKey: ['sheet-credits'] });
  };

  const connectMutation = useMutation({
    mutationFn: () => googleSheetsApi.connectOutbound({ sheetUrl: sheetUrl.trim(), tab: tab.trim() || undefined }),
    onSuccess: () => {
      setConnectError(null);
      setSheetUrl('');
      toast.success(t('gso_connect_success', 'leads', 'Feuille Google connectée'));
      refresh();
    },
    onError: (err: any) => {
      const body = err?.response?.data;
      // Kept in state so the sharing steps can re-render as an error callout — a
      // toast is gone before the seller has finished sharing the sheet.
      setConnectError({ reason: body?.reason, email: body?.serviceAccountEmail, message: body?.message });
      toast.error(body?.message || t('gso_connect_error', 'leads', 'Impossible de connecter la feuille'));
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: () => googleSheetsApi.disconnectOutbound(),
    onSuccess: () => {
      setConnectError(null);
      setShowJobs(false);
      toast.success(t('gso_disconnect_success', 'leads', 'Feuille déconnectée'));
      refresh();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || t('gso_disconnect_error', 'leads', 'Impossible de déconnecter la feuille'));
    },
  });

  const toggleMutation = useMutation({
    mutationFn: (payload: { active?: boolean; auto?: boolean }) => googleSheetsApi.toggleOutbound(payload),
    onSuccess: () => {
      toast.success(t('gso_toggle_success', 'leads', 'Paramètres mis à jour'));
      refresh();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || t('gso_toggle_error', 'leads', 'Impossible de mettre à jour les paramètres'));
    },
  });

  const testMutation = useMutation({
    mutationFn: () => googleSheetsApi.testOutbound(),
    onSuccess: (res: any) => {
      toast.success(res?.data?.message || t('gso_test_success', 'leads', 'Ligne de test envoyée vers votre feuille'));
      refresh();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || t('gso_test_error', 'leads', 'Le test a échoué'));
    },
  });

  /**
   * Writes the formatted header at the TOP of the tab — the fix for a sheet whose
   * header drifted to row 2 under a stray test row. Costs nothing, so no credit
   * refresh: only the status (row count, lastError) can have moved.
   */
  const setupHeaderMutation = useMutation({
    mutationFn: () => googleSheetsApi.setupSheetHeader(),
    onSuccess: (res: any) => {
      setHeaderOpen(false);
      toast.success(unwrap(res)?.message || t('gso_header_success', 'leads', 'Modèle appliqué en haut de votre feuille'));
      queryClient.invalidateQueries({ queryKey: OUTBOUND_STATUS_KEY });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || t('gso_header_error', 'leads', "Impossible d'appliquer le modèle"));
    },
  });

  const copyEmail = (email: string) => {
    if (!email) return;
    navigator.clipboard.writeText(email);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) {
    return (
      <Shell>
        <div className="flex items-center gap-3">
          <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
          <span className="text-xs font-bold text-slate-400">{t('loading_generic', 'leads', 'En cours...')}</span>
        </div>
      </Shell>
    );
  }

  // A failed request is not the same as "your admin has not enabled this" — with
  // retry:false an outage would otherwise paint the (a) card and send the seller
  // to support over a feature they already own. Paint nothing instead.
  if (isError) return null;

  // (a) The admin has not enabled the feature on this account. No form at all.
  if (!data?.enabled) {
    return (
      <Shell>
        <Heading t={t} muted />
        <p className="mt-3 text-[11px] font-bold text-slate-500 bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 leading-relaxed">
          <span className="block text-slate-700 font-black mb-0.5">
            {t('gso_not_enabled_title', 'leads', 'Fonctionnalité non activée')}
          </span>
          {t('gso_not_enabled_desc', 'leads', "L'envoi vers Google Sheets n'est pas activé sur votre compte. Contactez l'administrateur pour l'activer.")}
        </p>
      </Shell>
    );
  }

  // (b) Entitled, but the platform has no working service-account credentials yet.
  if (!data?.configured) {
    return (
      <Shell>
        <Heading t={t} muted />
        <p className="mt-3 text-[11px] font-bold text-slate-500 bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 leading-relaxed">
          <span className="block text-slate-700 font-black mb-0.5">
            {t('gso_not_configured_title', 'leads', 'Configuration en cours')}
          </span>
          {t('gso_not_configured_desc', 'leads', "La plateforme n'a pas encore terminé la configuration de Google Sheets. Réessayez dans un moment.")}
        </p>
      </Shell>
    );
  }

  const isConnected = !!(data?.connected ?? (data?.sheetId || data?.sheetUrl));
  const balance = Number(data?.balance ?? data?.credits?.balance ?? 0);
  const blocked = Number(data?.counts?.blocked ?? 0);

  /**
   * The reservation the seller actually lives under. Every lead captured under the
   * gate holds the price of a row until it reaches the sheet, so what decides whether
   * the NEXT lead arrives readable is `capacity` — not the balance. A comfortable
   * looking $1.00 with 21 leads waiting is one masked number, which is exactly why
   * the balance alone is not enough to show here.
   *
   * `balance` is MONEY, in cents; `unsent`, `capacity` and `locked` are counts of
   * LEADS the server already divided by the tariff — never divide them again.
   *
   * The block is absent until an admin switches the gate on, and nothing
   * gate-related is drawn in that case.
   */
  const gate: any = data?.gate || {};
  const gateActive = !!gate.active;
  const gateBalance = Number(gate.balance ?? balance);
  const gateUnsent = Number(gate.unsent ?? 0);
  const gateCapacity = Number(gate.capacity ?? 0);
  const gateLocked = Number(gate.locked ?? 0);

  /**
   * The tariff, in cents per lead, exactly as the server priced it. It is never a
   * constant on this side: the price is a server setting, and a copy baked into the
   * bundle would keep quoting the old one long after it changed. A payload that
   * predates the field simply drops the sentence rather than quoting "$0.00".
   */
  const priceCents = Number(gate.priceCents ?? 0);
  const priceSentence =
    priceCents > 0
      ? t('gso_price_per_lead', 'leads', 'Chaque lead envoyé coûte {price}.').replace('{price}', formatMoney(priceCents))
      : '';
  // Same three tones the chip already used, re-keyed from the balance to the capacity.
  const gateTone =
    gateCapacity > 0
      ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
      : gateCapacity === 0
      ? 'bg-amber-50 text-amber-700 border-amber-200'
      : 'bg-rose-50 text-rose-600 border-rose-100';

  // (c) Entitled and configured, but no sheet yet: the one-field form.
  if (!isConnected) {
    return (
      <Shell>
        <Heading t={t} />

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!sheetUrl.trim() || connectMutation.isPending) return;
            connectMutation.mutate();
          }}
          className="mt-4 space-y-3"
        >
          <div className="flex flex-col lg:flex-row gap-2">
            <div className="flex-1 min-w-0">
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                {t('gso_url_label', 'leads', 'URL de votre feuille Google')}
              </label>
              {/* dir=ltr: a URL inside the Arabic RTL layout is otherwise unreadable. */}
              <input
                type="url"
                required
                dir="ltr"
                value={sheetUrl}
                onChange={(e) => setSheetUrl(e.target.value)}
                placeholder={t('gso_url_placeholder', 'leads', 'https://docs.google.com/spreadsheets/d/...')}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-[11px] font-mono text-slate-700 text-left placeholder-slate-400 outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all"
              />
            </div>
            <div className="w-full lg:w-56">
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                {t('gso_tab_label', 'leads', "Nom de l'onglet (optionnel)")}
              </label>
              <input
                type="text"
                value={tab}
                onChange={(e) => setTab(e.target.value)}
                placeholder={t('gso_tab_placeholder', 'leads', DEFAULT_TAB)}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-[11px] font-bold text-slate-700 placeholder-slate-400 outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all"
              />
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                disabled={connectMutation.isPending || !sheetUrl.trim()}
                className="w-full lg:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl text-[11px] font-black uppercase tracking-widest shadow-lg shadow-emerald-200 hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {connectMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                {connectMutation.isPending
                  ? t('gso_connecting', 'leads', 'Connexion...')
                  : t('gso_connect', 'leads', 'Connecter')}
              </button>
            </div>
          </div>

          {/* The sheet the inbound sync reads cannot also be the one we write into:
              our own rows would come straight back as new leads. */}
          {connectError?.reason === 'SAME_AS_INBOUND' && (
            <p className="flex items-start gap-2 text-[11px] font-bold text-rose-600 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2 leading-relaxed">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              {t('gso_same_as_inbound', 'leads', "Cette feuille est déjà utilisée pour l'import de vos commandes. Choisissez une autre feuille pour l'envoi.")}
            </p>
          )}

          {connectError?.reason === 'NOT_SHARED' ? (
            <SharingSteps
              t={t}
              email={connectError?.email || data?.serviceAccountEmail || ''}
              copied={copied}
              onCopy={copyEmail}
              variant="error"
            />
          ) : (
            <SharingSteps t={t} email={data?.serviceAccountEmail || ''} copied={copied} onCopy={copyEmail} />
          )}
        </form>
      </Shell>
    );
  }

  // (d) Connected: the compact control row.
  const jobs: any[] = Array.isArray(jobsRes?.data) ? jobsRes.data : [];
  const jobsPagination = jobsRes?.pagination;
  const jobsTotalPages = Math.max(1, Number(jobsPagination?.totalPages) || 1);
  const jobsTotal = Number(jobsPagination?.total) || jobs.length;
  const isActive = data?.active !== false;
  const isAuto = !!data?.auto;
  const templateColumns: string[] = Array.isArray(data?.columns) && data.columns.length ? data.columns : TEMPLATE_COLUMNS;

  return (
    <>
      <Shell>
        <div className="flex flex-col xl:flex-row xl:items-center gap-4 justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl p-2 bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
              <img src={googleSheetsLogo} alt="Google Sheets" className="w-full h-full object-contain" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <a
                  href={data?.sheetUrl || `https://docs.google.com/spreadsheets/d/${data?.sheetId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  dir="ltr"
                  className="text-xs font-black text-emerald-700 hover:text-emerald-800 underline decoration-emerald-200 underline-offset-2 flex items-center gap-1"
                >
                  {t('gso_open_sheet', 'leads', 'Ouvrir la feuille')}
                  <ExternalLink className="w-3 h-3 shrink-0" />
                </a>
                {/* The chip is the entry point to the header template: the seller
                    clicks the tab he wants formatted, not a button elsewhere. */}
                <div className="relative">
                  <button
                    ref={headerBtnRef}
                    type="button"
                    onClick={toggleHeaderMenu}
                    title={t('gso_header_chip_tooltip', 'leads', "Appliquer le modèle d'en-tête en haut de cet onglet")}
                    className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-50 border border-slate-100 text-[10px] font-black text-slate-500 cursor-pointer hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700 transition-all"
                  >
                    {t('gso_tab', 'leads', 'Onglet')} · {data?.tab || DEFAULT_TAB}
                    <Settings2 className="w-3 h-3 shrink-0" />
                  </button>

                  {headerOpen && anchorRect && createPortal(
                    <>
                      <div data-dropdown-backdrop className="fixed inset-0 z-[998]" onClick={() => setHeaderOpen(false)} />
                      <div
                        style={popoverStyle(anchorRect, language === 'ar')}
                        className="bg-white rounded-2xl shadow-[0_30px_60px_rgba(0,0,0,0.18)] border border-slate-100 z-[999] overflow-y-auto overscroll-contain animate-in fade-in slide-in-from-top-2 duration-200"
                      >
                        <div className="px-4 py-3 border-b border-slate-50 bg-slate-50/50">
                          <p className="text-[11px] font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                            <LayoutTemplate className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            {t('gso_header_title', 'leads', "Modèle d'en-tête")}
                          </p>
                          <p className="text-[10px] font-bold text-slate-500 mt-1 leading-relaxed">
                            {t('gso_header_desc', 'leads', "Écrit la ligne d'en-tête tout en haut de l'onglet, la fige, la met en forme et élargit les colonnes.")}
                          </p>
                        </div>

                        <div className="p-4 space-y-3">
                          <div>
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                              {t('gso_header_preview', 'leads', 'Aperçu des colonnes')}
                            </p>
                            {/* dir=ltr: these are the sheet's own column names, in the
                                A→K order they land in — Arabic must not reverse them. */}
                            <div dir="ltr" className="overflow-x-auto rounded-xl border border-emerald-100">
                              <table className="min-w-full">
                                <thead>
                                  <tr>
                                    {templateColumns.map((column: string) => (
                                      <th
                                        key={column}
                                        className="px-2.5 py-1.5 bg-emerald-600 text-white text-[9px] font-black uppercase tracking-wider text-left whitespace-nowrap border-r border-emerald-500/40 last:border-r-0"
                                      >
                                        {column}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                              </table>
                            </div>
                          </div>

                          <p className="flex items-center gap-1.5 text-[10px] font-black text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2 leading-relaxed">
                            <Sparkles className="w-3.5 h-3.5 shrink-0" />
                            {t('gso_header_free', 'leads', "Gratuit — cette opération n'entame pas votre solde.")}
                          </p>

                          <button
                            type="button"
                            onClick={() => setupHeaderMutation.mutate()}
                            disabled={setupHeaderMutation.isPending}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-200 hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                          >
                            {setupHeaderMutation.isPending ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <LayoutTemplate className="w-3.5 h-3.5" />
                            )}
                            {setupHeaderMutation.isPending
                              ? t('gso_header_applying', 'leads', 'Application...')
                              : t('gso_header_apply', 'leads', "Appliquer le modèle")}
                          </button>
                        </div>
                      </div>
                    </>,
                    document.body
                  )}
                </div>
                {/* Two pills, not one run-on string: the first is neutral fact
                    (the money held, the rows it is spoken for), the second is the
                    state that actually matters. The two are in different units on
                    purpose — money then leads — which is why the tooltip spells the
                    tariff out. The state pill NEVER prints a negative —
                    "-1 disponibles" reads as a broken counter rather than as one
                    locked lead, so below zero it switches to counting what is
                    locked instead. */}
                {gateActive ? (
                  <>
                    <span
                      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[10px] font-black border bg-slate-50 border-slate-100 text-slate-500 tabular-nums"
                      title={[priceSentence, t('gso_gate_tooltip', 'leads', 'Disponibles = solde ÷ tarif − en attente.')]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      {/* A wallet rather than a "$" glyph: the amount beside it
                          already starts with one. */}
                      <Wallet className="w-3 h-3 shrink-0" />
                      <span>{formatMoney(gateBalance)}</span>
                      <span className="opacity-30">·</span>
                      <span>
                        {t('gso_gate_unsent', 'leads', '{count} en attente').replace('{count}', String(gateUnsent))}
                      </span>
                    </span>
                    <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black border tabular-nums ${gateTone}`}>
                      {gateCapacity > 0
                        ? t('gso_gate_capacity', 'leads', '{count} disponibles').replace('{count}', String(gateCapacity))
                        : gateLocked > 0
                        ? t('gso_gate_locked_pill', 'leads', '{count} verrouillé(s)').replace('{count}', String(gateLocked))
                        : t('gso_gate_capacity_none', 'leads', '0 disponible')}
                    </span>
                  </>
                ) : (
                  <span
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-black border tabular-nums ${
                      balance > 0
                        ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                        : 'bg-rose-50 text-rose-600 border-rose-100'
                    }`}
                    title={priceSentence || undefined}
                  >
                    {balance > 0
                      ? t('gso_credits_left', 'leads', '{amount} restant').replace('{amount}', formatMoney(balance))
                      : t('gso_credits_empty', 'leads', 'Solde épuisé — rechargez votre solde pour reprendre les envois.')}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-4 mt-2 flex-wrap">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Switch
                    checked={isActive}
                    disabled={toggleMutation.isPending}
                    onChange={() => toggleMutation.mutate({ active: !isActive })}
                  />
                  <span className="text-[11px] font-black text-slate-600">{t('gso_active', 'leads', 'Actif')}</span>
                </label>

                <label className="flex items-start gap-2 cursor-pointer">
                  <Switch
                    checked={isAuto}
                    disabled={toggleMutation.isPending}
                    onChange={() => toggleMutation.mutate({ auto: !isAuto })}
                  />
                  <span className="min-w-0">
                    <span className="block text-[11px] font-black text-slate-600">
                      {t('gso_auto', 'leads', 'Envoi automatique')}
                    </span>
                    <span className="block text-[10px] font-bold text-slate-400 leading-relaxed">
                      {/* The tariff is quoted from the payload, so the hint cannot
                          promise a price the server no longer charges. */}
                      {[t('gso_auto_hint', 'leads', 'Chaque nouveau lead part vers votre feuille.'), priceSentence]
                        .filter(Boolean)
                        .join(' ')}
                    </span>
                  </span>
                </label>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <button
              type="button"
              onClick={() => testMutation.mutate()}
              disabled={testMutation.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 transition-all text-[10px] font-black uppercase tracking-wider"
            >
              {testMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              {t('gso_test', 'leads', 'Tester')}
            </button>
            <button
              type="button"
              onClick={() => {
                // Reopening always starts at the newest page — the seller opens
                // this to see what just happened, not where they left off.
                if (!showJobs) setJobsPage(1);
                setShowJobs(!showJobs);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-slate-500 hover:bg-gray-50 transition-all text-[10px] font-black uppercase tracking-wider"
            >
              {showJobs ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              {t('gso_jobs_title', 'leads', 'Derniers envois')}
            </button>
            <button
              type="button"
              onClick={() => setDisconnectOpen(true)}
              disabled={disconnectMutation.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50 transition-all text-[10px] font-black uppercase tracking-wider"
            >
              {disconnectMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2Off className="w-3.5 h-3.5" />}
              {t('gso_disconnect', 'leads', 'Déconnecter')}
            </button>
          </div>
        </div>

        {/* ONE banner. A locked lead and a lead waiting on credits are the same
            lead seen from two angles — its number is masked AND it has not been
            written yet — so saying both separately just made the card look alarming
            twice. Under the gate `locked` is the authoritative count; without it the
            outbox count is all there is. Nothing is lost either way: the jobs sit in
            the outbox and the next drain picks them up as soon as credits land. */}
        {(gateActive ? gateLocked : blocked) > 0 && (
          <div className="mt-3 flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
            <Lock className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-600" />
            <div className="min-w-0">
              <p className="text-[11px] font-black text-amber-800 leading-relaxed">
                {gateActive
                  ? t('gso_gate_waiting', 'leads', '{count} lead(s) verrouillés — numéro masqué.').replace('{count}', String(gateLocked))
                  : t('gso_blocked_count', 'leads', '{count} lead(s) en attente — solde insuffisant.').replace('{count}', String(blocked))}
              </p>
              <p className="text-[10px] font-bold text-amber-600 leading-relaxed mt-0.5">
                {t('gso_gate_waiting_hint', 'leads', 'Rechargez votre solde pour afficher les numéros et les envoyer automatiquement vers votre feuille.')}
              </p>
            </div>
          </div>
        )}

        {data?.lastError && (
          <p className="mt-3 flex items-start gap-2 text-[11px] font-bold text-rose-600 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2 leading-relaxed">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>
              <span className="font-black">{t('gso_last_error', 'leads', 'Dernière erreur')} : </span>
              {data.lastError}
            </span>
          </p>
        )}

        {showJobs && (
          <div className="mt-4 border border-gray-100 rounded-2xl overflow-hidden">
            {jobsLoading ? (
              <div className="py-8 text-center">
                <div className="w-5 h-5 border-2 border-slate-200 border-t-emerald-500 rounded-full animate-spin mx-auto" />
              </div>
            ) : jobs.length === 0 ? (
              <p className="py-8 text-center text-[10px] font-bold text-slate-400">
                {t('gso_jobs_empty', 'leads', 'Aucun envoi pour le moment')}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-100">
                  <thead className="bg-gray-50/50">
                    <tr>
                      <th className="px-4 py-2 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">
                        {t('gso_job_lead', 'leads', 'Lead')}
                      </th>
                      <th className="px-4 py-2 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">
                        {t('gso_job_phone', 'leads', 'Téléphone')}
                      </th>
                      <th className="px-4 py-2 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">
                        {t('gso_job_status', 'leads', 'Statut')}
                      </th>
                      <th className="px-4 py-2 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">
                        {t('gso_job_date', 'leads', 'Date')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {jobs.map((job: any) => {
                      const meta = JOB_TONES[job?.status] || JOB_TONES.SKIPPED;
                      const StatusIcon = meta.icon;
                      const when = job?.sentAt || job?.updatedAt || job?.createdAt;
                      return (
                        <tr key={job?.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-4 py-2.5">
                            <span className="block text-[10px] font-black text-slate-700 tabular-nums">#{job?.leadId}</span>
                            {job?.lead?.fullName && (
                              <span className="block text-[9px] font-bold text-slate-400 truncate max-w-[160px]">
                                {job.lead.fullName}
                              </span>
                            )}
                          </td>
                          {/* dir=ltr: the app runs RTL in Arabic and a phone
                              number renders unreadably otherwise. */}
                          <td dir="ltr" className="px-4 py-2.5 text-[10px] font-bold text-slate-500 tabular-nums text-left whitespace-nowrap">
                            {job?.lead?.phone || '-'}
                          </td>
                          <td className="px-4 py-2.5">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[10px] font-black ${meta.tone}`}>
                              <StatusIcon className={`w-3 h-3 ${job?.status === 'SENDING' ? 'animate-spin' : ''}`} />
                              {t(`gso_status_${String(job?.status || '').toLowerCase()}`, 'leads', job?.status || '-')}
                            </span>
                            {job?.lastError && (
                              <span className="block text-[9px] font-bold text-rose-400 mt-1 max-w-[320px] truncate" title={job.lastError}>
                                {job.lastError}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-[10px] font-bold text-slate-400">
                            {when
                              ? `${new Date(when).toLocaleDateString([], { day: '2-digit', month: '2-digit' })} · ${new Date(when).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                              : '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Only worth showing once there is more than one page of history. */}
            {!jobsLoading && jobsTotalPages > 1 && (
              <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-gray-50/50 border-t border-gray-100">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest tabular-nums">
                  {t('gso_jobs_page', 'leads', 'Page {page} / {pages} · {total} envoi(s)')
                    .replace('{page}', String(jobsPage))
                    .replace('{pages}', String(jobsTotalPages))
                    .replace('{total}', String(jobsTotal))}
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setJobsPage((p) => Math.max(1, p - 1))}
                    disabled={jobsPage <= 1 || jobsFetching}
                    className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-white hover:text-emerald-600 hover:border-emerald-200 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    title={t('gso_jobs_prev', 'leads', 'Page précédente')}
                  >
                    {/* The chevron follows reading direction, not the button order. */}
                    {language === 'ar' ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => setJobsPage((p) => Math.min(jobsTotalPages, p + 1))}
                    disabled={jobsPage >= jobsTotalPages || jobsFetching}
                    className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-white hover:text-emerald-600 hover:border-emerald-200 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    title={t('gso_jobs_next', 'leads', 'Page suivante')}
                  >
                    {language === 'ar' ? <ChevronLeft className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </Shell>

      <ConfirmationModal
        isOpen={disconnectOpen}
        onClose={() => setDisconnectOpen(false)}
        onConfirm={() => disconnectMutation.mutate()}
        title={t('gso_disconnect_confirm_title', 'leads', 'Déconnecter la feuille ?')}
        message={t('gso_disconnect_confirm_msg', 'leads', 'Vos leads ne seront plus envoyés vers cette feuille. Votre solde reste sur votre compte.')}
        confirmText={t('gso_disconnect', 'leads', 'Déconnecter')}
        cancelText={t('cancel', 'leads', 'Annuler')}
        type="danger"
      />
    </>
  );
}
