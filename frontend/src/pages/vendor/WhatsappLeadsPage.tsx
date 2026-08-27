import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import { format, isToday } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Download,
  Loader2,
  Megaphone,
  Search,
  Sparkles,
  UserPlus,
  X,
} from 'lucide-react';
import {
  waAgentApi,
  type AgentStatus,
  type CollectedLead,
} from '../../lib/waAgentApi';
import { useDebounce } from '../../hooks/utils';

/**
 * Everything the agent has collected, as one table.
 *
 * The inbox reads one conversation at a time, which is right for answering
 * someone and useless for working a day's leads: it cannot say how many drafts
 * are waiting, which of them already became a Lead, or which are blocked. This
 * is that list view.
 *
 * One component serves both dashboards (`/dashboard/whatsapp-leads` and
 * `/influencer/whatsapp-leads`), so no URL here is built from a hardcoded
 * prefix — the only link that leaves the page reads the prefix off the current
 * location.
 *
 * Promotion is BILLED, so every path to it — the row button and the bulk bar —
 * goes through the same confirmation, and both call `promoteMany`: one code
 * path means the single-row case cannot drift away from the bulk one.
 */

/* ------------------------------------------------------------------ */
/* constants                                                           */
/* ------------------------------------------------------------------ */

const PAGE_SIZE = 30;

type StatusValue = CollectedLead['status'];
type StatusFilter = 'all' | StatusValue;
type SourceFilter = 'all' | 'AD' | 'ORGANIC';
type PromotedFilter = 'all' | 'yes' | 'no';

/** The same colours the inbox gives these statuses — one vocabulary, two pages. */
const STATUS_META: Record<StatusValue, { label: string; chip: string }> = {
  NEW: { label: 'Nouvelle', chip: 'bg-blue-50 text-blue-600 border-blue-100' },
  QUALIFIED: { label: 'En cours', chip: 'bg-amber-50 text-amber-600 border-amber-100' },
  CONFIRMED: { label: 'Confirmée', chip: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
  REJECTED: { label: 'Refusée', chip: 'bg-rose-50 text-rose-600 border-rose-100' },
  HUMAN: { label: 'Humain', chip: 'bg-violet-50 text-violet-600 border-violet-100' },
};

const STATUS_CHIPS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'Tous' },
  { value: 'NEW', label: 'Nouvelles' },
  { value: 'QUALIFIED', label: 'En cours' },
  { value: 'CONFIRMED', label: 'Confirmées' },
  { value: 'REJECTED', label: 'Refusées' },
  { value: 'HUMAN', label: 'Humain' },
];

const SOURCE_CHIPS: { value: SourceFilter; label: string }[] = [
  { value: 'all', label: 'Toutes' },
  { value: 'AD', label: 'Publicité' },
  { value: 'ORGANIC', label: 'Organique' },
];

const PROMOTED_OPTIONS: { value: PromotedFilter; label: string }[] = [
  { value: 'all', label: 'Tous' },
  { value: 'yes', label: 'Déjà créés' },
  { value: 'no', label: 'Pas encore' },
];

/** The four draft fields worth reading in a row, out of the nine collected. */
const SUMMARY_FIELDS: { key: string; label: string; suffix?: string }[] = [
  { key: 'product', label: 'Produit' },
  { key: 'city', label: 'Ville' },
  { key: 'quantity', label: 'Quantité' },
  // Plain MAD off the draft, not integer cents: formatWaMoney is for the credit
  // balance and would divide this by a hundred.
  { key: 'price', label: 'Prix', suffix: ' MAD' },
];

/** The agent collects nine fields; `filled` counts against this. */
const DRAFT_FIELD_COUNT = 9;

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

/** The platform answers `{ status, message }` on failure; fall back when it doesn't. */
const errorMessage = (err: unknown, fallback: string): string => {
  const data = (err as { response?: { data?: { message?: string; error?: string } } })?.response?.data;
  return data?.message || data?.error || fallback;
};

const draftValue = (draft: Record<string, unknown> | null, key: string): string => {
  const value = draft ? draft[key] : undefined;
  if (value === null || value === undefined) return '';
  return String(value).trim();
};

const contactLabel = (lead: CollectedLead): string =>
  (lead.pushName || '').trim() || 'Contact WhatsApp';

