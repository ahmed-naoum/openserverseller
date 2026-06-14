import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../../lib/api';
import {
  Users, Search, Eye, MousePointerClick, Link2, Wallet, TrendingUp, TrendingDown,
  ChevronDown, ChevronUp, Crown, MessageCircle, Package, CheckCircle2, Truck,
  ExternalLink, Activity, DollarSign, ArrowUpRight, ShieldCheck, Clock,
  RefreshCw, BarChart3, Mail, Phone, Filter, ShoppingCart
} from 'lucide-react';

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: 'bg-rose-100 text-rose-700 border-rose-200',
  VENDOR: 'bg-blue-100 text-blue-700 border-blue-200',
  SELLER: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  GROSSELLER: 'bg-violet-100 text-violet-700 border-violet-200',
  INFLUENCER: 'bg-purple-100 text-purple-700 border-purple-200',
  CALL_CENTER_AGENT: 'bg-amber-100 text-amber-700 border-amber-200',
  CONFIRMATION_AGENT: 'bg-orange-100 text-orange-700 border-orange-200',
  HELPER: 'bg-teal-100 text-teal-700 border-teal-200',
  SYSTEM_SUPPORT: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  FINANCE_ADMIN: 'bg-emerald-100 text-emerald-700 border-emerald-200',
};

const ALL_ROLES = [
  { value: '', label: 'Tous les rôles' },
  { value: 'VENDOR', label: 'Vendeur' },
  { value: 'INFLUENCER', label: 'Influenceur' },
  { value: 'GROSSELLER', label: 'Grossiste' },
];

const STATUS_COLORS: Record<string, string> = {
  NEW: 'bg-blue-100 text-blue-700',
  AVAILABLE: 'bg-emerald-100 text-emerald-700',
  ASSIGNED: 'bg-cyan-100 text-cyan-700',
  CONTACTED: 'bg-amber-100 text-amber-700',
  INTERESTED: 'bg-green-100 text-green-700',
  ORDERED: 'bg-emerald-100 text-emerald-800',
  CONFIRMED: 'bg-emerald-100 text-emerald-800',
  CALLBACK_REQUESTED: 'bg-orange-100 text-orange-700',
  NOT_INTERESTED: 'bg-rose-100 text-rose-700',
  UNREACHABLE: 'bg-slate-100 text-slate-600',
  INVALID: 'bg-red-100 text-red-700',
  PUSHED_TO_DELIVERY: 'bg-indigo-100 text-indigo-700',
  DELIVERED: 'bg-green-100 text-green-800',
  SHIPPED: 'bg-sky-100 text-sky-700',
  RETURNED: 'bg-rose-100 text-rose-700',
  CANCELLED: 'bg-slate-100 text-slate-600',
};

