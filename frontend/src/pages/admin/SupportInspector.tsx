import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../../lib/api';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import {
  Headphones, Search, Filter, ChevronLeft, ChevronRight,
  Calendar, Clock, AlertCircle, CheckCircle2, Tag,
  Package, Users, ArrowLeft, Eye, Activity, TrendingUp,
  MessageSquare, UserX, UserCheck, Inbox, Shield, Star,
  ExternalLink, CornerDownRight
} from 'lucide-react';

const TICKET_STATUS_COLORS: Record<string, string> = {
  PENDING_CLAIM: 'bg-amber-100 text-amber-800 border-amber-200',
  ACTIVE: 'bg-blue-100 text-blue-800 border-blue-200',
  CLOSED: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  ARCHIVED: 'bg-slate-100 text-slate-600 border-slate-200',
};

const TICKET_STATUS_LABELS: Record<string, string> = {
  PENDING_CLAIM: 'En attente',
  ACTIVE: 'En cours',
  CLOSED: 'Résolu',
  ARCHIVED: 'Archivé',
};

const CLIENT_ROLE_COLORS: Record<string, string> = {
  VENDOR: 'bg-violet-50 text-violet-700 border-violet-100',
  INFLUENCER: 'bg-pink-50 text-pink-700 border-pink-100',
  GROSSELLER: 'bg-amber-50 text-amber-700 border-amber-100',
  CALL_CENTER_AGENT: 'bg-cyan-50 text-cyan-700 border-cyan-100',
};

const CLIENT_ROLE_LABELS: Record<string, string> = {
  VENDOR: 'Vendeur',
  INFLUENCER: 'Influenceur',
  GROSSELLER: 'Grossiste',
  CALL_CENTER_AGENT: 'Agent Call Center',
};

