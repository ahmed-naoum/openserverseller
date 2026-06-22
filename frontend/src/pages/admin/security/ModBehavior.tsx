import { useState, useEffect, useCallback } from 'react';
import { securityApi } from '../../../lib/api';
import toast from 'react-hot-toast';
import { Activity, Clock } from 'lucide-react';
import { useSocket } from '../../../contexts/SocketContext';

const S = 'bg-slate-900 rounded-2xl border border-slate-800 p-5';

export default function ModBehavior() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { socket } = useSocket();

  const load = useCallback(async () => {
    try { const res = await securityApi.overview(); setData(res.data.data); }
    catch { toast.error('Failed to load'); }
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
    socket.on('realtime:active-users', handleUpdate);
    return () => {
      socket.off('security_event', handleUpdate);
      socket.off('security:update', handleUpdate);
      socket.off('realtime:active-users', handleUpdate);
    };
  }, [socket, load]);

  if (loading) return <div className="text-slate-500 text-sm text-center py-20 animate-pulse">Loading behavior analytics...</div>;
  if (!data) return null;

  const activity = data.recentActivity || [];

  return (
    <div className="space-y-6">
      {/* User Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Users', value: data.users?.total || 0 },
          { label: 'Active Users', value: data.users?.active || 0 },
          { label: 'Inactive Users', value: data.users?.inactive || 0 },
          { label: 'Recent Events', value: activity.length },
        ].map((m, i) => (
          <div key={i} className={S + ' text-center'}>
            <p className="text-2xl font-black text-white">{m.value}</p>
            <p className="text-[10px] text-slate-500 font-bold uppercase mt-1">{m.label}</p>
          </div>
        ))}
      </div>

      {/* Activity Timeline */}
      <div className={S + ' space-y-3'}>
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Activity size={16} className="text-pink-400" /> User Activity Timeline
        </h3>
        <div className="max-h-[400px] overflow-y-auto space-y-1">
          {activity.length === 0 ? (
            <p className="text-slate-500 text-xs text-center py-10">No user activity recorded</p>
          ) : activity.map((a: any) => (
            <div key={a.id} className="flex items-start gap-3 py-2.5 border-b border-slate-800/40">
              <div className="w-2 h-2 rounded-full bg-pink-500 mt-1.5 shrink-0"></div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white">{a.user}</span>
                  <span className="text-[10px] text-slate-600 flex items-center gap-1 shrink-0">
                    <Clock size={10} /> {new Date(a.createdAt).toLocaleString()}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5 font-mono truncate">{a.action}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
