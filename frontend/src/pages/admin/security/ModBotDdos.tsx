import { useState, useEffect, useCallback } from 'react';
import { securityApi } from '../../../lib/api';
import toast from 'react-hot-toast';
import { Ban, Plus, Trash2, Shield, AlertTriangle } from 'lucide-react';
import { useSocket } from '../../../contexts/SocketContext';

const S = 'bg-slate-900 rounded-2xl border border-slate-800 p-5';

export default function ModBotDdos() {
  const [data, setData] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [newIP, setNewIP] = useState('');
  const [newReason, setNewReason] = useState('');
  const [newWhiteIP, setNewWhiteIP] = useState('');
  const [blocking, setBlocking] = useState(false);
  const [bans, setBans] = useState<any[]>([]);
  const { socket } = useSocket();

  const load = useCallback(async () => {
    try {
      const [ov, st, bn] = await Promise.all([
        securityApi.overview(),
        securityApi.getSettings(),
        securityApi.getBannedIPs(),
      ]);
      setData(ov.data.data);
      setSettings(st.data.data);
      setBans(bn.data.data.bans || []);
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!socket) return;
    const handleUpdate = (event: any) => {
      if (event.type === 'blocklist') {
        load();
      }
    };
    socket.on('security:update', handleUpdate);
    return () => {
      socket.off('security:update', handleUpdate);
    };
  }, [socket, load]);

  const blockIP = async () => {
    if (!newIP.trim()) return;
    setBlocking(true);
    try {
      await securityApi.blockIP(newIP.trim(), { reason: newReason.trim() || undefined });
      toast.success(`IP ${newIP} blocked`);
      setNewIP(''); setNewReason(''); load();
    }
    // Surface the server's message: it explains a rejected CIDR or a
    // whitelisted address, which "Block failed" never did.
    catch (e: any) { toast.error(e?.response?.data?.message || 'Block failed'); }
    finally { setBlocking(false); }
  };

  const unblockIP = async (ip: string) => {
    try { await securityApi.unblockIP(ip); toast.success(`IP ${ip} unblocked`); load(); }
    catch { toast.error('Unblock failed'); }
  };

  const saveSettings = async (updated: any) => {
    try { await securityApi.updateSettings(updated); toast.success('Settings saved'); }
    catch { toast.error('Save failed'); }
  };

  const addWhitelistIP = async () => {
    if (!newWhiteIP.trim() || !settings) return;
    const updated = { ...settings, whitelistedIPs: [...(settings.whitelistedIPs||[]), newWhiteIP.trim()] };
    setSettings(updated); setNewWhiteIP(''); saveSettings(updated);
  };

  const removeWhitelistIP = async (ip: string) => {
    if (!settings) return;
    const updated = { ...settings, whitelistedIPs: (settings.whitelistedIPs||[]).filter((x:string)=>x!==ip) };
    setSettings(updated); saveSettings(updated);
  };

  if (loading) return <div className="text-slate-500 text-sm text-center py-20 animate-pulse">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* IP Blocklist */}
        <div className={S + ' space-y-4'}>
          <h3 className="text-sm font-bold text-white flex items-center gap-2"><Ban size={16} className="text-red-500" /> IP Blocklist</h3>

          {/* The list is stored whether or not blocking is switched on, so say
              plainly when nothing is being enforced — that state looked exactly
              like a working blocklist before, and silently let everyone in. */}
          {settings && !settings.enableIPBlocking && (
            <div className="flex items-start gap-2 bg-amber-950/40 border border-amber-800/50 rounded-lg px-3 py-2">
              <AlertTriangle size={13} className="text-amber-500 mt-0.5 flex-shrink-0" />
              <p className="text-[11px] text-amber-300 leading-relaxed">
                IP blocking is <strong>off</strong> — these bans are saved but not enforced.
                Turn on “IP Blocking” below to apply them.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex gap-2">
              <input value={newIP} onChange={e=>setNewIP(e.target.value)} placeholder="41.248.3.9 or 105.66.0.0/16"
                className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-red-500"
                onKeyDown={e=>e.key==='Enter'&&blockIP()} />
              <button onClick={blockIP} disabled={blocking}
                className="px-3 py-2 bg-red-600 hover:bg-red-500 rounded-lg text-xs font-bold text-white disabled:opacity-50">
                <Plus size={14} />
              </button>
            </div>
            <input value={newReason} onChange={e=>setNewReason(e.target.value)} placeholder="Reason (optional)"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-red-500"
              onKeyDown={e=>e.key==='Enter'&&blockIP()} />
          </div>

          <div className="max-h-[250px] overflow-y-auto divide-y divide-slate-800/50">
            {bans.length === 0 ? (
              <p className="text-slate-500 text-xs text-center py-6">No blocked IPs</p>
            ) : bans.map((b: any) => (
              <div key={b.id} className="py-2 flex items-start justify-between text-xs gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-white font-mono">{b.value}</span>
                    {b.isRange && <span className="px-1 py-0.5 rounded bg-slate-800 text-slate-400 text-[9px] font-bold">RANGE</span>}
                    {b.source === 'AUTO' && <span className="px-1 py-0.5 rounded bg-cyan-950 text-cyan-400 text-[9px] font-bold">AUTO</span>}
                    {b.isExpired && <span className="px-1 py-0.5 rounded bg-slate-800 text-slate-500 text-[9px] font-bold">EXPIRED</span>}
                  </div>
                  {b.reason && <p className="text-slate-500 mt-0.5 truncate">{b.reason}</p>}
                  <p className="text-slate-600 text-[10px] mt-0.5">
                    {new Date(b.createdAt).toLocaleDateString()}
                    {b.bannedByEmail ? ` · ${b.bannedByEmail}` : ''}
                    {b.hitCount > 0 ? ` · ${b.hitCount} blocked` : ''}
                  </p>
                </div>
                <button onClick={()=>unblockIP(b.value)} className="text-slate-500 hover:text-red-400 flex-shrink-0 mt-0.5"><Trash2 size={13}/></button>
              </div>
            ))}
          </div>
        </div>

        {/* IP Whitelist */}
        <div className={S + ' space-y-4'}>
          <h3 className="text-sm font-bold text-white flex items-center gap-2"><Shield size={16} className="text-emerald-500" /> IP Whitelist (Trusted)</h3>
          <div className="flex gap-2">
            <input value={newWhiteIP} onChange={e=>setNewWhiteIP(e.target.value)} placeholder="Trusted IP..."
              className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              onKeyDown={e=>e.key==='Enter'&&addWhitelistIP()} />
            <button onClick={addWhitelistIP}
              className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-xs font-bold text-white">
              <Plus size={14} />
            </button>
          </div>
          <div className="max-h-[250px] overflow-y-auto divide-y divide-slate-800/50">
            {(settings?.whitelistedIPs || []).length === 0 ? (
              <p className="text-slate-500 text-xs text-center py-6">No whitelisted IPs</p>
            ) : (settings?.whitelistedIPs || []).map((ip: string) => (
              <div key={ip} className="py-2 flex items-center justify-between text-xs">
                <span className="text-white font-mono">{ip}</span>
                <button onClick={()=>removeWhitelistIP(ip)} className="text-slate-500 hover:text-red-400"><Trash2 size={13}/></button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Rate Limit Settings */}
      {settings && (
        <div className={S + ' space-y-4'}>
          <h3 className="text-sm font-bold text-white">Rate Limit Configuration</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { key: 'globalRateLimitMax', label: 'Global Rate Limit (req/15min)' },
              { key: 'uploadRateLimitMax', label: 'Upload Rate Limit (req/15min)' },
              { key: 'payoutRateLimitMax', label: 'Payout Rate Limit (req/15min)' },
              { key: 'autoBanOrderThreshold', label: 'Auto-ban after N orders / 24h (0 = off)' },
              { key: 'autoBanDurationHours', label: 'Auto-ban duration in hours (0 = forever)' },
            ].map(f => (
              <div key={f.key} className="space-y-1">
                <label className="text-[10px] text-slate-400 font-semibold uppercase">{f.label}</label>
                <input type="number" value={settings[f.key]||0}
                  onChange={e => setSettings({...settings, [f.key]: Number(e.target.value)})}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500" />
              </div>
            ))}
          </div>
          <div className="flex gap-4 pt-2">
            {[
              { key: 'enableIPBlocking', label: 'IP Blocking' },
              { key: 'enableRequestSanitization', label: 'Request Sanitization' },
              { key: 'enableAuditLog', label: 'Audit Logging' },
            ].map(t => (
              <label key={t.key} className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input type="checkbox" checked={settings[t.key]||false}
                  onChange={e => setSettings({...settings, [t.key]: e.target.checked})}
                  className="accent-emerald-500" />
                {t.label}
              </label>
            ))}
          </div>
          <button onClick={()=>saveSettings(settings)}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 rounded-lg text-xs font-bold text-white">
            Save Settings
          </button>
        </div>
      )}

      {/* Active Threats */}
      <div className={S + ' space-y-3'}>
        <h3 className="text-sm font-bold text-white">Active Suspicious IPs (Last Hour)</h3>
        <div className="max-h-[200px] overflow-y-auto divide-y divide-slate-800/50 text-xs">
          {(data?.threats?.active || []).length === 0 ? (
            <p className="text-slate-500 text-center py-6">No active threats detected</p>
          ) : (data?.threats?.active || []).map((t: any) => (
            <div key={t.ip} className="py-2 flex items-center justify-between">
              <div>
                <span className="text-white font-mono">{t.ip}</span>
                <span className="text-slate-500 ml-2">({t.count} hits, type: {t.type})</span>
              </div>
              <button onClick={()=>{securityApi.blockIP(t.ip).then(()=>{toast.success('Blocked');load();})}}
                className="px-2 py-1 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white rounded text-[10px] font-bold">
                Block
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
