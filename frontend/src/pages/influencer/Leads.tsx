import { useState, useEffect } from 'react';
import { influencerApi } from '../../lib/api';
import { ReferralLink, InfluencerCommission } from '../../types';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import {
  Users, MousePointerClick, UserCheck, ShoppingCart,
  Filter, Download, Search, Calendar,
  MapPin, Phone, Package, Clock, Trash2, Headphones
} from 'lucide-react';

const STATUS_BADGES = {
  PENDING: { label: 'En attente', color: 'bg-yellow-100 text-yellow-800' },
  CONFIRMED: { label: 'Confirmé', color: 'bg-green-100 text-green-800' },
  SHIPPED: { label: 'Expédié', color: 'bg-blue-100 text-blue-800' },
  DELIVERED: { label: 'Livré', color: 'bg-purple-100 text-purple-800' },
  CANCELLED: { label: 'Annulé', color: 'bg-red-100 text-red-800' },
  RETURNED: { label: 'Retourné', color: 'bg-gray-100 text-gray-800' },
  LEAD: { label: 'Prospect', color: 'bg-indigo-100 text-indigo-800' },
  AVAILABLE: { label: 'En attente (Call Center)', color: 'bg-yellow-100 text-yellow-800' },
  ASSIGNED: { label: 'Au Call Center', color: 'bg-cyan-100 text-cyan-800' },
};