/**
 * What to show where a phone number goes.
 *
 * WhatsApp masks the number on a privacy (@lid) contact until the customer
 * gives it, so there genuinely is not one yet — say that rather than print an
 * opaque identifier nobody can call.
 */
const phoneLabel = (phone: string | null): string => phone || 'Numéro non communiqué';

const listStamp = (iso: string | null): string => {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return isToday(date) ? format(date, 'HH:mm') : format(date, 'd MMM', { locale: fr });
};

const fullStamp = (iso: string | null): string | undefined => {
  if (!iso) return undefined;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return undefined;
  return format(date, "d MMMM yyyy 'à' HH:mm", { locale: fr });
};

/** Why the row cannot be promoted — the checkbox and the button say the same thing. */
const blockedReason = (lead: CollectedLead): string | null => {
  if (lead.canPromote) return null;
  if (lead.leadId !== null) return `Lead déjà créé (#${lead.leadId}) à partir de cette conversation.`;
  return "Aucun numéro de téléphone : WhatsApp le masque tant que le client ne l'a pas donné.";
};

interface PromoteResult {
  contactId: number;
  ok: boolean;
  leadId?: number;
  error?: string;
}

interface PromoteResponse {
  created: number;
  failed: number;
  results: PromoteResult[];
}

/* ------------------------------------------------------------------ */
/* component                                                           */
/* ------------------------------------------------------------------ */

