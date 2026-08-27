import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BadgeCheck, Check, Clock, Loader2, Package, X, Zap } from 'lucide-react';
import toast from 'react-hot-toast';
import { useLanguage } from '../../contexts/LanguageContext';
import { formatMoney } from '../../lib/sheetMoney';
import { sheetPlansApi, type PlansPayload, type SheetPlan } from '../../lib/sheetPlansApi';
import { accentStyles } from '../../lib/planAccent';

/**
 * The seller's monthly-pack picker.
 *
 * WHAT A PACK IS, ON SCREEN. Without one, every lead written into the seller's
 * sheet costs the tariff out of their cents balance. With one, a fixed number of
 * leads a month is already paid for and the balance stops moving until the quota
 * runs out. That is the whole story this panel has to tell, so the running pack
 * leads with its remaining quota — the number that decides whether the next lead
 * arrives with a readable phone — and not with what it cost.
 *
 * SUBSCRIBING DOES NOT SUBSCRIBE. There is no payment gateway, so the button sends
 * a REQUEST an admin approves out of band. The copy says so plainly rather than
 * letting a seller believe their pack is live and then wonder why leads still lock.
 *
 * Renders nothing at all for an account without the Google Sheets entitlement:
 * the endpoint answers `enabled: false` (never a 403), and a pack picker for a
 * feature the account cannot use is a dead button.
 */

/** The routers disagree on the envelope; unwrap both without asserting a shape. */
const unwrap = (res: any) => res?.data?.data ?? res?.data ?? null;

/**
 * `1.5` -> `"$0.015"`. The per-lead price ON a pack, in fractional cents.
 *
 * Not formatMoney: that one floors to whole cents, so the $30 / 2 000 pack (1.5¢ a
 * lead) and the $50 / 5 000 one (1¢) would both print as "$0.01" and the cheaper
 * pack would look identical to the dearer one.
 *
 * Four decimals is the widest this ever needs — it survives a pack priced in
 * hundredths of a cent — but trailing zeros are trimmed back to two, so a rate that
 * happens to be round reads "$0.01" rather than the falsely-precise "$0.0100".
 */
function formatSubCent(cents: number): string {
  const n = Number(cents);
  if (!Number.isFinite(n) || n <= 0) return '$0.00';
  const fixed = (n / 100).toFixed(4);
  return `$${fixed.replace(/(\.\d{2}\d*?)0+$/, '$1')}`;
}

