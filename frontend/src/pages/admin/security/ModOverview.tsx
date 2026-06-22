import { useState, useEffect, useCallback } from 'react';
import { securityApi } from '../../../lib/api';
import { useSocket } from '../../../contexts/SocketContext';
import toast from 'react-hot-toast';
import { ShieldCheck, ShieldAlert, AlertTriangle, Ban, Cpu, Users, Activity, CheckCircle, XCircle, Clock } from 'lucide-react';

const S = 'bg-slate-900 rounded-2xl border border-slate-800 p-5'; // card style

export default function ModOverview() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { socket } = useSocket();

  const load = useCallback(async () => {
    try {
      const res = await securityApi.overview();
      setData(res.data.data);
    } catch { toast.error('Failed to load overview'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Live threat feed via websocket
  useEffect(() => {
    if (!socket) return;
    const handler = (event: any) => {
      setData((prev: any) => {
        if (!prev) return prev;
        return {
          ...prev,
          recentActivity: [
            { id: Math.random().toString(), action: `${event.eventType}: ${event.details || event.action}`, user: event.userEmail || 'System', createdAt: new Date().toISOString() },
            ...(prev.recentActivity || [])
          ].slice(0, 50)
        };
      });
      load();
    };
    const handleSecurityUpdate = () => {
      load();
    };
    socket.on('security_event', handler);
    socket.on('security:update', handleSecurityUpdate);
    socket.on('realtime:active-users', handleSecurityUpdate);
    return () => {
      socket.off('security_event', handler);
      socket.off('security:update', handleSecurityUpdate);
      socket.off('realtime:active-users', handleSecurityUpdate);
    };
  }, [socket, load]);

  if (loading) return <div className="text-slate-500 text-sm text-center py-20 animate-pulse">Loading threat intelligence...</div>;
  if (!data) return <div className="text-red-400 text-sm text-center py-20">Failed to connect</div>;

  const score = data.score ?? 100;
  const sc = (s: number) => s >= 90 ? '#10b981' : s >= 70 ? '#f59e0b' : '#ef4444';

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {[
          { label: 'Security Score', value: `${score}/100`, icon: ShieldCheck, color: sc(score) },
          { label: 'Active Threats', value: data.threats?.active?.length || 0, icon: AlertTriangle, color: '#f59e0b' },
          { label: 'Blocked IPs', value: data.threats?.blockedIPs?.length || 0, icon: Ban, color: '#ef4444' },
          { label: 'Heap Used', value: `${data.system?.heapUsedMB || 0} MB`, icon: Cpu, color: '#6366f1' },
          { label: 'Free Memory', value: `${data.system?.freeMemPct || 0}%`, icon: Cpu, color: '#06b6d4' },
          { label: 'Total Users', value: data.users?.total || 0, icon: Users, color: '#8b5cf6' },
        ].map((kpi, i) => (
          <div key={i} className={S + ' flex flex-col justify-between'}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{kpi.label}</span>
              <kpi.icon size={14} style={{ color: kpi.color }} />
            </div>
            <span className="text-2xl font-black text-white">{kpi.value}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Security Score Gauge */}
        <div className={S + ' lg:col-span-2 flex flex-col items-center justify-center'}>
          <div className="relative w-36 h-36">
            <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
              <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
              <circle cx="50" cy="50" r="42" fill="none" stroke={sc(score)} strokeWidth="8" strokeLinecap="round"
                strokeDasharray={`${2*Math.PI*42}`} strokeDashoffset={`${2*Math.PI*42*(1-score/100)}`}
                style={{ transition: 'stroke-dashoffset 1s ease' }} />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center flex-col">
              <span className="text-4xl font-black text-white">{score}</span>
              <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">/ 100</span>
            </div>
          </div>
          <p className="mt-3 text-xs font-bold" style={{ color: sc(score) }}>
            {score >= 90 ? 'Excellent' : score >= 70 ? 'Moderate' : 'Critical'}
          </p>
        </div>

        {/* Security Checks */}
        <div className={S + ' lg:col-span-3 space-y-3'}>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <ShieldCheck size={16} className="text-emerald-500" /> Security Checks
          </h3>
          <div className="divide-y divide-slate-800 max-h-[280px] overflow-y-auto">
            {(data.checks || []).map((c: any) => (
              <div key={c.id} className="py-2.5 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-white">{c.label}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">{c.detail}</p>
                </div>
                <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${
                  c.status === 'PASS' ? 'bg-emerald-500/10 text-emerald-400' :
                  c.status === 'WARN' ? 'bg-amber-500/10 text-amber-400' : 'bg-red-500/10 text-red-400'
                }`}>{c.status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Live Threat Feed */}
      <div className={S + ' space-y-3'}>
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Activity size={16} className="text-red-500 animate-pulse" /> Live Threat Feed
          <span className="text-[9px] text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded font-bold ml-auto">REALTIME</span>
        </h3>
        <div className="max-h-[300px] overflow-y-auto divide-y divide-slate-800/50 text-xs">
          {(data.recentActivity || []).length === 0 ? (
            <p className="text-slate-500 text-center py-8">No events recorded</p>
          ) : (
            (data.recentActivity || []).map((a: any) => (
              <div key={a.id} className="py-2.5 flex items-center justify-between">
                <div>
                  <span className="text-slate-400">{a.user}</span>
                  <span className="text-slate-600 mx-1.5">—</span>
                  <span className="text-slate-300 font-mono">{a.action}</span>
                </div>
                <span className="text-[10px] text-slate-600 shrink-0 ml-4">{new Date(a.createdAt).toLocaleTimeString()}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
