import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useLocation } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  FileSpreadsheet,
  Gift,
  MinusCircle,
  RotateCcw,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { sheetCreditsApi } from '../../lib/api';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { basePathFor } from '../../lib/dashboardBase';

/**
 * The full Google Sheets credit ledger.
 *
 * The header chip only ever shows the last handful of rows; this is where the
 * seller reconciles a balance they disagree with. Every row carries the balance
 * as it stood immediately after that operation, so the column reads as a running
 * statement rather than a list of deltas the seller has to add up themselves.
 */

const PAGE_SIZE = 20;

/** How each ledger type reads to the seller. */
const TYPE_META: Record<string, { tone: string; icon: any; sign: string }> = {
  GRANT: { tone: 'bg-emerald-50 text-emerald-600 border-emerald-100', icon: Gift, sign: '+' },
  CONSUME: { tone: 'bg-slate-50 text-slate-500 border-slate-100', icon: FileSpreadsheet, sign: '' },
  ADMIN_DEBIT: { tone: 'bg-rose-50 text-rose-600 border-rose-100', icon: MinusCircle, sign: '' },
  REFUND: { tone: 'bg-blue-50 text-blue-600 border-blue-100', icon: RotateCcw, sign: '+' },
};

/** The routers disagree on the envelope; unwrap both without asserting a shape. */
const unwrap = (res: any) => res?.data?.data ?? res?.data ?? null;

