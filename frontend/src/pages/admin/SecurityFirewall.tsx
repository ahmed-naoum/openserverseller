import { useState, useEffect, useCallback } from 'react';
import { securityApi } from '../../lib/api';
import toast from 'react-hot-toast';
import {
  Shield, ShieldAlert, ShieldCheck, ShieldX, Wifi, WifiOff,
  AlertTriangle, CheckCircle, XCircle, Clock, Cpu, MemoryStick,
  Users, Lock, Ban, Trash2, RefreshCw, ChevronRight, Eye,
  Activity, Server, Globe, Zap, Info
} from 'lucide-react';

interface SecurityCheck {
  id: string;
  label: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  detail: string;
}
interface ThreatEntry { ip: string; count: number; firstSeen: number; lastSeen: number; type: string; }
interface ActivityEntry { id: any; action: string; user: string; createdAt: string; changes: any; }
interface SystemInfo { uptime: number; heapUsedMB: number; freeMemPct: number; nodeVersion: string; platform: string; }

interface SecuritySettingsState {
  enableIPBlocking: boolean;
  enableAuditLog: boolean;
  enableRequestSanitization: boolean;
  blockedIPs: string[];
  whitelistedIPs: string[];
  globalRateLimitMax: number;
  uploadRateLimitMax: number;
  payoutRateLimitMax: number;
}

