import { useState, useEffect, useCallback } from 'react';
import { securityApi } from '../../../lib/api';
import toast from 'react-hot-toast';
import { ShieldCheck, Zap, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { useSocket } from '../../../contexts/SocketContext';

const S = 'bg-slate-900 rounded-2xl border border-slate-800 p-5';

export default function ModWaf() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { socket } = useSocket();

  const load = useCallback(async () => {
    try { const res = await securityApi.overview(); setData(res.data.data); }
    catch { toast.error('Failed to load WAF data'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!socket) return;
    const handleUpdate = () => {
      load();
    };
    socket.on('security_event', handleUpdate);
    socket.on('security:update', handleUpdate);
    return () => {
      socket.off('security_event', handleUpdate);
      socket.off('security:update', handleUpdate);
    };
  }, [socket, load]);

  if (loading) return <div className="text-slate-500 text-sm text-center py-20 animate-pulse">Loading WAF status...</div>;
  if (!data) return <div className="text-red-400 text-sm text-center py-20">Failed</div>;

  const checks = data.checks || [];
  const pass = checks.filter((c:any) => c.status === 'PASS').length;
  const warn = checks.filter((c:any) => c.status === 'WARN').length;
  const fail = checks.filter((c:any) => c.status === 'FAIL').length;

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Passing', count: pass, icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
          { label: 'Warnings', count: warn, icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-500/10' },
          { label: 'Failing', count: fail, icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/10' },
        ].map((c, i) => (
          <div key={i} className={S + ' flex items-center gap-4'}>
            <div className={`w-10 h-10 rounded-xl ${c.bg} flex items-center justify-center`}>
              <c.icon size={18} className={c.color} />
            </div>
            <div>
              <p className="text-2xl font-black text-white">{c.count}</p>
              <p className="text-[10px] text-slate-500 font-bold uppercase">{c.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Full checks list */}
      <div className={S + ' space-y-3'}>
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Zap size={16} className="text-amber-400" /> WAF & Security Checks
        </h3>
        <div className="divide-y divide-slate-800">
          {checks.map((c: any) => {
            const StatusIcon = c.status === 'PASS' ? CheckCircle : c.status === 'WARN' ? AlertTriangle : XCircle;
            const statusColor = c.status === 'PASS' ? 'text-emerald-400' : c.status === 'WARN' ? 'text-amber-400' : 'text-red-400';
            return (
              <div key={c.id} className="py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <StatusIcon size={16} className={statusColor} />
                  <div>
                    <p className="text-xs font-semibold text-white">{c.label}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">{c.detail}</p>
                  </div>
                </div>
                <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${
                  c.status === 'PASS' ? 'bg-emerald-500/10 text-emerald-400' :
                  c.status === 'WARN' ? 'bg-amber-500/10 text-amber-400' : 'bg-red-500/10 text-red-400'
                }`}>{c.status}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
