import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { sheetCreditsApi } from '../lib/api';
import { basePathFor } from '../lib/dashboardBase';
import { centsToLeads, formatMoney } from '../lib/sheetMoney';
import { accentStyles } from '../lib/planAccent';
// Wallet, not DollarSign: the figure beside it now carries its own "$", and the two
// glyphs side by side read as a typo.
import { Wallet, ChevronRight, ChevronLeft } from 'lucide-react';

/**
 * Only the vendor trees can own sheet credits — the vendor's own dashboard and
 * a sub-account's. Every other role (admin, agent, influenceur, confirmation,
 * helper, grossiste) never even fires the request.
 */
const CREDIT_ROLES = ['VENDOR', 'VENDOR_HELPER'];

/**
 * Below this many LEADS still affordable the chip turns amber; at an empty balance
 * it turns rose. Counted in leads, not in money: the balance is cents now, and a
 * threshold in cents would have to be rewritten every time the tariff moves.
 */
const LOW_BALANCE_LEADS = 20;

/**
 * The dashboard routers do not agree on an envelope — `{ status: 'success', data }`
 * on some, `{ success: true, data }` on others — so unwrap both without asserting
 * a shape (strictNullChecks is off here, narrowing on a flag would not hold).
 */
const unwrap = (res: any) => res?.data?.data ?? res?.data ?? null;

/**
 * The "$" chip in the dashboard header: the money the seller holds for Google
 * Sheets pushes, charged at the server's tariff for every row written into their
 * sheet. Clicking it opens the last ten ledger rows.
 *
 * Every figure the endpoint sends for this chip — the balance, each ledger amount,
 * the tariff — is in integer CENTS and goes through `formatMoney` before it is
 * shown. The gate's `unsent` / `capacity` / `locked` are counts of leads instead,
 * and are printed raw.
 *
 * Three independent guards keep it invisible for everyone else:
 *   a) `enabled` below — the query never fires outside the vendor roles;
 *   b) the endpoint answers 200 `{ enabled: false }` (never a 403) for anyone
 *      who does reach it, so a stray call is not an error toast;
 *   c) the component renders null on `!data?.enabled` and on any error — with
 *      `retry: false` a backend outage costs exactly one request and paints
 *      nothing at all.
 */