export default function SheetCreditsHistory() {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const location = useLocation();
  const isRtl = language === 'ar';
  const [page, setPage] = useState(1);

  const { data: account } = useQuery({
    queryKey: ['sheet-credits'],
    queryFn: async () => unwrap(await sheetCreditsApi.me()),
    staleTime: 15000,
    retry: false,
  });

  const { data: ledgerRes, isLoading, isFetching } = useQuery({
    queryKey: ['sheet-credits', 'transactions', page],
    // Not unwrap(): `pagination` is a sibling of `data` in the envelope.
    queryFn: async () => (await sheetCreditsApi.transactions({ page, limit: PAGE_SIZE }))?.data,
    // Keeps the current page on screen while the next loads.
    placeholderData: (previous: any) => previous,
    staleTime: 15000,
    retry: false,
  });

  const rows: any[] = Array.isArray(ledgerRes?.data) ? ledgerRes.data : [];
  const pagination = ledgerRes?.pagination;
  const totalPages = Math.max(1, Number(pagination?.totalPages) || 1);
  const total = Number(pagination?.total) || rows.length;

  const base = basePathFor(user?.role, location.pathname);

  const fmt = (iso: string) => {
    if (!iso) return '-';
    const d = new Date(iso);
    return `${d.toLocaleDateString([], { day: '2-digit', month: '2-digit', year: 'numeric' })} · ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="min-w-0">
          <Link
            to={`${base}/leads?mode=SELLER`}
            className="inline-flex items-center gap-1.5 text-[10px] font-black text-gray-400 hover:text-emerald-600 uppercase tracking-widest transition-colors mb-2"
          >
            {isRtl ? <ArrowRight className="w-3 h-3" /> : <ArrowLeft className="w-3 h-3" />}
            {t('sc_back_to_leads', 'dashboard', 'Retour aux leads')}
          </Link>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">
            {t('sc_history_title', 'dashboard', 'Crédits Google Sheets')}
          </h1>
          <p className="text-xs font-medium text-gray-500 mt-1">
            {t('sc_history_subtitle', 'dashboard', 'Historique complet des opérations · 1 crédit par ligne écrite')}
          </p>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5">
            <DollarSign size={72} className="text-emerald-600" />
          </div>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
            {t('sc_balance', 'dashboard', 'Solde actuel')}
          </p>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-lg font-black text-emerald-600">$</span>
            <span className="text-3xl font-black text-gray-900 tabular-nums">{account?.balance ?? 0}</span>
            <span className="text-[10px] font-black text-gray-400 uppercase">
              {t('sc_credits_unit', 'dashboard', 'crédits')}
            </span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5">
            <TrendingUp size={72} className="text-emerald-600" />
          </div>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
            {t('sc_total_granted', 'dashboard', 'Total accordé')}
          </p>
          <div className="mt-2 text-3xl font-black text-gray-900 tabular-nums">{account?.totalGranted ?? 0}</div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5">
            <TrendingDown size={72} className="text-slate-500" />
          </div>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
            {t('sc_total_consumed', 'dashboard', 'Total consommé')}
          </p>
          <div className="mt-2 text-3xl font-black text-gray-900 tabular-nums">{account?.totalConsumed ?? 0}</div>
        </div>
      </div>

      {/* Ledger */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between gap-3">
          <h2 className="text-xs font-black text-gray-900 uppercase tracking-widest">
            {t('sc_operations', 'dashboard', 'Opérations')}
          </h2>
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest tabular-nums">
            {t('sc_total_ops', 'dashboard', '{total} opération(s)').replace('{total}', String(total))}
          </span>
        </div>

        {isLoading ? (
          <div className="py-16 text-center">
            <div className="w-6 h-6 border-2 border-slate-200 border-t-emerald-500 rounded-full animate-spin mx-auto" />
          </div>
        ) : rows.length === 0 ? (
          <div className="py-16 text-center">
            <FileSpreadsheet className="w-8 h-8 text-gray-200 mx-auto mb-3" />
            <p className="text-[11px] font-bold text-gray-400">
              {t('sc_empty', 'dashboard', 'Aucune opération pour le moment')}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50/50">
                <tr>
                  <th className="px-5 py-2.5 text-left text-[9px] font-black text-gray-400 uppercase tracking-widest">
                    {t('sc_col_date', 'dashboard', 'Date')}
                  </th>
                  <th className="px-5 py-2.5 text-left text-[9px] font-black text-gray-400 uppercase tracking-widest">
                    {t('sc_col_type', 'dashboard', 'Type')}
                  </th>
                  <th className="px-5 py-2.5 text-left text-[9px] font-black text-gray-400 uppercase tracking-widest">
                    {t('sc_col_detail', 'dashboard', 'Détail')}
                  </th>
                  <th className="px-5 py-2.5 text-right text-[9px] font-black text-gray-400 uppercase tracking-widest">
                    {t('sc_col_amount', 'dashboard', 'Montant')}
                  </th>
                  <th className="px-5 py-2.5 text-right text-[9px] font-black text-gray-400 uppercase tracking-widest">
                    {t('sc_col_balance', 'dashboard', 'Solde après')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rows.map((tx: any) => {
                  const meta = TYPE_META[tx?.type] || TYPE_META.CONSUME;
                  const Icon = meta.icon;
                  const amount = Number(tx?.amount) || 0;
                  return (
                    <tr key={tx?.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-5 py-3 text-[10px] font-bold text-gray-400 whitespace-nowrap">{fmt(tx?.createdAt)}</td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[10px] font-black ${meta.tone}`}>
                          <Icon className="w-3 h-3" />
                          {t(`sheet_credits_type_${String(tx?.type || '').toLowerCase()}`, 'dashboard', tx?.type || '-')}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-[11px] font-bold text-gray-600">{tx?.description || '-'}</span>
                        {/* The lead the credit was spent on — the same id shown in
                            the leads table and written into the sheet. */}
                        {tx?.leadId ? (
                          <span className="ml-2 px-1.5 py-0.5 rounded-md bg-slate-50 border border-slate-100 text-[9px] font-black text-slate-400 tabular-nums">
                            #{tx.leadId}
                          </span>
                        ) : null}
                      </td>
                      <td
                        className={`px-5 py-3 text-right text-[11px] font-black tabular-nums ${
                          amount > 0 ? 'text-emerald-600' : 'text-rose-500'
                        }`}
                      >
                        {amount > 0 ? `+${amount}` : String(amount)}
                      </td>
                      <td className="px-5 py-3 text-right text-[11px] font-black text-gray-700 tabular-nums">
                        {tx?.balanceAfter ?? '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!isLoading && totalPages > 1 && (
          <div className="flex items-center justify-between gap-3 px-5 py-3 bg-gray-50/50 border-t border-gray-100">
            <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest tabular-nums">
              {t('sc_page', 'dashboard', 'Page {page} / {pages}')
                .replace('{page}', String(page))
                .replace('{pages}', String(totalPages))}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || isFetching}
                className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-white hover:text-emerald-600 hover:border-emerald-200 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                {/* Chevron follows reading direction, not button order. */}
                {isRtl ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || isFetching}
                className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-white hover:text-emerald-600 hover:border-emerald-200 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                {isRtl ? <ChevronLeft className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
