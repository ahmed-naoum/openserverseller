import { useState, useEffect, useCallback } from 'react';
import { securityApi } from '../../../lib/api';
import toast from 'react-hot-toast';
import { Lock, Eye, EyeOff } from 'lucide-react';
import { useSocket } from '../../../contexts/SocketContext';

const S = 'bg-slate-900 rounded-2xl border border-slate-800 p-5';

export default function ModAccessControl() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [maskIPs, setMaskIPs] = useState(true);
  const { socket } = useSocket();

  const load = useCallback(async () => {
    try { const res = await securityApi.getAuditLogs(); setLogs(res.data.data || []); }
    catch { toast.error('Failed to load audit logs'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!socket) return;
    const handleUpdate = () => {
      load();
    };
    socket.on('security:update', handleUpdate);
    socket.on('security_event', handleUpdate);
    return () => {
      socket.off('security:update', handleUpdate);
      socket.off('security_event', handleUpdate);
    };
  }, [socket, load]);

  const mask = (val: string) => maskIPs ? val.replace(/\d+\.\d+\.\d+\.\d+/g, '●●●.●●●.●●●.●●●') : val;

  if (loading) return <div className="text-slate-500 text-sm text-center py-20 animate-pulse">Loading audit trail...</div>;

  return (
    <div className="space-y-6">
      <div className={S + ' space-y-4'}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Lock size={16} className="text-violet-400" /> Admin Action Audit Trail
          </h3>
          <button onClick={() => setMaskIPs(!maskIPs)} className="flex items-center gap-1.5 text-[10px] text-slate-400 hover:text-white">
            {maskIPs ? <EyeOff size={12} /> : <Eye size={12} />}
            {maskIPs ? 'Show IPs' : 'Mask IPs'}
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-800 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="pb-3 pr-4">Timestamp</th>
                <th className="pb-3 pr-4">Action</th>
                <th className="pb-3 pr-4">User</th>
                <th className="pb-3 pr-4">IP Address</th>
                <th className="pb-3">Hash</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50 text-xs">
              {logs.length === 0 ? (
                <tr><td colSpan={5} className="py-10 text-center text-slate-500">No audit logs recorded</td></tr>
              ) : logs.map((log: any) => (
                <tr key={log.id} className="hover:bg-slate-800/30">
                  <td className="py-2.5 pr-4 text-slate-400 whitespace-nowrap">{new Date(log.timestamp).toLocaleString()}</td>
                  <td className="py-2.5 pr-4 text-white font-mono max-w-[200px] truncate" title={log.action}>{log.action}</td>
                  <td className="py-2.5 pr-4 text-slate-300">{log.userEmail || '—'}</td>
                  <td className="py-2.5 pr-4 font-mono text-slate-400">{mask(log.ipAddress || log.ip || '')}</td>
                  <td className="py-2.5 text-[9px] text-red-400/60 font-mono max-w-[120px] truncate" title={log.hash}>{log.hash}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