export default function SheetCreditsIndicator() {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const location = useLocation();
  const isRtl = language === 'ar';
  const [open, setOpen] = useState(false);

  // (a) Admins, agents, influenceurs and fulfilment never reach the network.
  const canHaveCredits = CREDIT_ROLES.includes(user?.role || '');

  const { data, isError } = useQuery({
    queryKey: ['sheet-credits'],
    queryFn: async () => unwrap(await sheetCreditsApi.me()),
    enabled: canHaveCredits,
    refetchInterval: 60000,
    staleTime: 30000,
    retry: false,
  });

  // The ledger is fetched lazily — nothing is requested until the popover opens.
  // Its key is a child of ['sheet-credits'], so the layout's socket invalidation
  // refreshes the balance and the rows in one go.
  const { data: ledger, isLoading: ledgerLoading } = useQuery({
    queryKey: ['sheet-credits', 'transactions'],
    queryFn: async () => unwrap(await sheetCreditsApi.transactions({ limit: 10 })),
    enabled: open,
    staleTime: 30000,
    retry: false,
  });

  // (c) Anything short of an explicitly enabled account renders nothing.
  if (!canHaveCredits || isError || !data?.enabled) return null;

  const balance = Number(data?.balance ?? 0);

  /**
   * The reservation behind the balance. Each lead captured under the gate holds the
   * price of a row until it reaches the sheet, so the number that decides whether
   * the NEXT lead arrives with a readable phone is `capacity`, not the balance: a
   * dollar behind 21 un-sent leads is already one masked lead, and painting that
   * chip in the calm neutral would be a lie.
   *
   * With no gate on the account nothing is reserved, so the balance is the only
   * signal there is — read as the number of leads it can still pay for.
   */
  const gate: any = data?.gate || {};
  const gateActive = !!gate.active;
  const gateBalance = Number(gate.balance ?? balance);
  const gateUnsent = Number(gate.unsent ?? 0);
  const gateCapacity = Number(gate.capacity ?? 0);
  const gateLocked = Number(gate.locked ?? 0);

  /**
   * The monthly pack, when the account is on one. A pack is capacity that is not
   * money, so it has to be read BEFORE the balance is judged: an account with a
   * $0.00 balance and 1 800 leads left on its pack is in perfect health, and
   * painting that chip rose would send the seller to top up something they do not
   * need. Both fields are absent on a payload that predates packs, hence the ??.
   */
  const plan: any = gate.plan || null;
  const planRemaining = Number(gate.planRemaining ?? 0);

  /**
   * The pack's own colour — the admin's "Couleur de la carte" — so the chip in the
   * header matches the card the seller bought from. Inline styles, not Tailwind
   * classes: the hex only exists at runtime (see lib/planAccent.ts), and
   * `accentStyles` re-validates it before it reaches the DOM.
   */
  const planAccent = accentStyles(plan?.planAccentColor);

  /** Cents per lead, straight from the payload — the tariff is never assumed here. */
  const priceCents = Number(gate.priceCents ?? 0);
  const priceSentence =
    priceCents > 0
      ? t('sheet_credits_price_per_lead', 'dashboard', 'Chaque lead envoyé coûte {price}.').replace(
          '{price}',
          formatMoney(priceCents)
        )
      : '';

  // The server already divides for us; the fallback covers a payload that predates
  // `affordable`. With no tariff at all nothing can be divided, so the chip declines
  // to call a balance "low" rather than guessing.
  const affordable = Number(gate.affordable ?? centsToLeads(balance, priceCents) + planRemaining);
  // "Nothing left" means nothing left to send with — neither cents nor quota.
  const isEmpty = affordable <= 0;
  const isLow = !isEmpty && (priceCents > 0 || gate.affordable != null) && affordable <= LOW_BALANCE_LEADS;

  const level = gateActive
    ? gateCapacity < 0
      ? 'danger'
      : gateCapacity === 0
      ? 'warn'
      : 'ok'
    : isEmpty
    ? 'danger'
    : isLow
    ? 'warn'
    : 'ok';

  const rows: any[] = Array.isArray(ledger)
    ? ledger
    : ledger?.transactions || ledger?.items || [];

  const typeLabel = (type: string) => {
    if (type === 'GRANT') return t('sheet_credits_type_grant', 'dashboard', 'Solde ajouté');
    if (type === 'CONSUME') return t('sheet_credits_type_consume', 'dashboard', 'Ligne envoyée');
    if (type === 'ADMIN_DEBIT') return t('sheet_credits_type_admin_debit', 'dashboard', 'Retrait administrateur');
    if (type === 'REFUND') return t('sheet_credits_type_refund', 'dashboard', 'Remboursement');
    return type;
  };

  // Same chrome as the search / fullscreen buttons, only wider to fit the number.
  const tone = level === 'danger'
    ? 'bg-rose-50 border-rose-200 text-rose-600 hover:border-rose-300'
    : level === 'warn'
    ? 'bg-amber-50 border-amber-200 text-amber-600 hover:border-amber-300'
    : `bg-white text-slate-400 ${open ? 'border-primary-200 text-primary-600' : 'border-slate-100 hover:text-primary-600 hover:border-primary-200'}`;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`relative flex items-center gap-1 py-2 px-2 rounded-lg border transition-all shadow-sm hover:shadow-md active:scale-95 ${tone}`}
        title={[
          // The pack first: it is the reason the balance beside it can sit at $0.00
          // without anything being wrong, so it has to be the first thing read.
          plan?.planName
            ? `${plan.planName} · ${t('sheet_plan_leads_left', 'dashboard', 'Leads inclus')}: ${planRemaining.toLocaleString()}`
            : '',
          gateActive
            ? t('sheet_credits_gate_tooltip', 'dashboard', 'Disponibles = solde ÷ tarif − non envoyés.')
            : t('sheet_credits_tooltip', 'dashboard', "Solde d'envoi vers Google Sheets"),
          priceSentence,
        ]
          .filter(Boolean)
          .join(' · ')}
        id="sheet-credits-toggle"
      >
        <Wallet size={16} />
        {/* Cents, always through the formatter — printed raw this reads "15" for $0.15. */}
        <span className="text-[11px] font-black leading-none tabular-nums">{formatMoney(balance)}</span>
        {/* The pack name, when the account is on one. Truncated and capped rather
            than wrapped: the header row is fixed-height, and a long pack name must
            never push the language or notification buttons off the edge. */}
        {/* The pack's own accent, as a pill rather than bare text: the tinted
            surface keeps the name legible when the chip itself turns amber or
            rose behind it, whatever colour the admin picked. */}
        {plan?.planName && (
          <span
            style={planAccent.chip}
            className="hidden sm:inline-block max-w-[90px] truncate px-1.5 py-0.5 rounded-md text-[10px] font-black leading-none uppercase tracking-wide"
          >
            {plan.planName}
          </span>
        )}
      </button>

      {open && (
        <>
          <div data-dropdown-backdrop className="fixed inset-0 z-[99]" onClick={() => setOpen(false)}></div>
          <div className={`absolute ${isRtl ? 'left-0 origin-top-left' : 'right-0 origin-top-right'} mt-3 w-72 sm:w-80 bg-white/95 backdrop-blur-md rounded-2xl shadow-[0_30px_60px_rgba(0,0,0,0.12)] border border-slate-100 z-[100] overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300`}>
            {/* Header: the balance itself, plus whichever warning applies — the
                reservation under the gate, the low / empty balance without it */}
            <div className="px-5 py-4 border-b border-slate-50 bg-slate-50/50 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-black text-slate-900 uppercase tracking-wider">
                  {t('sheet_credits_label', 'dashboard', 'Solde Sheets')}
                </p>
                <p className="text-[10px] font-bold text-slate-400 mt-0.5 leading-relaxed">
                  {/* Under the gate the balance no longer explains itself: it is the
                      reservation, not the balance, that the seller feels. The calm
                      line is the only one that has room for the tariff — the three
                      warnings are already saying something more urgent. */}
                  {gateActive
                    ? gateLocked > 0
                      ? t('sheet_credits_gate_locked', 'dashboard', '{count} lead(s) ont leur numéro masqué en attendant une recharge de votre solde.').replace('{count}', String(gateLocked))
                      : gateCapacity === 0
                      ? t('sheet_credits_gate_full', 'dashboard', 'Tout votre solde est réservé : le prochain lead arrivera masqué.')
                      : [priceSentence, t('sheet_credits_gate_tooltip', 'dashboard', 'Disponibles = solde ÷ tarif − non envoyés.')].filter(Boolean).join(' ')
                    : isEmpty
                    ? t('sheet_credits_empty', 'dashboard', 'Solde épuisé : les envois vers votre feuille sont bloqués.')
                    : isLow
                    ? t('sheet_credits_low', 'dashboard', 'Solde bas : pensez à recharger votre solde.')
                    : [t('sheet_credits_tooltip', 'dashboard', "Solde d'envoi vers Google Sheets"), priceSentence].filter(Boolean).join(' · ')}
                </p>
              </div>
              <div className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl flex-shrink-0 ${
                level === 'danger' ? 'bg-rose-50 text-rose-600' : level === 'warn' ? 'bg-amber-50 text-amber-600' : 'bg-white text-slate-700 border border-slate-100'
              }`}>
                <Wallet size={12} />
                <span className="text-xs font-black leading-none tabular-nums">{formatMoney(balance)}</span>
              </div>
            </div>

            {/* The pack, when there is one. It sits above the three columns because
                it is the source of most of "Disponibles" and none of "Solde" —
                without this line a seller reads a frozen balance as a bug. */}
            {plan && (
              <div className="px-5 py-3 border-b border-slate-50 flex items-center justify-between gap-3 bg-emerald-50/40">
                <div className="min-w-0">
                  <p className="text-[10px] font-black text-emerald-800 truncate">{plan.planName}</p>
                  <p className="text-[9px] font-bold text-emerald-600/70 mt-0.5">
                    {t('sheet_plan_days_left', 'dashboard', '{count} jour(s) restant(s)').replace(
                      '{count}',
                      String(Number(plan.daysLeft ?? 0))
                    )}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-black text-emerald-700 leading-none tabular-nums">
                    {planRemaining.toLocaleString()}
                  </p>
                  <p className="text-[9px] font-black text-emerald-600/70 uppercase tracking-wider mt-1">
                    {t('sheet_plan_leads_left', 'dashboard', 'Leads inclus')}
                  </p>
                </div>
              </div>
            )}

            {/* The same three numbers the leads page shows, laid out as columns
                rather than a sentence — the popover is 288px wide and the inline
                form would wrap into three lines anyway. The first column is money,
                the other two are leads; the labels carry that distinction. */}
            {gateActive && (
              <div className="grid grid-cols-3 gap-2 px-5 py-3 border-b border-slate-50 text-center">
                <div className="min-w-0">
                  <p className="text-sm font-black text-slate-900 leading-none tabular-nums">{formatMoney(gateBalance)}</p>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mt-1 leading-tight">
                    {t('sheet_credits_gate_credits', 'dashboard', 'Solde')}
                  </p>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-black text-slate-900 leading-none tabular-nums">{gateUnsent}</p>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mt-1 leading-tight">
                    {t('sheet_credits_gate_unsent', 'dashboard', 'Non envoyés')}
                  </p>
                </div>
                <div className="min-w-0">
                  <p className={`text-sm font-black leading-none tabular-nums ${
                    level === 'danger' ? 'text-rose-600' : level === 'warn' ? 'text-amber-600' : 'text-slate-900'
                  }`}>
                    {gateCapacity}
                  </p>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mt-1 leading-tight">
                    {t('sheet_credits_gate_capacity', 'dashboard', 'Disponibles')}
                  </p>
                </div>
              </div>
            )}

            {/* Ledger: the last ten movements */}
            <div className="px-5 pt-3 pb-1">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                {t('sheet_credits_history', 'dashboard', 'Dernières opérations')}
              </p>
            </div>
            <div className="max-h-[280px] overflow-y-auto divide-y divide-slate-50">
              {ledgerLoading ? (
                <div className="py-8 text-center">
                  <div className="w-5 h-5 border-2 border-slate-200 border-t-primary-500 rounded-full animate-spin mx-auto" />
                </div>
              ) : rows.length === 0 ? (
                <div className="py-10 px-6 text-center">
                  <p className="text-[10px] font-bold text-slate-400">
                    {t('sheet_credits_none', 'dashboard', 'Aucune opération pour le moment')}
                  </p>
                </div>
              ) : (
                rows.slice(0, 10).map((tx: any) => {
                  const amount = Number(tx?.amount ?? 0);
                  return (
                    <div key={tx?.id} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-slate-50/80 transition-colors">
                      <div className="min-w-0">
                        <p className="text-[11px] font-black text-slate-900 truncate">
                          {typeLabel(tx?.type)}
                        </p>
                        <p className="text-[9px] font-bold text-slate-400 mt-0.5">
                          {tx?.createdAt
                            ? `${new Date(tx.createdAt).toLocaleDateString([], { day: '2-digit', month: '2-digit' })} · ${new Date(tx.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                            : ''}
                        </p>
                      </div>
                      {/* Ledger amounts are signed CENTS: a lead charge is -5, which
                          must read "-$0.05". formatMoney already carries the minus, so
                          only the credit side needs a sign glued on. */}
                      {/* A pack-covered row carries amount 0. Printed through the
                          same branch it reads "$0.00" in charge-rose, which looks
                          like a bug; it gets its own calm label instead. */}
                      <span className={`text-[11px] font-black tabular-nums flex-shrink-0 ${
                        amount > 0 ? 'text-emerald-600' : amount === 0 ? 'text-slate-400' : 'text-rose-500'
                      }`}>
                        {amount > 0
                          ? `+${formatMoney(amount)}`
                          : amount === 0
                            ? t('sheet_credits_covered', 'dashboard', 'Inclus')
                            : formatMoney(amount)}
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer: one destination only. This popover shows the last handful
                of rows, so the single thing a seller wants from it is the full
                statement — the sheet's own settings live on the leads page. */}
            <div className="px-4 py-3 bg-slate-50/50 border-t border-slate-50 text-center">
              <Link
                to={`${basePathFor(user?.role, location.pathname)}/sheet-credits`}
                onClick={() => setOpen(false)}
                className="inline-flex items-center gap-1.5 text-[10px] font-black text-emerald-600 hover:text-emerald-700 transition-colors uppercase tracking-wider"
              >
                <span>{t('sheet_credits_see_all_ops', 'dashboard', 'Voir toutes les opérations')}</span>
                {isRtl ? <ChevronLeft size={10} /> : <ChevronRight size={10} />}
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
