import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { agentFacturationApi, payoutsApi } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import {
  Receipt, Package, Banknote, Wallet, ArrowUpRight, Clock, FileText, Eye, ArrowLeft,
  CheckCircle2, XCircle, Building2, CreditCard, RotateCcw, AlertCircle, TrendingUp, MapPin,
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import toast from 'react-hot-toast';

/**
 * Facturation for the call-center agent.
 *
 * Three steps, top to bottom, in the order the agent works them: the colis
 * livrés that are still unbilled, the factures they were turned into, and the
 * retraits taken out of the balance those factures credited. The wallet figures
 * come from the facturation summary rather than /wallet so every number on the
 * page is read in one round trip and cannot disagree with itself.
 */

const MIN_WITHDRAWAL_MAD = 200;

const fmtMad = (n: unknown) => `${Math.round(Number(n) || 0).toLocaleString('fr-FR')} MAD`;

const fmtDate = (value: unknown, pattern = 'dd MMM yyyy') => {
  if (!value) return '—';
  const d = new Date(value as string);
  return Number.isNaN(d.getTime()) ? '—' : format(d, pattern, { locale: fr });
};

const payoutBadge = (status: string) => {
  const map: Record<string, { label: string; cls: string; icon: React.ComponentType<any> }> = {
    PENDING: { label: 'En attente', cls: 'bg-amber-50 text-amber-700 border-amber-100', icon: Clock },
    COMPLETED: { label: 'Payé', cls: 'bg-emerald-50 text-emerald-700 border-emerald-100', icon: CheckCircle2 },
    RECEIVED: { label: 'Reçu', cls: 'bg-violet-50 text-violet-700 border-violet-100', icon: CheckCircle2 },
    REJECTED: { label: 'Rejeté', cls: 'bg-rose-50 text-rose-700 border-rose-100', icon: XCircle },
  };
  const cfg = map[status] || { label: status, cls: 'bg-gray-100 text-gray-700 border-gray-200', icon: Clock };
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold border ${cfg.cls}`}>
      <Icon size={12} /> {cfg.label}
    </span>
  );
};

export default function AgentFacturation() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Only an approved account can receive a payout, so the modal never offers
  // any other — a pending RIB in the picker just produces a rejected retrait.
  const approvedBanks: any[] = (user?.bankAccounts || []).filter((b: any) => b.status === 'APPROVED');

  const [openInvoiceId, setOpenInvoiceId] = useState<number | null>(null);
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);
  const [selectedBankId, setSelectedBankId] = useState('');
  const [withdrawForm, setWithdrawForm] = useState({ amountMad: '', bankName: '', ribAccount: '', iceNumber: '' });

  const { data: summaryRes, isLoading: loadingSummary } = useQuery({
    queryKey: ['agent-facturation-summary'],
    queryFn: () => agentFacturationApi.summary(),
  });

  const { data: billableRes, isLoading: loadingBillable } = useQuery({
    queryKey: ['agent-facturation-billable'],
    queryFn: () => agentFacturationApi.billable({ limit: 100 }),
    placeholderData: keepPreviousData,
  });

  const { data: invoicesRes, isLoading: loadingInvoices } = useQuery({
    queryKey: ['agent-facturation-invoices'],
    queryFn: () => agentFacturationApi.invoices({ limit: 50 }),
    placeholderData: keepPreviousData,
  });

  const { data: payoutsRes } = useQuery({
    queryKey: ['agent-payouts'],
    queryFn: () => payoutsApi.list({ limit: 20 }),
  });

  const { data: invoiceDetailRes, isLoading: loadingDetail } = useQuery({
    queryKey: ['agent-facturation-invoice', openInvoiceId],
    queryFn: () => agentFacturationApi.invoice(openInvoiceId as number),
    enabled: openInvoiceId !== null,
  });

  const summary = summaryRes?.data?.data;
  const billable = billableRes?.data?.data;
  const invoices = invoicesRes?.data?.data?.invoices || [];
  const payouts = payoutsRes?.data?.data?.payouts || [];
  const detail = invoiceDetailRes?.data?.data;

  const balance = Number(summary?.wallet?.balanceMad) || 0;
  const billableCount = Number(billable?.totals?.count ?? summary?.billable?.count) || 0;
  const billableAmount = Number(billable?.totals?.amountMad ?? summary?.billable?.amountMad) || 0;

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ['agent-facturation-summary'] });
    queryClient.invalidateQueries({ queryKey: ['agent-facturation-billable'] });
    queryClient.invalidateQueries({ queryKey: ['agent-facturation-invoices'] });
    queryClient.invalidateQueries({ queryKey: ['agent-payouts'] });
  };

  const invoiceMutation = useMutation({
    mutationFn: () => agentFacturationApi.generateInvoice(),
    onSuccess: res => {
      toast.success(res?.data?.message || 'Facture générée');
      refreshAll();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Erreur lors de la génération de la facture');
    },
  });

  const withdrawMutation = useMutation({
    mutationFn: (data: any) => payoutsApi.create(data),
    onSuccess: () => {
      toast.success('Demande de retrait envoyée à l\'administration');
      setIsWithdrawOpen(false);
      setWithdrawForm({ amountMad: '', bankName: '', ribAccount: '', iceNumber: '' });
      refreshAll();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Erreur lors de la demande de retrait');
    },
  });

  const openWithdraw = () => {
    const defaultBank = approvedBanks.find((b: any) => b.isDefault);
    if (defaultBank) {
      setSelectedBankId(String(defaultBank.id));
      setWithdrawForm({
        amountMad: '',
        bankName: defaultBank.bankName,
        ribAccount: defaultBank.ribAccount,
        iceNumber: defaultBank.iceNumber || '',
      });
    } else {
      setSelectedBankId('');
      setWithdrawForm({ amountMad: '', bankName: '', ribAccount: '', iceNumber: '' });
    }
    setIsWithdrawOpen(true);
  };

  const handleWithdrawSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(withdrawForm.amountMad);
    if (amount < MIN_WITHDRAWAL_MAD) {
      toast.error(`Le montant minimum de retrait est de ${MIN_WITHDRAWAL_MAD} MAD`);
      return;
    }
    if (amount > balance) {
      toast.error('Solde insuffisant');
      return;
    }
    withdrawMutation.mutate({ ...withdrawForm, amountMad: amount });
  };

  const handleGenerate = () => {
    if (billableCount === 0) return;
    const ok = window.confirm(
      `Générer une facture pour ${billableCount} colis livré(s) ?\n\n` +
        `Montant : ${fmtMad(billableAmount)} — il sera crédité sur votre solde.\n` +
        `Cette action est définitive : ces colis ne pourront plus être refacturés.`
    );
    if (ok) invoiceMutation.mutate();
  };

  // ------------------------------------------------------------------ detail
  if (openInvoiceId !== null) {
    return (
      <div className="space-y-6 pb-24">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setOpenInvoiceId(null)}
            className="p-2 hover:bg-white rounded-xl transition-all border border-transparent hover:border-gray-100"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">
              Facture {detail?.invoiceNumber || ''}
            </h1>
            <p className="text-sm text-gray-500 font-medium">
              {detail ? `Générée le ${fmtDate(detail.createdAt, "dd MMM yyyy 'à' HH:mm")}` : 'Chargement…'}
            </p>
          </div>
        </div>

        {loadingDetail || !detail ? (
          <div className="flex justify-center p-12">
            <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Package className="w-5 h-5 text-indigo-500" /> {detail.items?.length || 0} colis facturé(s)
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="py-3 px-3 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Colis</th>
                      <th className="py-3 px-3 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Client</th>
                      <th className="py-3 px-3 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Produit</th>
                      <th className="py-3 px-3 text-[11px] font-bold text-gray-400 uppercase tracking-wider text-right">Valeur</th>
                      <th className="py-3 px-3 text-[11px] font-bold text-gray-400 uppercase tracking-wider text-right">Gain</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {detail.items?.map((it: any) => (
                      <tr key={it.id} className="hover:bg-gray-50/60 transition-colors">
                        <td className="py-3 px-3">
                          <p className="text-sm font-black text-gray-900 font-mono tracking-tight">
                            {it.packageCode || it.orderNumber || `#${it.leadId}`}
                          </p>
                          <p className="text-[11px] text-gray-400 font-medium mt-0.5">
                            Livré {fmtDate(it.deliveredAt)}
                          </p>
                        </td>
                        <td className="py-3 px-3">
                          <p className="text-sm font-bold text-gray-900">{it.customerName || '—'}</p>
                          {it.customerCity && (
                            <p className="text-[11px] text-gray-500 font-medium flex items-center gap-1 mt-0.5">
                              <MapPin className="w-3 h-3" /> {it.customerCity}
                            </p>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <p className="text-sm text-gray-700 font-semibold line-clamp-2 max-w-[200px]">
                            {it.productName || '—'}
                          </p>
                        </td>
                        <td className="py-3 px-3 text-right text-sm font-semibold text-gray-500">
                          {fmtMad(it.parcelValueMad)}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <span className="text-sm font-black text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100">
                            {fmtMad(it.amountMad)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm h-fit">
              <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Détail du paiement</h2>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500 font-medium">Colis livrés</span>
                  <span className="font-bold text-gray-900">{detail.parcelCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 font-medium">Bénéfice net</span>
                  <span className="font-bold text-gray-900">{fmtMad(detail.feePerParcelMad)} / colis</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 font-medium">Période</span>
                  <span className="font-bold text-gray-900 text-right text-xs">
                    {fmtDate(detail.periodFrom)} → {fmtDate(detail.periodTo)}
                  </span>
                </div>
              </div>
              <div className="pt-4 mt-4 border-t border-gray-100">
                <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Total gagné</h2>
                <p className="text-3xl font-black text-gray-900">
                  {Number(detail.totalAmountMad).toLocaleString('fr-FR')} <span className="text-lg">MAD</span>
                </p>
                <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-bold border border-emerald-100">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Crédité sur le solde
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // -------------------------------------------------------------------- list
  const cards = [
    {
      label: 'Colis livrés',
      value: String(summary?.deliveredTotal ?? 0),
      sub: 'Total de vos colis arrivés au client',
      icon: Package,
      color: 'from-blue-500 to-indigo-500',
      shadow: 'shadow-blue-200',
    },
    {
      label: 'À facturer',
      value: fmtMad(billableAmount),
      sub: `${billableCount} colis livré(s) non facturé(s)`,
      icon: Receipt,
      color: billableCount > 0 ? 'from-amber-400 to-orange-500' : 'from-slate-300 to-slate-400',
      shadow: billableCount > 0 ? 'shadow-amber-200' : 'shadow-slate-200',
    },
    {
      label: 'Argent gagné',
      value: fmtMad(summary?.invoiced?.totalEarnedMad),
      sub: `${summary?.invoiced?.count ?? 0} facture(s) · ${summary?.invoiced?.parcelCount ?? 0} colis`,
      icon: TrendingUp,
      color: 'from-emerald-400 to-teal-500',
      shadow: 'shadow-emerald-200',
    },
    {
      label: 'Solde disponible',
      value: fmtMad(balance),
      sub: `Retrait à partir de ${MIN_WITHDRAWAL_MAD} MAD`,
      icon: Wallet,
      color: 'from-violet-500 to-purple-600',
      shadow: 'shadow-violet-200',
    },
    {
      label: 'Total retiré',
      value: fmtMad(summary?.wallet?.totalWithdrawnMad),
      sub: `${summary?.pendingWithdrawals?.count ?? 0} demande(s) en attente · ${fmtMad(summary?.pendingWithdrawals?.amountMad)}`,
      icon: ArrowUpRight,
      color: 'from-cyan-400 to-blue-500',
      shadow: 'shadow-cyan-200',
    },
  ];

  return (
    <div className="space-y-5 pb-24">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-200 flex items-center justify-center">
              <Receipt className="w-5 h-5 text-white" />
            </div>
            Facturation
          </h1>
          <p className="text-sm text-gray-500 mt-1 sm:ml-13">
            Facturez vos colis livrés, suivez vos gains et demandez un retrait à l'administration.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold border ${
              balance < MIN_WITHDRAWAL_MAD
                ? 'bg-amber-50 text-amber-700 border-amber-200/80'
                : 'bg-emerald-50 text-emerald-700 border-emerald-200/80'
            }`}
            title={`Solde minimum de ${MIN_WITHDRAWAL_MAD} DH requis pour demander un retrait`}
          >
            <AlertCircle size={14} /> Min. retrait : {MIN_WITHDRAWAL_MAD} DH
          </span>

          <button
            onClick={() => {
              refreshAll();
              toast.success('Actualisé');
            }}
            className="p-2.5 bg-white border border-gray-200 text-gray-500 rounded-xl hover:text-indigo-600 hover:border-indigo-100 transition-all shadow-sm"
            title="Actualiser"
          >
            <RotateCcw size={18} />
          </button>

          <button
            onClick={openWithdraw}
            disabled={balance < MIN_WITHDRAWAL_MAD}
            title={balance < MIN_WITHDRAWAL_MAD ? `Solde minimum de ${MIN_WITHDRAWAL_MAD} DH requis` : undefined}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-bold hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg active:scale-[0.98]"
          >
            <Banknote size={18} /> Demander un retrait
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {cards.map(card => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{card.label}</p>
                  <p className="text-xl font-black text-gray-900 mt-1 tracking-tight">
                    {loadingSummary ? '…' : card.value}
                  </p>
                </div>
                <div
                  className={`w-11 h-11 shrink-0 rounded-2xl bg-gradient-to-br ${card.color} shadow-lg ${card.shadow} flex items-center justify-center`}
                >
                  <Icon className="w-5 h-5 text-white" />
                </div>
              </div>
              <p className="text-[11px] text-gray-500 font-medium mt-2 leading-snug">{card.sub}</p>
            </div>
          );
        })}
      </div>

      {/* Colis livrés à facturer */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Package className="w-5 h-5 text-amber-500" /> Colis livrés à facturer
            </h2>
            <p className="text-sm text-gray-500 font-medium mt-0.5">
              {billableCount > 0
                ? `${billableCount} colis · ${fmtMad(billable?.feePerParcelMad)} par colis = ${fmtMad(billableAmount)}`
                : 'Tous vos colis livrés sont déjà facturés.'}
            </p>
          </div>
          <button
            onClick={handleGenerate}
            disabled={billableCount === 0 || invoiceMutation.isPending}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md active:scale-[0.98]"
          >
            <Receipt size={18} />
            {invoiceMutation.isPending ? 'Génération…' : `Générer la facture (${fmtMad(billableAmount)})`}
          </button>
        </div>

        <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-gray-50/90 backdrop-blur z-10">
              <tr className="border-b border-gray-100">
                <th className="py-3 px-6 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Colis</th>
                <th className="py-3 px-6 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Client</th>
                <th className="py-3 px-6 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Produit</th>
                <th className="py-3 px-6 text-[11px] font-bold text-gray-400 uppercase tracking-wider text-right">Valeur colis</th>
                <th className="py-3 px-6 text-[11px] font-bold text-gray-400 uppercase tracking-wider text-right">Votre gain</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loadingBillable ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center">
                    <div className="flex justify-center">
                      <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                    </div>
                  </td>
                </tr>
              ) : (billable?.parcels?.length || 0) === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center">
                    <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                      <CheckCircle2 className="w-8 h-8 text-gray-300" />
                    </div>
                    <p className="text-gray-500 font-medium">Aucun colis livré en attente de facturation</p>
                  </td>
                </tr>
              ) : (
                billable.parcels.map((p: any) => (
                  <tr key={p.leadId} className="hover:bg-gray-50/70 transition-colors">
                    <td className="py-3 px-6">
                      <p className="text-sm font-black text-gray-900 font-mono tracking-tight">
                        {p.packageCode || p.orderNumber || `#${p.leadId}`}
                      </p>
                      <p className="text-[11px] text-gray-400 font-medium mt-0.5">Livré {fmtDate(p.deliveredAt)}</p>
                    </td>
                    <td className="py-3 px-6">
                      <p className="text-sm font-bold text-gray-900">{p.customerName || '—'}</p>
                      {p.customerCity && (
                        <p className="text-[11px] text-gray-500 font-medium flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3" /> {p.customerCity}
                        </p>
                      )}
                    </td>
                    <td className="py-3 px-6">
                      <p className="text-sm text-gray-700 font-semibold line-clamp-2 max-w-[220px]">
                        {p.productName || '—'}
                      </p>
                    </td>
                    <td className="py-3 px-6 text-right text-sm font-semibold text-gray-500">
                      {fmtMad(p.parcelValueMad)}
                    </td>
                    <td className="py-3 px-6 text-right">
                      <span className="text-sm font-black text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100">
                        {fmtMad(p.earnedMad)}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* Factures */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b border-gray-50 flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-500" /> Mes factures
            </h2>
            <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg">
              {fmtMad(summary?.invoiced?.totalEarnedMad)} au total
            </span>
          </div>
          <div className="overflow-x-auto flex-1 max-h-[460px] overflow-y-auto">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-gray-50/90 backdrop-blur z-10">
                <tr className="border-b border-gray-100">
                  <th className="py-3 px-5 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Facture</th>
                  <th className="py-3 px-5 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Colis</th>
                  <th className="py-3 px-5 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Montant</th>
                  <th className="py-3 px-5 text-[11px] font-bold text-gray-400 uppercase tracking-wider text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loadingInvoices ? (
                  <tr>
                    <td colSpan={4} className="py-10 text-center">
                      <div className="flex justify-center">
                        <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                      </div>
                    </td>
                  </tr>
                ) : invoices.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-12 text-center">
                      <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <FileText className="w-8 h-8 text-gray-300" />
                      </div>
                      <p className="text-gray-500 font-medium">Aucune facture pour le moment</p>
                    </td>
                  </tr>
                ) : (
                  invoices.map((inv: any) => (
                    <tr key={inv.id} className="hover:bg-gray-50/70 transition-colors group">
                      <td className="py-3 px-5">
                        <p className="text-sm font-bold text-gray-900 font-mono">{inv.invoiceNumber}</p>
                        <p className="text-[11px] text-gray-400 font-medium mt-0.5">{fmtDate(inv.createdAt)}</p>
                      </td>
                      <td className="py-3 px-5">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 text-gray-600 rounded-lg text-xs font-bold">
                          <Package size={13} /> {inv.parcelCount}
                        </span>
                      </td>
                      <td className="py-3 px-5">
                        <span className="text-sm font-black text-gray-900">{fmtMad(inv.totalAmountMad)}</span>
                      </td>
                      <td className="py-3 px-5 text-right">
                        <button
                          onClick={() => setOpenInvoiceId(inv.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 text-gray-700 rounded-lg text-xs font-bold hover:bg-gray-50 hover:border-gray-300 transition-all"
                        >
                          <Eye size={14} /> Voir
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Retraits */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b border-gray-50 flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Banknote className="w-5 h-5 text-emerald-500" /> Mes retraits
            </h2>
            <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2.5 py-1 rounded-lg">
              {fmtMad(summary?.wallet?.totalWithdrawnMad)} retirés
            </span>
          </div>
          <div className="p-4 flex-1 overflow-y-auto max-h-[460px]">
            {payouts.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Banknote className="w-8 h-8 text-gray-300" />
                </div>
                <p className="text-gray-500 font-medium">Aucune demande de retrait</p>
              </div>
            ) : (
              <div className="space-y-3">
                {payouts.map((payout: any) => (
                  <div key={payout.id} className="p-4 rounded-2xl bg-gray-50 border border-transparent hover:border-gray-100 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
                          <Building2 size={18} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-gray-900 truncate">{payout.bankName}</p>
                          <p className="text-[11px] text-gray-500 font-medium mt-0.5">
                            RIB : {'•'.repeat(12)}
                            {String(payout.ribAccount || '').slice(-4)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-black text-gray-900">{fmtMad(payout.amountMad)}</p>
                        <div className="mt-1">{payoutBadge(payout.status)}</div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-3 mt-3 border-t border-gray-100">
                      <p className="text-[11px] text-gray-400 font-medium">Demandé le {fmtDate(payout.createdAt)}</p>
                      {payout.processedAt && (
                        <p className="text-[11px] text-gray-400 font-medium">Traité le {fmtDate(payout.processedAt)}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Withdraw modal */}
      {isWithdrawOpen &&
        createPortal(
          <div
            className="fixed inset-0 bg-slate-900/65 backdrop-blur-md z-[999999] flex items-center justify-center p-4 cursor-pointer"
            onClick={() => setIsWithdrawOpen(false)}
          >
            <div
              className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden cursor-default"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-6 border-b border-gray-50 flex justify-between items-start">
                <div>
                  <h3 className="text-xl font-black text-gray-900 tracking-tight">Demander un retrait</h3>
                  <p className="text-sm text-gray-500 font-medium mt-1">Solde disponible : {fmtMad(balance)}</p>
                </div>
                <button
                  onClick={() => setIsWithdrawOpen(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-xl transition-colors"
                >
                  <XCircle size={24} />
                </button>
              </div>

              <form onSubmit={handleWithdrawSubmit} className="p-6 space-y-4">
                {approvedBanks.length > 0 && (
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                      Compte bancaire
                    </label>
                    <select
                      value={selectedBankId}
                      onChange={e => {
                        const val = e.target.value;
                        setSelectedBankId(val);
                        const bank = approvedBanks.find((b: any) => b.id === Number(val));
                        setWithdrawForm({
                          ...withdrawForm,
                          bankName: bank?.bankName || '',
                          ribAccount: bank?.ribAccount || '',
                          iceNumber: bank?.iceNumber || '',
                        });
                      }}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
                    >
                      <option value="">Nouveau compte bancaire</option>
                      {approvedBanks.map((b: any) => (
                        <option key={b.id} value={b.id}>
                          {b.bankName} - {String(b.ribAccount).slice(0, 8)}…{String(b.ribAccount).slice(-4)}
                          {b.isDefault ? ' (par défaut)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                    Montant (MAD)
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Banknote size={16} className="text-gray-400" />
                    </div>
                    <input
                      type="number"
                      required
                      min={MIN_WITHDRAWAL_MAD}
                      max={balance}
                      value={withdrawForm.amountMad}
                      onChange={e => setWithdrawForm({ ...withdrawForm, amountMad: e.target.value })}
                      className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
                      placeholder={`Min. ${MIN_WITHDRAWAL_MAD} MAD`}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setWithdrawForm({ ...withdrawForm, amountMad: String(Math.floor(balance)) })}
                    className="mt-2 text-[11px] font-black uppercase tracking-wider text-indigo-600 hover:text-indigo-700"
                  >
                    Tout retirer ({fmtMad(balance)})
                  </button>
                </div>

                {!selectedBankId && (
                  <>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                        Nom de la banque
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <Building2 size={16} className="text-gray-400" />
                        </div>
                        <input
                          type="text"
                          required
                          value={withdrawForm.bankName}
                          onChange={e => setWithdrawForm({ ...withdrawForm, bankName: e.target.value })}
                          className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
                          placeholder="ex: CIH, Attijariwafa"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                        RIB (24 chiffres)
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <CreditCard size={16} className="text-gray-400" />
                        </div>
                        <input
                          type="text"
                          required
                          pattern="[0-9]{24}"
                          value={withdrawForm.ribAccount}
                          onChange={e => setWithdrawForm({ ...withdrawForm, ribAccount: e.target.value })}
                          className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
                          placeholder="000000000000000000000000"
                        />
                      </div>
                    </div>
                  </>
                )}

                <div className="pt-2 border-t border-gray-50">
                  <p className="text-[11px] text-gray-400 font-medium mb-3">
                    Le montant est déduit de votre solde immédiatement et versé après validation par
                    l'administration.
                  </p>
                  <button
                    type="submit"
                    disabled={withdrawMutation.isPending}
                    className="w-full py-3 bg-gray-900 text-white rounded-xl text-sm font-bold hover:bg-gray-800 disabled:opacity-50 transition-all shadow-md"
                  >
                    {withdrawMutation.isPending ? 'Envoi…' : 'Confirmer la demande'}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
