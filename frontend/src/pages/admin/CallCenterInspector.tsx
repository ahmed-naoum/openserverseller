import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../../lib/api';
import { format } from 'date-fns';
import {
  Headphones, Search, Filter, ChevronLeft, ChevronRight,
  Phone, MapPin, Calendar, Clock, AlertCircle, Truck,
  CheckCircle2, Tag, Package, Users, ArrowLeft, Eye,
  Activity, TrendingUp, UserCheck, XCircle, PhoneOff, RotateCcw,
  CalendarDays, X
} from 'lucide-react';

const STATUS_BADGES: Record<string, { label: string; color: string; bgCard: string; icon: any }> = {
  ASSIGNED: { label: 'Assigné', icon: Headphones, color: 'bg-cyan-100 text-cyan-800', bgCard: 'from-cyan-500 to-cyan-600' },
  CONTACTED: { label: 'Contacté', icon: Phone, color: 'bg-blue-100 text-blue-800', bgCard: 'from-blue-500 to-blue-600' },
  INTERESTED: { label: 'Intéressé', icon: CheckCircle2, color: 'bg-green-100 text-green-800', bgCard: 'from-green-500 to-green-600' },
  ORDERED: { label: 'Commandé', icon: Tag, color: 'bg-emerald-100 text-emerald-800', bgCard: 'from-emerald-500 to-emerald-600' },
  CALLBACK_REQUESTED: { label: 'Rappel', icon: RotateCcw, color: 'bg-orange-100 text-orange-800', bgCard: 'from-orange-500 to-orange-600' },
  NOT_INTERESTED: { label: 'Pas intéressé', icon: XCircle, color: 'bg-red-100 text-red-800', bgCard: 'from-red-500 to-red-600' },
  UNREACHABLE: { label: 'Injoignable', icon: PhoneOff, color: 'bg-gray-100 text-gray-800', bgCard: 'from-gray-500 to-gray-600' },
  INVALID: { label: 'Invalide', icon: AlertCircle, color: 'bg-red-100 text-red-800', bgCard: 'from-red-400 to-red-500' },
  PUSHED_TO_DELIVERY: { label: 'En livraison', icon: Truck, color: 'bg-indigo-100 text-indigo-800', bgCard: 'from-indigo-500 to-indigo-600' },
  NEW: { label: 'Nouveau', icon: Clock, color: 'bg-blue-100 text-blue-800', bgCard: 'from-blue-400 to-blue-500' },
  AVAILABLE: { label: 'Disponible', icon: CheckCircle2, color: 'bg-emerald-100 text-emerald-800', bgCard: 'from-emerald-400 to-emerald-500' },
};

const allStatuses = Object.keys(STATUS_BADGES);

