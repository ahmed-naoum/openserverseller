import React, { useState, useEffect, useCallback } from 'react';
import { 
  History, 
  Search, 
  User as UserIcon, 
  Activity, 
  Calendar,
  ChevronLeft,
  ChevronRight,
  Eye,
  X,
  Trash2,
  Globe,
  Clock,
  ChevronDown,
  ChevronUp,
  Monitor,
  ArrowRight,
  Filter
} from 'lucide-react';
import toast from 'react-hot-toast';
import { adminApi } from '../../lib/api';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

// ─── Helpers ────────────────────────────────────────────────
const getActionColor = (action: string) => {
  if (action.includes('DELETE')) return 'bg-rose-50 text-rose-700 border-rose-100';
  if (action.includes('POST')) return 'bg-emerald-50 text-emerald-700 border-emerald-100';
  if (action.includes('PUT') || action.includes('PATCH')) return 'bg-amber-50 text-amber-700 border-amber-100';
  return 'bg-slate-50 text-slate-700 border-slate-100';
};

const getMethodColor = (method: string) => {
  switch (method) {
    case 'GET': return 'bg-blue-500';
    case 'POST': return 'bg-emerald-500';
    case 'PUT': case 'PATCH': return 'bg-amber-500';
    case 'DELETE': return 'bg-rose-500';
    default: return 'bg-slate-500';
  }
};

const getStatusColor = (code: number) => {
  if (code >= 200 && code < 300) return 'text-emerald-600 bg-emerald-50 border-emerald-100';
  if (code >= 300 && code < 400) return 'text-blue-600 bg-blue-50 border-blue-100';
  if (code >= 400 && code < 500) return 'text-amber-600 bg-amber-50 border-amber-100';
  return 'text-rose-600 bg-rose-50 border-rose-100';
};

const safeParse = (str: string | null | undefined) => {
  if (!str) return {};
  try { return JSON.parse(str); } catch { return {}; }
};