export default function InfluencerLeads() {
  const [activeTab, setActiveTab] = useState<'overview' | 'conversions' | 'pushed'>('overview');
  const [links, setLinks] = useState<ReferralLink[]>([]);
  const [commissions, setCommissions] = useState<InfluencerCommission[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [linksRes, commissionsRes] = await Promise.all([
        influencerApi.getLinks(),
        influencerApi.getCustomers() // This returns commissions with orders
      ]);
      setLinks(linksRes.data);
      // API returns { status, data: { commissions, pagination } }
      const commissionsData = commissionsRes.data?.data?.commissions || commissionsRes.data?.commissions || [];
      setCommissions(commissionsData);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const totalReferrals = links.reduce((sum, l) => sum + l.clicks, 0);
  const registered = links.reduce((sum, l) => sum + Math.floor(l.clicks * 0.3), 0);
  const converted = links.reduce((sum, l) => sum + l.conversions, 0);

  const filteredCommissions = commissions.filter(c => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      (c.order?.customerName?.toLowerCase().includes(term)) ||
      (c.order?.customerPhone?.includes(searchTerm)) ||
      (c.order?.customerCity?.toLowerCase().includes(term))
    );
  });

  const newLeads = filteredCommissions.filter(c => c.order?.status === 'LEAD');
  const pushedLeads = filteredCommissions.filter(c => c.order?.status !== 'LEAD');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-influencer-200 border-t-influencer-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Mes Leads & Parrainages</h1>
          <p className="text-sm text-gray-500 mt-1">Suivez les clics et les conversions générés par vos liens.</p>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-50 transition-all">
            <Download className="w-3.5 h-3.5" />
            Exporter
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-gray-100 p-1 rounded-2xl w-fit">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${
            activeTab === 'overview'
              ? 'bg-white text-influencer-600 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Vue d'ensemble
        </button>
        <button
          onClick={() => setActiveTab('conversions')}
          className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${
            activeTab === 'conversions'
              ? 'bg-white text-influencer-600 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Détails des Conversions ({newLeads.length})
        </button>
        <button
          onClick={() => setActiveTab('pushed')}
          className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${
            activeTab === 'pushed'
              ? 'bg-white text-influencer-600 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          En Traitement ({pushedLeads.length})
        </button>
      </div>

      {activeTab === 'overview' ? (
        <>
          {/* Conversion Funnel */}
          <div className="card p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
              <Filter className="w-5 h-5 text-influencer-500" />
              Entonnoir de Conversion
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-5 text-white text-center">
                <MousePointerClick className="w-8 h-8 mx-auto mb-2 opacity-80" />
                <h3 className="text-3xl font-black">{totalReferrals.toLocaleString()}</h3>
                <p className="text-xs font-medium opacity-80 mt-1">Clics Totaux</p>
              </div>
              <div className="bg-gradient-to-br from-influencer-500 to-purple-600 rounded-2xl p-5 text-white text-center">
                <UserCheck className="w-8 h-8 mx-auto mb-2 opacity-80" />
                <h3 className="text-3xl font-black">{registered.toLocaleString()}</h3>
                <p className="text-xs font-medium opacity-80 mt-1">Inscrits (Est.)</p>
              </div>
              <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl p-5 text-white text-center">
                <ShoppingCart className="w-8 h-8 mx-auto mb-2 opacity-80" />
                <h3 className="text-3xl font-black">{converted.toLocaleString()}</h3>
                <p className="text-xs font-medium opacity-80 mt-1">Ventes Confirmées</p>
              </div>
            </div>
          </div>

          {/* Referrals by Link */}
          <div className="card overflow-hidden">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-influencer-500" />
                Détail par Lien
              </h2>
            </div>
            {links.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-100">
                  <thead className="bg-gray-50/50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Produit</th>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Code</th>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Visiteurs</th>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Acheteurs</th>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Revenus</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {links.map((link) => (
                      <tr key={link.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <p className="text-sm font-bold text-gray-900 truncate max-w-[200px]">{link.product?.nameFr || `Produit #${link.productId}`}</p>
                        </td>
                        <td className="px-6 py-4">
                          <code className="text-xs font-mono bg-gray-100 px-2 py-1 rounded">{link.code}</code>
                        </td>
                        <td className="px-6 py-4 text-sm font-bold text-gray-900">{link.clicks}</td>
                        <td className="px-6 py-4 text-sm font-bold text-green-600">{link.conversions}</td>
                        <td className="px-6 py-4 text-sm font-black text-green-600">{link.earnings.toFixed(2)} MAD</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-12 text-center">
                <Users className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                <p className="text-gray-500 font-medium">Aucun lien de parrainage</p>
              </div>
            )}
          </div>
        </>
      ) : activeTab === 'conversions' ? (
        /* New Leads / Conversions Tab */
        <div className="space-y-4">
          <div className="flex items-center gap-4 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher par nom, téléphone ou ville..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-sm bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-influencer-500 transition-all font-medium"
              />
            </div>
          </div>

          <div className="card overflow-hidden">
            {newLeads.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-100">
                  <thead className="bg-gray-50/50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Client</th>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Produit</th>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Montant</th>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Commission</th>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {newLeads.map((commission) => (
                      <tr key={commission.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-gray-900">{commission.order?.customerName}</span>
                            <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-500 font-medium uppercase tracking-wider">
                              <span className="flex items-center gap-1"><Phone className="w-2.5 h-2.5" /> {commission.order?.customerPhone}</span>
                              <span className="flex items-center gap-1"><MapPin className="w-2.5 h-2.5" /> {commission.order?.customerCity}</span>
                            </div>
                            {commission.order?.customerAddress && (
                              <span className="text-[10px] text-gray-400 mt-1 truncate max-w-[200px]">📍 {commission.order.customerAddress}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            {commission.referralLink?.product?.images?.[0]?.imageUrl ? (
                              <img src={commission.referralLink.product.images[0].imageUrl} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                            ) : (
                              <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                                <Package className="w-4 h-4 text-gray-400" />
                              </div>
                            )}
                            <div className="flex flex-col">
                              <span className="text-sm font-bold text-gray-900">{commission.referralLink?.product?.nameFr}</span>
                              <span className="text-[10px] text-gray-400 font-mono mt-0.5 uppercase">SKU: {commission.referralLink?.product?.sku}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm font-bold text-gray-900">
                            {Number(commission.order?.totalAmountMad) > 0
                              ? `${Number(commission.order!.totalAmountMad).toFixed(2)} MAD`
                              : commission.referralLink?.product?.retailPriceMad
                                ? `${Number(commission.referralLink.product.retailPriceMad).toFixed(2)} MAD`
                                : '-'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            STATUS_BADGES[commission.order?.status as keyof typeof STATUS_BADGES]?.color || 'bg-gray-100 text-gray-800'
                          }`}>
                            {STATUS_BADGES[commission.order?.status as keyof typeof STATUS_BADGES]?.label || commission.order?.status}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col text-xs text-gray-500 font-medium whitespace-nowrap">
                            <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {commission.createdAt ? format(new Date(commission.createdAt), 'dd MMM yyyy') : '-'}</span>
                            <span className="flex items-center gap-1 mt-0.5 opacity-60"><Clock className="w-3 h-3" /> {commission.createdAt ? format(new Date(commission.createdAt), 'HH:mm') : '-'}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm font-black text-green-600">+{commission.amount.toFixed(2)} MAD</span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1">
                            {commission.order?.status === 'LEAD' && (
                              <>
                                <button
                                  onClick={async () => {
                                    const realId = String(commission.id).replace('lead-', '');
                                    try {
                                      await influencerApi.pushLeadToCallCenter(Number(realId));
                                      toast.success('Lead envoyé au Call Center!');
                                      loadData();
                                    } catch (err: any) {
                                      toast.error(err?.response?.data?.message || 'Erreur');
                                    }
                                  }}
                                  className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition-all" title="Envoyer au Call Center"
                                >
                                  <Headphones className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={async () => {
                                    if (!confirm('Supprimer ce lead ?')) return;
                                    const realId = String(commission.id).replace('lead-', '');
                                    try {
                                      await influencerApi.deleteLead(Number(realId));
                                      toast.success('Lead supprimé');
                                      loadData();
                                    } catch (err: any) {
                                      toast.error(err?.response?.data?.message || 'Erreur');
                                    }
                                  }}
                                  className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-all" title="Supprimer"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            )}
                            {commission.order?.status === 'ASSIGNED' && (
                              <span className="text-[10px] text-gray-400 font-medium">Au Call Center</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-12 text-center">
                <Package className="w-12 h-12 mx-auto text-gray-200 mb-3" />
                <p className="text-gray-500 font-medium">Aucune conversion trouvée</p>
                <p className="text-gray-400 text-sm mt-1">Vos ventes apparaîtront ici dès qu'un client commande via vos liens.</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Pushed / En Traitement Tab */
        <div className="space-y-4">
          <div className="flex items-center gap-4 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher par nom, téléphone ou ville..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-sm bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-influencer-500 transition-all font-medium"
              />
            </div>
          </div>

          <div className="card overflow-hidden">
            {pushedLeads.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-100">
                  <thead className="bg-gray-50/50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Client</th>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Produit</th>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Montant</th>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Commission</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {pushedLeads.map((commission) => {
                      const status = (commission.order?.status || 'PENDING') as keyof typeof STATUS_BADGES;
                      const badge = STATUS_BADGES[status] || { label: status, color: 'bg-gray-100 text-gray-800' };
                      const productImage = (commission as any).referralLink?.product?.images?.[0]?.imageUrl;
                      return (
                        <tr key={commission.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-6 py-4">
                            <div>
                              <p className="text-sm font-bold text-gray-900">{commission.order?.customerName || '-'}</p>
                              <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                                <Phone className="w-3 h-3" /> {commission.order?.customerPhone}
                                <span className="mx-1">·</span>
                                <MapPin className="w-3 h-3" /> {commission.order?.customerCity || '-'}
                              </p>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              {productImage && <img src={productImage} alt="" className="w-8 h-8 rounded-lg object-cover" />}
                              <div>
                                <p className="text-sm font-semibold text-gray-800">{(commission as any).referralLink?.product?.nameFr || (commission as any).referralLink?.product?.nameAr || '-'}</p>
                                <p className="text-[10px] text-gray-400">SKU: {(commission as any).referralLink?.product?.sku || '-'}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-sm font-bold text-gray-900">
                              {Number(commission.order?.totalAmountMad) > 0
                                ? `${Number(commission.order!.totalAmountMad).toFixed(2)} MAD`
                                : (commission as any).referralLink?.product?.retailPriceMad
                                  ? `${Number((commission as any).referralLink.product.retailPriceMad).toFixed(2)} MAD`
                                  : '-'}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${badge.color}`}>
                              {badge.label}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-xs text-gray-500 flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              <span>{format(new Date(commission.createdAt), 'dd MMM yyyy')}</span>
                            </div>
                            <p className="text-[10px] text-gray-400 mt-0.5">{format(new Date(commission.createdAt), 'HH:mm')}</p>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-sm font-black text-green-600">+{commission.amount.toFixed(2)} MAD</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-12 text-center">
                <Headphones className="w-12 h-12 mx-auto text-gray-200 mb-3" />
                <p className="text-gray-500 font-medium">Aucun lead en traitement</p>
                <p className="text-gray-400 text-sm mt-1">Les leads envoyés au Call Center apparaîtront ici.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
