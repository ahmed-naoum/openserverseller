import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  BadgeCheck,
  Ban,
  Check,
  Clock,
  Loader2,
  Package,
  Pencil,
  Plus,
  Search,
  X,
} from 'lucide-react';
import { formatMoney } from '../../lib/sheetMoney';
import { ACCENT_PRESETS, DEFAULT_ACCENT, accentOf, accentStyles, normaliseAccent } from '../../lib/planAccent';
import {
  sheetPlansAdminApi,
  type AdminSheetPlan,
  type AdminSubscription,
  type PlanDraft,
  type SubscriptionStatus,
} from '../../lib/sheetPlansApi';

/**
 * « Packs & abonnements » — le cinquième onglet de la console « Envoi des leads ».
 *
 * DEUX CHOSES, DANS CET ORDRE. En haut la FILE : les vendeurs qui demandent un
 * pack et attendent une validation. En bas le CATALOGUE : ce qui est vendu, et à
 * quel prix. La file passe en premier parce que c'est la seule partie de cette
 * page où quelqu'un attend — un catalogue mal trié ne bloque personne, une
 * demande non validée bloque un vendeur qui a déjà payé.
 *
 * CE QU'IL FAUT SAVOIR AVANT DE VALIDER. Il n'y a aucune passerelle de paiement
 * dans cette plateforme : la validation EST le reçu. Valider donne le quota
 * immédiatement, donc elle ne doit intervenir qu'après encaissement hors
 * plateforme. Le bouton le rappelle plutôt que de le supposer connu.
 *
 * TOUS LES MONTANTS SONT DES CENTS ENTIERS, jamais divisés ici — sauf
 * `effectivePricePerLead`, que le serveur calcule en cents fractionnaires parce
 * qu'un pack coûte moins d'un cent par lead.
 */

const unwrap = (res: any) => res?.data?.data ?? res?.data ?? null;

