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

export default function SecurityFirewall() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'overview' | 'threats' | 'activity' | 'tools'>('overview');
  const [blockIP, setBlockIP] = useState('');
  const [blocking, setBlocking] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

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

  useEffect(() => { load(); }, [load]);

  const handleRefresh = () => { setRefreshing(true); load(); };

  const handleBlock = async (ip: string) => {
    if (!ip.trim()) return;
    setBlocking(true);
    try {
      await securityApi.blockIP(ip.trim());
      toast.success(`IP ${ip} bloquée`);
      setBlockIP('');
      load();
    } catch { toast.error('Erreur lors du blocage'); }
    finally { setBlocking(false); }
  };

  const handleUnblock = async (ip: string) => {
    try {
      await securityApi.unblockIP(ip);
      toast.success(`IP ${ip} débloquée`);
      load();
    } catch { toast.error('Erreur'); }
  };

  const handleClearThreat = async (ip?: string) => {
    try {
      await securityApi.clearThreat(ip);
      toast.success(ip ? `Menace ${ip} effacée` : 'Toutes les menaces effacées');
      load();
    } catch { toast.error('Erreur'); }
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
    { id: 'tools', label: 'Outils', icon: Lock },
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

      {/* ── TOOLS TAB ── */}
      {tab === 'tools' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Block IP */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <h3 className="font-black text-slate-800 mb-1 flex items-center gap-2"><Ban size={16} className="text-red-500" /> Bloquer une IP</h3>
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
            <h3 className="font-black text-slate-800 mb-1 flex items-center gap-2"><Info size={16} className="text-amber-500" /> Résumé des vulnérabilités</h3>
            <p className="text-xs text-slate-400 mb-4">Basé sur l'analyse du code source de l'application.</p>
            <div className="space-y-2">
              {[
                { label: 'Requêtes SQL brutes', count: 4, severity: 'WARN', note: 'Paramétrisées via Prisma, risque faible' },
                { label: 'Secrets fallback JWT', count: 2, severity: 'WARN', note: 'maintenance.ts + settingsController.ts' },
                { label: 'Noms de fichiers non sécurisés', count: 1, severity: 'WARN', note: 'upload.routes.ts — utiliser UUID' },
                { label: 'Mode dev exposé', count: 1, severity: process.env.NODE_ENV === 'production' ? 'OK' : 'WARN', note: 'Stack traces + NODE_ENV visibles' },
                { label: 'Console.log avec token', count: 1, severity: 'WARN', note: 'user.routes.ts ligne 421 (dev only)' },
              ].map(v => (
                <div key={v.label} className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className={`text-[10px] font-black px-1.5 py-0.5 rounded mt-0.5 ${v.severity === 'OK' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{v.severity}</span>
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
              Recommandations prioritaires
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                { p: 1, title: 'Passer NODE_ENV=production', desc: 'Masque les stack traces et active les optimisations de sécurité.', color: '#ef4444' },
                { p: 2, title: 'Supprimer les fallback_secret', desc: "Remplacer 'fallback_secret' par process.env.JWT_SECRET avec vérification de présence.", color: '#f59e0b' },
                { p: 3, title: 'UUID pour les noms de fichiers upload', desc: 'Ne pas conserver le nom original du fichier dans le stockage disque.', color: '#f59e0b' },
                { p: 4, title: 'Activer SECURITY_ENABLE_AUDIT_LOG', desc: 'Ajouter cette variable dans .env pour activer les logs d\'audit complets.', color: '#6366f1' },
                { p: 5, title: 'Restreindre /api/v1/health', desc: 'Masquer NODE_ENV et les infos de version sur cet endpoint public.', color: '#6366f1' },
                { p: 6, title: 'Supprimer le console.log en production', desc: 'user.routes.ts:421 log le lien de reset de mot de passe — retirer en production.', color: '#6366f1' },
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
