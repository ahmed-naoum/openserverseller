import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { leadsApi } from '../../lib/api';
import { Phone, MapPin, Building2, User, Globe, Activity, Smartphone } from 'lucide-react';

export default function YouCanLeads() {
  const { data: leadsData, isLoading } = useQuery({
    queryKey: ['leads', 'youcan'],
    queryFn: () => leadsApi.list(),
  });

  // Filter leads that come specifically from YouCan
  const leads = (leadsData?.data?.data?.leads || []).filter((l: any) => l.source === 'YOUCAN');

  const statusColors: Record<string, string> = {
    NEW: 'primary',
    ASSIGNED: 'purple',
    CONTACTED: 'warning',
    INTERESTED: 'success',
    NOT_INTERESTED: 'danger',
    ORDERED: 'success',
    UNREACHABLE: 'gray',
    INVALID: 'danger',
  };

  return (
    <div className="space-y-6 pt-6 animate-in fade-in duration-500">
      {/* Premium Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-2xl flex items-center justify-center shadow-xl shadow-indigo-200 ring-4 ring-white">
            <Globe className="text-white" size={32} />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-none uppercase">Flux YouCan</h1>
            <p className="text-slate-500 mt-2 font-medium flex items-center gap-2">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              {leads.length} Prospects synchronisés automatiquement
            </p>
          </div>
        </div>
        
        <div className="flex bg-white p-2 rounded-2xl shadow-sm border border-slate-100 items-center gap-6 px-6">
            <div className="text-center">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Temps Réel</p>
                <p className="text-sm font-bold text-slate-900 flex items-center gap-1 justify-center">
                    <Activity size={14} className="text-emerald-500" /> ACTIF
                </p>
            </div>
            <div className="w-px h-8 bg-slate-100" />
            <div className="text-center">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Dernière Sync</p>
                <p className="text-sm font-bold text-slate-900">À l'instant</p>
            </div>
        </div>
      </div>

      {/* Leads Main Area */}
      {isLoading ? (
        <div className="text-center py-20 flex flex-col items-center">
          <div className="w-12 h-12 border-4 border-slate-200 border-t-primary-500 rounded-full animate-spin mb-4" />
          <p className="font-black text-slate-400 uppercase tracking-widest text-xs">Analyse du flux YouCan...</p>
        </div>
      ) : leads.length === 0 ? (
        <div className="bento-card border-none bg-white p-16 text-center shadow-sm rounded-[2rem]">
          <div className="w-24 h-24 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner border border-indigo-100/50">
            <Smartphone size={40} className="text-indigo-400" />
          </div>
          <h3 className="text-2xl font-black text-slate-900 tracking-tight mb-3">Aucun prospect YouCan détecté</h3>
          <p className="text-slate-500 font-medium mb-8 max-w-sm mx-auto leading-relaxed">
            Une fois votre boutique connectée et le webhook actif, vos nouveaux prospects s'afficheront ici en temps réel.
          </p>
        </div>
      ) : (
        <div className="bento-card border-none bg-white overflow-hidden shadow-sm p-0 rounded-[2rem]">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50/50 border-b border-slate-100/50">
                <tr>
                  <th className="text-left py-5 px-8 text-[10px] uppercase font-black tracking-widest text-slate-400">Client YouCan</th>
                  <th className="text-left py-5 px-8 text-[10px] uppercase font-black tracking-widest text-slate-400">Canal Direct</th>
                  <th className="text-left py-5 px-8 text-[10px] uppercase font-black tracking-widest text-slate-400">Identifiant Unique</th>
                  <th className="text-left py-5 px-8 text-[10px] uppercase font-black tracking-widest text-slate-400">État CRM</th>
                  <th className="text-left py-5 px-8 text-[10px] uppercase font-black tracking-widest text-slate-400">Affectation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {leads.map((lead: any) => (
                  <tr key={lead.id} className="hover:bg-slate-50/30 transition-colors group">
                    <td className="py-5 px-8">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-lg font-black shrink-0 border border-indigo-100/50 shadow-sm group-hover:scale-110 transition-transform">
                          {lead.fullName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                           <div className="font-extrabold text-slate-900 text-[15px]">{lead.fullName}</div>
                           <div className="text-[11px] text-slate-400 font-bold uppercase tracking-tighter mt-0.5">Capture le {new Date(lead.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-5 px-8">
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-2 text-sm text-slate-700 font-black">
                          <Phone size={14} className="text-indigo-400" /> {lead.phone}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-400 font-bold">
                          <MapPin size={12} /> {lead.city || 'Non renseigné'}
                        </div>
                      </div>
                    </td>
                    <td className="py-5 px-8">
                       <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-100 text-slate-600 rounded-xl text-[11px] font-black border border-slate-200">
                           ID: {lead.sourceId || 'N/A'}
                       </span>
                    </td>
                    <td className="py-5 px-8">
                      <span className={`px-4 py-2 rounded-xl text-[10px] uppercase font-black tracking-widest shadow-sm badge-${statusColors[lead.status] || 'gray'}`}>
                        {lead.status}
                      </span>
                    </td>
                    <td className="py-5 px-8">
                      {lead.assignedAgent ? (
                        <div className="flex items-center gap-2">
                           <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700 text-[11px] font-black">{lead.assignedAgent.fullName.charAt(0)}</div>
                           <span className="text-sm font-bold text-slate-700">{lead.assignedAgent.fullName}</span>
                        </div>
                      ) : (
                        <span className="inline-flex items-center px-3 py-1.5 rounded-lg bg-orange-50 text-orange-500 text-[10px] font-black uppercase tracking-widest border border-orange-100/50">Attente Agent</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
