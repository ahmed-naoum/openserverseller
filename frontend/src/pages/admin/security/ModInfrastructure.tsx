import { useState, useEffect, useCallback } from 'react';
import { securityApi } from '../../../lib/api';
import toast from 'react-hot-toast';
import { Server, Cpu, ShieldAlert } from 'lucide-react';
import { useSocket } from '../../../contexts/SocketContext';

const S = 'bg-slate-900 rounded-2xl border border-slate-800 p-5';

export default function ModInfrastructure() {
  const [data, setData] = useState<any>(null);
  const [vulns, setVulns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { socket } = useSocket();

  const load = useCallback(async () => {
    try {
      const [ov, vRes] = await Promise.all([securityApi.overview(), securityApi.getVulns()]);
      setData(ov.data.data);
      setVulns(vRes.data.data || []);
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!socket) return;
    const handleUpdate = () => {
      load();
    };
    socket.on('security:update', handleUpdate);
    return () => {
      socket.off('security:update', handleUpdate);
    };
  }, [socket, load]);

  if (loading) return <div className="text-slate-500 text-sm text-center py-20 animate-pulse">Loading infrastructure status...</div>;

  const sys = data?.system || {};

  return (
    <div className="space-y-6">
      {/* System Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Uptime', value: `${Math.round((sys.uptime || 0) / 60)} min` },
          { label: 'Heap Used', value: `${sys.heapUsedMB || 0} MB` },
          { label: 'Free Memory', value: `${sys.freeMemPct || 0}%` },
          { label: 'Node Version', value: `v${sys.nodeVersion || '?'}` },
          { label: 'Platform', value: sys.platform || '?' },
        ].map((m, i) => (
          <div key={i} className={S + ' text-center'}>
            <p className="text-lg font-black text-white">{m.value}</p>
            <p className="text-[10px] text-slate-500 font-bold uppercase mt-1">{m.label}</p>
          </div>
        ))}
      </div>

      {/* Honeypot Status */}
      <div className={S + ' space-y-3'}>
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Server size={16} className="text-blue-400" /> Honeypot Trap Endpoints
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {['/wp-admin', '/phpmyadmin', '/.env', '/admin-old'].map(ep => (
            <div key={ep} className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-center">
              <p className="text-xs font-mono text-emerald-400">{ep}</p>
              <p className="text-[9px] text-slate-500 mt-1">Active • Auto-blocks scanners</p>
            </div>
          ))}
        </div>
      </div>

      {/* CVE Vulnerability Table */}
      <div className={S + ' space-y-3'}>
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <ShieldAlert size={16} className="text-red-400" /> CVE Vulnerability Registry ({vulns.length})
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-800 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="pb-3 pr-4">CVE ID</th>
                <th className="pb-3 pr-4">Package</th>
                <th className="pb-3 pr-4">CVSS</th>
                <th className="pb-3 pr-4">Affected</th>
                <th className="pb-3">Fixed In</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50 text-xs">
              {vulns.length === 0 ? (
                <tr><td colSpan={5} className="py-8 text-center text-slate-500">No vulnerabilities detected</td></tr>
              ) : vulns.map((v: any) => (
                <tr key={v.id} className="hover:bg-slate-800/30">
                  <td className="py-2.5 pr-4 text-red-400 font-bold">{v.cveId}</td>
                  <td className="py-2.5 pr-4 text-white">{v.packageName}</td>
                  <td className="py-2.5 pr-4">
                    <span className={`text-[9px] font-black px-2 py-0.5 rounded ${
                      v.cvssScore >= 9 ? 'bg-red-500/10 text-red-400' : v.cvssScore >= 7 ? 'bg-orange-500/10 text-orange-400' : 'bg-amber-500/10 text-amber-400'
                    }`}>{v.cvssScore}</span>
                  </td>
                  <td className="py-2.5 pr-4 text-slate-400">{v.affectedVersion}</td>
                  <td className="py-2.5 text-emerald-400">{v.fixedVersion}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
