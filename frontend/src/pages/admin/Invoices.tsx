import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../../lib/api';
import { FileText, Search, ChevronRight, ArrowLeft, Download, Eye, Calendar, Package, User, Phone, MapPin, Tag } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { generateInvoicePDF } from '../../utils/pdfGenerator';

export default function AdminInvoices() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-invoices', page, search],
    queryFn: () => adminApi.getInvoices({ page, limit: 20, search }),
  });

  const { data: invoiceDetails, isLoading: isLoadingDetails } = useQuery({
    queryKey: ['admin-invoice-details', selectedInvoice?.id],
    queryFn: () => adminApi.getInvoice(selectedInvoice.id),
    enabled: !!selectedInvoice,
  });

  const invoices = data?.data?.data?.invoices || [];
  const pagination = data?.data?.data?.pagination;
  const details = invoiceDetails?.data?.data;

  if (selectedInvoice && details) {
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
              <h1 className="text-2xl font-black text-gray-900 tracking-tight">Facture {details.invoiceNumber}</h1>
              <p className="text-sm text-gray-500 font-medium">Générée le {format(new Date(details.createdAt), 'dd MMM yyyy HH:mm', { locale: fr })}</p>
            </div>
          </div>
          <button 
            onClick={() => generateInvoicePDF(details)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-xl text-sm font-bold hover:bg-gray-800 transition-all shadow-md"
          >
            <Download size={16} /> Télécharger PDF
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Package className="w-5 h-5 text-violet-500" /> Colis Facturés ({details.leads?.length || 0})
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="py-3 px-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Colis</th>
                      <th className="py-3 px-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Client</th>
                      <th className="py-3 px-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Destination</th>
                      <th className="py-3 px-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Produit</th>
                      <th className="py-3 px-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Montant</th>
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
                                <span className="text-xs font-medium text-gray-500">{format(new Date(lead.createdAt), 'dd MMM yyyy', { locale: fr })}</span>
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
            <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-violet-50 rounded-bl-full -z-10 opacity-50"></div>
              <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Utilisateur</h2>
              <p className="text-xl font-black text-gray-900">{details.userFullName}</p>
              <p className="text-sm text-gray-500">{details.user?.email}</p>
              
              <div className="mt-6 pt-6 border-t border-gray-100">
                <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Total Facture</h2>
                <p className="text-3xl font-black text-violet-600">{details.totalAmountMad.toLocaleString()} <span className="text-lg">MAD</span></p>
                <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 bg-green-50 text-green-700 rounded-lg text-xs font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span> Payé
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
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Factures</h1>
          <p className="text-sm text-gray-500 font-medium">Historique des factures générées</p>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gray-50/50">
          <div className="relative max-w-md w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Rechercher par N° facture ou utilisateur..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none transition-all"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-100 bg-white">
                <th className="py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider">Facture</th>
                <th className="py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider">Utilisateur</th>
                <th className="py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider">Date</th>
                <th className="py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider">Colis</th>
                <th className="py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider">Montant</th>
                <th className="py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-sm text-gray-500">
                    <div className="flex justify-center"><div className="w-6 h-6 border-2 border-violet-600 border-t-transparent rounded-full animate-spin"></div></div>
                  </td>
                </tr>
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center">
                    <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                      <FileText className="w-8 h-8 text-gray-300" />
                    </div>
                    <p className="text-gray-500 font-medium">Aucune facture trouvée</p>
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
                            Payé
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <p className="text-sm font-bold text-gray-900">{invoice.userFullName}</p>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2 text-gray-600">
                        <Calendar size={14} />
                        <span className="text-sm font-medium">{format(new Date(invoice.createdAt), 'dd MMM yyyy', { locale: fr })}</span>
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
    </div>
  );
}
