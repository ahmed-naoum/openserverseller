import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { invoiceApi } from '../../lib/api';
import { FileText, ChevronRight, ArrowLeft, Download, Eye, Calendar, Package, User, Phone, MapPin, Tag, TrendingUp, TrendingDown, Wallet, RotateCcw } from 'lucide-react';
import { format } from 'date-fns';
import { fr, ar, enUS } from 'date-fns/locale';
import { generateInvoicePDF } from '../../utils/pdfGenerator';
import { useLanguage } from '../../contexts/LanguageContext';

export default function UserInvoices() {
  const { t, language } = useLanguage();
  const [page, setPage] = useState(1);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);

  const getLocale = () => {
    if (language === 'ar') return ar;
    if (language === 'en') return enUS;
    return fr;
  };

  const { data: statsData } = useQuery({
    queryKey: ['user-invoices-stats'],
    queryFn: () => invoiceApi.stats(),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['user-invoices', page],
    queryFn: () => invoiceApi.list({ page, limit: 20 }),
  });

  const stats = statsData?.data?.data;

  const { data: invoiceDetails, isLoading: isLoadingDetails } = useQuery({
    queryKey: ['user-invoice-details', selectedInvoice?.id],
    queryFn: () => invoiceApi.get(selectedInvoice.id),
    enabled: !!selectedInvoice,
  });

  const invoices = data?.data?.data?.invoices || [];
  const pagination = data?.data?.data?.pagination;
  const details = invoiceDetails?.data?.data;

  if (selectedInvoice && details) {
    let subTotalBrut = 0;
    let totalShipping = 0;
    let totalPlatformFee = 0;

    if (details.leads) {
      details.leads.forEach((lead: any) => {
        const gross = Number(lead.order?.totalAmountMad) || 0;
        const shipping = lead.customShippingFee ?? 57;
        const rate = lead.customPlatformFeeRate ?? details.user?.platformFeeRate ?? 0.05;
        const profit = gross - shipping;
        const fee = profit > 0 ? profit * rate : 0;

        subTotalBrut += gross;
        totalShipping += shipping;
        totalPlatformFee += fee;
      });
    }

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setSelectedInvoice(null)}
              className="p-2 hover:bg-white rounded-xl transition-all border border-transparent hover:border-gray-100"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div>
              <h1 className="text-2xl font-black text-gray-900 tracking-tight">{t('invoice_title', 'invoices').replace('{number}', details.invoiceNumber)}</h1>
              <p className="text-sm text-gray-500 font-medium">{t('generated_on', 'invoices').replace('{date}', format(new Date(details.createdAt), 'dd MMM yyyy HH:mm', { locale: getLocale() }))}</p>
            </div>
          </div>
          <button 
            onClick={() => generateInvoicePDF(details)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-xl text-sm font-bold hover:bg-gray-800 transition-all shadow-md"
          >
            <Download size={16} /> {t('download_pdf', 'invoices')}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Package className="w-5 h-5 text-violet-500" /> {t('billed_parcels', 'invoices').replace('{count}', (details.leads?.length || 0).toString())}
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="py-3 px-4 text-xs font-bold text-gray-400 uppercase tracking-wider">{t('th_parcel', 'invoices')}</th>
                      <th className="py-3 px-4 text-xs font-bold text-gray-400 uppercase tracking-wider">{t('th_customer', 'invoices')}</th>
                      <th className="py-3 px-4 text-xs font-bold text-gray-400 uppercase tracking-wider">{t('th_destination', 'invoices')}</th>
                      <th className="py-3 px-4 text-xs font-bold text-gray-400 uppercase tracking-wider">{t('th_product', 'invoices')}</th>
                      <th className="py-3 px-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">{t('th_amount', 'invoices')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {details.leads?.map((lead: any) => {
                       const amount = lead.order?.totalAmountMad || 0;
                       
                       return (
                      <tr key={lead.id} className="hover:bg-gray-50/50 transition-colors group">
                        <td className="py-4 px-4 align-top">
                          <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center shrink-0 border border-violet-100 group-hover:scale-110 transition-transform">
                              <Package className="w-5 h-5" />
                            </div>
                            <div className="flex flex-col">
                              <p className="text-sm font-black text-gray-900 font-mono tracking-tight">{lead.order?.coliatyPackageCode || lead.order?.orderNumber || 'N/A'}</p>
                              <div className="flex items-center gap-1.5 mt-1">
                                <Calendar className="w-3.5 h-3.5 text-gray-400" />
                                <span className="text-xs font-medium text-gray-500">{format(new Date(lead.createdAt), 'dd MMM yyyy', { locale: getLocale() })}</span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4 align-top">
                          <div className="flex flex-col gap-1.5">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
                                <User className="w-4 h-4 text-blue-600" />
                              </div>
                              <div className="flex flex-col">
                                <p className="text-sm font-bold text-gray-900 leading-none">{lead.order?.customerName || lead.fullName}</p>
                                <div className="flex items-center gap-1 mt-1 text-gray-500">
                                  <Phone className="w-3 h-3" />
                                  <p className="text-[11px] font-medium">{lead.order?.customerPhone || lead.phone}</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4 align-top">
                          {(lead.order?.customerCity || lead.order?.customerAddress || lead.city || lead.address) ? (
                            <div className="flex items-start gap-1.5">
                              <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
                              <div className="flex flex-col gap-0.5 min-w-0">
                                {(lead.order?.customerCity || lead.city) && (
                                  <p className="text-[11px] font-bold text-gray-700 uppercase tracking-wider">
                                    {lead.order?.customerCity || lead.city}
                                  </p>
                                )}
                                {(lead.order?.customerAddress || lead.address) && (
                                  <p className="text-[11px] text-gray-500 truncate max-w-[150px]" title={lead.order?.customerAddress || lead.address}>
                                    {lead.order?.customerAddress || lead.address}
                                  </p>
                                )}
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">-</span>
                          )}
                        </td>
                        <td className="py-4 px-4 align-top">
                          <div className="flex items-start gap-2">
                            <div className="w-8 h-8 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center border border-orange-100 shrink-0">
                              <Tag className="w-4 h-4" />
                            </div>
                            <p className="text-sm font-bold text-gray-900 line-clamp-2 max-w-[180px] mt-1.5">
                              {lead.order?.items?.[0]?.product?.nameFr || lead.referralLink?.product?.nameFr || 'Produit'}
                            </p>
                          </div>
                        </td>
                        <td className="py-4 px-4 align-top text-right">
                          <div className="inline-flex flex-col items-end">
                            <span className="text-sm font-black text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-100 shadow-sm">
                              {amount.toLocaleString()} MAD
                            </span>
                          </div>
                        </td>
                      </tr>
                    )})}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-green-50 rounded-bl-full -z-10 opacity-50"></div>
              
              <div className="pt-2">
                <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">{t('payment_details', 'invoices')}</h2>
                
                <div className="space-y-3 mb-6">
                  {!details.invoiceNumber?.startsWith('RET-') && (
                    <>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-500 font-medium">{t('subtotal_gross', 'invoices')}</span>
                        <span className="font-bold text-gray-900">
                          {subTotalBrut.toLocaleString()} MAD
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-500 font-medium">{t('shipping_fees', 'invoices').replace('{count}', (details.leads?.length || 0).toString())}</span>
                        <span className="font-bold text-red-500">
                          -{totalShipping.toLocaleString()} MAD
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-500 font-medium">
                          {t('platform_fees', 'invoices')} {subTotalBrut - totalShipping > 0 ? `(${((totalPlatformFee / (subTotalBrut - totalShipping)) * 100).toFixed(1)}%)` : ''}
                        </span>
                        <span className="font-bold text-red-500">
                          -{totalPlatformFee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MAD
                        </span>
                      </div>
                    </>
                  )}
                </div>

                <div className="pt-4 border-t border-gray-100">
                  <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">{t('total_net_billed', 'invoices')}</h2>
                  <p className="text-3xl font-black text-gray-900">{details.totalAmountMad.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-lg">MAD</span></p>
                  <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 bg-green-50 text-green-700 rounded-lg text-xs font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span> {t('status_paid', 'invoices')}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">{t('title', 'invoices')}</h1>
          <p className="text-sm text-gray-500 font-medium">{t('subtitle', 'invoices')}</p>
        </div>
      </div>

      {/* Stats Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
        {[  
          { label: t('stat_gross_earnings', 'invoices'), value: stats?.totalEarnings || 0, icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50', isPrice: true },
          { label: t('stat_returns', 'invoices'), value: (stats?.totalDeductions || 0) - (stats?.manualFees || 0), icon: RotateCcw, color: 'text-amber-600', bg: 'bg-amber-50', isPrice: true },
          { label: t('stat_fees_debits', 'invoices'), value: stats?.manualFees || 0, icon: TrendingDown, color: 'text-rose-600', bg: 'bg-rose-50', isPrice: true },
          { label: t('stat_net_balance', 'invoices'), value: stats?.netBalance || 0, icon: Wallet, color: 'text-violet-600', bg: 'bg-violet-50', isPrice: true },
          { label: t('stat_total_parcels', 'invoices'), value: stats?.totalColis || 0, icon: Package, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: t('stat_invoices_qty', 'invoices'), value: stats?.totalFactures || 0, icon: FileText, color: 'text-slate-600', bg: 'bg-slate-50' },
        ].map((stat, i) => (
          <div key={i} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex items-center gap-4">
            <div className={`w-12 h-12 ${stat.bg} rounded-xl flex items-center justify-center`}>
              <stat.icon className={`w-6 h-6 ${stat.color}`} />
            </div>
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{stat.label}</p>
              <p className={`text-lg font-black text-gray-900`}>
                {stat.isPrice ? `${stat.value.toLocaleString(undefined, { minimumFractionDigits: 2 })} MAD` : stat.value}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider">{t('th_invoice', 'invoices')}</th>
                <th className="py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider">{t('th_date', 'invoices')}</th>
                <th className="py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider">{t('th_colis', 'invoices')}</th>
                <th className="py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider">{t('th_amount', 'invoices')}</th>
                <th className="py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">{t('th_action', 'invoices')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-sm text-gray-500">
                    <div className="flex justify-center"><div className="w-6 h-6 border-2 border-violet-600 border-t-transparent rounded-full animate-spin"></div></div>
                  </td>
                </tr>
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center">
                    <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                      <FileText className="w-8 h-8 text-gray-300" />
                    </div>
                    <p className="text-gray-500 font-medium">{t('no_invoices', 'invoices')}</p>
                  </td>
                </tr>
              ) : (
                invoices.map((invoice: any) => (
                  <tr key={invoice.id} className="hover:bg-gray-50/80 transition-colors group">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center border border-violet-100 group-hover:scale-110 transition-transform">
                          <FileText size={18} />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-900">{invoice.invoiceNumber}</p>
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-50 text-green-600 border border-green-100 mt-1">
                            {t('status_paid', 'invoices')}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2 text-gray-600">
                        <Calendar size={14} />
                        <span className="text-sm font-medium">{format(new Date(invoice.createdAt), 'dd MMM yyyy', { locale: getLocale() })}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 text-gray-600 rounded-lg text-xs font-bold">
                        <Package size={14} /> {invoice.leadsCount}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-sm font-black text-gray-900">{invoice.totalAmountMad.toLocaleString()} MAD</span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <button 
                        onClick={() => setSelectedInvoice(invoice)}
                        className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 text-gray-700 rounded-lg text-xs font-bold hover:bg-gray-50 hover:border-gray-300 transition-all"
                      >
                        <Eye size={14} /> {t('btn_view', 'invoices')}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