const dateOf = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString([], { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

export default function SheetPlansPanel() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState<SheetPlan | null>(null);

  const { data, isLoading } = useQuery<PlansPayload | null>({
    queryKey: ['sheet-plans'],
    queryFn: async () => unwrap(await sheetPlansApi.get()),
    staleTime: 30000,
    retry: false,
  });

  /**
   * Both mutations invalidate `sheet-credits` as well as `sheet-plans`: a pack is
   * capacity, so the header chip and the gate figures are stale the moment either
   * one lands, and refetching only the picker would leave the two disagreeing.
   */
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['sheet-plans'] });
    queryClient.invalidateQueries({ queryKey: ['sheet-credits'] });
  };

  const subscribe = useMutation({
    mutationFn: async (planId: number) => sheetPlansApi.subscribe(planId),
    onSuccess: (res: any) => {
      setConfirming(null);
      invalidate();
      toast.success(
        res?.data?.message ||
          t('sp_request_sent', 'dashboard', 'Demande envoyée. Un administrateur va la valider.')
      );
    },
    onError: (err: any) => {
      toast.error(
        err?.response?.data?.message || t('sp_request_failed', 'dashboard', "La demande n'a pas pu être envoyée")
      );
    },
  });

  const cancelRequest = useMutation({
    mutationFn: async () => sheetPlansApi.cancelRequest(),
    onSuccess: () => {
      invalidate();
      toast.success(t('sp_request_cancelled', 'dashboard', 'Demande annulée'));
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || t('sp_generic_error', 'dashboard', 'Opération impossible'));
    },
  });

  if (isLoading) {
    return (
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-10 flex justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-emerald-500" />
      </div>
    );
  }

  // An account without the entitlement is shown nothing at all, rather than a
  // picker whose button can only ever answer 403.
  if (!data?.enabled) return null;

  const plans = data.plans || [];
  const active = data.state?.subscription || null;
  const pending = data.state?.pending || null;
  const tariff = Number(data.priceCents) || 0;

  /** How far through the month's quota the seller is, for the progress bar. */
  const usedPct = active && active.leadQuota > 0
    ? Math.min(100, Math.round((active.leadsUsed / active.leadQuota) * 100))
    : 0;

  /**
   * The running pack's colour, taken from its entry in the catalogue rather than
   * from the subscription — the subscription snapshots price and quota, not
   * presentation, so the card and this banner would otherwise disagree the moment
   * an admin recoloured the pack. Falls back to the default if the pack has since
   * been deactivated and is no longer in the list.
   */
  const activeAccent = accentStyles(plans.find((p) => p.id === active?.planId)?.accentColor);

  return (
    <div className="space-y-4">
      {/* ── The running pack, or the pay-as-you-go state it replaces ────────── */}
      {active ? (
        <div className="bg-white rounded-3xl border shadow-sm overflow-hidden" style={activeAccent.outline}>
          <div
            className="px-5 py-4 border-b flex items-center justify-between gap-3 flex-wrap"
            style={activeAccent.surface}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className="w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={activeAccent.solid}
              >
                <BadgeCheck size={17} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-black text-gray-900 truncate">{active.planName}</p>
                <p className="text-[10px] font-bold uppercase tracking-widest" style={activeAccent.text}>
                  {t('sp_active', 'dashboard', 'Pack actif')} · {formatMoney(active.priceCents)}
                  {t('sp_per_month_suffix', 'dashboard', '/mois')}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-black tabular-nums leading-none" style={activeAccent.text}>
                {active.remaining.toLocaleString()}
              </p>
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mt-1">
                {t('sp_leads_left', 'dashboard', 'Leads restants')}
              </p>
            </div>
          </div>

          <div className="px-5 py-4 space-y-3">
            <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${usedPct}%`, backgroundColor: activeAccent.hex }}
              />
            </div>
            <div className="flex items-center justify-between gap-3 text-[10px] font-bold text-gray-500 tabular-nums">
              <span>
                {t('sp_used_of', 'dashboard', '{used} / {quota} leads utilisés')
                  .replace('{used}', active.leadsUsed.toLocaleString())
                  .replace('{quota}', active.leadQuota.toLocaleString())}
              </span>
              <span>
                {t('sp_renews_on', 'dashboard', "Expire le {date}").replace('{date}', dateOf(active.endsAt))}
              </span>
            </div>
            {/* The one thing a seller on a pack has to know: what happens at zero. */}
            <p className="text-[10px] font-medium text-gray-400 leading-relaxed">
              {t(
                'sp_overflow_notice',
                'dashboard',
                'Une fois le quota épuisé, les leads suivants sont facturés {price} à l’unité sur votre solde.'
              ).replace('{price}', formatMoney(tariff))}
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm px-5 py-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center flex-shrink-0">
            <Zap size={17} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-black text-gray-900">
              {t('sp_payg_title', 'dashboard', "Facturation à l'unité")}
            </p>
            <p className="text-[10px] font-bold text-gray-400 mt-0.5">
              {t('sp_payg_subtitle', 'dashboard', 'Chaque lead envoyé coûte {price} sur votre solde.').replace(
                '{price}',
                formatMoney(tariff)
              )}
            </p>
          </div>
        </div>
      )}

      {/* ── A request waiting on an admin ───────────────────────────────────── */}
      {pending && (
        <div className="bg-amber-50 rounded-3xl border border-amber-100 px-5 py-4 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5 min-w-0">
            <Clock size={16} className="text-amber-600 flex-shrink-0" />
            <p className="text-[11px] font-bold text-amber-800 leading-relaxed">
              {t('sp_pending_notice', 'dashboard', 'Demande pour le {plan} en attente de validation.').replace(
                '{plan}',
                pending.planName
              )}
            </p>
          </div>
          <button
            onClick={() => cancelRequest.mutate()}
            disabled={cancelRequest.isPending}
            className="text-[10px] font-black text-amber-700 hover:text-amber-900 uppercase tracking-widest disabled:opacity-50"
          >
            {t('sp_cancel_request', 'dashboard', 'Annuler')}
          </button>
        </div>
      )}

      {/* ── The catalogue ───────────────────────────────────────────────────── */}
      {plans.length > 0 && (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50">
            <h2 className="text-xs font-black text-gray-900 uppercase tracking-widest flex items-center gap-2">
              <Package size={14} className="text-emerald-600" />
              {t('sp_packs_title', 'dashboard', 'Packs mensuels')}
            </h2>
            <p className="text-[10px] font-medium text-gray-400 mt-1 leading-relaxed">
              {t(
                'sp_packs_subtitle',
                'dashboard',
                "Un pack couvre un nombre de leads par mois. Sans pack, chaque lead est facturé {price}."
              ).replace('{price}', formatMoney(tariff))}
            </p>
          </div>

          {/* Three across from `lg` down to two on a tablet and one on a phone. The
              cards carry a price and a sentence, so below ~1024px a third column
              would wrap the prose to two words a line. */}
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {plans.map((plan) => {
              const isCurrent = active?.planId === plan.id;
              const isPending = pending?.planId === plan.id;
              // One colour per pack, so three cards side by side are told apart at a
              // glance instead of being three identical green rectangles.
              const accent = accentStyles(plan.accentColor);
              return (
                <div
                  key={plan.id}
                  className="rounded-2xl border p-4 flex flex-col gap-3 transition-colors"
                  style={isCurrent ? accent.surface : accent.outline}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-black text-gray-900 truncate">{plan.name}</p>
                      <p className="text-[10px] font-black uppercase tracking-widest mt-0.5 tabular-nums" style={accent.text}>
                        {plan.leadQuota.toLocaleString()} {t('sp_leads_word', 'dashboard', 'leads')}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xl font-black text-gray-900 tabular-nums leading-none">
                        {formatMoney(plan.priceCents)}
                      </p>
                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mt-1">
                        {t('sp_per_period', 'dashboard', '/ {days} jours').replace(
                          '{days}',
                          String(plan.periodDays)
                        )}
                      </p>
                    </div>
                  </div>

                  {plan.description && (
                    <p className="text-[10px] font-medium text-gray-500 leading-relaxed">{plan.description}</p>
                  )}

                  {/* The comparison that justifies the pack, computed by the server.
                      The PACK's rate carries the emphasis and the tariff it beats is
                      muted: the green half is the price the seller would be paying,
                      so colouring $0.05 as the good news sold the wrong number. */}
                  <p className="text-[10px] font-bold tabular-nums" style={accent.text}>
                    {t('sp_effective_rate', 'dashboard', 'Soit {rate} par lead').replace(
                      '{rate}',
                      formatSubCent(plan.effectivePricePerLead)
                    )}
                    {tariff > 0 && (
                      <span className="text-gray-400 font-medium">
                        {' · '}
                        {t('sp_vs_tariff', 'dashboard', 'au lieu de {price}').replace('{price}', formatMoney(tariff))}
                      </span>
                    )}
                  </p>

                  {isCurrent ? (
                    <div
                      className="mt-auto flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest"
                      style={accent.chip}
                    >
                      <Check size={12} />
                      {t('sp_current_plan', 'dashboard', 'Pack actuel')}
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirming(plan)}
                      // Any pending request blocks every card, not just its own: the
                      // server allows one at a time and a second click would only
                      // ever return 409.
                      disabled={!!pending || subscribe.isPending}
                      className="mt-auto py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-opacity hover:opacity-90 disabled:opacity-40"
                      // The pack's own colour, so the button belongs to the card it
                      // sits in rather than to the page.
                      style={accent.solid}
                    >
                      {isPending
                        ? t('sp_requested', 'dashboard', 'Demandé')
                        : active
                          ? t('sp_switch_to', 'dashboard', 'Changer pour ce pack')
                          : t('sp_subscribe', 'dashboard', 'Demander ce pack')}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Confirmation ────────────────────────────────────────────────────── */}
      {confirming && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-50 flex items-center justify-between gap-3">
              <h3 className="text-sm font-black text-gray-900">
                {t('sp_confirm_title', 'dashboard', 'Demander ce pack')}
              </h3>
              <button
                onClick={() => setConfirming(null)}
                className="text-gray-300 hover:text-gray-600 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <div className="px-6 py-5 space-y-3">
              <p className="text-xs font-bold text-gray-900">
                {confirming.name} · {formatMoney(confirming.priceCents)}
                {t('sp_per_month_suffix', 'dashboard', '/mois')} ·{' '}
                {confirming.leadQuota.toLocaleString()} {t('sp_leads_word', 'dashboard', 'leads')}
              </p>
              {/* Said once, plainly: the button does not activate anything. */}
              <p className="text-[11px] font-medium text-gray-500 leading-relaxed">
                {t(
                  'sp_confirm_body',
                  'dashboard',
                  "Votre demande sera transmise à un administrateur. Le pack ne sera actif qu'après validation, et le paiement se fait hors plateforme."
                )}
              </p>
              {active && (
                <p className="text-[11px] font-bold text-amber-700 leading-relaxed">
                  {t(
                    'sp_confirm_replace',
                    'dashboard',
                    'Ce pack remplacera le {plan} en cours dès sa validation, et le quota repart de zéro.'
                  ).replace('{plan}', active.planName)}
                </p>
              )}
            </div>
            <div className="px-6 py-4 bg-gray-50/60 border-t border-gray-50 flex items-center justify-end gap-2">
              <button
                onClick={() => setConfirming(null)}
                className="px-4 py-2.5 rounded-xl text-[10px] font-black text-gray-500 hover:text-gray-900 uppercase tracking-widest transition-colors"
              >
                {t('sp_cancel', 'dashboard', 'Annuler')}
              </button>
              <button
                onClick={() => subscribe.mutate(confirming.id)}
                disabled={subscribe.isPending}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {subscribe.isPending && <Loader2 size={12} className="animate-spin" />}
                {t('sp_confirm_send', 'dashboard', 'Envoyer la demande')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
