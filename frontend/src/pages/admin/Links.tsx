import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminApi, helperApi } from '../../lib/api';
import {
  Link2, Search, Eye, MousePointerClick, TrendingUp, RefreshCw, Trash2,
  Power, Wand2, Copy, Users, MessageCircle, ShoppingCart, CheckCircle2,
  ExternalLink, Calendar, AlertTriangle, ShieldCheck, ChevronDown, ChevronUp,
  Filter, X
} from 'lucide-react';
import toast from 'react-hot-toast';

interface ReferralLink {
  id: number;
  code: string;
  isActive: boolean;
  status: string;
  createdAt: string;
  product?: {
    id: number;
    sku?: string;
    nameFr?: string;
    retailPriceMad?: number | string;
    images?: { imageUrl?: string; url?: string }[];
  };
  influencer?: {
    id: number;
    email: string;
    phone?: string;
    fullName: string;
  };
  landingPage?: any;
  rawClicks: number;
  clicks: number;
  whatsappClicks: number;
  leadsCount: number;
  confirmedCount: number;
  deliveredCount: number;
}

export default function AdminLinks() {
  const navigate = useNavigate();
  const [links, setLinks] = useState<ReferralLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [influencerFilter, setInfluencerFilter] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedLinkToDelete, setSelectedLinkToDelete] = useState<ReferralLink | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [expandedLinkId, setExpandedLinkId] = useState<number | null>(null);

  useEffect(() => {
    loadLinks();
  }, []);

  const loadLinks = async () => {
    try {
      setLoading(true);
      const res = await adminApi.getReferralLinks();
      if (res.data?.status === 'success') {
        setLinks(res.data.data);
      } else {
        setLinks(res.data || []);
      }
    } catch (err) {
      toast.error('Erreur lors du chargement des liens de parrainage');
    } finally {
      setLoading(false);
    }
  };

  const copyLink = (code: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/r/${code}`);
    toast.success('Lien copié avec succès !');
  };

  const toggleStatus = async (link: ReferralLink) => {
    const newActive = !link.isActive;
    try {
      await helperApi.updateLinkStatus(link.id, newActive);
      setLinks(prev => prev.map(l => l.id === link.id ? { ...l, isActive: newActive } : l));
      toast.success(newActive ? 'Lien activé !' : 'Lien désactivé !');
    } catch {
      toast.error('Impossible de modifier le statut du lien');
    }
  };

  const blockLink = async (link: ReferralLink, block: boolean) => {
    try {
      const newStatus = block ? 'SUSPENDED' : 'ACTIVE';
      const newActive = !block;
      await helperApi.updateLinkStatus(link.id, newActive, newStatus);
      setLinks(prev => prev.map(l => l.id === link.id ? { ...l, isActive: newActive, status: newStatus } : l));
      toast.success(block ? 'Lien bloqué avec succès !' : 'Lien débloqué avec succès !');
    } catch {
      toast.error('Impossible de modifier le statut de blocage du lien');
    }
  };

  const handleDeleteClick = (link: ReferralLink, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedLinkToDelete(link);
    setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!selectedLinkToDelete) return;
    try {
      setDeleting(true);
      await adminApi.deleteReferralLink(selectedLinkToDelete.id);
      setLinks(prev => prev.filter(l => l.id !== selectedLinkToDelete.id));
      toast.success('Lien supprimé définitivement');
      setDeleteModalOpen(false);
      setSelectedLinkToDelete(null);
    } catch {
      toast.error('Impossible de supprimer ce lien');
    } finally {
      setDeleting(false);
    }
  };

  // Get unique influencers list for filter dropdown
  const uniqueInfluencers = Array.from(new Set(links.map(l => l.influencer?.id)))
    .map(id => links.find(l => l.influencer?.id === id)?.influencer)
    .filter(Boolean);

  // Filters
  const filtered = links.filter(link => {
    const matchesStatus =
      statusFilter === '' ||
      (statusFilter === 'active' && link.isActive && link.status !== 'SUSPENDED') ||
      (statusFilter === 'inactive' && !link.isActive && link.status !== 'SUSPENDED') ||
      (statusFilter === 'blocked' && link.status === 'SUSPENDED') ||
      (statusFilter === 'building' && link.status === 'BUILDING');

    const matchesInfluencer = influencerFilter === '' || link.influencer?.id === Number(influencerFilter);

    const q = search.toLowerCase();
    const matchesSearch =
      !search ||
      link.code.toLowerCase().includes(q) ||
      (link.product?.nameFr || '').toLowerCase().includes(q) ||
      (link.product?.sku || '').toLowerCase().includes(q) ||
      (link.influencer?.fullName || '').toLowerCase().includes(q) ||
      (link.influencer?.email || '').toLowerCase().includes(q) ||
      (link.influencer?.phone || '').includes(q);

    return matchesStatus && matchesInfluencer && matchesSearch;
  });

  // Sort
  const sorted = [...filtered].sort((a: any, b: any) => {
    let aVal = a[sortBy];
    let bVal = b[sortBy];

    if (sortBy === 'product') {
      aVal = a.product?.nameFr || '';
      bVal = b.product?.nameFr || '';
    } else if (sortBy === 'influencer') {
      aVal = a.influencer?.fullName || '';
      bVal = b.influencer?.fullName || '';
    }

    if (aVal === undefined || aVal === null) return 1;
    if (bVal === undefined || bVal === null) return -1;

    if (typeof aVal === 'string') {
      return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }
    return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
  });

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortDir('desc');
    }
  };

  // Calculate metrics
  const totalViews = links.reduce((sum, l) => sum + (l.rawClicks || 0), 0);
  const totalVisitors = links.reduce((sum, l) => sum + (l.clicks || 0), 0);
  const totalWhatsapp = links.reduce((sum, l) => sum + (l.whatsappClicks || 0), 0);
  const totalLeads = links.reduce((sum, l) => sum + (l.leadsCount || 0), 0);
  const totalConfirmed = links.reduce((sum, l) => sum + (l.confirmedCount || 0), 0);
  const conversionRate = totalVisitors > 0 ? ((totalLeads / totalVisitors) * 100).toFixed(1) : '0.0';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-violet-100 border-t-violet-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Link2 className="text-violet-600 w-7 h-7" /> Gestion des Liens
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Visualisez, modifiez avec le constructeur et inspectez les performances de tous les liens d'affiliation.
          </p>
        </div>

        <button
          onClick={loadLinks}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200/80 rounded-xl text-xs font-black text-slate-600 hover:bg-slate-50 hover:text-violet-600 transition-all shadow-sm group"
        >
          <RefreshCw className="w-3.5 h-3.5 group-hover:rotate-180 transition-all duration-500" />
          ACTUALISER
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Total Liens', value: links.length, icon: Link2, color: 'text-indigo-600', bg: 'bg-indigo-50 border-indigo-100' },
          { label: 'Vues Totales', value: totalViews, icon: Eye, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-100' },
          { label: 'Visiteurs Uniques', value: totalVisitors, icon: Users, color: 'text-purple-600', bg: 'bg-purple-50 border-purple-100' },
          { label: 'Clics WhatsApp', value: totalWhatsapp, icon: MessageCircle, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-100' },
          { label: 'Ventes (Leads)', value: totalLeads, icon: ShoppingCart, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-100' },
          { label: 'Taux de Conv.', value: `${conversionRate}%`, icon: TrendingUp, color: 'text-rose-600', bg: 'bg-rose-50 border-rose-100' },
        ].map((stat, i) => {
          const Icon = stat.icon;
          return (
            <div key={i} className={`rounded-2xl p-4 border shadow-sm bg-white ${stat.bg} transition-all hover:scale-[1.02]`}>
              <div className="flex items-center justify-between mb-2">
                <span className={`text-xl font-black ${stat.color}`}>{stat.value}</span>
                <Icon size={16} className={stat.color} />
              </div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{stat.label}</p>
            </div>
          );
        })}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-3">
        <div className="flex flex-col lg:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50/50 border border-gray-200/80 rounded-xl text-sm font-bold text-slate-700 placeholder-slate-400 focus:outline-none focus:border-violet-500 focus:bg-white transition-all"
              placeholder="Rechercher par code, produit, SKU, influenceur (nom, mail, tél)..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X size={14} />
              </button>
            )}
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-2.5">
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/50 px-3 py-1.5 rounded-xl">
              <Filter size={12} className="text-slate-400" />
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="bg-transparent border-none text-xs font-bold text-slate-600 focus:outline-none cursor-pointer"
              >
                <option value="">Tous les statuts</option>
                <option value="active">Actifs</option>
                <option value="inactive">Inactifs</option>
                <option value="blocked">Bloqués</option>
                <option value="building">En construction</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/50 px-3 py-1.5 rounded-xl">
              <Users size={12} className="text-slate-400" />
              <select
                value={influencerFilter}
                onChange={e => setInfluencerFilter(e.target.value)}
                className="bg-transparent border-none text-xs font-bold text-slate-600 focus:outline-none cursor-pointer max-w-[160px]"
              >
                <option value="">Tous les influenceurs</option>
                {uniqueInfluencers.map((inf: any) => (
                  <option key={inf.id} value={inf.id}>{inf.fullName}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Links Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {sorted.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-100 text-[10px] font-black text-slate-500 uppercase tracking-wider">
                  <th className="px-6 py-4 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('influencer')}>
                    Influenceur {sortBy === 'influencer' && (sortDir === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="px-6 py-4 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('product')}>
                    Produit / SKU {sortBy === 'product' && (sortDir === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="px-6 py-4 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('code')}>
                    Code {sortBy === 'code' && (sortDir === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="px-6 py-4 text-center cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('rawClicks')}>
                    Vues {sortBy === 'rawClicks' && (sortDir === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="px-6 py-4 text-center cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('clicks')}>
                    Visiteurs {sortBy === 'clicks' && (sortDir === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="px-6 py-4 text-center cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('leadsCount')}>
                    Leads {sortBy === 'leadsCount' && (sortDir === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="px-6 py-4 text-center cursor-pointer hover:bg-slate-100 transition-colors">
                    Taux Conv.
                  </th>
                  <th className="px-6 py-4 text-center">Statut</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sorted.map(link => {
                  const isExpanded = expandedLinkId === link.id;
                  const linkConv = link.clicks > 0 ? ((link.leadsCount / link.clicks) * 100).toFixed(1) : '0.0';
                  
                  return (
                    <>
                      <tr
                        key={link.id}
                        className={`group hover:bg-slate-50/50 transition-colors cursor-pointer ${isExpanded ? 'bg-slate-50/30' : ''}`}
                        onClick={() => setExpandedLinkId(isExpanded ? null : link.id)}
                      >
                        {/* Influencer */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white flex items-center justify-center font-black text-xs">
                              {(link.influencer?.fullName || 'I')[0].toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-black text-slate-800 truncate">{link.influencer?.fullName}</p>
                              <p className="text-[10px] text-slate-400 font-bold truncate mt-0.5">{link.influencer?.email}</p>
                              {link.influencer?.phone && (
                                <p className="text-[9px] text-slate-500 font-mono mt-0.5">{link.influencer.phone}</p>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Product / SKU */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            {link.product?.images?.[0]?.imageUrl || link.product?.images?.[0]?.url ? (
                              <img
                                src={link.product.images[0].imageUrl || link.product.images[0].url}
                                className="w-9 h-9 rounded-lg object-cover border border-slate-100"
                                alt=""
                              />
                            ) : (
                              <div className="w-9 h-9 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400">
                                <Link2 size={16} />
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="text-xs font-black text-slate-800 truncate max-w-[150px]">
                                {link.product?.nameFr || 'Produit sans nom'}
                              </p>
                              <span className="text-[9px] font-black bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded uppercase mt-0.5 inline-block">
                                SKU: {link.product?.sku || 'N/A'}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Code */}
                        <td className="px-6 py-4">
                          <code className="text-xs font-mono font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-lg">
                            {link.code}
                          </code>
                        </td>

                        {/* Clicks (Vues) */}
                        <td className="px-6 py-4 text-center font-bold text-xs text-slate-700">
                          {link.rawClicks || 0}
                        </td>

                        {/* Unique Visitors */}
                        <td className="px-6 py-4 text-center font-bold text-xs text-slate-700">
                          {link.clicks || 0}
                        </td>

                        {/* Leads Count */}
                        <td className="px-6 py-4 text-center font-bold text-xs text-slate-700">
                          {link.leadsCount || 0}
                        </td>

                        {/* Conversion Rate */}
                        <td className="px-6 py-4 text-center font-black text-xs text-rose-600">
                          {linkConv}%
                        </td>

                        {/* Status Toggle */}
                        <td className="px-6 py-4 text-center" onClick={e => e.stopPropagation()}>
                          {link.status === 'SUSPENDED' ? (
                            <span className="px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5 mx-auto bg-red-50 text-red-700 border border-red-100">
                              <AlertTriangle size={10} />
                              Bloqué
                            </span>
                          ) : (
                            <button
                              onClick={() => toggleStatus(link)}
                              className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5 mx-auto ${
                                link.isActive
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                  : 'bg-rose-50 text-rose-700 border border-rose-100'
                              }`}
                            >
                              <Power size={10} />
                              {link.isActive ? 'Actif' : 'Inactif'}
                            </button>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-6 py-4 text-right" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => copyLink(link.code)}
                              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-indigo-600 transition-colors"
                              title="Copier le lien d'affiliation"
                            >
                              <Copy size={13} />
                            </button>

                            <button
                              onClick={() => navigate(`/admin/links/${link.id}/builder`)}
                              className="p-1.5 hover:bg-violet-50 rounded-lg text-slate-400 hover:text-violet-600 transition-colors"
                              title="Ouvrir le Constructeur de Landing Page"
                            >
                              <Wand2 size={13} />
                            </button>

                            {link.status === 'SUSPENDED' ? (
                              <button
                                onClick={(e) => { e.stopPropagation(); blockLink(link, false); }}
                                className="p-1.5 hover:bg-emerald-50 rounded-lg text-slate-400 hover:text-emerald-600 transition-colors"
                                title="Débloquer le lien de parrainage"
                              >
                                <ShieldCheck size={13} />
                              </button>
                            ) : (
                              <button
                                onClick={(e) => { e.stopPropagation(); blockLink(link, true); }}
                                className="p-1.5 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-600 transition-colors"
                                title="Bloquer le lien de parrainage"
                              >
                                <AlertTriangle size={13} />
                              </button>
                            )}

                            <button
                              onClick={(e) => handleDeleteClick(link, e)}
                              className="p-1.5 hover:bg-rose-50 rounded-lg text-slate-400 hover:text-rose-600 transition-colors"
                              title="Supprimer définitivement"
                            >
                              <Trash2 size={13} />
                            </button>

                            {isExpanded ? (
                              <ChevronUp size={14} className="text-slate-400" />
                            ) : (
                              <ChevronDown size={14} className="text-slate-400" />
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Expandable Section */}
                      {isExpanded && (
                        <tr key={`${link.id}-expanded`}>
                          <td colSpan={9} className="px-0 py-0">
                            <div className="bg-slate-50/50 border-y border-slate-100 px-8 py-5 animate-in fade-in slide-in-from-top-1 duration-150">
                              <h4 className="text-xs font-black text-slate-600 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                                <TrendingUp size={13} /> Statistiques Détaillées du Lien
                              </h4>

                              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
                                <div className="bg-white rounded-xl p-3 border border-slate-100 shadow-sm flex items-center justify-between">
                                  <div>
                                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wide">Clics WhatsApp</p>
                                    <p className="text-sm font-black text-teal-600 mt-0.5">{link.whatsappClicks || 0}</p>
                                  </div>
                                  <MessageCircle size={14} className="text-teal-400" />
                                </div>

                                <div className="bg-white rounded-xl p-3 border border-slate-100 shadow-sm flex items-center justify-between">
                                  <div>
                                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wide">Ventes Totales (Leads)</p>
                                    <p className="text-sm font-black text-amber-600 mt-0.5">{link.leadsCount || 0}</p>
                                  </div>
                                  <ShoppingCart size={14} className="text-amber-400" />
                                </div>

                                <div className="bg-white rounded-xl p-3 border border-slate-100 shadow-sm flex items-center justify-between">
                                  <div>
                                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wide">Commandes Confirmées</p>
                                    <p className="text-sm font-black text-emerald-600 mt-0.5">{link.confirmedCount || 0}</p>
                                  </div>
                                  <CheckCircle2 size={14} className="text-emerald-400" />
                                </div>

                                <div className="bg-white rounded-xl p-3 border border-slate-100 shadow-sm flex items-center justify-between">
                                  <div>
                                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wide">Commandes Livrées</p>
                                    <p className="text-sm font-black text-indigo-600 mt-0.5">{link.deliveredCount || 0}</p>
                                  </div>
                                  <ShieldCheck size={14} className="text-indigo-400" />
                                </div>

                                <div className="bg-white rounded-xl p-3 border border-slate-100 shadow-sm flex items-center justify-between col-span-2 md:col-span-1">
                                  <div>
                                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wide">Taux de Conversion</p>
                                    <p className="text-sm font-black text-rose-600 mt-0.5">{linkConv}%</p>
                                  </div>
                                  <TrendingUp size={14} className="text-rose-400" />
                                </div>
                              </div>

                              <div className="flex flex-wrap gap-4 items-center justify-between pt-3 border-t border-slate-100/80 text-[10px] text-slate-400 font-bold">
                                <span className="flex items-center gap-1.5">
                                  <Calendar size={12} /> Créé le : {link.createdAt ? new Date(link.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                                </span>

                                <div className="flex gap-2">
                                  {link.landingPage ? (
                                    <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded flex items-center gap-1">
                                      <ExternalLink size={10} /> Landing Page Active
                                    </span>
                                  ) : (
                                    <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded">
                                      Pas de Landing Page (Défaut)
                                    </span>
                                  )}
                                  <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded uppercase">
                                    Format : {link.status || 'ACTIVE'}
                                  </span>
                                </div>
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
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-slate-300">
            <Link2 size={48} className="mb-3" />
            <p className="text-sm font-black uppercase tracking-widest">Aucun lien d'affiliation trouvé</p>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteModalOpen && selectedLinkToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-150">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">Supprimer le lien de parrainage ?</h3>
                <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                  Êtes-vous sûr de vouloir supprimer définitivement le lien <code className="bg-slate-100 px-1 py-0.5 rounded font-mono font-bold">{selectedLinkToDelete.code}</code> ?
                </p>
                <div className="mt-3 p-3 bg-rose-50/50 border border-rose-100 rounded-xl">
                  <p className="text-[10px] font-bold text-rose-700 flex items-center gap-1.5 uppercase">
                    <AlertTriangle size={12} /> Conséquences :
                  </p>
                  <ul className="list-disc pl-4 text-[10px] text-rose-600 mt-1.5 space-y-1">
                    <li>Toutes les commandes (leads) associées seront conservées mais déconnectées de ce lien.</li>
                    <li>L'historique des clics (statistiques de visites) de ce lien sera supprimé définitivement.</li>
                    <li>La Landing Page personnalisée de ce lien sera supprimée définitivement.</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 mt-6 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setDeleteModalOpen(false);
                  setSelectedLinkToDelete(null);
                }}
                disabled={deleting}
                className="px-4 py-2 border border-slate-200 text-slate-600 text-xs font-bold rounded-xl hover:bg-slate-50 transition-colors"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleting}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-black rounded-xl shadow-lg shadow-rose-100 transition-colors"
              >
                {deleting ? 'Suppression...' : 'Confirmer la suppression'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