// ─── Activités Tab ──────────────────────────────────────────
const ActivitiesTab = ({ logs, loading, selectedLog, setSelectedLog }: any) => (
  <>
    <div className="bg-white rounded-[32px] border border-slate-100 shadow-xl shadow-slate-200/50 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/50 border-b border-slate-100">
              <th className="px-6 py-5 text-[11px] font-black text-slate-400 uppercase tracking-wider">Utilisateur</th>
              <th className="px-6 py-5 text-[11px] font-black text-slate-400 uppercase tracking-wider">Action</th>
              <th className="px-6 py-5 text-[11px] font-black text-slate-400 uppercase tracking-wider">Modèle</th>
              <th className="px-6 py-5 text-[11px] font-black text-slate-400 uppercase tracking-wider">ID</th>
              <th className="px-6 py-5 text-[11px] font-black text-slate-400 uppercase tracking-wider text-right">Date & Heure</th>
              <th className="px-6 py-5 text-[11px] font-black text-slate-400 uppercase tracking-wider text-center">Détails</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td colSpan={6} className="px-6 py-6"><div className="h-4 bg-slate-100 rounded-full w-full" /></td>
                </tr>
              ))
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-20 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="p-4 bg-slate-50 rounded-full text-slate-300"><Activity size={40} /></div>
                    <p className="text-slate-500 font-bold">Aucun journal trouvé</p>
                  </div>
                </td>
              </tr>
            ) : logs.map((log: any) => (
              <tr key={log.id} className="hover:bg-slate-50/50 transition-colors group">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-xs shrink-0">
                      {log.user?.profile?.fullName?.charAt(0) || 'U'}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900 leading-none">{log.user?.profile?.fullName || log.user?.email || 'Système'}</p>
                      <p className="text-[10px] text-slate-400 font-black uppercase mt-1 tracking-tight">{log.user?.role?.name || 'Inconnu'}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-3 py-1 rounded-full text-[10px] font-black border uppercase tracking-wider ${getActionColor(log.action)}`}>{log.action}</span>
                </td>
                <td className="px-6 py-4"><span className="text-sm font-bold text-slate-600">{log.modelType || '-'}</span></td>
                <td className="px-6 py-4 font-mono text-xs text-slate-400">{log.modelId ? `#${log.modelId}` : '-'}</td>
                <td className="px-6 py-4 text-right">
                  <div className="text-sm font-bold text-slate-900">{format(new Date(log.createdAt), 'dd MMMM yyyy', { locale: fr })}</div>
                  <div className="text-[11px] font-black text-slate-400 uppercase">{format(new Date(log.createdAt), 'HH:mm:ss')}</div>
                </td>
                <td className="px-6 py-4 text-center">
                  <button onClick={() => setSelectedLog(log)} className="p-2 text-slate-400 hover:text-slate-900 hover:bg-white rounded-xl border border-transparent hover:border-slate-200 transition-all shadow-sm">
                    <Eye size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>

    {/* Log Detail Modal */}
    {selectedLog && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setSelectedLog(null)} />
        <div className="relative bg-white rounded-[40px] shadow-2xl w-full max-w-2xl overflow-hidden">
          <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white rounded-2xl shadow-sm border border-slate-100 text-slate-900"><Activity size={24} /></div>
              <div>
                <h3 className="text-xl font-black text-slate-900 tracking-tight">Détails de l'Activité</h3>
                <p className="text-xs text-slate-400 font-black uppercase mt-1 tracking-wider">Log #{selectedLog.id}</p>
              </div>
            </div>
            <button onClick={() => setSelectedLog(null)} className="p-3 hover:bg-white text-slate-400 hover:text-slate-900 rounded-2xl transition-all border border-transparent hover:border-slate-200">
              <X size={20} />
            </button>
          </div>
          <div className="p-8 overflow-y-auto max-h-[70vh] space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div className="p-5 bg-slate-50 rounded-3xl border border-slate-100">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2"><UserIcon size={12} /> Utilisateur</p>
                <p className="font-bold text-slate-900">{selectedLog.user?.profile?.fullName || selectedLog.user?.email || 'Système'}</p>
              </div>
              <div className="p-5 bg-slate-50 rounded-3xl border border-slate-100">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2"><Calendar size={12} /> Date & Heure</p>
                <p className="font-bold text-slate-900">{format(new Date(selectedLog.createdAt), 'Pp', { locale: fr })}</p>
              </div>
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-3 px-1">Données de l'Action (Payload)</p>
              <div className="p-6 bg-slate-900 rounded-[32px] overflow-hidden relative">
                <pre className="text-xs font-mono text-emerald-400 overflow-x-auto">
                  {JSON.stringify(safeParse(selectedLog.changes), null, 2)}
                </pre>
                <div className="absolute top-4 right-4 p-2 bg-white/10 rounded-lg text-white/40 text-[10px] font-black uppercase tracking-widest pointer-events-none">JSON VIEW</div>
              </div>
            </div>
          </div>
          <div className="p-8 border-t border-slate-100 bg-slate-50/50 text-center">
            <button onClick={() => setSelectedLog(null)} className="px-8 py-3.5 bg-slate-900 text-white rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/20 active:scale-95">Fermer</button>
          </div>
        </div>
      </div>
    )}
  </>
);