export default function SupportInspector() {
  const navigate = useNavigate();
  const [selectedAgent, setSelectedAgent] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [ticketSearch, setTicketSearch] = useState('');
  const [ticketStatus, setTicketStatus] = useState('ALL');
  const [sortBy, setSortBy] = useState<'name' | 'tickets' | 'responseTime'>('tickets');

  const { data: inspectorData, isLoading } = useQuery({
    queryKey: ['support-inspector'],
    queryFn: () => adminApi.getSupportInspector(),
  });

  const agents = inspectorData?.data?.data?.agents || [];
  const totals = inspectorData?.data?.data?.totals || {
    totalAgents: 0,
    totalTickets: 0,
    totalActiveTickets: 0,
    totalClosedTickets: 0,
    totalPendingTickets: 0,
  };

  // Filter and sort agents
  const filteredAgents = agents
    .filter((a: any) =>
      a.fullName.toLowerCase().includes(search.toLowerCase()) ||
      a.email.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a: any, b: any) => {
      if (sortBy === 'name') {
        return a.fullName.localeCompare(b.fullName);
      }
      if (sortBy === 'responseTime') {
        const tA = a.averageResponseTimeMinutes ?? 999999;
        const tB = b.averageResponseTimeMinutes ?? 999999;
        return tA - tB;
      }
      return b.totalTickets - a.totalTickets;
    });

  // If agent is selected, find the up-to-date agent details
  const activeAgentData = selectedAgent
    ? agents.find((a: any) => a.id === selectedAgent.id) || selectedAgent
    : null;

  // Filter agent's tickets
  const filteredTickets = activeAgentData
    ? activeAgentData.ticketsDetail.filter((t: any) => {
        const matchesSearch =
          t.subject.toLowerCase().includes(ticketSearch.toLowerCase()) ||
          t.category.toLowerCase().includes(ticketSearch.toLowerCase()) ||
          (t.client?.fullName || '').toLowerCase().includes(ticketSearch.toLowerCase()) ||
          (t.client?.email || '').toLowerCase().includes(ticketSearch.toLowerCase());

        const matchesStatus =
          ticketStatus === 'ALL' ||
          (ticketStatus === 'ACTIVE' && (t.status === 'ACTIVE' || t.status === 'PENDING_CLAIM')) ||
          (ticketStatus === 'CLOSED' && (t.status === 'CLOSED' || t.status === 'ARCHIVED')) ||
          t.status === ticketStatus;

        return matchesSearch && matchesStatus;
      })
    : [];

  const handleSelectAgent = (agent: any) => {
    setSelectedAgent(agent);
    setTicketSearch('');
    setTicketStatus('ALL');
  };

  const handleBack = () => {
    setSelectedAgent(null);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-medium text-slate-500">Chargement des données de l'inspecteur...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview/Grid Screen */}
      {!activeAgentData ? (
        <>
          {/* Header Dashboard Banner */}
          <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 rounded-3xl p-8 text-white shadow-xl">
            <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-violet-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/3" />
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/10 text-indigo-300 text-xs font-bold mb-4 backdrop-blur-sm">
                  <Shield className="w-3.5 h-3.5 animate-pulse" /> Inspecteur Support Client
                </div>
                <h1 className="text-3xl font-black tracking-tight leading-none mb-2">Centre d'Inspection Supports</h1>
                <p className="text-base text-white/60 font-medium">Inspectez l'efficacité, les tickets résolus et l'activité des comptes Support Client.</p>
              </div>

              {/* Quick statistics */}
              <div className="flex items-center gap-6 bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-sm">
                <div className="text-center">
                  <p className="text-[10px] font-black text-white/40 uppercase tracking-wider">Agents</p>
                  <p className="text-2xl font-black text-white">{totals.totalAgents}</p>
                </div>
                <div className="h-8 w-[1px] bg-white/10" />
                <div className="text-center">
                  <p className="text-[10px] font-black text-white/40 uppercase tracking-wider">En Attente</p>
                  <p className="text-2xl font-black text-amber-400">{totals.totalPendingTickets}</p>
                </div>
                <div className="h-8 w-[1px] bg-white/10" />
                <div className="text-center">
                  <p className="text-[10px] font-black text-white/40 uppercase tracking-wider">Tickets gérés</p>
                  <p className="text-2xl font-black text-white">{totals.totalTickets}</p>
                </div>
                <div className="h-8 w-[1px] bg-white/10" />
                <div className="text-center">
                  <p className="text-[10px] font-black text-white/40 uppercase tracking-wider">Actifs</p>
                  <p className="text-2xl font-black text-emerald-400">{totals.totalActiveTickets}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Filters and Sort */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
            <div className="relative w-full sm:max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Rechercher un agent support..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all font-medium text-sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <span className="text-xs font-bold text-slate-400 whitespace-nowrap">Trier par:</span>
              <select
                value={sortBy}
                onChange={(e: any) => setSortBy(e.target.value)}
                className="px-3 py-2 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 appearance-none cursor-pointer"
              >
                <option value="tickets">Tickets Gérés</option>
                <option value="responseTime">Temps de Réponse</option>
                <option value="name">Nom</option>
              </select>
            </div>
          </div>

          {/* Agents Cards Grid */}
          {filteredAgents.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 p-16 text-center shadow-sm">
              <Headphones className="w-16 h-16 mx-auto text-slate-200 mb-4" />
              <h3 className="text-lg font-bold text-slate-900 mb-1">Aucun agent support trouvé</h3>
              <p className="text-sm text-slate-400">Essayez d'ajuster votre recherche.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredAgents.map((agent: any) => {
                const activePercentage = agent.totalTickets > 0 ? Math.round((agent.activeTickets / agent.totalTickets) * 100) : 0;
                
                return (
                  <button
                    key={agent.id}
                    onClick={() => handleSelectAgent(agent)}
                    className="bg-white rounded-2xl border border-slate-100 p-6 text-left hover:shadow-xl hover:border-slate-200 transition-all duration-300 group hover:scale-[1.01] active:scale-[0.99] flex flex-col justify-between shadow-sm"
                  >
                    <div>
                      {/* Card Header */}
                      <div className="flex items-center gap-4 mb-5">
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-black text-white shadow-lg ${
                          agent.isActive
                            ? 'bg-gradient-to-br from-indigo-500 to-violet-600 shadow-indigo-100'
                            : 'bg-gradient-to-br from-slate-400 to-slate-500 shadow-slate-100'
                        }`}>
                          {agent.fullName.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-black text-slate-900 truncate group-hover:text-indigo-600 transition-colors">{agent.fullName}</h3>
                          <p className="text-[11px] text-slate-400 font-medium truncate">{agent.email}</p>
                          <div className="flex items-center gap-2 mt-1">
                            {agent.isActive ? (
                              <span className="inline-flex items-center gap-1 text-[9px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md uppercase tracking-wider border border-emerald-100">
                                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" /> Actif
                              </span>
                            ) : (
                              <span className="text-[9px] font-black text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md uppercase tracking-wider border border-slate-200">Suspendu</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Performance Indicators */}
                      <div className="grid grid-cols-2 gap-3 mb-5">
                        <div className="bg-indigo-50/50 rounded-xl p-3 border border-indigo-100/30">
                          <p className="text-[9px] font-black text-indigo-500 uppercase tracking-widest mb-0.5">Tickets</p>
                          <p className="text-lg font-black text-indigo-950 leading-none">{agent.totalTickets}</p>
                        </div>
                        <div className="bg-violet-50/50 rounded-xl p-3 border border-violet-100/30">
                          <p className="text-[9px] font-black text-violet-500 uppercase tracking-widest mb-0.5">Rép. Moyenne</p>
                          <p className="text-lg font-black text-violet-950 leading-none">
                            {agent.averageResponseTimeMinutes !== null ? `${agent.averageResponseTimeMinutes} min` : 'N/A'}
                          </p>
                        </div>
                      </div>

                      {/* Progress representation */}
                      <div className="space-y-1.5 mb-4">
                        <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          <span>Actifs vs Résolus</span>
                          <span className="text-slate-700">{agent.closedTickets} / {agent.totalTickets} clos</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden flex">
                          <div className="bg-indigo-500 h-full transition-all" style={{ width: `${activePercentage}%` }} title={`Actifs: ${agent.activeTickets}`} />
                          <div className="bg-emerald-500 h-full transition-all" style={{ width: `${100 - activePercentage}%` }} title={`Résolus: ${agent.closedTickets}`} />
                        </div>
                      </div>
                    </div>

                    {/* Footer Hint */}
                    <div className="flex items-center justify-center gap-1.5 pt-3 border-t border-slate-50 w-full text-[10px] font-black text-slate-400 group-hover:text-indigo-600 transition-colors uppercase tracking-widest">
                      <Eye className="w-3.5 h-3.5" /> Inspecter les détails
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </>
      ) : (
        /* Detailed Support Agent View */
        <>
          {/* Header Profile with Back Button */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <button
                onClick={handleBack}
                className="p-2.5 bg-white rounded-xl border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition-all shadow-sm hover:shadow-md active:scale-95"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-black text-white shadow-lg ${
                  activeAgentData.isActive
                    ? 'bg-gradient-to-br from-indigo-500 to-violet-600 shadow-indigo-100'
                    : 'bg-gradient-to-br from-slate-400 to-slate-500 shadow-slate-100'
                }`}>
                  {activeAgentData.fullName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h1 className="text-xl font-black text-slate-900 tracking-tight">{activeAgentData.fullName}</h1>
                  <p className="text-xs text-slate-400 font-medium">{activeAgentData.email} · Support Technique</p>
                </div>
              </div>
            </div>
          </div>

          {/* Stats Cards Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-lg shadow-slate-100">
              <Inbox className="w-5 h-5 mb-2 text-slate-400" />
              <h3 className="text-2xl font-black">{activeAgentData.totalTickets}</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Total Tickets</p>
            </div>
            
            <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
              <Activity className="w-5 h-5 mb-2 text-indigo-500" />
              <h3 className="text-2xl font-black text-slate-900">{activeAgentData.activeTickets}</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Tickets Actifs</p>
            </div>

            <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
              <CheckCircle2 className="w-5 h-5 mb-2 text-emerald-500" />
              <h3 className="text-2xl font-black text-slate-900">{activeAgentData.closedTickets}</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Tickets Clos</p>
            </div>

            <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
              <Clock className="w-5 h-5 mb-2 text-violet-500" />
              <h3 className="text-2xl font-black text-slate-900">
                {activeAgentData.averageResponseTimeMinutes !== null ? `${activeAgentData.averageResponseTimeMinutes} min` : 'N/A'}
              </h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Rép. Moyenne</p>
            </div>
          </div>

          {/* Filters Area */}
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filtrer par sujet, catégorie, client..."
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all font-medium text-sm"
                  value={ticketSearch}
                  onChange={(e) => setTicketSearch(e.target.value)}
                />
              </div>
            </div>

            {/* Filter Chips */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setTicketStatus('ALL')}
                className={`px-3.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border ${
                  ticketStatus === 'ALL'
                    ? 'bg-slate-900 text-white border-slate-900 shadow-md'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                Tout ({activeAgentData.ticketsDetail.length})
              </button>
              <button
                onClick={() => setTicketStatus('ACTIVE')}
                className={`px-3.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border ${
                  ticketStatus === 'ACTIVE'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                Actifs / En cours ({activeAgentData.ticketsDetail.filter((t: any) => t.status === 'ACTIVE' || t.status === 'PENDING_CLAIM').length})
              </button>
              <button
                onClick={() => setTicketStatus('CLOSED')}
                className={`px-3.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border ${
                  ticketStatus === 'CLOSED'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-md'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                Résolus / Clos ({activeAgentData.ticketsDetail.filter((t: any) => t.status === 'CLOSED' || t.status === 'ARCHIVED').length})
              </button>
            </div>
          </div>

          {/* Tickets Detailed Table */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-100">
                    <th className="px-5 py-3.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Client</th>
                    <th className="px-5 py-3.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Ticket / Objet</th>
                    <th className="px-5 py-3.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Messages</th>
                    <th className="px-5 py-3.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Rép. Agent</th>
                    <th className="px-5 py-3.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Statut</th>
                    <th className="px-5 py-3.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Dates</th>
                    <th className="px-5 py-3.5 w-24"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredTickets.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-5 py-12 text-center text-slate-400 font-medium">
                        <Inbox className="w-12 h-12 mx-auto text-slate-200 mb-3" />
                        Aucun ticket correspondant
                      </td>
                    </tr>
                  ) : (
                    filteredTickets.map((t: any) => (
                      <tr key={t.id} className="hover:bg-slate-50/30 transition-colors">
                        {/* Client details */}
                        <td className="px-5 py-4">
                          {t.client ? (
                            <div className="flex flex-col">
                              <span className="text-sm font-bold text-slate-800">{t.client.fullName}</span>
                              <span className="text-[10px] text-slate-400 font-medium lowercase tracking-tight">{t.client.email}</span>
                              {t.client.roleName && (
                                <span className={`inline-flex w-fit mt-1 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border ${CLIENT_ROLE_COLORS[t.client.roleName] || 'bg-slate-100 text-slate-600'}`}>
                                  {CLIENT_ROLE_LABELS[t.client.roleName] || t.client.roleName}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs font-bold text-slate-400 italic">Inconnu</span>
                          )}
                        </td>

                        {/* Ticket info */}
                        <td className="px-5 py-4">
                          <div className="flex flex-col max-w-xs">
                            <span className="text-sm font-bold text-slate-800 truncate">{t.subject}</span>
                            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-black mt-0.5">{t.category}</span>
                            {t.product && (
                              <div className="flex items-center gap-1 mt-1 text-[9px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100/30 w-fit">
                                <Package className="w-2.5 h-2.5" />
                                {t.product.nameFr} ({t.product.sku})
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Messages count */}
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-1 text-sm font-black text-slate-800">
                            <MessageSquare className="w-4 h-4 text-slate-400" />
                            {t.messagesCount}
                          </div>
                        </td>

                        {/* Response time */}
                        <td className="px-5 py-4">
                          {t.responseTimeMinutes !== null ? (
                            <div className="flex flex-col">
                              <span className="text-sm font-black text-slate-800">{t.responseTimeMinutes} min</span>
                              <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider">Répondu</span>
                            </div>
                          ) : (
                            <span className="text-xs font-medium text-slate-400 italic">Sans réponse</span>
                          )}
                        </td>

                        {/* Status Badge */}
                        <td className="px-5 py-4">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${TICKET_STATUS_COLORS[t.status] || 'bg-slate-100 text-slate-600'}`}>
                            {TICKET_STATUS_LABELS[t.status] || t.status}
                          </span>
                        </td>

                        {/* Dates */}
                        <td className="px-5 py-4">
                          <div className="flex flex-col text-[10px] text-slate-500 font-medium">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3 text-slate-400" />
                              Créé: {format(new Date(t.createdAt), 'dd/MM HH:mm')}
                            </span>
                            {t.claimedAt && (
                              <span className="flex items-center gap-1 mt-0.5 text-indigo-500 font-semibold">
                                <CornerDownRight className="w-3 h-3" />
                                Pris: {format(new Date(t.claimedAt), 'dd/MM HH:mm')}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Action link */}
                        <td className="px-5 py-4 text-right">
                          <button
                            onClick={() => navigate(`/admin/chat?convId=${t.id}`)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all shadow-sm active:scale-95"
                          >
                            Chat <ExternalLink className="w-3 h-3" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