export default function WhatsappLeadsPage() {
  const location = useLocation();
  const navigate = useNavigate();

  /* -- entitlement ------------------------------------------------ */
  const [agentStatus, setAgentStatus] = useState<AgentStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);

  /* -- list ------------------------------------------------------- */
  const [leads, setLeads] = useState<CollectedLead[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [promotedFilter, setPromotedFilter] = useState<PromotedFilter>('all');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 350);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  /* -- selection / promotion -------------------------------------- */
  const [selected, setSelected] = useState<number[]>([]);
  const [pendingIds, setPendingIds] = useState<number[] | null>(null);
  const [promoting, setPromoting] = useState(false);
  const [exporting, setExporting] = useState(false);

  const enabled = agentStatus?.enabled === true;

  /**
   * The inbox lives under whichever tree the account is browsing. Reading the
   * prefix off the current location is what lets this one component be mounted
   * twice without a copy per dashboard.
   */
  const inboxBase = location.pathname.startsWith('/influencer')
    ? '/influencer/whatsapp-inbox'
    : '/dashboard/whatsapp-inbox';

  /* ---------------------------------------------------------------- */
  /* status                                                            */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await waAgentApi.status();
        if (!alive) return;
        setAgentStatus((res.data?.data ?? { enabled: false }) as AgentStatus);
      } catch {
        // `status` never 403s, so a failure here is the network, not the gate.
        if (alive) setAgentStatus({ enabled: false });
      } finally {
        if (alive) setStatusLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  /* ---------------------------------------------------------------- */
  /* list                                                              */
  /* ---------------------------------------------------------------- */

  const loadLeads = useCallback(
    async (silent: boolean) => {
      if (!silent) setListLoading(true);
      try {
        const res = await waAgentApi.leads({
          status: statusFilter,
          source: sourceFilter,
          promoted: promotedFilter,
          q: debouncedSearch.trim() || undefined,
          page,
          limit: PAGE_SIZE,
        });
        const payload = res.data?.data as {
          leads?: CollectedLead[];
          pagination?: { total?: number; totalPages?: number };
        };
        setLeads(Array.isArray(payload?.leads) ? payload.leads : []);
        setTotal(Number(payload?.pagination?.total) || 0);
        setTotalPages(Math.max(1, Number(payload?.pagination?.totalPages) || 1));
      } catch (err) {
        if (!silent) toast.error(errorMessage(err, 'Impossible de charger les leads collectés.'));
      } finally {
        if (!silent) setListLoading(false);
      }
    },
    [statusFilter, sourceFilter, promotedFilter, debouncedSearch, page]
  );

  useEffect(() => {
    if (!enabled) return;
    loadLeads(false);
  }, [enabled, loadLeads]);

  // Narrowing always restarts at the first page — page 3 of the old result set
  // is meaningless against the new one. Reset alongside the filter rather than
  // in an effect, so the list is fetched once and not twice.
  const applyStatusFilter = (value: StatusFilter) => {
    setStatusFilter(value);
    setPage(1);
  };

  const applySourceFilter = (value: SourceFilter) => {
    setSourceFilter(value);
    setPage(1);
  };

  const applyPromotedFilter = (value: PromotedFilter) => {
    setPromotedFilter(value);
    setPage(1);
  };

  const applySearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  // A selection is a set of rows the account can see. Once the page or the
  // filters move, the ids behind the bulk bar are no longer on screen — acting
  // on them would promote rows nobody is looking at.
  useEffect(() => {
    setSelected([]);
  }, [statusFilter, sourceFilter, promotedFilter, debouncedSearch, page]);

  /* ---------------------------------------------------------------- */
  /* selection                                                         */
  /* ---------------------------------------------------------------- */

  const selectableIds = useMemo(
    () => leads.filter((lead) => lead.canPromote).map((lead) => lead.contactId),
    [leads]
  );

  const allSelected = selectableIds.length > 0 && selected.length === selectableIds.length;

  const toggleRow = (contactId: number) => {
    setSelected((prev) =>
      prev.includes(contactId) ? prev.filter((id) => id !== contactId) : [...prev, contactId]
    );
  };

  const toggleAll = () => {
    setSelected((prev) => (prev.length === selectableIds.length ? [] : selectableIds));
  };

  /* ---------------------------------------------------------------- */
  /* export                                                            */
  /* ---------------------------------------------------------------- */

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await waAgentApi.exportLeads({ status: statusFilter, promoted: promotedFilter });
      // A CSV is a file, not a view: hand it to the browser as a download and
      // release the object URL immediately — nothing else will.
      const url = URL.createObjectURL(res.data as Blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'whatsapp-leads.csv';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success('Export CSV téléchargé.');
    } catch (err) {
      toast.error(errorMessage(err, "L'export CSV a échoué."));
    } finally {
      setExporting(false);
    }
  };

  /* ---------------------------------------------------------------- */
  /* promotion                                                         */
  /* ---------------------------------------------------------------- */

  const confirmPromotion = async () => {
    if (!pendingIds || pendingIds.length === 0) return;
    const ids = pendingIds;

    setPromoting(true);
    try {
      const res = await waAgentApi.promoteMany(ids);
      const payload = res.data?.data as PromoteResponse;
      const created = Number(payload?.created) || 0;
      const results = Array.isArray(payload?.results) ? payload.results : [];
      const failures = results.filter((row) => !row.ok);

      if (created > 0) {
        toast.success(created > 1 ? `${created} leads créés.` : '1 lead créé.');
      }

      if (failures.length > 0) {
        // The API's messages are already French and written for the seller, so
        // they are shown as-is; deduplicated because twenty rows blocked for the
        // same reason are one problem, not twenty.
        const reasons = Array.from(
          new Set(failures.map((row) => row.error || 'Raison inconnue.'))
        );
        toast.error(
          `${failures.length} lead(s) non créé(s) :\n${reasons.map((r) => `• ${r}`).join('\n')}`,
          { duration: 8000 }
        );
      }

      if (created === 0 && failures.length === 0) {
        toast.error('Aucun lead créé.');
      }

      setSelected([]);
      setPendingIds(null);
      await loadLeads(true);
    } catch (err) {
      toast.error(errorMessage(err, 'La création des leads a échoué.'));
    } finally {
      setPromoting(false);
    }
  };

  /* ---------------------------------------------------------------- */
  /* render — gates                                                    */
  /* ---------------------------------------------------------------- */

  if (statusLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 text-primary-500 animate-spin" />
      </div>
    );
  }

  if (!enabled) {
    return (
      <div className="max-w-xl mx-auto py-10">
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-500 flex items-center justify-center mx-auto mb-5">
            <ClipboardList className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-black text-gray-900 tracking-tight">
            Collecte de leads WhatsApp non activée
          </h1>
          <p className="mt-3 text-sm font-medium text-gray-500 leading-relaxed">
            L&apos;agent WhatsApp n&apos;est pas activé sur votre compte. Une fois l&apos;option
            ouverte par l&apos;équipe Vegas, tout ce que l&apos;agent collecte auprès de vos clients
            s&apos;affichera ici : nom, ville, produit, quantité et prix, prêts à devenir des leads
            en un clic.
          </p>
          <p className="mt-4 text-xs font-bold text-gray-400">
            Contactez le support pour demander l&apos;activation.
          </p>
        </div>
      </div>
    );
  }

  /* ---------------------------------------------------------------- */
  /* render — page                                                     */
  /* ---------------------------------------------------------------- */

  const filtersActive =
    !!debouncedSearch.trim() ||
    statusFilter !== 'all' ||
    sourceFilter !== 'all' ||
    promotedFilter !== 'all';

  return (
    <div className="flex flex-col gap-4 pb-24">
      {/* ── Header ───────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Leads collectés</h1>
          <p className="text-xs font-medium text-gray-500 mt-1">
            Tout ce que votre agent a recueilli sur WhatsApp. Créer un lead à partir d&apos;une fiche
            est une action facturée.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:ms-auto">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 bg-white text-[10px] font-black uppercase tracking-widest text-gray-500 tabular-nums">
            <ClipboardList className="w-3 h-3" />
            {total} fiche{total > 1 ? 's' : ''}
          </span>
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-900 text-white text-[10px] font-black uppercase tracking-wider hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            title="Télécharger les fiches filtrées au format CSV"
          >
            {exporting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            Exporter CSV
          </button>
        </div>
      </div>

      {/* ── Filters ──────────────────────────────────────────────── */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-4 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute start-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => applySearch(e.target.value)}
              placeholder="Rechercher un nom ou un numéro…"
              className="w-full ps-10 pe-9 py-2.5 bg-gray-50 border-none rounded-xl text-sm font-medium text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30 transition-all"
            />
            {search ? (
              <button
                type="button"
                onClick={() => applySearch('')}
                className="absolute end-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Effacer la recherche"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            <label
              htmlFor="wa-leads-promoted"
              className="text-[9px] font-black text-gray-400 uppercase tracking-widest"
            >
              Promu
            </label>
            <select
              id="wa-leads-promoted"
              value={promotedFilter}
              onChange={(e) => applyPromotedFilter(e.target.value as PromotedFilter)}
              className="px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-[11px] font-bold text-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500/30 transition-all"
            >
              {PROMOTED_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {STATUS_CHIPS.map((chip) => (
            <button
              key={chip.value}
              type="button"
              onClick={() => applyStatusFilter(chip.value)}
              className={clsx(
                'px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-all',
                statusFilter === chip.value
                  ? 'bg-primary-500 text-white border-primary-500'
                  : 'bg-gray-50 text-gray-500 border-gray-100 hover:bg-gray-100'
              )}
            >
              {chip.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {SOURCE_CHIPS.map((chip) => (
            <button
              key={chip.value}
              type="button"
              onClick={() => applySourceFilter(chip.value)}
              className={clsx(
                'inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-all',
                sourceFilter === chip.value
                  ? 'bg-accent-500 text-white border-accent-500'
                  : 'bg-gray-50 text-gray-500 border-gray-100 hover:bg-gray-100'
              )}
            >
              {chip.value === 'AD' ? <Megaphone className="w-3 h-3" /> : null}
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Table ────────────────────────────────────────────────── */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        {listLoading ? (
          <div className="py-20 text-center">
            <Loader2 className="w-6 h-6 text-primary-500 animate-spin mx-auto" />
          </div>
        ) : leads.length === 0 ? (
          <div className="py-20 px-6 text-center">
            <ClipboardList className="w-8 h-8 text-gray-200 mx-auto mb-3" />
            <p className="text-[11px] font-bold text-gray-400">
              {filtersActive
                ? 'Aucune fiche ne correspond à ces filtres.'
                : "Votre agent n'a encore collecté aucune fiche client."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px]">
              <thead>
                <tr className="border-b border-gray-50 bg-gray-50/60">
                  <th className="w-10 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      disabled={selectableIds.length === 0}
                      aria-label="Tout sélectionner"
                      title={
                        selectableIds.length === 0
                          ? 'Aucune fiche de cette page ne peut devenir un lead.'
                          : 'Sélectionner toutes les fiches promouvables de cette page'
                      }
                      className="w-4 h-4 rounded border-gray-300 text-primary-500 focus:ring-primary-500/30 disabled:opacity-40 disabled:cursor-not-allowed"
                    />
                  </th>
                  {['Contact', 'Statut', 'Fiche collectée', 'Lead', 'Date'].map((label) => (
                    <th
                      key={label}
                      className="px-4 py-3 text-start text-[9px] font-black text-gray-400 uppercase tracking-widest"
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {leads.map((lead) => {
                  const meta = STATUS_META[lead.status];
                  const reason = blockedReason(lead);
                  const isSelected = selected.includes(lead.contactId);
                  const stamp = lead.confirmedAt || lead.lastMessageAt;

                  return (
                    <tr
                      key={lead.contactId}
                      onClick={() => navigate(`${inboxBase}?conversation=${lead.contactId}`)}
                      className={clsx(
                        'cursor-pointer transition-colors',
                        isSelected ? 'bg-primary-50/50' : 'hover:bg-gray-50/70'
                      )}
                      title="Ouvrir la conversation dans la messagerie"
                    >
                      {/* Sélection */}
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleRow(lead.contactId)}
                          disabled={!lead.canPromote}
                          aria-label={`Sélectionner ${contactLabel(lead)}`}
                          title={reason || 'Sélectionner cette fiche'}
                          className="w-4 h-4 rounded border-gray-300 text-primary-500 focus:ring-primary-500/30 disabled:opacity-40 disabled:cursor-not-allowed"
                        />
                      </td>

                      {/* Contact */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-bold text-gray-900 truncate max-w-[180px]">
                            {contactLabel(lead)}
                          </span>
                          {lead.source === 'AD' ? (
                            <span
                              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-accent-50 text-accent-600 border border-accent-100 text-[9px] font-black uppercase tracking-wider flex-shrink-0"
                              title="Conversation issue d’une publicité"
                            >
                              <Megaphone className="w-2.5 h-2.5" />
                              AD
                            </span>
                          ) : null}
                        </div>
                        <p
                          className={clsx(
                            'mt-0.5 text-[10px] font-medium tabular-nums',
                            lead.phone ? 'text-gray-500' : 'text-gray-300 italic'
                          )}
                        >
                          {phoneLabel(lead.phone)}
                        </p>
                      </td>

                      {/* Statut */}
                      <td className="px-4 py-3">
                        <span
                          className={clsx(
                            'inline-block px-1.5 py-0.5 rounded-md border text-[9px] font-black uppercase tracking-wider',
                            meta.chip
                          )}
                        >
                          {meta.label}
                        </span>
                      </td>

                      {/* Fiche collectée */}
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                          {SUMMARY_FIELDS.map((field) => {
                            const value = draftValue(lead.draft, field.key);
                            return (
                              <div key={field.key} className="min-w-0">
                                <span className="block text-[8px] font-black text-gray-300 uppercase tracking-widest">
                                  {field.label}
                                </span>
                                <span
                                  className={clsx(
                                    'block text-[11px] font-bold truncate max-w-[120px]',
                                    value ? 'text-gray-700' : 'text-gray-300'
                                  )}
                                >
                                  {value ? `${value}${field.suffix || ''}` : '—'}
                                </span>
                              </div>
                            );
                          })}
                          <span
                            className="px-1.5 py-0.5 rounded-md bg-primary-50 text-primary-600 text-[9px] font-black tabular-nums"
                            title="Champs remplis par l’agent, sur les neuf de la fiche"
                          >
                            {lead.filled}/{DRAFT_FIELD_COUNT}
                          </span>
                        </div>
                      </td>

                      {/* Lead */}
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        {lead.leadId !== null ? (
                          <div className="flex flex-col gap-1">
                            <span className="inline-flex w-fit items-center gap-1.5 px-2 py-1 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100 text-[10px] font-black uppercase tracking-wider tabular-nums">
                              <Sparkles className="w-3 h-3" />
                              Lead #{lead.leadId}
                            </span>
                            {lead.lead?.status ? (
                              <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">
                                {lead.lead.status}
                              </span>
                            ) : null}
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setPendingIds([lead.contactId])}
                            disabled={!lead.canPromote || promoting}
                            title={reason || 'Créer un lead facturé à partir de cette fiche'}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary-500 text-white text-[10px] font-black uppercase tracking-wider hover:bg-primary-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                          >
                            <UserPlus className="w-3.5 h-3.5" />
                            Créer le lead
                          </button>
                        )}
                      </td>

                      {/* Date */}
                      <td className="px-4 py-3">
                        <span
                          className="text-[10px] font-bold text-gray-400 tabular-nums"
                          title={fullStamp(stamp)}
                        >
                          {listStamp(stamp)}
                        </span>
                        {lead.confirmedAt ? (
                          <span className="block text-[8px] font-black text-emerald-500 uppercase tracking-widest">
                            Confirmée
                          </span>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 ? (
          <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-t border-gray-50 bg-gray-50/50">
            <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest tabular-nums">
              {total} fiche{total > 1 ? 's' : ''} · page {page}/{totalPages}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-white hover:text-primary-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                aria-label="Page précédente"
              >
                <ChevronLeft className="w-3.5 h-3.5 rtl:rotate-180" />
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-white hover:text-primary-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                aria-label="Page suivante"
              >
                <ChevronRight className="w-3.5 h-3.5 rtl:rotate-180" />
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {/* ── Bulk bar ─────────────────────────────────────────────── */}
      {selected.length > 0 ? (
        <div className="sticky bottom-4 z-20">
          <div className="mx-auto flex max-w-2xl flex-wrap items-center gap-3 rounded-2xl border border-gray-100 bg-white px-4 py-3 shadow-xl">
            <span className="text-[11px] font-black text-gray-700 tabular-nums">
              {selected.length} fiche{selected.length > 1 ? 's' : ''} sélectionnée
              {selected.length > 1 ? 's' : ''}
            </span>
            <button
              type="button"
              onClick={() => setSelected([])}
              className="text-[10px] font-bold text-gray-400 uppercase tracking-wider hover:text-gray-600 transition-colors"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={() => setPendingIds(selected)}
              disabled={promoting}
              className="ms-auto inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary-500 text-white text-[10px] font-black uppercase tracking-wider hover:bg-primary-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              {promoting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <UserPlus className="w-3.5 h-3.5" />
              )}
              Créer les leads
            </button>
          </div>
        </div>
      ) : null}

      {/* ── Confirmation ─────────────────────────────────────────── */}
      {pendingIds && pendingIds.length > 0 ? (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            onClick={() => (promoting ? undefined : setPendingIds(null))}
          />
          <div className="relative z-10 w-full max-w-md overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-2xl">
            <div className="flex items-start gap-3 border-b border-gray-100 px-6 py-4">
              <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-500 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-black text-gray-900">
                  Créer {pendingIds.length} lead{pendingIds.length > 1 ? 's' : ''} ?
                </h3>
                <p className="mt-1 text-[11px] font-medium text-gray-500">
                  Cette action est facturée.
                </p>
              </div>
            </div>

            <div className="px-6 py-4 space-y-3">
              <p className="text-xs font-medium text-gray-600 leading-relaxed">
                Vous êtes sur le point de créer{' '}
                <span className="font-black text-gray-900 tabular-nums">{pendingIds.length}</span>{' '}
                lead{pendingIds.length > 1 ? 's' : ''} à partir{' '}
                {pendingIds.length > 1 ? 'des fiches sélectionnées' : 'de cette fiche'}.
              </p>
              <ul className="space-y-1.5 rounded-2xl bg-amber-50/60 border border-amber-100 px-4 py-3">
                <li className="text-[11px] font-bold text-amber-700">
                  · Chaque lead est facturé au tarif de saisie.
                </li>
                <li className="text-[11px] font-bold text-amber-700">
                  · Chaque lead réserve un crédit Google Sheets.
                </li>
                <li className="text-[11px] font-bold text-amber-700">
                  · Le lead peut être transmis automatiquement au call center.
                </li>
              </ul>
              <p className="text-[10px] font-medium text-gray-400">
                Vérifiez les fiches depuis la messagerie avant de continuer — elles ne seront plus
                modifiables ici une fois le lead créé.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-6 py-4">
              <button
                type="button"
                onClick={() => setPendingIds(null)}
                disabled={promoting}
                className="px-3 py-2 rounded-xl border border-gray-200 text-[10px] font-black uppercase tracking-wider text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={confirmPromotion}
                disabled={promoting}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary-500 text-white text-[10px] font-black uppercase tracking-wider hover:bg-primary-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                {promoting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <UserPlus className="w-3.5 h-3.5" />
                )}
                Confirmer la création
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