// ─── Requêtes API Tab ───────────────────────────────────────
const RequestsTab = ({ logs, loading }: any) => {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [methodFilter, setMethodFilter] = useState('ALL');

  const parsed = logs.map((log: any) => {
    const c = safeParse(log.changes);
    return { ...log, _p: c };
  });

  const filtered = methodFilter === 'ALL' ? parsed : parsed.filter((l: any) => l._p.method === methodFilter);

  return (
    <div className="space-y-4">
      {/* Method Filter */}
      <div className="flex items-center gap-2">
        <Filter size={14} className="text-slate-400" />
        {['ALL', 'GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map(m => (
          <button key={m} onClick={() => setMethodFilter(m)}
            className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border ${
              methodFilter === m ? 'bg-slate-900 text-white border-slate-900 shadow-md' : 'bg-white text-slate-500 border-slate-100 hover:bg-slate-50'
            }`}>{m === 'ALL' ? 'Tous' : m}</button>
        ))}
      </div>

      <div className="bg-white rounded-[32px] border border-slate-100 shadow-xl shadow-slate-200/50 overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-12 gap-4 px-6 py-4 bg-slate-50/50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
          <div className="col-span-1">Méthode</div>
          <div className="col-span-3">Route</div>
          <div className="col-span-2">IP Source</div>
          <div className="col-span-1">Statut</div>
          <div className="col-span-1">Durée</div>
          <div className="col-span-2">Utilisateur</div>
          <div className="col-span-2 text-right">Date</div>
        </div>

        {loading ? (
          <div className="divide-y divide-slate-50">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="px-6 py-5 animate-pulse"><div className="h-4 bg-slate-100 rounded-full" /></div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <Globe className="w-12 h-12 text-slate-200 mx-auto mb-4" />
            <p className="text-slate-400 font-bold">Aucune requête trouvée</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {filtered.map((log: any) => {
              const c = log._p;
              const isExpanded = expandedId === log.id;
              const statusCode = c.statusCode || 0;

              return (
                <div key={log.id} className="hover:bg-slate-50/50 transition-colors">
                  <div className="grid grid-cols-12 gap-4 items-center px-6 py-4 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : log.id)}>
                    {/* Method */}
                    <div className="col-span-1">
                      <span className={`inline-block px-2 py-1 rounded-lg text-[10px] font-black text-white uppercase ${getMethodColor(c.method || '')}`}>
                        {c.method || '?'}
                      </span>
                    </div>
                    {/* Route */}
                    <div className="col-span-3">
                      <p className="text-xs font-bold text-slate-700 font-mono truncate">{c.path || log.action || '—'}</p>
                    </div>
                    {/* IP */}
                    <div className="col-span-2">
                      <div className="flex items-center gap-1.5">
                        <Globe size={12} className="text-slate-400 shrink-0" />
                        <span className="text-xs font-mono text-slate-600 truncate">{c.ip || '—'}</span>
                      </div>
                    </div>
                    {/* Status */}
                    <div className="col-span-1">
                      {statusCode > 0 ? (
                        <span className={`inline-flex px-2 py-0.5 rounded-lg text-[10px] font-black border ${getStatusColor(statusCode)}`}>{statusCode}</span>
                      ) : <span className="text-slate-300 text-xs">—</span>}
                    </div>
                    {/* Duration */}
                    <div className="col-span-1">
                      {c.duration != null ? (
                        <div className="flex items-center gap-1 text-xs font-bold text-slate-500">
                          <Clock size={10} className="shrink-0" />
                          {c.duration}ms
                        </div>
                      ) : <span className="text-slate-300 text-xs">—</span>}
                    </div>
                    {/* User */}
                    <div className="col-span-2">
                      <p className="text-xs font-bold text-slate-700 truncate">{log.user?.profile?.fullName || log.user?.email || 'Système'}</p>
                    </div>
                    {/* Date */}
                    <div className="col-span-2 flex items-center justify-end gap-2">
                      <div className="text-right">
                        <p className="text-[10px] font-bold text-slate-500">{format(new Date(log.createdAt), "dd MMM yyyy", { locale: fr })}</p>
                        <p className="text-[10px] text-slate-400">{format(new Date(log.createdAt), "HH:mm:ss")}</p>
                      </div>
                      {isExpanded ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="px-6 pb-5 space-y-4">
                      {/* Info Cards */}
                      <div className="grid grid-cols-3 gap-3">
                        <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">User Agent</p>
                          <p className="text-[10px] font-medium text-slate-600 break-all leading-relaxed">{c.userAgent || '—'}</p>
                        </div>
                        <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Query Params</p>
                          <p className="text-[10px] font-mono text-slate-600 break-all">{c.query && Object.keys(c.query).length > 0 ? JSON.stringify(c.query) : '—'}</p>
                        </div>
                        <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Réponse</p>
                          <div className="flex items-center gap-2">
                            {statusCode > 0 && <span className={`px-2 py-0.5 rounded text-[10px] font-black border ${getStatusColor(statusCode)}`}>{statusCode}</span>}
                            {c.duration != null && <span className="text-[10px] text-slate-500">{c.duration}ms</span>}
                          </div>
                        </div>
                      </div>

                      {/* Database Changes (if present) */}
                      {c.dbChanges && (
                        <div className="p-5 bg-violet-50/50 rounded-3xl border border-violet-100/50 space-y-4">
                          <p className="text-[10px] font-black text-violet-600 uppercase tracking-widest flex items-center gap-2">
                            💾 Modifications de la Base de Données
                          </p>

                          {/* Webhook Custom Changes */}
                          {c.dbChanges.message && (
                            <p className="text-xs font-semibold text-slate-500 italic">{c.dbChanges.message}</p>
                          )}

                          {(c.dbChanges.order || c.dbChanges.lead) && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {c.dbChanges.order && (
                                <div className="p-4 bg-white rounded-2xl border border-slate-100 space-y-2">
                                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Commande</p>
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="font-bold text-slate-700">N° {c.dbChanges.order.orderNumber}</span>
                                    <span className="font-mono text-slate-400 text-[10px]">#{c.dbChanges.order.id}</span>
                                  </div>
                                  {c.dbChanges.order.status && (
                                    <div className="flex items-center gap-2 mt-1">
                                      <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-bold">{c.dbChanges.order.status.from || '—'}</span>
                                      <span className="text-slate-400 text-xs">➔</span>
                                      <span className="text-[10px] px-2 py-0.5 rounded bg-violet-100 text-violet-700 font-bold">{c.dbChanges.order.status.to}</span>
                                    </div>
                                  )}
                                </div>
                              )}
                              {c.dbChanges.lead && (
                                <div className="p-4 bg-white rounded-2xl border border-slate-100 space-y-2">
                                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Lead (Prospect)</p>
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="font-bold text-slate-700">{c.dbChanges.lead.fullName || '—'}</span>
                                    <span className="font-mono text-slate-400 text-[10px]">#{c.dbChanges.lead.id}</span>
                                  </div>
                                  <div className="space-y-1.5 mt-1">
                                    {c.dbChanges.lead.status && (
                                      <div className="flex items-center gap-2">
                                        <span className="text-[9px] font-black text-slate-400 uppercase w-12 text-slate-500">Statut:</span>
                                        <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-bold">{c.dbChanges.lead.status.from || '—'}</span>
                                        <span className="text-slate-400 text-xs">➔</span>
                                        <span className="text-[10px] px-2 py-0.5 rounded bg-violet-100 text-violet-700 font-bold">{c.dbChanges.lead.status.to}</span>
                                      </div>
                                    )}
                                    {c.dbChanges.lead.paymentSituation && (
                                      <div className="flex items-center gap-2">
                                        <span className="text-[9px] font-black text-slate-400 uppercase w-12 text-slate-500">Paiement:</span>
                                        <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-bold">{c.dbChanges.lead.paymentSituation.from || '—'}</span>
                                        <span className="text-slate-400 text-xs">➔</span>
                                        <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 font-bold">{c.dbChanges.lead.paymentSituation.to}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Generic Before/After Diff Table */}
                          {(c.dbChanges.before || c.dbChanges.after) && (() => {
                            const beforeObj = c.dbChanges.before || {};
                            const afterObj = c.dbChanges.after || {};
                            
                            const allKeys = Array.from(new Set([...Object.keys(beforeObj), ...Object.keys(afterObj)]));
                            const ignoredKeys = ['createdAt', 'updatedAt', 'id', 'password', 'passwordHash', 'token', 'secret', 'twoFactorSecret'];
                            
                            const changedFields = allKeys.filter(key => {
                              if (ignoredKeys.includes(key)) return false;
                              const beforeVal = beforeObj[key];
                              const afterVal = afterObj[key];
                              
                              if (typeof beforeVal === 'object' || typeof afterVal === 'object') {
                                return JSON.stringify(beforeVal) !== JSON.stringify(afterVal);
                              }
                              return beforeVal !== afterVal;
                            });

                            if (!c.dbChanges.after && c.dbChanges.before) {
                              return (
                                <div className="p-4 bg-rose-50/50 rounded-2xl border border-rose-100/50">
                                  <p className="text-xs font-bold text-rose-700 mb-2 flex items-center gap-1.5">
                                    🗑️ Enregistrement Supprimé (Données d'origine)
                                  </p>
                                  <pre className="text-[10px] text-rose-600 font-mono overflow-auto max-h-40 p-2.5 bg-white rounded-xl border border-rose-100">
                                    {JSON.stringify(c.dbChanges.before, null, 2)}
                                  </pre>
                                </div>
                              );
                            }

                            if (!c.dbChanges.before && c.dbChanges.after) {
                              return (
                                <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100/50">
                                  <p className="text-xs font-bold text-emerald-700 mb-2 flex items-center gap-1.5">
                                    ➕ Enregistrement Créé (Données)
                                  </p>
                                  <pre className="text-[10px] text-emerald-600 font-mono overflow-auto max-h-40 p-2.5 bg-white rounded-xl border border-emerald-100">
                                    {JSON.stringify(c.dbChanges.after, null, 2)}
                                  </pre>
                                </div>
                              );
                            }

                            if (changedFields.length === 0) {
                              return (
                                <p className="text-xs text-slate-400 italic font-semibold">
                                  Aucun champ modifié détecté dans la base de données.
                                </p>
                              );
                            }

                            return (
                              <div className="overflow-hidden bg-white rounded-2xl border border-slate-100 shadow-sm">
                                <table className="min-w-full divide-y divide-slate-100 text-left text-xs">
                                  <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                    <tr>
                                      <th className="px-4 py-2">Champ</th>
                                      <th className="px-4 py-2">Avant (Before)</th>
                                      <th className="px-4 py-2">Après (After)</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-50 font-medium text-slate-700">
                                    {changedFields.map(field => {
                                      const oldVal = beforeObj[field];
                                      const newVal = afterObj[field];
                                      
                                      const formatVal = (v: any) => {
                                        if (v === null || v === undefined) return <span className="text-slate-300">—</span>;
                                        if (typeof v === 'boolean') return v ? 'true' : 'false';
                                        if (typeof v === 'string') {
                                           const isISODate = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?(Z|[+-]\d{2}:\d{2})?$/.test(v);
                                           if (isISODate) {
                                             try {
                                               return new Date(v).toLocaleString();
                                             } catch (e) {}
                                           }
                                           return v;
                                         }
                                         if (typeof v === 'object') {
                                           if (Object.keys(v).length === 0) {
                                             return <span className="text-slate-300">—</span>;
                                           }
                                           return JSON.stringify(v);
                                         }
                                        return String(v);
                                      };

                                      return (
                                        <tr key={field} className="hover:bg-slate-50/30 transition-colors">
                                          <td className="px-4 py-2.5 font-bold text-slate-900">{field}</td>
                                          <td className="px-4 py-2.5">
                                            <span className="inline-block px-2 py-0.5 rounded bg-rose-50 text-rose-600 text-[10px] font-bold border border-rose-100/40">
                                              {formatVal(oldVal)}
                                            </span>
                                          </td>
                                          <td className="px-4 py-2.5">
                                            <span className="inline-block px-2 py-0.5 rounded bg-emerald-50 text-emerald-600 text-[10px] font-bold border border-emerald-100/40">
                                              {formatVal(newVal)}
                                            </span>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            );
                          })()}
                        </div>
                      )}

                      {/* Request Body */}
                      <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                          <ArrowRight size={10} /> Payload de la Requête
                        </p>
                        <div className="bg-slate-900 rounded-2xl p-4 overflow-auto max-h-60">
                          <pre className="text-[11px] text-emerald-400 font-mono leading-relaxed whitespace-pre-wrap">
                            {c.body && Object.keys(c.body).length > 0 ? JSON.stringify(c.body, null, 2) : '{ }  // Aucun body'}
                          </pre>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Main Component ─────────────────────────────────────────
const ActivityLogs = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [selectedLog, setSelectedLog] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'activities' | 'requests'>('activities');

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      const res = await adminApi.getActivityLogs({ page, limit: 50, action: search });
      setLogs(res.data.data.logs);
      setTotalPages(res.data.data.pagination.totalPages);
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const handleClearLogs = async () => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer TOUS les journaux d\'activité ? Cette action est irréversible.')) return;
    try {
      setLoading(true);
      await adminApi.clearActivityLogs();
      toast.success('Tous les journaux ont été supprimés');
      setPage(1);
      fetchLogs();
    } catch (error) {
      console.error('Failed to clear logs:', error);
      toast.error('Erreur lors de la suppression des journaux');
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <div className="p-2.5 bg-slate-900 text-white rounded-2xl shadow-lg shadow-slate-200">
              <History size={24} />
            </div>
            Journaux d'Activité
          </h1>
          <p className="text-slate-500 mt-2 font-medium">Surveillez chaque action effectuée sur la plateforme</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-slate-900 transition-colors" size={18} />
            <input type="text" placeholder="Rechercher une action..." value={search} onChange={(e) => setSearch(e.target.value)}
              className="pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl w-full md:w-80 focus:outline-none focus:ring-4 focus:ring-slate-900/5 focus:border-slate-900 transition-all font-medium text-sm shadow-sm" />
          </div>
          <button onClick={handleClearLogs} className="flex items-center gap-2 bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-700 px-4 py-3 rounded-2xl font-bold text-sm transition-all shadow-sm">
            <Trash2 size={18} />
            <span className="hidden sm:inline">Supprimer tout</span>
          </button>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex rounded-2xl bg-slate-100 p-1 gap-1 w-fit">
        <button onClick={() => setActiveTab('activities')}
          className={`flex items-center gap-2 py-2.5 px-5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
            activeTab === 'activities' ? 'bg-white text-slate-900 shadow-lg shadow-slate-200' : 'text-slate-400 hover:text-slate-600'
          }`}>
          <Activity size={14} /> Activités
        </button>
        <button onClick={() => setActiveTab('requests')}
          className={`flex items-center gap-2 py-2.5 px-5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
            activeTab === 'requests' ? 'bg-white text-indigo-600 shadow-lg shadow-indigo-100' : 'text-slate-400 hover:text-slate-600'
          }`}>
          <Monitor size={14} /> Requêtes API
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'activities' ? (
        <ActivitiesTab logs={logs} loading={loading} selectedLog={selectedLog} setSelectedLog={setSelectedLog} />
      ) : (
        <RequestsTab logs={logs} loading={loading} />
      )}

      {/* Pagination */}
      <div className="flex items-center justify-between bg-white rounded-2xl px-6 py-4 border border-slate-100 shadow-sm">
        <p className="text-xs font-bold text-slate-500">Page <span className="text-slate-900">{page}</span> sur {totalPages}</p>
        <div className="flex items-center gap-2">
          <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 disabled:opacity-40 hover:bg-slate-50 transition-colors shadow-sm">
            <ChevronLeft size={18} />
          </button>
          <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)} className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 disabled:opacity-40 hover:bg-slate-50 transition-colors shadow-sm">
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ActivityLogs;