function StatCard({ icon: Icon, label, value, sub, gradient }: { icon: any; label: string; value: string | number; sub?: string; gradient: string }) {
  return (
    <div className={`relative overflow-hidden rounded-2xl p-5 text-white shadow-lg ${gradient}`}>
      <div className="absolute top-3 right-3 opacity-20">
        <Icon size={40} />
      </div>
      <Icon size={20} className="mb-2 opacity-80" />
      <h3 className="text-2xl font-black">{typeof value === 'number' ? value.toLocaleString() : value}</h3>
      <p className="text-[10px] font-bold opacity-80 uppercase tracking-wider mt-1">{label}</p>
      {sub && <p className="text-[9px] opacity-60 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function InfluencerInspector() {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [expandedUser, setExpandedUser] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<string>('totalLeads');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['influencer-inspector'],
    queryFn: () => adminApi.getInfluencerInspector(),
  });

  const allUsers = data?.data?.data?.users || data?.data?.data?.influencers || [];
  const totals = data?.data?.data?.totals || {};

  // Filter by role and search
  const filtered = allUsers.filter((inf: any) => {
    if (roleFilter && inf.roleName !== roleFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      inf.email?.toLowerCase().includes(q) ||
      inf.fullName?.toLowerCase().includes(q) ||
      inf.phone?.toLowerCase().includes(q) ||
      inf.roleName?.toLowerCase().includes(q)
    );
  });

  // Sort
  const sorted = [...filtered].sort((a: any, b: any) => {
    const aVal = a[sortBy] ?? 0;
    const bVal = b[sortBy] ?? 0;
    if (sortDir === 'desc') return bVal - aVal;
    return aVal - bVal;
  });

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortDir(sortDir === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(field);
      setSortDir('desc');
    }
  };

  const SortIcon = ({ field }: { field: string }) => {
    if (sortBy !== field) return <ChevronDown size={12} className="opacity-30" />;
    return sortDir === 'desc' ? <ChevronDown size={12} className="text-primary-500" /> : <ChevronUp size={12} className="text-primary-500" />;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm font-bold text-slate-400 uppercase tracking-wider">Chargement des données...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
            <Crown className="w-7 h-7 text-amber-500" />
            Inspecteur Utilisateurs
          </h1>
          <p className="text-sm text-gray-500 mt-1">Vue complète de tous les utilisateurs et leurs performances.</p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-50 transition-all shadow-sm"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Actualiser
        </button>
      </div>

      {/* Global Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard icon={Users} label="Utilisateurs" value={totals.totalUsers || totals.totalInfluencers || 0} gradient="bg-gradient-to-br from-violet-500 to-purple-600 shadow-purple-200/50" />
        <StatCard icon={MousePointerClick} label="Total Leads" value={totals.totalLeads || 0} gradient="bg-gradient-to-br from-blue-500 to-blue-600 shadow-blue-200/50" />
        <StatCard icon={CheckCircle2} label="Confirmés" value={totals.totalConfirmed || 0} gradient="bg-gradient-to-br from-emerald-500 to-green-600 shadow-green-200/50" />
        <StatCard icon={Truck} label="Livrés" value={totals.totalDelivered || 0} gradient="bg-gradient-to-br from-teal-500 to-emerald-600 shadow-emerald-200/50" />
        <StatCard icon={Eye} label="Vues Totales" value={totals.totalViews || 0} sub={`${totals.totalUniqueVisitors || 0} uniques`} gradient="bg-gradient-to-br from-amber-500 to-orange-600 shadow-orange-200/50" />
        <StatCard icon={DollarSign} label="Revenus" value={`${Number(totals.totalRevenue || 0).toLocaleString()} MAD`} gradient="bg-gradient-to-br from-rose-500 to-pink-600 shadow-pink-200/50" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard icon={Link2} label="Liens Actifs" value={`${totals.totalActiveLinks || 0} / ${totals.totalLinks || 0}`} gradient="bg-gradient-to-br from-indigo-500 to-violet-600 shadow-indigo-200/50" />
        <StatCard icon={MessageCircle} label="WhatsApp Clicks" value={totals.totalWhatsappClicks || 0} gradient="bg-gradient-to-br from-green-500 to-emerald-600 shadow-green-200/50" />
        <StatCard icon={Wallet} label="Solde Total" value={`${Number(totals.totalWalletBalance || 0).toLocaleString()} MAD`} gradient="bg-gradient-to-br from-cyan-500 to-blue-600 shadow-blue-200/50" />
        <StatCard icon={TrendingDown} label="Total Retiré" value={`${Number(totals.totalWithdrawn || 0).toLocaleString()} MAD`} gradient="bg-gradient-to-br from-slate-500 to-slate-700 shadow-slate-200/50" />
      </div>

      {/* Search & Role Filter */}
      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher par nom, email, téléphone..."
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-primary-500 transition-all font-medium text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="relative sm:w-56">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-primary-500 transition-all font-medium text-sm appearance-none cursor-pointer"
            >
              {ALL_ROLES.map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/80">
                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-gray-400">Utilisateur</th>
                {[
                  { key: 'totalLeads', label: 'Leads' },
                  { key: 'confirmedLeads', label: 'Confirmés' },
                  { key: 'deliveredLeads', label: 'Livrés' },
                  { key: 'totalViews', label: 'Vues' },
                  { key: 'uniqueVisitors', label: 'Uniques' },
                  { key: 'activeLinks', label: 'Liens' },
                  { key: 'totalWhatsappClicks', label: 'WhatsApp' },
                  { key: 'walletBalance', label: 'Solde' },
                  { key: 'totalEarned', label: 'Gagné' },
                  { key: 'totalWithdrawn', label: 'Retiré' },
                  { key: 'totalRevenue', label: 'Revenus' },
                ].map(col => (
                  <th
                    key={col.key}
                    className="px-3 py-3 text-[10px] font-black uppercase tracking-wider text-gray-400 cursor-pointer hover:text-gray-600 transition-colors select-none whitespace-nowrap"
                    onClick={() => handleSort(col.key)}
                  >
                    <div className="flex items-center gap-1">
                      {col.label}
                      <SortIcon field={col.key} />
                    </div>
                  </th>
                ))}
                <th className="px-3 py-3 text-[10px] font-black uppercase tracking-wider text-gray-400 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((inf: any) => {
                const isExpanded = expandedUser === inf.id;
                const conversionRate = inf.totalLeads > 0 ? ((inf.confirmedLeads / inf.totalLeads) * 100).toFixed(1) : '0';
                const deliveryRate = inf.confirmedLeads > 0 ? ((inf.deliveredLeads / inf.confirmedLeads) * 100).toFixed(1) : '0';
                return (
                  <> 
                    <tr
                      key={inf.id}
                      className={`border-b border-gray-50 hover:bg-gray-50/50 transition-colors cursor-pointer ${isExpanded ? 'bg-primary-50/30' : ''}`}
                      onClick={() => setExpandedUser(isExpanded ? null : inf.id)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white font-black text-xs ${inf.isActive ? 'bg-gradient-to-br from-violet-500 to-purple-600' : 'bg-gray-300'}`}>
                            {(inf.fullName || inf.email || '?')[0].toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-800 truncate max-w-[140px]">{inf.fullName}</p>
                            <p className="text-[10px] text-slate-400 truncate max-w-[140px]">{inf.email}</p>
                            {inf.roleName && (
                              <span className={`inline-flex mt-0.5 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border ${ROLE_COLORS[inf.roleName] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                                {inf.roleName === 'VENDOR' ? 'Vendeur' : inf.roleName === 'INFLUENCER' ? 'Influenceur' : inf.roleName === 'GROSSELLER' ? 'Grossiste' : inf.roleName}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <span className="text-sm font-black text-slate-800">{inf.totalLeads}</span>
                      </td>
                      <td className="px-3 py-3">
                        <div>
                          <span className="text-sm font-black text-emerald-600">{inf.confirmedLeads}</span>
                          <span className="text-[9px] font-bold text-slate-400 ml-1">({conversionRate}%)</span>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div>
                          <span className="text-sm font-black text-teal-600">{inf.deliveredLeads}</span>
                          <span className="text-[9px] font-bold text-slate-400 ml-1">({deliveryRate}%)</span>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <span className="text-sm font-bold text-slate-700">{inf.totalViews.toLocaleString()}</span>
                      </td>
                      <td className="px-3 py-3">
                        <span className="text-sm font-bold text-slate-700">{inf.uniqueVisitors.toLocaleString()}</span>
                      </td>
                      <td className="px-3 py-3">
                        <span className="text-sm font-bold text-indigo-600">{inf.activeLinks}/{inf.totalLinks}</span>
                      </td>
                      <td className="px-3 py-3">
                        <span className="text-sm font-bold text-green-600">{inf.totalWhatsappClicks}</span>
                      </td>
                      <td className="px-3 py-3">
                        <span className={`text-sm font-black ${inf.walletBalance >= 0 ? 'text-blue-600' : 'text-red-500'}`}>
                          {Number(inf.walletBalance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <span className="text-sm font-bold text-emerald-600">+{Number(inf.totalEarned).toLocaleString()}</span>
                      </td>
                      <td className="px-3 py-3">
                        <span className="text-sm font-bold text-slate-500">-{Number(inf.totalWithdrawn).toLocaleString()}</span>
                      </td>
                      <td className="px-3 py-3">
                        <span className="text-sm font-black text-amber-600">{Number(inf.totalRevenue).toLocaleString()}</span>
                      </td>
                      <td className="px-3 py-3">
                        {isExpanded ? (
                          <ChevronUp size={16} className="text-primary-500" />
                        ) : (
                          <ChevronDown size={16} className="text-gray-400" />
                        )}
                      </td>
                    </tr>

                    {/* Expanded Detail Row */}
                    {isExpanded && (
                      <tr key={`${inf.id}-detail`}>
                        <td colSpan={13} className="px-0 py-0">
                          <div className="bg-gradient-to-br from-slate-50 to-gray-50 border-y border-gray-100 px-6 py-5 animate-in fade-in slide-in-from-top-1 duration-200">
                            {/* User Info Header */}
                            <div className="flex flex-wrap items-center gap-4 mb-5 pb-4 border-b border-gray-200/60">
                              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white font-black text-lg shadow-lg ${inf.isActive ? 'bg-gradient-to-br from-violet-500 to-purple-600' : 'bg-gray-300'}`}>
                                {(inf.fullName || '?')[0].toUpperCase()}
                              </div>
                              <div>
                                <h3 className="text-lg font-black text-slate-800">{inf.fullName}</h3>
                                <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                                  <span className="flex items-center gap-1"><Mail size={12} /> {inf.email}</span>
                                  {inf.phone && <span className="flex items-center gap-1"><Phone size={12} /> {inf.phone}</span>}
                                </div>
                              </div>
                              <div className="ml-auto flex items-center gap-2">
                                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${inf.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                                  {inf.isActive ? 'Actif' : 'Inactif'}
                                </span>
                                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${inf.kycStatus === 'APPROVED' ? 'bg-green-100 text-green-700' : inf.kycStatus === 'PENDING' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                                  KYC: {inf.kycStatus || 'N/A'}
                                </span>
                              </div>
                            </div>

                            {/* Mini Stats Row */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 mb-5">
                              {[
                                { label: 'Solde Portefeuille', value: `${Number(inf.walletBalance).toLocaleString(undefined, { minimumFractionDigits: 2 })} MAD`, color: inf.walletBalance >= 0 ? 'text-blue-600' : 'text-red-500' },
                                { label: 'Total Gagné', value: `+${Number(inf.totalEarned).toLocaleString()} MAD`, color: 'text-emerald-600' },
                                { label: 'Total Retiré', value: `-${Number(inf.totalWithdrawn).toLocaleString()} MAD`, color: 'text-slate-500' },
                                { label: 'Revenus Total', value: `${Number(inf.totalRevenue).toLocaleString()} MAD`, color: 'text-amber-600' },
                                { label: 'Commissions Payées', value: `${Number(inf.paidCommissions).toLocaleString()} MAD`, color: 'text-green-600' },
                                { label: 'Commissions En Attente', value: `${Number(inf.pendingCommissions).toLocaleString()} MAD`, color: 'text-orange-500' },
                                { label: 'Retraits En Attente', value: `${Number(inf.pendingPayouts).toLocaleString()} MAD`, color: 'text-red-500' },
                                { label: 'Produits Réclamés', value: `${inf.approvedClaims}/${inf.claimsCount}`, color: 'text-indigo-600' },
                              ].map((s, i) => (
                                <div key={i} className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm">
                                  <p className={`text-sm font-black ${s.color}`}>{s.value}</p>
                                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-1">{s.label}</p>
                                </div>
                              ))}
                            </div>

                            {/* Lead Status Breakdown */}
                            {Object.keys(inf.statusBreakdown || {}).length > 0 && (
                              <div className="mb-5">
                                <h4 className="text-xs font-black text-slate-600 uppercase tracking-wider mb-3 flex items-center gap-2">
                                  <BarChart3 size={14} /> Répartition des Statuts
                                </h4>
                                <div className="flex flex-wrap gap-2">
                                  {Object.entries(inf.statusBreakdown).sort((a: any, b: any) => b[1] - a[1]).map(([status, count]: any) => (
                                    <span
                                      key={status}
                                      className={`px-2.5 py-1 rounded-lg text-[10px] font-black ${STATUS_COLORS[status] || 'bg-gray-100 text-gray-600'}`}
                                    >
                                      {status} ({count})
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                             {/* Affiliate Link Performance Statistics */}
                             {inf.linksDetail?.length > 0 && (
                               <div className="mb-6">
                                 <h4 className="text-xs font-black text-slate-600 uppercase tracking-wider mb-3 flex items-center gap-2">
                                   <TrendingUp size={14} /> Performance de l'Affiliation
                                 </h4>
                                 <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                                   {[
                                     { label: 'Total Liens', value: inf.totalLinks || 0, icon: Link2, color: 'text-indigo-600', bg: 'bg-indigo-50/50 border-indigo-100/50' },
                                     { label: 'Liens Actifs', value: inf.activeLinks || 0, icon: ShieldCheck, color: 'text-emerald-600', bg: 'bg-emerald-50/50 border-emerald-100/50' },
                                     { label: 'Vues Totales', value: inf.totalViews || 0, icon: Eye, color: 'text-blue-600', bg: 'bg-blue-50/50 border-blue-100/50' },
                                     { label: 'Visiteurs Uniques', value: inf.uniqueVisitors || 0, icon: Users, color: 'text-purple-600', bg: 'bg-purple-50/50 border-purple-100/50' },
                                     { label: 'Clics WhatsApp', value: inf.totalWhatsappClicks || 0, icon: MessageCircle, color: 'text-teal-600', bg: 'bg-teal-50/50 border-teal-100/50' },
                                     { label: 'Ventes Totales', value: inf.totalLeads || 0, icon: ShoppingCart, color: 'text-amber-600', bg: 'bg-amber-50/50 border-amber-100/50' },
                                     { label: 'Taux de Conv.', value: inf.uniqueVisitors > 0 ? `${((inf.totalLeads / inf.uniqueVisitors) * 100).toFixed(1)}%` : '0.0%', icon: TrendingUp, color: 'text-rose-600', bg: 'bg-rose-50/50 border-rose-100/50' },
                                   ].map((stat, i) => {
                                     const Icon = stat.icon;
                                     return (
                                       <div key={i} className={`rounded-xl p-3 border shadow-sm bg-white ${stat.bg}`}>
                                         <div className="flex items-center justify-between mb-1">
                                           <span className={`text-sm font-black ${stat.color}`}>{stat.value}</span>
                                           <Icon size={14} className={stat.color} />
                                         </div>
                                         <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{stat.label}</p>
                                       </div>
                                     );
                                   })}
                                 </div>
                                </div>
                              )}

                             {/* Links Detail */}
                             {inf.linksDetail?.length > 0 && (
                               <div>
                                 <h4 className="text-xs font-black text-slate-600 uppercase tracking-wider mb-3 flex items-center gap-2">
                                   <Link2 size={14} /> Détails des Liens ({inf.linksDetail.length})
                                 </h4>
                                 <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                                   {inf.linksDetail.map((link: any) => (
                                     <div key={link.id} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
                                       <div>
                                         <div className="flex items-start justify-between mb-3">
                                           <div className="min-w-0 flex-1">
                                             <p className="text-xs font-black text-slate-800 truncate">
                                               {link.product?.nameFr || link.product?.nameAr || link.product?.name || 'Produit'}
                                             </p>
                                             <p className="text-[10px] text-slate-400 font-mono mt-0.5">{link.code}</p>
                                           </div>
                                           <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${link.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                                             {link.isActive ? 'Actif' : 'Inactif'}
                                           </span>
                                         </div>
                                         <div className="grid grid-cols-2 gap-2 mt-2">
                                           <div className="bg-slate-50/50 rounded-lg p-2 flex items-center justify-between">
                                             <div>
                                               <p className="text-[8px] font-bold text-slate-400 uppercase">Vues</p>
                                               <p className="text-xs font-black text-slate-700">{link.rawClicks || 0}</p>
                                             </div>
                                             <Eye size={12} className="text-slate-400" />
                                           </div>
                                           <div className="bg-slate-50/50 rounded-lg p-2 flex items-center justify-between">
                                             <div>
                                               <p className="text-[8px] font-bold text-slate-400 uppercase">Visiteurs</p>
                                               <p className="text-xs font-black text-slate-700">{link.clicks || 0}</p>
                                             </div>
                                             <Users size={12} className="text-slate-400" />
                                           </div>
                                           <div className="bg-slate-50/50 rounded-lg p-2 flex items-center justify-between">
                                             <div>
                                               <p className="text-[8px] font-bold text-slate-400 uppercase">WhatsApp</p>
                                               <p className="text-xs font-black text-teal-600">{link.whatsappClicks || 0}</p>
                                             </div>
                                             <MessageCircle size={12} className="text-teal-400" />
                                           </div>
                                           <div className="bg-slate-50/50 rounded-lg p-2 flex items-center justify-between">
                                             <div>
                                               <p className="text-[8px] font-bold text-slate-400 uppercase">Ventes</p>
                                               <p className="text-xs font-black text-amber-600">{link.leadsCount || 0}</p>
                                             </div>
                                             <ShoppingCart size={12} className="text-amber-400" />
                                           </div>
                                           <div className="bg-slate-50/50 rounded-lg p-2 flex items-center justify-between">
                                             <div>
                                               <p className="text-[8px] font-bold text-slate-400 uppercase">Confirmés</p>
                                               <p className="text-xs font-black text-emerald-600">{link.confirmedCount || 0}</p>
                                             </div>
                                             <CheckCircle2 size={12} className="text-emerald-400" />
                                           </div>
                                           <div className="bg-slate-50/50 rounded-lg p-2 flex items-center justify-between">
                                             <div>
                                               <p className="text-[8px] font-bold text-slate-400 uppercase">Conv.</p>
                                               <p className="text-xs font-black text-rose-600">
                                                 {link.clicks > 0 ? `${((link.leadsCount / link.clicks) * 100).toFixed(1)}%` : '0.0%'}
                                               </p>
                                             </div>
                                             <TrendingUp size={12} className="text-rose-400" />
                                           </div>
                                         </div>
                                       </div>
                                       <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-50">
                                         <div className="text-[10px] text-slate-400 font-bold">
                                           Créé le: {link.createdAt ? new Date(link.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) : 'N/A'}
                                         </div>
                                         {link.landingPage && (
                                           <span className="text-[9px] font-bold text-indigo-500 flex items-center gap-1">
                                             <ExternalLink size={10} /> Landing Page
                                           </span>
                                         )}
                                       </div>
                                     </div>
                                   ))}
                                 </div>
                               </div>
                             )}

                            {/* Account Dates */}
                            <div className="mt-4 pt-3 border-t border-gray-200/60 flex flex-wrap gap-4 text-[10px] text-slate-400 font-bold">
                              <span className="flex items-center gap-1">
                                <Clock size={11} /> Inscrit le: {inf.createdAt ? new Date(inf.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'}
                              </span>
                              <span className="flex items-center gap-1">
                                <Activity size={11} /> Dernière connexion: {inf.lastLoginAt ? new Date(inf.lastLoginAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Jamais'}
                              </span>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>

        {sorted.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-slate-300">
            <Users size={48} className="mb-3" />
            <p className="text-sm font-black uppercase tracking-widest">Aucun influenceur trouvé</p>
          </div>
        )}
      </div>
    </div>
  );
}
