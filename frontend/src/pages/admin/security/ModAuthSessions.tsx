import { useState, useEffect, useCallback } from 'react';
import { securityApi } from '../../../lib/api';
import toast from 'react-hot-toast';
import { Users, Wifi, XCircle, Activity, Clock } from 'lucide-react';

import { useSocket } from '../../../contexts/SocketContext';

const S = 'bg-slate-900 rounded-2xl border border-slate-800 p-5';

const UptimeTimer = ({ connectedAt }: { connectedAt: number }) => {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const int = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(int);
  }, []);

  if (!connectedAt) return <span>Just now</span>;

  const diff = Math.max(0, Math.floor((now - connectedAt) / 1000));
  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  const s = diff % 60;

  if (h > 0) return <span className="font-mono">{h}h {m}m {s}s</span>;
  if (m > 0) return <span className="font-mono">{m}m {s}s</span>;
  return <span className="font-mono">{s}s</span>;
};

export default function ModAuthSessions() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [blockedSessions, setBlockedSessions] = useState<any[]>([]);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { socket } = useSocket();

  const load = useCallback(async () => {
    try { 
      const [sessRes, blocksRes, overviewRes] = await Promise.all([
        securityApi.getSessions(),
        securityApi.getBlockedSessions(),
        securityApi.overview()
      ]);
      setSessions(sessRes.data.data || []); 
      setBlockedSessions(blocksRes.data.data || []);
      setData(overviewRes.data.data);
    }
    catch { toast.error('Failed to load sessions'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!socket) return;
    const handleActiveUsers = () => { load(); };
    const handleSecurityUpdate = (event: any) => {
      load();
    };
    socket.on('realtime:active-users', handleActiveUsers);
    socket.on('security_event', handleSecurityUpdate);
    socket.on('security:update', handleSecurityUpdate);
    return () => {
      socket.off('realtime:active-users', handleActiveUsers);
      socket.off('security_event', handleSecurityUpdate);
      socket.off('security:update', handleSecurityUpdate);
    };
  }, [socket, load]);

  const terminateGroup = async (socketIds: string[]) => {
    try {
      await Promise.all(socketIds.map(id => securityApi.terminateSession(id)));
      toast.success(`Terminated ${socketIds.length} session(s)`);
      setTimeout(load, 1000); // Wait a second for socket events to settle
    } catch {
      toast.error('Terminate failed for one or more sessions');
    }
  };

  const unblockSession = async (key: string) => {
    try {
      await securityApi.unblockSession(key);
      toast.success('Block removed successfully');
      load();
    } catch {
      toast.error('Failed to remove block');
    }
  };

  const unblockAllSessions = async () => {
    try {
      await securityApi.unblockAllSessions();
      toast.success('All blocks removed successfully');
      load();
    } catch {
      toast.error('Failed to remove all blocks');
    }
  };

  if (loading) return <div className="text-slate-500 text-sm text-center py-20 animate-pulse">Loading sessions and behavior...</div>;

  // Group sessions by User (email), IP, and Current Page
  const groupedSessions = sessions.reduce((acc: any[], current) => {
    const key = `${current.email}-${current.ip}-${current.currentPage}`;
    const existing = acc.find(item => item.key === key);
    if (existing) {
      existing.socketIds.push(current.socketId);
      existing.connectedAt = Math.min(existing.connectedAt, current.connectedAt);
    } else {
      acc.push({
        key,
        socketIds: [current.socketId],
        email: current.email,
        fullName: current.fullName,
        ip: current.ip,
        role: current.role,
        userAgent: current.userAgent,
        currentPage: current.currentPage,
        userUuid: current.userUuid,
        connectedAt: current.connectedAt,
      });
    }
    return acc;
  }, []);

  const activity = data?.recentActivity || [];

  return (
    <div className="space-y-6">
      {/* User Stats merged from ModBehavior */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Users', value: data?.users?.total || 0 },
          { label: 'Active Users', value: data?.users?.active || 0 },
          { label: 'Inactive Users', value: data?.users?.inactive || 0 },
          { label: 'Recent Events', value: activity.length },
        ].map((m, i) => (
          <div key={i} className={S + ' text-center'}>
            <p className="text-2xl font-black text-white">{m.value}</p>
            <p className="text-[10px] text-slate-500 font-bold uppercase mt-1">{m.label}</p>
          </div>
        ))}
      </div>

      <div className={S}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Users size={16} className="text-cyan-400" /> Active Sessions ({sessions.length} sockets, {groupedSessions.length} unique)
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-800 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="pb-3 pr-4">User</th>
                <th className="pb-3 pr-4">IP Address</th>
                <th className="pb-3 pr-4">Role</th>
                <th className="pb-3 pr-4">User Agent</th>
                <th className="pb-3 pr-4">Current Page</th>
                <th className="pb-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50 text-xs">
              {groupedSessions.length === 0 ? (
                <tr><td colSpan={6} className="py-10 text-center text-slate-500">No active sessions</td></tr>
              ) : groupedSessions.map((s: any) => {
                const isBlocked = blockedSessions.some(b => {
                  const idMatch = s.userUuid ? b.key.startsWith(`${s.userUuid}-`) : b.key.startsWith(`${s.ip}-`);
                  if (!idMatch) return false;
                  return b.path === '*' || b.path === s.currentPage;
                });

                return (
                <tr key={s.key} className="hover:bg-slate-800/30">
                  <td className="py-3 pr-4">
                    <p className="font-semibold text-white">{s.fullName || 'Anonymous'}</p>
                    <p className="text-[10px] text-slate-500">{s.email}</p>
                  </td>
                  <td className="py-3 pr-4 font-mono text-slate-300">{s.ip}</td>
                  <td className="py-3 pr-4">
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300">{s.role}</span>
                  </td>
                  <td className="py-3 pr-4 text-slate-400 max-w-[180px] truncate" title={s.userAgent}>{s.userAgent}</td>
                  <td className="py-3 pr-4 text-slate-400">
                    <div>{s.currentPage || '—'}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-emerald-500/70 font-semibold flex items-center gap-1">
                        <Clock size={10} /> <UptimeTimer connectedAt={s.connectedAt} />
                      </span>
                      {s.socketIds.length > 1 && (
                        <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded-full">
                          {s.socketIds.length} tabs
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 text-right">
                    {isBlocked ? (
                      <span className="px-2.5 py-1 bg-slate-800 text-slate-500 rounded text-[10px] font-bold">
                        Blocked
                      </span>
                    ) : (
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => terminateGroup(s.socketIds)}
                          className="px-2.5 py-1 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white rounded text-[10px] font-bold transition-all">
                          Terminate
                        </button>
                        <button onClick={async () => {
                          try {
                            await securityApi.blockGlobalSession(s.socketIds[0]);
                            toast.success('Globally blocked user');
                            setTimeout(load, 1000);
                          } catch {
                            toast.error('Failed to globally block user');
                          }
                        }}
                          className="px-2.5 py-1 bg-purple-500/10 text-purple-400 hover:bg-purple-500 hover:text-white rounded text-[10px] font-bold transition-all"
                          title="Block this user from ALL pages">
                          Block Global
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className={S}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <XCircle size={16} className="text-red-400" /> Terminated Sessions (Page Blocks)
          </h3>
          {blockedSessions.length > 0 && (
            <button 
              onClick={unblockAllSessions}
              className="px-3 py-1.5 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-white rounded text-[11px] font-bold transition-all"
            >
              Unblock All
            </button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-800 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="pb-3 pr-4">User</th>
                <th className="pb-3 pr-4">IP Address</th>
                <th className="pb-3 pr-4">Blocked Page</th>
                <th className="pb-3 pr-4">Time</th>
                <th className="pb-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50 text-xs">
              {blockedSessions.length === 0 ? (
                <tr><td colSpan={5} className="py-10 text-center text-slate-500">No active page blocks</td></tr>
              ) : blockedSessions.map((b: any) => (
                <tr key={b.key} className="hover:bg-slate-800/30">
                  <td className="py-3 pr-4">
                    <p className="font-semibold text-white">{b.email || 'Anonymous'}</p>
                  </td>
                  <td className="py-3 pr-4 font-mono text-slate-300">{b.ip}</td>
                  <td className="py-3 pr-4 text-slate-400 font-mono text-[10px]">{b.path}</td>
                  <td className="py-3 pr-4 text-slate-500">{new Date(b.timestamp).toLocaleTimeString()}</td>
                  <td className="py-3 text-right">
                    <button onClick={() => unblockSession(b.key)}
                      className="px-2.5 py-1 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-white rounded text-[10px] font-bold transition-all">
                      Unblock
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Activity Timeline merged from ModBehavior */}
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