/** Comment chaque statut se lit, et ce qu'il autorise. */
const STATUS_META: Record<SubscriptionStatus, { label: string; tone: string }> = {
  PENDING: { label: 'En attente', tone: 'bg-amber-50 text-amber-700 border-amber-200' },
  ACTIVE: { label: 'Actif', tone: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  REJECTED: { label: 'Refusé', tone: 'bg-rose-50 text-rose-700 border-rose-200' },
  CANCELLED: { label: 'Annulé', tone: 'bg-gray-100 text-gray-600 border-gray-200' },
  EXPIRED: { label: 'Expiré', tone: 'bg-slate-100 text-slate-600 border-slate-200' },
};

const STATUS_FILTERS: { key: SubscriptionStatus | ''; label: string }[] = [
  { key: '', label: 'Tous' },
  { key: 'PENDING', label: 'En attente' },
  { key: 'ACTIVE', label: 'Actifs' },
  { key: 'EXPIRED', label: 'Expirés' },
  { key: 'CANCELLED', label: 'Annulés' },
  { key: 'REJECTED', label: 'Refusés' },
];

const PAGE_SIZE = 25;

/** `1.5` -> `"$0.015"`. Voir formatSubCent côté vendeur : formatMoney arrondirait à $0.01. */
const formatSubCent = (cents: number): string => {
  const n = Number(cents);
  if (!Number.isFinite(n) || n <= 0) return '$0.00';
  const fixed = (n / 100).toFixed(4);
  return `$${fixed.replace(/(\.\d{2}\d*?)0+$/, '$1')}`;
};

const dateOf = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

/** Un brouillon de plan tel que le formulaire le tient : en DOLLARS, pas en cents. */
interface PlanForm {
  id: number | null;
  code: string;
  name: string;
  priceDollars: string;
  leadQuota: string;
  periodDays: string;
  sortOrder: string;
  description: string;
  /** `#rrggbb`, or '' meaning "use the default accent". */
  accentColor: string;
  active: boolean;
}

const EMPTY_FORM: PlanForm = {
  id: null,
  code: '',
  name: '',
  priceDollars: '',
  leadQuota: '',
  periodDays: '30',
  sortOrder: '0',
  description: '',
  accentColor: '',
  active: true,
};

/**
 * Dollars saisis -> cents entiers. Arrondit plutôt que tronquer, exactement comme
 * `amountToCents` côté serveur : `29.99 * 100` vaut 2998.9999… en binaire.
 */
const dollarsToCents = (value: string): number | null => {
  const n = Number(String(value).replace(',', '.'));
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
};

/**
 * `refreshToken` : le bouton « Actualiser » de la page parente. Ce panneau
 * possède ses propres données, donc le parent ne peut pas les recharger
 * lui-même ; il incrémente ce nombre et l'effet plus bas relit le catalogue et
 * la file.
 */
interface SheetPlansAdminPanelProps {
  refreshToken?: number;
}

export default function SheetPlansAdminPanel({ refreshToken = 0 }: SheetPlansAdminPanelProps) {
  /* ---------------------------------------------------------------- */
  /* catalogue                                                         */
  /* ---------------------------------------------------------------- */
  const [plans, setPlans] = useState<AdminSheetPlan[]>([]);
  const [tariffCents, setTariffCents] = useState(0);
  const [plansLoading, setPlansLoading] = useState(true);
  const [form, setForm] = useState<PlanForm | null>(null);
  const [savingPlan, setSavingPlan] = useState(false);

  /* ---------------------------------------------------------------- */
  /* file d'attente                                                    */
  /* ---------------------------------------------------------------- */
  const [subs, setSubs] = useState<AdminSubscription[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [subsLoading, setSubsLoading] = useState(true);
  const [status, setStatus] = useState<SubscriptionStatus | ''>('PENDING');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  /** L'id en cours de traitement, pour ne désactiver QUE sa ligne. */
  const [acting, setActing] = useState<number | null>(null);

  const loadPlans = async () => {
    setPlansLoading(true);
    try {
      const data = unwrap(await sheetPlansAdminApi.listPlans());
      setPlans(data?.plans || []);
      setTariffCents(Number(data?.priceCents) || 0);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Chargement des packs impossible');
    } finally {
      setPlansLoading(false);
    }
  };

  const loadSubs = async () => {
    setSubsLoading(true);
    try {
      const data = unwrap(
        await sheetPlansAdminApi.listSubscriptions({ page, limit: PAGE_SIZE, status, search: search || undefined })
      );
      setSubs(data?.subscriptions || []);
      setPendingCount(Number(data?.pendingCount) || 0);
      setTotalPages(Math.max(1, Number(data?.pagination?.totalPages) || 1));
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Chargement des abonnements impossible');
    } finally {
      setSubsLoading(false);
    }
  };

  useEffect(() => {
    void loadPlans();
    // Le catalogue ne dépend d'aucun filtre : chargé une fois.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void loadSubs(), search ? 350 : 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, status, search]);

  // Rafraîchissement demandé par la page. La ref garde le premier rendu hors du
  // jeu : les deux effets ci-dessus viennent déjà de charger, un troisième appel
  // au montage ne ferait que doubler les requêtes.
  const mountedToken = useRef(refreshToken);
  useEffect(() => {
    if (refreshToken === mountedToken.current) return;
    mountedToken.current = refreshToken;
    void Promise.all([loadPlans(), loadSubs()]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshToken]);

  /* ---------------------------------------------------------------- */
  /* actions                                                           */
  /* ---------------------------------------------------------------- */

  const act = async (
    id: number,
    verb: 'approve' | 'reject' | 'cancel',
    confirmText: string,
    successText: string
  ) => {
    if (!window.confirm(confirmText)) return;
    // Le motif est facultatif partout : sur un refus ou une annulation il part
    // dans la notification du vendeur, donc il vaut mieux le demander que de le
    // laisser deviner « pourquoi ».
    const note =
      verb === 'approve' ? undefined : window.prompt('Motif (facultatif, transmis au vendeur) :') || undefined;

    setActing(id);
    try {
      await sheetPlansAdminApi[verb](id, note);
      toast.success(successText);
      // Le catalogue aussi : `activeSubscribers` vient de bouger.
      await Promise.all([loadSubs(), loadPlans()]);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "L'opération a échoué");
    } finally {
      setActing(null);
    }
  };

  const savePlan = async () => {
    if (!form) return;
    const priceCents = dollarsToCents(form.priceDollars);
    const leadQuota = Number(form.leadQuota);
    const periodDays = Number(form.periodDays);

    if (!form.name.trim()) return toast.error('Le nom est obligatoire');
    if (priceCents === null) return toast.error('Prix invalide');
    if (!Number.isInteger(leadQuota) || leadQuota <= 0) return toast.error('Quota de leads invalide');
    if (!Number.isInteger(periodDays) || periodDays <= 0) return toast.error('Durée invalide');
    // Caught here as well as on the server so a typo is a message next to the field
    // rather than a round trip that comes back as a generic 400.
    if (form.accentColor.trim() && !normaliseAccent(form.accentColor))
      return toast.error('Couleur invalide (format attendu : #RRGGBB)');

    const draft: PlanDraft = {
      name: form.name.trim(),
      priceCents,
      leadQuota,
      periodDays,
      sortOrder: Number(form.sortOrder) || 0,
      description: form.description.trim() || null,
      // '' is meaningful — it clears the accent back to the default — so it is sent
      // as an empty string rather than omitted, which the PATCH reads as "no change".
      accentColor: form.accentColor.trim(),
      active: form.active,
    };
    // `code` n'est envoyé qu'à la création : il identifie le plan et ne bouge plus.
    if (form.id === null) draft.code = form.code.trim().toUpperCase();

    if (form.id === null && !draft.code) return toast.error('Le code est obligatoire');

    setSavingPlan(true);
    try {
      if (form.id === null) await sheetPlansAdminApi.createPlan(draft);
      else await sheetPlansAdminApi.updatePlan(form.id, draft);
      toast.success(form.id === null ? 'Pack créé' : 'Pack mis à jour');
      setForm(null);
      await loadPlans();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Enregistrement impossible');
    } finally {
      setSavingPlan(false);
    }
  };

  const editPlan = (plan: AdminSheetPlan) =>
    setForm({
      id: plan.id,
      code: plan.code,
      name: plan.name,
      // Le formulaire parle en dollars ; la conversion se fait aux deux bords.
      priceDollars: (plan.priceCents / 100).toFixed(2),
      leadQuota: String(plan.leadQuota),
      periodDays: String(plan.periodDays),
      sortOrder: String(plan.sortOrder),
      description: plan.description || '',
      accentColor: plan.accentColor || '',
      active: plan.active,
    });

  return (
    <div className="space-y-4">
      {/* ===================== FILE D'ATTENTE ===================== */}
      <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <Clock size={16} className="text-amber-600" />
            <h3 className="text-sm font-black text-gray-900">Demandes & abonnements</h3>
            {pendingCount > 0 && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-700 tabular-nums">
                {pendingCount} en attente
              </span>
            )}
          </div>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
            <input
              value={search}
              onChange={(e) => {
                setPage(1);
                setSearch(e.target.value);
              }}
              placeholder="Nom ou e-mail du vendeur"
              className="w-56 rounded-xl border border-gray-200 py-2 pl-8 pr-3 text-xs font-medium outline-none focus:border-gray-900"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 border-b border-gray-100 px-5 py-3">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.key || 'all'}
              type="button"
              onClick={() => {
                setPage(1);
                setStatus(f.key);
              }}
              className={`rounded-lg px-3 py-1.5 text-[11px] font-bold transition-colors ${
                status === f.key ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {subsLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-gray-300" />
          </div>
        ) : subs.length === 0 ? (
          <p className="py-12 text-center text-xs font-bold text-gray-400">Aucun abonnement pour ce filtre</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {subs.map((sub) => {
              const meta = STATUS_META[sub.status] || STATUS_META.CANCELLED;
              const busy = acting === sub.id;
              // Un abonnement dont `endsAt` est passé ne couvre plus rien, même si
              // le cron d'expiration ne l'a pas encore estampillé — même lecture
              // que le serveur, sinon la console affirmerait « actif » à tort.
              const lapsed = !!sub.endsAt && new Date(sub.endsAt).getTime() <= Date.now();
              const live = sub.status === 'ACTIVE' && !lapsed;
              const usedPct = sub.leadQuota > 0 ? Math.min(100, Math.round((sub.leadsUsed / sub.leadQuota) * 100)) : 0;

              return (
                <div key={sub.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                  <div className="min-w-[190px] flex-1">
                    <p className="truncate text-xs font-black text-gray-900">{sub.user.name}</p>
                    <p className="truncate text-[10px] font-medium text-gray-400">{sub.user.email}</p>
                    {!sub.user.googleSheetsOutboundEnabled && (
                      <p className="mt-1 text-[10px] font-black uppercase tracking-wider text-rose-600">
                        Google Sheets désactivé sur ce compte
                      </p>
                    )}
                  </div>

                  <div className="min-w-[130px]">
                    <p className="text-xs font-black text-gray-900">{sub.plan.name}</p>
                    <p className="text-[10px] font-bold tabular-nums text-gray-400">
                      {formatMoney(sub.priceCents)} · {sub.leadQuota.toLocaleString('fr-FR')} leads
                    </p>
                  </div>

                  {/* La consommation n'a de sens que sur un abonnement qui tourne :
                      sur une demande en attente le quota n'est pas encore engagé. */}
                  <div className="min-w-[150px]">
                    {live ? (
                      <>
                        <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
                          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${usedPct}%` }} />
                        </div>
                        <p className="mt-1 text-[10px] font-bold tabular-nums text-gray-500">
                          {sub.leadsUsed.toLocaleString('fr-FR')} / {sub.leadQuota.toLocaleString('fr-FR')} ·{' '}
                          expire le {dateOf(sub.endsAt)}
                        </p>
                      </>
                    ) : (
                      <p className="text-[10px] font-bold text-gray-400">
                        Demandé le {dateOf(sub.requestedAt)}
                        {sub.requestNote ? ` · « ${sub.requestNote} »` : ''}
                      </p>
                    )}
                  </div>

                  <span
                    className={`rounded-lg border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${meta.tone}`}
                  >
                    {lapsed && sub.status === 'ACTIVE' ? 'Expiré' : meta.label}
                  </span>

                  <div className="ml-auto flex items-center gap-2">
                    {sub.status === 'PENDING' && (
                      <>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            act(
                              sub.id,
                              'approve',
                              `Activer le ${sub.plan.name} (${formatMoney(sub.priceCents)}) pour ${sub.user.name} ?\n\n` +
                                `${sub.leadQuota.toLocaleString('fr-FR')} leads sont crédités immédiatement. ` +
                                'À ne faire QU\'APRÈS encaissement : la plateforme ne prend aucun paiement.',
                              'Pack activé'
                            )
                          }
                          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
                        >
                          {busy ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                          Valider
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            act(sub.id, 'reject', `Refuser la demande de ${sub.user.name} ?`, 'Demande refusée')
                          }
                          className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-gray-500 transition-colors hover:border-rose-200 hover:text-rose-600 disabled:opacity-50"
                        >
                          <X size={12} />
                          Refuser
                        </button>
                      </>
                    )}
                    {live && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          act(
                            sub.id,
                            'cancel',
                            `Arrêter le ${sub.plan.name} de ${sub.user.name} maintenant ?\n\n` +
                              'Le compte repasse aussitôt à la facturation au lead.',
                            'Abonnement annulé'
                          )
                        }
                        className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-gray-500 transition-colors hover:border-rose-200 hover:text-rose-600 disabled:opacity-50"
                      >
                        {busy ? <Loader2 size={12} className="animate-spin" /> : <Ban size={12} />}
                        Arrêter
                      </button>
                    )}
                  </div>

                  {sub.adminNote && (
                    <p className="w-full text-[10px] font-medium italic text-gray-400">Note : {sub.adminNote}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-100 px-5 py-3">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-lg px-3 py-1.5 text-[11px] font-bold text-gray-500 disabled:opacity-30"
            >
              Précédent
            </button>
            <span className="text-[11px] font-bold tabular-nums text-gray-400">
              {page} / {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="rounded-lg px-3 py-1.5 text-[11px] font-bold text-gray-500 disabled:opacity-30"
            >
              Suivant
            </button>
          </div>
        )}
      </div>

      {/* ===================== CATALOGUE ===================== */}
      <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <Package size={16} className="text-gray-900" />
            <h3 className="text-sm font-black text-gray-900">Catalogue des packs</h3>
            {tariffCents > 0 && (
              <span className="text-[10px] font-bold text-gray-400">
                tarif sans pack : {formatMoney(tariffCents)} / lead
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setForm({ ...EMPTY_FORM })}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gray-900 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-white transition-colors hover:bg-gray-700"
          >
            <Plus size={12} />
            Nouveau pack
          </button>
        </div>

        {plansLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-gray-300" />
          </div>
        ) : plans.length === 0 ? (
          <p className="py-12 text-center text-xs font-bold text-gray-400">Aucun pack au catalogue</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {plans.map((plan) => (
              <div key={plan.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                <span
                  className="h-8 w-1.5 flex-shrink-0 rounded-full"
                  style={{ backgroundColor: accentOf(plan.accentColor) }}
                  title={plan.accentColor || `${DEFAULT_ACCENT} (défaut)`}
                />
                <div className="min-w-[170px] flex-1">
                  <p className="flex items-center gap-2 text-xs font-black text-gray-900">
                    {plan.name}
                    {!plan.active && (
                      <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[9px] font-black uppercase text-gray-500">
                        masqué
                      </span>
                    )}
                  </p>
                  <p className="text-[10px] font-medium text-gray-400">{plan.code}</p>
                </div>

                <div className="min-w-[110px]">
                  <p className="text-xs font-black tabular-nums text-gray-900">
                    {formatMoney(plan.priceCents)}
                    <span className="font-bold text-gray-400"> / {plan.periodDays} j</span>
                  </p>
                  <p className="text-[10px] font-bold tabular-nums text-gray-400">
                    {plan.leadQuota.toLocaleString('fr-FR')} leads
                  </p>
                </div>

                <div className="min-w-[120px]">
                  <p className="text-[10px] font-bold tabular-nums text-emerald-600">
                    {formatSubCent(plan.effectivePricePerLead)} / lead
                  </p>
                  <p className="text-[10px] font-bold tabular-nums text-gray-400">
                    {plan.activeSubscribers} abonné(s)
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => editPlan(plan)}
                  className="ml-auto inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-gray-500 transition-colors hover:border-gray-900 hover:text-gray-900"
                >
                  <Pencil size={12} />
                  Modifier
                </button>
              </div>
            ))}
          </div>
        )}

        <p className="border-t border-gray-100 bg-gray-50/60 px-5 py-3 text-[10px] font-medium leading-relaxed text-gray-500">
          <BadgeCheck size={12} className="mr-1 inline text-gray-400" />
          Modifier un pack n'affecte <span className="font-bold">aucun</span> abonnement en cours : chacun a figé son
          prix et son quota au moment de la validation. Le nouveau tarif s'applique à partir de la prochaine
          validation.
        </p>
      </div>

      {/* ===================== FORMULAIRE ===================== */}
      {form && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-6 py-4">
              <h3 className="text-sm font-black text-gray-900">
                {form.id === null ? 'Nouveau pack' : `Modifier « ${form.name} »`}
              </h3>
              <button type="button" onClick={() => setForm(null)} className="text-gray-300 hover:text-gray-700">
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 px-6 py-5">
              {form.id === null && (
                <label className="col-span-2 block">
                  <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-gray-400">
                    Code (définitif)
                  </span>
                  <input
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                    placeholder="SHEETS_100K"
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs font-bold uppercase outline-none focus:border-gray-900"
                  />
                </label>
              )}

              <label className="col-span-2 block">
                <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-gray-400">Nom</span>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs font-medium outline-none focus:border-gray-900"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-gray-400">
                  Prix ($)
                </span>
                <input
                  value={form.priceDollars}
                  onChange={(e) => setForm({ ...form, priceDollars: e.target.value })}
                  inputMode="decimal"
                  placeholder="30.00"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs font-bold tabular-nums outline-none focus:border-gray-900"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-gray-400">
                  Quota de leads
                </span>
                <input
                  value={form.leadQuota}
                  onChange={(e) => setForm({ ...form, leadQuota: e.target.value })}
                  inputMode="numeric"
                  placeholder="20000"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs font-bold tabular-nums outline-none focus:border-gray-900"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-gray-400">
                  Durée (jours)
                </span>
                <input
                  value={form.periodDays}
                  onChange={(e) => setForm({ ...form, periodDays: e.target.value })}
                  inputMode="numeric"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs font-bold tabular-nums outline-none focus:border-gray-900"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-gray-400">
                  Ordre d'affichage
                </span>
                <input
                  value={form.sortOrder}
                  onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
                  inputMode="numeric"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs font-bold tabular-nums outline-none focus:border-gray-900"
                />
              </label>

              <label className="col-span-2 block">
                <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-gray-400">
                  Description (vue par le vendeur)
                </span>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={2}
                  className="w-full resize-none rounded-xl border border-gray-200 px-3 py-2 text-xs font-medium outline-none focus:border-gray-900"
                />
              </label>

              {/* Couleur. Six pastilles sûres sur fond blanc, plus un sélecteur libre
                  et le hex en clair : la rangée couvre le cas courant (distinguer
                  trois packs d'un coup d'œil) sans interdire une teinte de marque. */}
              <div className="col-span-2">
                <span className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-gray-400">
                  Couleur de la carte
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  {ACCENT_PRESETS.map((preset) => {
                    const selected = accentOf(form.accentColor) === preset.hex;
                    return (
                      <button
                        key={preset.hex}
                        type="button"
                        title={preset.label}
                        onClick={() => setForm({ ...form, accentColor: preset.hex })}
                        className={`h-7 w-7 rounded-full transition-transform hover:scale-110 ${
                          selected ? 'ring-2 ring-gray-900 ring-offset-2' : ''
                        }`}
                        style={{ backgroundColor: preset.hex }}
                      />
                    );
                  })}

                  <input
                    type="color"
                    value={accentOf(form.accentColor)}
                    onChange={(e) => setForm({ ...form, accentColor: e.target.value })}
                    title="Couleur personnalisée"
                    className="h-7 w-9 cursor-pointer rounded border border-gray-200 bg-white p-0.5"
                  />

                  <input
                    value={form.accentColor}
                    onChange={(e) => setForm({ ...form, accentColor: e.target.value })}
                    placeholder={DEFAULT_ACCENT}
                    className="w-24 rounded-xl border border-gray-200 px-2 py-1.5 text-[11px] font-bold uppercase tabular-nums outline-none focus:border-gray-900"
                  />

                  {form.accentColor && (
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, accentColor: '' })}
                      className="text-[10px] font-black uppercase tracking-wider text-gray-400 hover:text-gray-900"
                    >
                      Défaut
                    </button>
                  )}
                </div>

                {/* Ce que le vendeur verra, avec la couleur choisie. */}
                <div
                  className="mt-2.5 inline-flex items-center gap-2 rounded-xl border px-3 py-2"
                  style={accentStyles(form.accentColor).surface}
                >
                  <span className="text-[11px] font-black" style={accentStyles(form.accentColor).text}>
                    {(Number(form.leadQuota) || 0).toLocaleString('en-US')} LEADS
                  </span>
                  <span className="text-[10px] font-bold text-gray-400">aperçu</span>
                </div>
              </div>

              <label className="col-span-2 flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm({ ...form, active: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <span className="text-[11px] font-bold text-gray-600">
                  Visible dans le sélecteur des vendeurs
                </span>
              </label>

              {/* Le calcul que l'admin fait de tête sinon, et se trompe. */}
              {(() => {
                const cents = dollarsToCents(form.priceDollars);
                const quota = Number(form.leadQuota);
                if (cents === null || !Number.isFinite(quota) || quota <= 0) return null;
                return (
                  <p className="col-span-2 text-[10px] font-bold tabular-nums text-gray-400">
                    Soit {formatSubCent((cents / quota) * 100)} par lead
                    {tariffCents > 0 && ` — contre ${formatMoney(tariffCents)} sans pack`}
                  </p>
                );
              })()}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-gray-100 bg-gray-50/60 px-6 py-4">
              <button
                type="button"
                onClick={() => setForm(null)}
                className="px-4 py-2.5 text-[10px] font-black uppercase tracking-wider text-gray-500 hover:text-gray-900"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={savePlan}
                disabled={savingPlan}
                className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-5 py-2.5 text-[10px] font-black uppercase tracking-wider text-white transition-colors hover:bg-gray-700 disabled:opacity-50"
              >
                {savingPlan && <Loader2 size={12} className="animate-spin" />}
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
