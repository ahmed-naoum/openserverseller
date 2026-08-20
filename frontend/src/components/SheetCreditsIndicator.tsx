import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { sheetCreditsApi } from '../lib/api';
import { basePathFor } from '../lib/dashboardBase';
import { DollarSign, ChevronRight, ChevronLeft } from 'lucide-react';

/**
 * Only the vendor trees can own sheet credits — the vendor's own dashboard and
 * a sub-account's. Every other role (admin, agent, influenceur, confirmation,
 * helper, grossiste) never even fires the request.
 */
const CREDIT_ROLES = ['VENDOR', 'VENDOR_HELPER'];

/** Below this the chip turns amber; at zero it turns rose. */
const LOW_BALANCE_THRESHOLD = 20;

/**
 * The dashboard routers do not agree on an envelope — `{ status: 'success', data }`
 * on some, `{ success: true, data }` on others — so unwrap both without asserting
 * a shape (strictNullChecks is off here, narrowing on a flag would not hold).
 */
const unwrap = (res: any) => res?.data?.data ?? res?.data ?? null;

/**
 * The "$" chip in the dashboard header: the seller's Google Sheets push credit
 * balance, one credit per row written into their sheet. Clicking it opens the
 * last ten ledger rows.
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
  const isEmpty = balance <= 0;
  const isLow = !isEmpty && balance <= LOW_BALANCE_THRESHOLD;

  /**
   * The reservation behind the balance. Each lead captured under the gate holds a
   * credit until its row reaches the sheet, so the number that decides whether the
   * NEXT lead arrives with a readable phone is `capacity`, not the balance: 20
   * credits behind 21 un-sent leads is already one masked lead, and painting that
   * chip in the calm neutral would be a lie.
   *
   * With no gate on the account nothing is reserved, so the balance is the only
   * signal there is and the old thresholds still apply.
   */
  const gate: any = data?.gate || {};
  const gateActive = !!gate.active;
  const gateBalance = Number(gate.balance ?? balance);
  const gateUnsent = Number(gate.unsent ?? 0);
  const gateCapacity = Number(gate.capacity ?? 0);
  const gateLocked = Number(gate.locked ?? 0);

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
    if (type === 'GRANT') return t('sheet_credits_type_grant', 'dashboard', 'Crédits ajoutés');
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
        title={
          gateActive
            ? t('sheet_credits_gate_tooltip', 'dashboard', "Chaque lead reçu réserve un crédit jusqu'à son envoi. Disponibles = crédits − non envoyés.")
            : t('sheet_credits_tooltip', 'dashboard', "Crédits d'envoi vers Google Sheets · 1 crédit par ligne écrite")
        }
        id="sheet-credits-toggle"
      >
        <DollarSign size={16} />
        <span className="text-[11px] font-black leading-none tabular-nums">{balance}</span>
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
                  {t('sheet_credits_label', 'dashboard', 'Crédits Sheets')}
                </p>
                <p className="text-[10px] font-bold text-slate-400 mt-0.5 leading-relaxed">
                  {/* Under the gate the balance no longer explains itself: it is the
                      reservation, not the balance, that the seller feels. */}
                  {gateActive
                    ? gateLocked > 0
                      ? t('sheet_credits_gate_locked', 'dashboard', "{count} lead(s) ont leur numéro masqué en attendant l'ajout de crédits.").replace('{count}', String(gateLocked))
                      : gateCapacity === 0
                      ? t('sheet_credits_gate_full', 'dashboard', 'Tous vos crédits sont réservés : le prochain lead arrivera masqué.')
                      : t('sheet_credits_gate_tooltip', 'dashboard', "Chaque lead reçu réserve un crédit jusqu'à son envoi. Disponibles = crédits − non envoyés.")
                    : isEmpty
                    ? t('sheet_credits_empty', 'dashboard', 'Solde épuisé : les envois vers votre feuille sont bloqués.')
                    : isLow
                    ? t('sheet_credits_low', 'dashboard', 'Solde bas : pensez à recharger vos crédits.')
                    : t('sheet_credits_tooltip', 'dashboard', "Crédits d'envoi vers Google Sheets · 1 crédit par ligne écrite")}
                </p>
              </div>
              <div className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl flex-shrink-0 ${
                level === 'danger' ? 'bg-rose-50 text-rose-600' : level === 'warn' ? 'bg-amber-50 text-amber-600' : 'bg-white text-slate-700 border border-slate-100'
              }`}>
                <DollarSign size={12} />
                <span className="text-xs font-black leading-none tabular-nums">{balance}</span>
              </div>
            </div>

            {/* The same three numbers the leads page shows, laid out as columns
                rather than a sentence — the popover is 288px wide and the inline
                form would wrap into three lines anyway. */}
            {gateActive && (
              <div className="grid grid-cols-3 gap-2 px-5 py-3 border-b border-slate-50 text-center">
                <div className="min-w-0">
                  <p className="text-sm font-black text-slate-900 leading-none tabular-nums">{gateBalance}</p>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mt-1 leading-tight">
                    {t('sheet_credits_gate_credits', 'dashboard', 'Crédits')}
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
                      <span className={`text-[11px] font-black tabular-nums flex-shrink-0 ${
                        amount > 0 ? 'text-emerald-600' : 'text-rose-500'
                      }`}>
                        {amount > 0 ? `+${amount}` : amount}
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
