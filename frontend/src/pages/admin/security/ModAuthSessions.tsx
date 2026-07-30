import { useState, useEffect, useCallback } from 'react';
import { securityApi } from '../../../lib/api';
import toast from 'react-hot-toast';
import { Users, ShieldAlert, XCircle, Clock, Ban, CheckSquare, Square, X, Activity } from 'lucide-react';

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

  // Ban Modal State
  const [banTarget, setBanTarget] = useState<any | null>(null);
  const [banOptions, setBanOptions] = useState({
    banIp: true,
    banCurrentPage: true,
    banGlobal: false,
    banAccount: false,
    banUserAgent: false,
  });
  const [submittingBan, setSubmittingBan] = useState(false);

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
    const handleSecurityUpdate = () => {
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
      setTimeout(load, 1000);
    } catch {
      toast.error('Terminate failed for one or more sessions');
    }
  };

  const openBanModal = (session: any) => {
    setBanTarget(session);
    setBanOptions({
      banIp: true,
      banCurrentPage: true,
      banGlobal: false,
      banAccount: session.userUuid ? true : false,
      banUserAgent: false,
    });
  };

  const handleExecuteBan = async () => {
    if (!banTarget) return;
    setSubmittingBan(true);
    try {
      const res = await securityApi.batchBan({
        socketId: banTarget.socketIds[0],
        userUuid: banTarget.userUuid,
        publicIp: banTarget.publicIp || banTarget.ip,
        currentPage: banTarget.currentPage,
        userAgent: banTarget.userAgent,
        options: banOptions,
      });
      toast.success(res.data.message || 'Ban actions executed');
      setBanTarget(null);
      setTimeout(load, 1000);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to execute ban actions');
    } finally {
      setSubmittingBan(false);
    }
  };

  const toggleSelectAllBan = () => {
    const isUserAccount = Boolean(banTarget?.userUuid);
    const allSelected = banOptions.banIp && banOptions.banCurrentPage && banOptions.banGlobal && (isUserAccount ? banOptions.banAccount : true) && banOptions.banUserAgent;
    setBanOptions({
      banIp: !allSelected,
      banCurrentPage: !allSelected,
      banGlobal: !allSelected,
      banAccount: isUserAccount ? !allSelected : false,
      banUserAgent: !allSelected,
    });
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

  // Group sessions by User (email), Public IP, and Current Page
  const groupedSessions = sessions.reduce((acc: any[], current) => {
    const pubIp = current.publicIp || current.ip || '127.0.0.1';
    const locIp = current.localIp || '127.0.0.1 (Localhost)';
    const key = `${current.email}-${pubIp}-${current.currentPage}`;
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
        publicIp: pubIp,
        localIp: locIp,
        ip: pubIp,
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
                <th className="pb-3 pr-4">Public IP</th>
                <th className="pb-3 pr-4">Private IP</th>
                <th className="pb-3 pr-4">Role</th>
                <th className="pb-3 pr-4">User Agent</th>
                <th className="pb-3 pr-4">Current Page</th>
                <th className="pb-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50 text-xs">
              {groupedSessions.length === 0 ? (
                <tr><td colSpan={7} className="py-10 text-center text-slate-500">No active sessions</td></tr>
              ) : groupedSessions.map((s: any) => {
                const isBlocked = blockedSessions.some(b => {
                  const idMatch = s.userUuid ? b.key.startsWith(`${s.userUuid}-`) : b.key.startsWith(`${s.publicIp}-`);
                  if (!idMatch) return false;
                  return b.path === '*' || b.path === s.currentPage;
                });

                return (
                <tr key={s.key} className="hover:bg-slate-800/30">
                  <td className="py-3 pr-4">
                    <p className="font-semibold text-white">{s.fullName || 'Anonymous'}</p>
                    <p className="text-[10px] text-slate-500">{s.email}</p>
                  </td>
                  <td className="py-3 pr-4 font-mono text-cyan-400 font-medium">{s.publicIp}</td>
                  <td className="py-3 pr-4 font-mono text-slate-400 text-[11px]">{s.localIp}</td>
                  <td className="py-3 pr-4">
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300">{s.role}</span>
                  </td>
                  <td className="py-3 pr-4 text-slate-400 max-w-[160px] truncate" title={s.userAgent}>{s.userAgent}</td>
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
                        <button onClick={() => openBanModal(s)}
                          className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-[10px] font-bold transition-all flex items-center gap-1"
                          title="Open Ban options (IP, Page, User Account, User-Agent)">
                          <Ban size={12} /> Ban Options
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

      {/* Ban Options Modal */}
      {banTarget && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl relative space-y-5 animate-in fade-in zoom-in-95">
            <button 
              onClick={() => setBanTarget(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-3">
              <div className="p-3 bg-rose-500/10 text-rose-500 rounded-xl">
                <ShieldAlert size={24} />
              </div>
              <div>
                <h4 className="text-base font-bold text-white">Execute Security Ban</h4>
                <p className="text-xs text-slate-400">Target: <span className="text-white font-semibold">{banTarget.fullName}</span> ({banTarget.email})</p>
              </div>
            </div>

            <div className="bg-slate-950/60 rounded-xl p-3.5 border border-slate-800/80 space-y-1 text-xs font-mono">
              <p className="text-slate-400"><span className="text-slate-500">Public IP:</span> <span className="text-cyan-400 font-bold">{banTarget.publicIp}</span></p>
              <p className="text-slate-400"><span className="text-slate-500">Private IP:</span> <span className="text-slate-300">{banTarget.localIp}</span></p>
              <p className="text-slate-400 truncate" title={banTarget.currentPage}><span className="text-slate-500">Current Page:</span> <span className="text-amber-400">{banTarget.currentPage}</span></p>
              <p className="text-slate-400 truncate" title={banTarget.userAgent}><span className="text-slate-500">User Agent:</span> <span className="text-slate-300">{banTarget.userAgent}</span></p>
            </div>

            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Select Ban Actions</span>
                <button 
                  onClick={toggleSelectAllBan}
                  className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold transition-colors"
                >
                  {banOptions.banIp && banOptions.banCurrentPage && banOptions.banGlobal && (banTarget.userUuid ? banOptions.banAccount : true) && banOptions.banUserAgent ? 'Deselect All' : 'Select All'}
                </button>
              </div>

              <div className="space-y-2">
                {[
                  { key: 'banIp', label: `Ban IP Address (${banTarget.publicIp})`, desc: 'Blocks all incoming HTTP/WS traffic from this IP in Firewall' },
                  { key: 'banCurrentPage', label: `Ban Current Page (${banTarget.currentPage})`, desc: 'Terminates & locks session on this specific path' },
                  { key: 'banGlobal', label: 'Ban Global (All Pages)', desc: 'Terminates & locks socket across all application routes' },
                  { 
                    key: 'banAccount', 
                    label: banTarget.userUuid ? 'Ban User Account (Deactivate Account)' : 'Ban User Account (Guest / Anonymous)', 
                    desc: banTarget.userUuid ? 'Sets user.isActive = false to prevent future logins' : 'Not available for anonymous guests',
                    disabled: !banTarget.userUuid
                  },
                  { key: 'banUserAgent', label: 'Ban User-Agent', desc: 'Blocks all requests matching this specific browser User-Agent' },
                ].map((opt) => {
                  const isChecked = (banOptions as any)[opt.key];
                  return (
                    <label 
                      key={opt.key}
                      className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                        opt.disabled 
                          ? 'opacity-40 border-slate-800 bg-slate-950 cursor-not-allowed'
                          : isChecked 
                            ? 'bg-rose-500/10 border-rose-500/40 text-white' 
                            : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <input 
                        type="checkbox"
                        disabled={opt.disabled}
                        checked={isChecked}
                        onChange={(e) => setBanOptions(prev => ({ ...prev, [opt.key]: e.target.checked }))}
                        className="sr-only"
                      />
                      <div className="mt-0.5 text-rose-400">
                        {isChecked ? <CheckSquare size={16} /> : <Square size={16} />}
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-bold">{opt.label}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">{opt.desc}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setBanTarget(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submittingBan}
                onClick={handleExecuteBan}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-lg shadow-rose-600/20"
              >
                <Ban size={14} />
                {submittingBan ? 'Executing...' : 'Execute Ban Actions'}
              </button>
            </div>
          </div>
        </div>
      )}

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
                <th className="pb-3 pr-4">User / Target</th>
                <th className="pb-3 pr-4 font-mono">Blocked Path</th>
                <th className="pb-3 pr-4">Timestamp</th>
                <th className="pb-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50 text-xs">
              {blockedSessions.length === 0 ? (
                <tr><td colSpan={4} className="py-10 text-center text-slate-500">No terminated session blocks</td></tr>
              ) : blockedSessions.map((b: any) => (
                <tr key={b.key} className="hover:bg-slate-800/30">
                  <td className="py-3 pr-4">
                    <p className="font-semibold text-white">{b.email || 'Guest'}</p>
                    <p className="text-[10px] font-mono text-slate-500">{b.ip}</p>
                  </td>
                  <td className="py-3 pr-4 font-mono text-rose-400 font-semibold">{b.path}</td>
                  <td className="py-3 pr-4 text-slate-400">{new Date(b.timestamp).toLocaleString()}</td>
                  <td className="py-3 text-right">
                    <button 
                      onClick={() => unblockSession(b.key)}
                      className="px-2.5 py-1 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-white rounded text-[10px] font-bold transition-all"
                    >
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