export default function CallCenterInspector() {
  const [selectedAgent, setSelectedAgent] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const limit = 20;

  // Fetch all agents
  const { data: agentsData, isLoading: agentsLoading } = useQuery({
    queryKey: ['call-center-agents', startDate, endDate],
    queryFn: () => adminApi.getCallCenterAgents({
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    }),
  });

  const agents = agentsData?.data?.data || [];

  // Fetch leads for selected agent
  const { data: leadsData, isLoading: leadsLoading } = useQuery({
    queryKey: ['call-center-agent-leads', selectedAgent?.id, statusFilter, search, page, startDate, endDate],
    queryFn: () => adminApi.getCallCenterAgentLeads(selectedAgent.id, {
      status: statusFilter === 'ALL' ? undefined : statusFilter,
      search: search || undefined,
      page,
      limit,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    }),
    enabled: !!selectedAgent,
  });

  const leads = leadsData?.data?.data?.leads || [];
  const statusBreakdown = leadsData?.data?.data?.statusBreakdown || selectedAgent?.statusBreakdown || {};
  const pagination = leadsData?.data?.data?.pagination || { totalPages: 1, total: 0 };

  const handleSelectAgent = (agent: any) => {
    setSelectedAgent(agent);
    setStatusFilter('ALL');
    setSearch('');
    setPage(1);
  };

  const handleBack = () => {
    setSelectedAgent(null);
    setStatusFilter('ALL');
    setSearch('');
    setPage(1);
  };

  const handleClearDates = () => {
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  // Agent Overview (no agent selected)
  if (!selectedAgent) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-3xl p-8 text-white shadow-2xl">
          <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/3" />
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/10 text-cyan-300 text-xs font-bold mb-4 backdrop-blur-sm">
              <Activity className="w-3.5 h-3.5 animate-pulse" /> Inspecteur Call Center
            </div>
            <h1 className="text-3xl font-black tracking-tight leading-none mb-2">Centre d'Inspection Agents</h1>
            <p className="text-base text-white/60 font-medium">Inspectez les performances et les leads de chaque agent du Call Center.</p>
          </div>
          <div className="absolute top-6 right-8 hidden lg:flex items-center gap-3">
            <div className="text-right">
              <p className="text-[10px] font-black text-white/40 uppercase tracking-wider">Agents actifs</p>
              <p className="text-3xl font-black text-white">{agents.filter((a: any) => a.isActive).length}</p>
            </div>
            <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-sm border border-white/10">
              <Headphones className="w-7 h-7 text-cyan-400" />
            </div>
          </div>
        </div>

        {/* Date Filters */}
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="flex items-center gap-2 text-xs font-bold text-gray-500">
              <CalendarDays className="w-4 h-4 text-cyan-500" />
              Filtrer par date
            </div>
            <div className="flex items-center gap-2 flex-1">
              <div className="relative flex-1 max-w-[200px]">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                />
              </div>
              <span className="text-xs font-bold text-gray-300">→</span>
              <div className="relative flex-1 max-w-[200px]">
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                />
              </div>
              {(startDate || endDate) && (
                <button
                  onClick={handleClearDates}
                  className="flex items-center gap-1 px-3 py-2 bg-red-50 text-red-500 rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-red-100 transition-all border border-red-100"
                >
                  <X className="w-3 h-3" />
                  Effacer
                </button>
              )}
            </div>
            {(startDate || endDate) && (
              <div className="text-[10px] font-bold text-cyan-600 bg-cyan-50 px-3 py-1.5 rounded-lg border border-cyan-100">
                {startDate && endDate ? `${startDate} → ${endDate}` : startDate ? `Depuis ${startDate}` : `Jusqu'au ${endDate}`}
              </div>
            )}
          </div>
        </div>

        {/* Agents Grid */}
        {agentsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 p-6 animate-pulse">
                <div className="flex items-center gap-4 mb-5">
                  <div className="w-14 h-14 bg-gray-100 rounded-2xl" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-100 rounded-lg w-32" />
                    <div className="h-3 bg-gray-100 rounded-lg w-20" />
                  </div>
                </div>
                <div className="h-16 bg-gray-50 rounded-xl" />
              </div>
            ))}
          </div>
        ) : agents.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center">
            <Headphones className="w-16 h-16 mx-auto text-gray-200 mb-4" />
            <h3 className="text-lg font-bold text-gray-900 mb-1">Aucun agent Call Center</h3>
            <p className="text-sm text-gray-400">Il n'y a pas encore d'agents dans le système.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {agents.map((agent: any) => {
              const totalLeads = agent.totalLeads || 0;
              const breakdown = agent.statusBreakdown || {};
              const topStatuses = Object.entries(breakdown)
                .sort(([, a]: any, [, b]: any) => b - a)
                .slice(0, 5);

              return (
                <button
                  key={agent.id}
                  onClick={() => handleSelectAgent(agent)}
                  className="bg-white rounded-2xl border border-gray-100 p-6 text-left hover:shadow-xl hover:shadow-gray-100/80 hover:border-gray-200 transition-all duration-300 group hover:scale-[1.02] active:scale-[0.98]"
                >
                  {/* Agent Header */}
                  <div className="flex items-center gap-4 mb-5">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-black text-white shadow-lg ${
                      agent.isActive
                        ? 'bg-gradient-to-br from-cyan-500 to-blue-600 shadow-cyan-200/50'
                        : 'bg-gradient-to-br from-gray-400 to-gray-500 shadow-gray-200/50'
                    }`}>
                      {agent.fullName?.charAt(0)?.toUpperCase() || 'A'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-black text-gray-900 truncate group-hover:text-cyan-600 transition-colors">{agent.fullName}</h3>
                      <p className="text-[11px] text-gray-400 font-medium truncate">{agent.email}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {agent.isActive ? (
                          <span className="inline-flex items-center gap-1 text-[9px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md uppercase tracking-wider">
                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" /> Actif
                          </span>
                        ) : (
                          <span className="text-[9px] font-black text-gray-400 bg-gray-100 px-2 py-0.5 rounded-md uppercase tracking-wider">Inactif</span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end">
                      <div className="text-2xl font-black text-gray-900">{totalLeads}</div>
                      <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Leads</div>
                    </div>
                  </div>

                  {/* Status Breakdown */}
                  {topStatuses.length > 0 ? (
                    <div className="bg-gray-50/80 rounded-xl p-3 space-y-2">
                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">Répartition Statuts</p>
                      <div className="flex flex-wrap gap-1.5">
                        {topStatuses.map(([status, count]: any) => {
                          const badge = STATUS_BADGES[status] || { label: status, color: 'bg-gray-100 text-gray-600', icon: Clock };
                          const StatusIcon = badge.icon;
                          return (
                            <span key={status} className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider ${badge.color}`}>
                              <StatusIcon className="w-2.5 h-2.5" />
                              {badge.label} <span className="opacity-70">({count})</span>
                            </span>
                          );
                        })}
                      </div>
                      {/* Mini progress bar */}
                      {totalLeads > 0 && (
                        <div className="flex h-1.5 rounded-full overflow-hidden bg-gray-200/50 mt-2">
                          {topStatuses.map(([status, count]: any) => {
                            const pct = (count / totalLeads) * 100;
                            const colors: Record<string, string> = {
                              ASSIGNED: 'bg-cyan-500',
                              CONTACTED: 'bg-blue-500',
                              INTERESTED: 'bg-green-500',
                              ORDERED: 'bg-emerald-500',
                              CALLBACK_REQUESTED: 'bg-orange-500',
                              NOT_INTERESTED: 'bg-red-500',
                              UNREACHABLE: 'bg-gray-400',
                              PUSHED_TO_DELIVERY: 'bg-indigo-500',
                            };
                            return (
                              <div
                                key={status}
                                className={`${colors[status] || 'bg-gray-300'} transition-all`}
                                style={{ width: `${pct}%` }}
                                title={`${STATUS_BADGES[status]?.label || status}: ${count}`}
                              />
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="bg-gray-50/80 rounded-xl p-4 text-center">
                      <p className="text-[10px] font-bold text-gray-300 italic">Aucun lead assigné</p>
                    </div>
                  )}

                  {/* Action hint */}
                  <div className="flex items-center justify-center gap-2 mt-4 text-[10px] font-bold text-gray-300 group-hover:text-cyan-500 transition-colors">
                    <Eye className="w-3.5 h-3.5" />
                    Cliquez pour inspecter
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // Agent Detail View (agent selected)
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={handleBack}
            className="p-2.5 bg-white rounded-xl border border-gray-200 text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition-all shadow-sm hover:shadow-md active:scale-95"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-black text-white shadow-lg ${
              selectedAgent.isActive
                ? 'bg-gradient-to-br from-cyan-500 to-blue-600 shadow-cyan-200/50'
                : 'bg-gradient-to-br from-gray-400 to-gray-500 shadow-gray-200/50'
            }`}>
              {selectedAgent.fullName?.charAt(0)?.toUpperCase() || 'A'}
            </div>
            <div>
              <h1 className="text-xl font-black text-gray-900 tracking-tight">{selectedAgent.fullName}</h1>
              <p className="text-xs text-gray-400 font-medium">{selectedAgent.email} · {selectedAgent.phone || 'Pas de téléphone'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Status Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* Total */}
        <div className="bg-gradient-to-br from-slate-700 to-slate-900 rounded-2xl p-4 text-white shadow-lg shadow-slate-200/50">
          <Users className="w-5 h-5 mb-1.5 opacity-80" />
          <h3 className="text-xl font-black">{Object.values(statusBreakdown).reduce((s: any, c: any) => s + c, 0)}</h3>
          <p className="text-[9px] font-bold opacity-60 uppercase tracking-wider mt-0.5">Total Leads</p>
        </div>
        {Object.entries(statusBreakdown)
          .sort(([, a]: any, [, b]: any) => b - a)
          .slice(0, 4)
          .map(([status, count]: any) => {
            const badge = STATUS_BADGES[status] || { label: status, bgCard: 'from-gray-500 to-gray-600', icon: Clock };
            const StatusIcon = badge.icon;
            return (
              <div key={status} className={`bg-gradient-to-br ${badge.bgCard} rounded-2xl p-4 text-white shadow-lg`}>
                <StatusIcon className="w-5 h-5 mb-1.5 opacity-80" />
                <h3 className="text-xl font-black">{count}</h3>
                <p className="text-[9px] font-bold opacity-60 uppercase tracking-wider mt-0.5">{badge.label}</p>
              </div>
            );
          })}
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-4">
        {/* Search + Date Range */}
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher par nom, téléphone, ville..."
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-cyan-500 transition-all font-medium text-sm"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <div className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-cyan-500 flex-shrink-0" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
              className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all w-[150px]"
            />
            <span className="text-xs font-bold text-gray-300">→</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
              className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all w-[150px]"
            />
            {(startDate || endDate) && (
              <button
                onClick={handleClearDates}
                className="p-2 bg-red-50 text-red-500 rounded-xl hover:bg-red-100 transition-all border border-red-100"
                title="Effacer les dates"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Status Filter Chips */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => { setStatusFilter('ALL'); setPage(1); }}
            className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border ${
              statusFilter === 'ALL'
                ? 'bg-gray-900 text-white border-gray-900 shadow-md'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
            }`}
          >
            Tout ({pagination.total || Object.values(statusBreakdown).reduce((s: any, c: any) => s + c, 0)})
          </button>
          {allStatuses.map(status => {
            const badge = STATUS_BADGES[status];
            const count = statusBreakdown[status] || 0;
            if (count === 0 && statusFilter !== status) return null;
            const IconComp = badge.icon;
            const isActive = statusFilter === status;
            return (
              <button
                key={status}
                onClick={() => { setStatusFilter(status); setPage(1); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border ${
                  isActive
                    ? `${badge.color} border-current shadow-md`
                    : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                }`}
              >
                <IconComp className="w-3 h-3" />
                {badge.label} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Leads Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-700 flex items-center gap-2">
            <Filter className="w-4 h-4 text-cyan-500" />
            {statusFilter === 'ALL' ? 'Tous les Leads' : STATUS_BADGES[statusFilter]?.label || statusFilter}
            <span className="text-gray-400 font-medium">({pagination.total})</span>
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <th className="px-5 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Client</th>
                <th className="px-5 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Produit</th>
                <th className="px-5 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Montant</th>
                <th className="px-5 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Statut</th>
                <th className="px-5 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {leadsLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={5} className="px-5 py-4"><div className="h-10 bg-gray-100 rounded-lg w-full" /></td>
                  </tr>
                ))
              ) : leads.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-gray-400 font-medium">
                    <Package className="w-12 h-12 mx-auto text-gray-200 mb-3" />
                    Aucun lead trouvé
                  </td>
                </tr>
              ) : (
                leads.map((lead: any) => {
                  const statusInfo = STATUS_BADGES[lead.status] || { label: lead.status, color: 'bg-gray-100 text-gray-800', icon: Clock };
                  const StatusIcon = statusInfo.icon;
                  const productImage = lead.product?.image;

                  return (
                    <tr key={lead.id} className="hover:bg-gray-50/50 transition-colors group">
                      {/* Client */}
                      <td className="px-5 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-gray-900">{lead.fullName}</span>
                          <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-500 font-medium uppercase tracking-wider">
                            <span className="flex items-center gap-1"><Phone className="w-2.5 h-2.5" /> {lead.phone}</span>
                            <span className="flex items-center gap-1"><MapPin className="w-2.5 h-2.5" /> {lead.city || '-'}</span>
                          </div>
                        </div>
                      </td>

                      {/* Product */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          {productImage ? (
                            <img src={productImage} alt="" className="w-9 h-9 rounded-lg object-cover flex-shrink-0 shadow-sm" />
                          ) : (
                            <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                              <Package className="w-4 h-4 text-gray-400" />
                            </div>
                          )}
                          <div className="flex flex-col min-w-0">
                            <span className="text-sm font-bold text-gray-900 truncate">{lead.product?.name || '-'}</span>
                            {lead.productVariant && (
                              <span className="text-[10px] font-black text-cyan-600 truncate uppercase tracking-tighter bg-cyan-50 px-1.5 py-0.5 rounded-md w-fit mt-0.5">
                                {lead.productVariant}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Amount */}
                      <td className="px-5 py-4">
                        <span className="text-sm font-black text-gray-900 tracking-tight">
                          {lead.productPrice > 0 ? `${Number(lead.productPrice).toFixed(2)} MAD` : '-'}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${statusInfo.color}`}>
                          <StatusIcon className="w-3 h-3" />
                          {statusInfo.label}
                        </span>
                      </td>

                      {/* Date */}
                      <td className="px-5 py-4">
                        <div className="flex flex-col text-[11px] text-gray-500 font-medium">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {format(new Date(lead.createdAt), 'dd MMM yyyy')}
                          </span>
                          <span className="flex items-center gap-1 mt-0.5 opacity-60">
                            <Clock className="w-3 h-3" />
                            {format(new Date(lead.createdAt), 'HH:mm')}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="px-6 py-5 border-t border-gray-100 flex items-center justify-between bg-gray-50/30">
            <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest">
              {leads.length} sur {pagination.total} leads
            </p>
            <div className="flex items-center gap-1">
              <button
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
                className="w-8 h-8 flex items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-600 disabled:opacity-30 hover:bg-gray-50 transition-all shadow-sm"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, pagination.totalPages) }).map((_, i) => {
                  let pageNum = i + 1;
                  if (pagination.totalPages > 5 && page > 3) {
                    pageNum = page - 2 + i;
                    if (pageNum > pagination.totalPages) pageNum = pagination.totalPages - (4 - i);
                    if (pageNum < 1) pageNum = i + 1;
                  }

                  return (
                    <button
                      key={pageNum}
                      onClick={() => setPage(pageNum)}
                      className={`w-8 h-8 rounded-xl text-[10px] font-black transition-all shadow-sm ${
                        page === pageNum
                          ? 'bg-cyan-500 text-white shadow-cyan-200 border-cyan-500'
                          : 'bg-white border border-gray-200 text-gray-400 hover:bg-gray-50'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>
              <button
                disabled={page === pagination.totalPages}
                onClick={() => setPage(p => p + 1)}
                className="w-8 h-8 flex items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-600 disabled:opacity-30 hover:bg-gray-50 transition-all shadow-sm"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