export default function SecurityFirewall() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'overview' | 'threats' | 'activity' | 'settings' | 'tools'>('overview');
  const [blockIP, setBlockIP] = useState('');
  const [blocking, setBlocking] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Settings states
  const [settings, setSettings] = useState<SecuritySettingsState>({
    enableIPBlocking: false,
    enableAuditLog: false,
    enableRequestSanitization: false,
    blockedIPs: [],
    whitelistedIPs: [],
    globalRateLimitMax: 100,
    uploadRateLimitMax: 10,
    payoutRateLimitMax: 5,
  });
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [newBlockedIp, setNewBlockedIp] = useState('');
  const [newWhitelistedIp, setNewWhitelistedIp] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await securityApi.overview();
      setData(res.data.data);
    } catch {
      toast.error('Impossible de charger les données de sécurité');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const loadSettings = async () => {
    setSettingsLoading(true);
    try {
      const res = await securityApi.getSettings();
      if (res.data.status === 'success') {
        setSettings(res.data.data);
      }
    } catch {
      toast.error('Impossible de charger les paramètres de sécurité');
    } finally {
      setSettingsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (tab === 'settings') {
      loadSettings();
    }
  }, [tab]);

  const handleRefresh = () => {
    setRefreshing(true);
    load();
    if (tab === 'settings') {
      loadSettings();
    }
  };

  const handleBlock = async (ip: string) => {
    if (!ip.trim()) return;
    setBlocking(true);
    try {
      await securityApi.blockIP(ip.trim());
      toast.success(`IP ${ip} bloquée`);
      setBlockIP('');
      load();
      if (tab === 'settings') {
        loadSettings();
      }
    } catch {
      toast.error('Erreur lors du blocage');
    } finally {
      setBlocking(false);
    }
  };

  const handleUnblock = async (ip: string) => {
    try {
      await securityApi.unblockIP(ip);
      toast.success(`IP ${ip} débloquée`);
      load();
      if (tab === 'settings') {
        loadSettings();
      }
    } catch {
      toast.error('Erreur lors du déblocage');
    }
  };

  const handleClearThreat = async (ip?: string) => {
    try {
      await securityApi.clearThreat(ip);
      toast.success(ip ? `Menace ${ip} effacée` : 'Toutes les menaces effacées');
      load();
    } catch {
      toast.error('Erreur');
    }
  };

  const handleSaveSettings = async (updatedSettings = settings) => {
    setSettingsLoading(true);
    try {
      await securityApi.updateSettings(updatedSettings);
      toast.success('Paramètres de sécurité mis à jour');
      load(); // refresh main stats in case IPs or states change
    } catch {
      toast.error('Erreur lors de la mise à jour des paramètres');
    } finally {
      setSettingsLoading(false);
    }
  };

  const addBlockedIp = (ip: string) => {
    const clean = ip.trim();
    if (!clean) return;
    if (settings.blockedIPs.includes(clean)) {
      toast.error('IP déjà dans la liste noire');
      return;
    }
    const updated = {
      ...settings,
      blockedIPs: [...settings.blockedIPs, clean]
    };
    setSettings(updated);
    setNewBlockedIp('');
    handleSaveSettings(updated);
  };

  const removeBlockedIp = (ip: string) => {
    const updated = {
      ...settings,
      blockedIPs: settings.blockedIPs.filter(x => x !== ip)
    };
    setSettings(updated);
    handleSaveSettings(updated);
  };

  const addWhitelistedIp = (ip: string) => {
    const clean = ip.trim();
    if (!clean) return;
    if (settings.whitelistedIPs.includes(clean)) {
      toast.error('IP déjà dans la liste blanche');
      return;
    }
    const updated = {
      ...settings,
      whitelistedIPs: [...settings.whitelistedIPs, clean]
    };
    setSettings(updated);
    setNewWhitelistedIp('');
    handleSaveSettings(updated);
  };

  const removeWhitelistedIp = (ip: string) => {
    const updated = {
      ...settings,
      whitelistedIPs: settings.whitelistedIPs.filter(x => x !== ip)
    };
    setSettings(updated);
    handleSaveSettings(updated);
  };

  const scoreColor = (s: number) => s >= 80 ? '#10b981' : s >= 60 ? '#f59e0b' : '#ef4444';
  const scoreLabel = (s: number) => s >= 80 ? 'Sécurisé' : s >= 60 ? 'Acceptable' : 'Critique';

  const statusIcon = (s: string) => {
    if (s === 'PASS') return <CheckCircle size={15} className="text-emerald-400" />;
    if (s === 'FAIL') return <XCircle size={15} className="text-red-400" />;
    return <AlertTriangle size={15} className="text-amber-400" />;
  };

  const statusBg = (s: string) => {
    if (s === 'PASS') return 'rgba(16,185,129,0.08)';
    if (s === 'FAIL') return 'rgba(239,68,68,0.08)';
    return 'rgba(245,158,11,0.08)';
  };
  const statusBorder = (s: string) => {
    if (s === 'PASS') return '1px solid rgba(16,185,129,0.2)';
    if (s === 'FAIL') return '1px solid rgba(239,68,68,0.2)';
    return '1px solid rgba(245,158,11,0.2)';
  };

  const formatUptime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return `${h}h ${m}m`;
  };

  const tabs = [
    { id: 'overview', label: 'Vue générale', icon: Shield },
    { id: 'threats', label: 'Menaces', icon: ShieldAlert },
    { id: 'activity', label: 'Activité', icon: Activity },
    { id: 'settings', label: 'Configuration', icon: Lock },
    { id: 'tools', label: 'Vulnérabilités', icon: Info },
  ] as const;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-primary-500/20 border-t-primary-500 rounded-full animate-spin" />
      </div>
    );
  }

  const score: number = data?.score || 0;
  const checks: SecurityCheck[] = data?.checks || [];
  const threats = data?.threats || {};
  const system: SystemInfo = data?.system || {};
  const users = data?.users || {};
  const activity: ActivityEntry[] = data?.recentActivity || [];

  return (
    <div className="space-y-6 p-1 font-['Inter']">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500/10 to-orange-500/10 border border-red-200/50 flex items-center justify-center">
              <Shield size={20} className="text-red-500" />
            </div>
            Firewall & Sécurité
          </h1>
          <p className="text-slate-500 text-sm mt-1">Surveillance en temps réel • Analyse des vulnérabilités</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-700 font-semibold text-sm transition-all disabled:opacity-50"
        >
          <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
          Actualiser
        </button>
      </div>

      {/* Score Card */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Security Score */}
        <div className="md:col-span-1 bg-white rounded-2xl border border-slate-100 shadow-sm p-6 flex flex-col items-center justify-center text-center">
          <div className="relative w-28 h-28">
            <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
              <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth="8" />
              <circle
                cx="50" cy="50" r="42" fill="none"
                stroke={scoreColor(score)} strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 42}`}
                strokeDashoffset={`${2 * Math.PI * 42 * (1 - score / 100)}`}
                style={{ transition: 'stroke-dashoffset 1s ease' }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center rotate-90 flex-col">
              <span className="text-3xl font-black" style={{ color: scoreColor(score) }}>{score}</span>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">/ 100</span>
            </div>
          </div>
          <p className="mt-3 font-black text-lg" style={{ color: scoreColor(score) }}>{scoreLabel(score)}</p>
          <p className="text-xs text-slate-400 mt-1">Score de sécurité</p>
        </div>

        {/* Quick Stats */}
        {[
          { label: 'Menaces actives', value: threats.active?.length || 0, icon: ShieldX, color: '#ef4444', bg: 'rgba(239,68,68,0.06)' },
          { label: 'IP bloquées', value: threats.blockedIPs?.length || 0, icon: Ban, color: '#f59e0b', bg: 'rgba(245,158,11,0.06)' },
          { label: 'Utilisateurs actifs', value: users.active || 0, icon: Users, color: '#6366f1', bg: 'rgba(99,102,241,0.06)' },
        ].map(stat => (
          <div key={stat.label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-semibold text-slate-500">{stat.label}</p>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: stat.bg }}>
                <stat.icon size={18} style={{ color: stat.color }} />
              </div>
            </div>
            <p className="text-4xl font-black text-slate-800">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* System Info Bar */}
      <div className="bg-slate-900 rounded-2xl p-4 flex flex-wrap gap-6 text-sm font-mono">
        {[
          { label: 'Uptime', value: formatUptime(system.uptime || 0), icon: Clock },
          { label: 'RAM Heap', value: `${system.heapUsedMB || 0} MB`, icon: MemoryStick },
          { label: 'Mémoire libre', value: `${system.freeMemPct || 0}%`, icon: Cpu },
          { label: 'Node.js', value: system.nodeVersion || 'N/A', icon: Server },
          { label: 'Plateforme', value: system.platform || 'N/A', icon: Globe },
        ].map(s => (
          <div key={s.label} className="flex items-center gap-2 text-slate-400">
            <s.icon size={14} className="text-slate-600" />
            <span className="text-slate-500">{s.label}:</span>
            <span className="text-green-400 font-bold">{s.value}</span>
          </div>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-green-400 text-xs font-bold">ONLINE</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
              tab === t.id ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <t.icon size={14} />
            {t.label}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ── */}
      {tab === 'overview' && (
        <div className="space-y-3">
          <h2 className="text-sm font-black text-slate-500 uppercase tracking-wider">Vérifications de sécurité ({checks.filter(c => c.status === 'PASS').length}/{checks.length} réussies)</h2>
          {checks.map(check => (
            <div
              key={check.id}
              className="flex items-start gap-4 p-4 rounded-2xl"
              style={{ background: statusBg(check.status), border: statusBorder(check.status) }}
            >
              <div className="mt-0.5">{statusIcon(check.status)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-bold text-slate-800 text-sm">{check.label}</p>
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                    check.status === 'PASS' ? 'bg-emerald-100 text-emerald-700' :
                    check.status === 'FAIL' ? 'bg-red-100 text-red-700' :
                    'bg-amber-100 text-amber-700'
                  }`}>
                    {check.status === 'PASS' ? '✓ OK' : check.status === 'FAIL' ? '✗ FAIL' : '⚠ WARN'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">{check.detail}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── THREATS TAB ── */}
      {tab === 'threats' && (
        <div className="space-y-6">
          {/* Brute force */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-black text-slate-500 uppercase tracking-wider flex items-center gap-2">
                <ShieldX size={14} className="text-red-500" />
                Tentatives de brute force ({threats.active?.length || 0})
              </h2>
              {(threats.active?.length || 0) > 0 && (
                <button onClick={() => handleClearThreat()} className="text-xs text-slate-400 hover:text-red-500 font-bold transition-colors">
                  Tout effacer
                </button>
              )}
            </div>
            {(threats.active?.length || 0) === 0 ? (
              <div className="text-center py-10 bg-emerald-50 rounded-2xl border border-emerald-100">
                <ShieldCheck size={32} className="text-emerald-400 mx-auto mb-2" />
                <p className="text-emerald-700 font-bold text-sm">Aucune tentative de brute force détectée</p>
              </div>
            ) : (
              <div className="space-y-2">
                {threats.active.map((t: ThreatEntry) => (
                  <div key={t.ip} className="flex items-center gap-4 p-4 bg-red-50 border border-red-100 rounded-2xl">
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    <div className="flex-1">
                      <p className="font-black text-slate-800 font-mono text-sm">{t.ip}</p>
                      <p className="text-xs text-slate-400">{t.count} tentatives • Dernière: {new Date(t.lastSeen).toLocaleTimeString('fr-FR')}</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleBlock(t.ip)} className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1">
                        <Ban size={11} /> Bloquer
                      </button>
                      <button onClick={() => handleClearThreat(t.ip)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg transition-all">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Blocked IPs */}
          <div>
            <h2 className="text-sm font-black text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Ban size={14} className="text-amber-500" />
              IPs bloquées ({threats.blockedIPs?.length || 0})
            </h2>
            {(threats.blockedIPs?.length || 0) === 0 ? (
              <div className="text-center py-8 bg-slate-50 rounded-2xl border border-slate-100">
                <p className="text-slate-400 text-sm">Aucune IP bloquée</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {threats.blockedIPs.map((ip: string) => (
                  <div key={ip} className="flex items-center justify-between p-3 bg-amber-50 border border-amber-100 rounded-xl">
                    <div className="flex items-center gap-3">
                      <WifiOff size={14} className="text-amber-500" />
                      <span className="font-mono text-sm font-bold text-slate-700">{ip}</span>
                    </div>
                    <button onClick={() => handleUnblock(ip)} className="text-xs text-slate-400 hover:text-emerald-600 font-bold transition-colors flex items-center gap-1">
                      <Wifi size={11} /> Débloquer
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── ACTIVITY TAB ── */}
      {tab === 'activity' && (
        <div className="space-y-2">
          <h2 className="text-sm font-black text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Activity size={14} className="text-primary-500" />
            Activité récente (50 dernières actions)
          </h2>
          {activity.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 rounded-2xl border border-slate-100">
              <p className="text-slate-400 text-sm">Aucune activité enregistrée</p>
              <p className="text-slate-300 text-xs mt-1">Activez SECURITY_ENABLE_AUDIT_LOG=true dans .env</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
              {activity.map((a, i) => {
                const sc = a.changes?.statusCode;
                const isError = sc && sc >= 400;
                return (
                  <div key={i} className="flex items-start gap-3 p-3 bg-white border border-slate-100 rounded-xl hover:border-slate-200 transition-all">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${isError ? 'bg-red-50' : 'bg-emerald-50'}`}>
                      {isError ? <AlertTriangle size={13} className="text-red-400" /> : <CheckCircle size={13} className="text-emerald-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs text-slate-600 bg-slate-100 px-2 py-0.5 rounded">{a.action}</span>
                        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${isError ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>{sc || '?'}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-slate-400">{a.user}</span>
                        <span className="text-[10px] text-slate-300">{new Date(a.createdAt).toLocaleString('fr-FR')}</span>
                        {a.changes?.ip && <span className="text-[10px] font-mono text-slate-300">{a.changes.ip}</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── SETTINGS TAB ── */}
      {tab === 'settings' && (
        <div className="space-y-6">
          {settingsLoading && (
            <div className="flex items-center gap-2 text-slate-500 font-medium text-sm">
              <RefreshCw size={14} className="animate-spin text-primary-500" />
              <span>Chargement des paramètres...</span>
            </div>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* General Toggles */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-6">
              <div>
                <h3 className="font-black text-slate-800 text-lg flex items-center gap-2">
                  <Shield size={18} className="text-primary-500" />
                  Contrôles de sécurité dynamiques
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Activez ou désactivez les fonctionnalités de protection globales en un clic.
                </p>
              </div>

              <div className="space-y-4">
                {/* Toggle 1 */}
                <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-xl">
                  <div>
                    <p className="text-sm font-bold text-slate-700">Filtrage des adresses IP</p>
                    <p className="text-xs text-slate-400 mt-0.5">Bloque les IPs sur liste noire et limite l'accès à la liste blanche.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.enableIPBlocking}
                      onChange={(e) => {
                        const updated = { ...settings, enableIPBlocking: e.target.checked };
                        setSettings(updated);
                        handleSaveSettings(updated);
                      }}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
                  </label>
                </div>

                {/* Toggle 2 */}
                <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-xl">
                  <div>
                    <p className="text-sm font-bold text-slate-700">Journaux d'audit complets</p>
                    <p className="text-xs text-slate-400 mt-0.5">Enregistre les actions critiques des utilisateurs dans la base de données.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.enableAuditLog}
                      onChange={(e) => {
                        const updated = { ...settings, enableAuditLog: e.target.checked };
                        setSettings(updated);
                        handleSaveSettings(updated);
                      }}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
                  </label>
                </div>

                {/* Toggle 3 */}
                <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-xl">
                  <div>
                    <p className="text-sm font-bold text-slate-700">Assainissement des requêtes</p>
                    <p className="text-xs text-slate-400 mt-0.5">Filtre et élimine automatiquement le code HTML/JS suspect (anti-XSS).</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.enableRequestSanitization}
                      onChange={(e) => {
                        const updated = { ...settings, enableRequestSanitization: e.target.checked };
                        setSettings(updated);
                        handleSaveSettings(updated);
                      }}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
                  </label>
                </div>
              </div>
            </div>

            {/* Rate Limits */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-6">
              <div>
                <h3 className="font-black text-slate-800 text-lg flex items-center gap-2">
                  <Zap size={18} className="text-amber-500" />
                  Limites de débit (Rate Limiting)
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Définissez le nombre maximal de requêtes autorisées pour éviter le spam et les surcharges DoS.
                </p>
              </div>

              <div className="space-y-4">
                {/* Global Limit */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Requêtes globales (max / 15 minutes)</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={settings.globalRateLimitMax}
                      onChange={(e) => setSettings({ ...settings, globalRateLimitMax: Number(e.target.value) })}
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
                    />
                    <button
                      onClick={() => handleSaveSettings()}
                      className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-sm transition-all"
                    >
                      Enregistrer
                    </button>
                  </div>
                </div>

                {/* Upload Limit */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Téléversements (max / 15 minutes)</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={settings.uploadRateLimitMax}
                      onChange={(e) => setSettings({ ...settings, uploadRateLimitMax: Number(e.target.value) })}
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
                    />
                    <button
                      onClick={() => handleSaveSettings()}
                      className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-sm transition-all"
                    >
                      Enregistrer
                    </button>
                  </div>
                </div>

                {/* Payout Limit */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Demandes de retrait (max / heure)</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={settings.payoutRateLimitMax}
                      onChange={(e) => setSettings({ ...settings, payoutRateLimitMax: Number(e.target.value) })}
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
                    />
                    <button
                      onClick={() => handleSaveSettings()}
                      className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-sm transition-all"
                    >
                      Enregistrer
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Blocked IPs Manager */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-6">
              <div>
                <h3 className="font-black text-slate-800 text-lg flex items-center gap-2">
                  <Ban size={18} className="text-red-500" />
                  Liste noire d'adresses IP (Blacklist)
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Les adresses IP listées ici se verront refuser l'accès global au site.
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newBlockedIp}
                    onChange={(e) => setNewBlockedIp(e.target.value)}
                    placeholder="Saisir une adresse IP (ex: 197.230.1.5)"
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-mono focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
                    onKeyDown={(e) => e.key === 'Enter' && addBlockedIp(newBlockedIp)}
                  />
                  <button
                    onClick={() => addBlockedIp(newBlockedIp)}
                    className="px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl text-sm transition-all"
                  >
                    Ajouter
                  </button>
                </div>

                <div className="max-h-48 overflow-y-auto pr-1 space-y-1.5">
                  {settings.blockedIPs.length === 0 ? (
                    <p className="text-xs text-slate-400 italic py-2">Aucune adresse IP bloquée.</p>
                  ) : (
                    settings.blockedIPs.map((ip) => (
                      <div key={ip} className="flex items-center justify-between p-2 bg-red-50/50 border border-red-100/50 rounded-xl text-slate-700 font-mono text-xs font-semibold">
                        <span>{ip}</span>
                        <button
                          onClick={() => removeBlockedIp(ip)}
                          className="p-1 hover:text-red-500 rounded transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Whitelisted IPs Manager */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-6">
              <div>
                <h3 className="font-black text-slate-800 text-lg flex items-center gap-2">
                  <ShieldCheck size={18} className="text-emerald-500" />
                  Liste blanche d'adresses IP (Whitelist)
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Si cette liste n'est pas vide, *seules* ces IPs seront autorisées à se connecter.
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newWhitelistedIp}
                    onChange={(e) => setNewWhitelistedIp(e.target.value)}
                    placeholder="Saisir une adresse IP (ex: 82.22.4.19)"
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-mono focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
                    onKeyDown={(e) => e.key === 'Enter' && addWhitelistedIp(newWhitelistedIp)}
                  />
                  <button
                    onClick={() => addWhitelistedIp(newWhitelistedIp)}
                    className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl text-sm transition-all"
                  >
                    Ajouter
                  </button>
                </div>

                <div className="max-h-48 overflow-y-auto pr-1 space-y-1.5">
                  {settings.whitelistedIPs.length === 0 ? (
                    <p className="text-xs text-slate-400 italic py-2">Aucune adresse IP sur liste blanche. (Toutes les adresses non-bloquées sont autorisées)</p>
                  ) : (
                    settings.whitelistedIPs.map((ip) => (
                      <div key={ip} className="flex items-center justify-between p-2 bg-emerald-50/50 border border-emerald-100/50 rounded-xl text-slate-700 font-mono text-xs font-semibold">
                        <span>{ip}</span>
                        <button
                          onClick={() => removeWhitelistedIp(ip)}
                          className="p-1 hover:text-emerald-500 rounded transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── VULNERABILITIES TAB ── */}
      {tab === 'tools' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Block IP */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <h3 className="font-black text-slate-800 mb-1 flex items-center gap-2"><Ban size={16} className="text-red-500" /> Bloquer une IP rapidement</h3>
            <p className="text-xs text-slate-400 mb-4">Bloque immédiatement toutes les requêtes venant de cette adresse IP.</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={blockIP}
                onChange={e => setBlockIP(e.target.value)}
                placeholder="ex: 192.168.1.100"
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
                onKeyDown={e => e.key === 'Enter' && handleBlock(blockIP)}
              />
              <button
                onClick={() => handleBlock(blockIP)}
                disabled={blocking || !blockIP.trim()}
                className="px-4 py-3 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white font-bold rounded-xl text-sm transition-all"
              >
                {blocking ? '...' : 'Bloquer'}
              </button>
            </div>
          </div>

          {/* Vulnerability Summary */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <h3 className="font-black text-slate-800 mb-1 flex items-center gap-2"><Info size={16} className="text-amber-500" /> Résumé de l'Audit de Sécurité Globale</h3>
            <p className="text-xs text-slate-400 mb-4">Basé sur l'analyse de sécurité approfondie effectuée.</p>
            <div className="space-y-2">
              {[
                { label: 'File Upload RCE Vulnerability Fixed', count: 1, severity: 'PASS', note: 'Double-validation matching mimetype & file extension active' },
                { label: 'Dynamic Rate Limiter Active', count: 1, severity: 'PASS', note: 'Global, Upload, and Payout request limits dynamically controlled' },
                { label: 'Helper impersonation restricted', count: 1, severity: 'PASS', note: 'Helpers strictly restricted to client-facing roles impersonation only' },
                { label: 'NaN query parameters errors fixed', count: 1, severity: 'PASS', note: 'Path parameters numeric validation enforced to prevent Prisma crashes' },
                { label: 'Sensitive bank details masked', count: 1, severity: 'PASS', note: 'Sensitive RIB, bankName, iceNumber logs masked securely' },
              ].map(v => (
                <div key={v.label} className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className={`text-[10px] font-black px-1.5 py-0.5 rounded mt-0.5 ${v.severity === 'PASS' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{v.severity}</span>
                  <div>
                    <p className="text-xs font-bold text-slate-700">{v.label}</p>
                    <p className="text-[11px] text-slate-400">{v.note}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Security recommendations */}
          <div className="md:col-span-2 bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-6 text-white">
            <h3 className="font-black text-lg mb-4 flex items-center gap-2">
              <Zap size={18} className="text-amber-400" />
              Recommandations de sécurité prioritaires appliquées
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                { p: 1, title: 'Double-vérification Multer', desc: 'Le mimetype et l\'extension (.ext) sont comparés aux listes blanches.', color: '#10b981' },
                { p: 2, title: 'Limiteur de débit dynamique persisté', desc: 'Les limites de débit sont lues en temps réel à partir de PlatformSettings.', color: '#10b981' },
                { p: 3, title: 'Masquage accru des RIB/ICE', desc: 'Les clés sensibles comme bankName, ribAccount, iceNumber sont automatiquement expurgées des journaux.', color: '#10b981' },
                { p: 4, title: 'Correction des requêtes SQL / NaN', desc: 'Les identifiants invalides renvoient des erreurs propres avant Prisma.', color: '#10b981' },
                { p: 5, title: 'Contrôles de privilèges renforcés', desc: 'Les agents de support et assistants ne peuvent plus usurper des privilèges administratifs.', color: '#10b981' },
                { p: 6, title: 'Interface d\'administration premium intégrée', desc: 'Gestion en direct des configurations de sécurité globales.', color: '#10b981' },
              ].map(r => (
                <div key={r.p} className="flex items-start gap-3 p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <span className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black flex-shrink-0" style={{ background: r.color }}>
                    {r.p}
                  </span>
                  <div>
                    <p className="text-sm font-bold text-white">{r.title}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{r.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
