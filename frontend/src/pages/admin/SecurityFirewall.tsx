import { useState } from 'react';
import {
  Shield, ShieldAlert, Users, Lock, Globe, Database,
  FileText, AlertTriangle, Zap, RefreshCw, Radio, Server, Eye
} from 'lucide-react';
import ModOverview from './security/ModOverview';
import ModBotDdos from './security/ModBotDdos';
import ModAuthSessions from './security/ModAuthSessions';
import ModWaf from './security/ModWaf';
import ModAccessControl from './security/ModAccessControl';
import ModInfrastructure from './security/ModInfrastructure';
import ModDataProtection from './security/ModDataProtection';
import ModIncidents from './security/ModIncidents';
import ModCompliance from './security/ModCompliance';
import ModThreatMap from './security/ModThreatMap';

const MODULES = [
  { id: 'overview', label: 'Threat Overview', icon: Shield, color: 'text-emerald-400' },
  { id: 'threat-map', label: 'Global Analytics', icon: Globe, color: 'text-emerald-400' },
  { id: 'bot-ddos', label: 'Bot & DDoS', icon: ShieldAlert, color: 'text-red-400' },
  { id: 'auth-sessions', label: 'Auth, Sessions & Behavior', icon: Users, color: 'text-cyan-400' },
  { id: 'waf', label: 'WAF & Injection', icon: Zap, color: 'text-amber-400' },
  { id: 'access', label: 'Access Control', icon: Lock, color: 'text-violet-400' },
  { id: 'infra', label: 'Infrastructure', icon: Server, color: 'text-blue-400' },
  { id: 'data', label: 'Database & Storage', icon: Database, color: 'text-teal-400' },
  { id: 'incidents', label: 'Incidents & Alerts', icon: AlertTriangle, color: 'text-orange-400' },
  { id: 'compliance', label: 'Audit & Compliance', icon: FileText, color: 'text-indigo-400' },
] as const;

type ModuleId = typeof MODULES[number]['id'];

export default function SecurityFirewall() {
  const [activeModule, setActiveModule] = useState<ModuleId>('overview');
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = () => setRefreshKey(k => k + 1);

  const renderModule = () => {
    const props = { key: refreshKey };
    switch (activeModule) {
      case 'overview': return <ModOverview {...props} />;
      case 'threat-map': return <ModThreatMap {...props} />;
      case 'bot-ddos': return <ModBotDdos {...props} />;
      case 'auth-sessions': return <ModAuthSessions {...props} />;
      case 'waf': return <ModWaf {...props} />;
      case 'access': return <ModAccessControl {...props} />;
      case 'infra': return <ModInfrastructure {...props} />;
      case 'data': return <ModDataProtection {...props} />;
      case 'incidents': return <ModIncidents {...props} />;
      case 'compliance': return <ModCompliance {...props} />;
    }
  };

  const current = MODULES.find(m => m.id === activeModule)!;

  return (
    <div className="flex min-h-[calc(100vh-80px)] bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden shadow-2xl">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 bg-slate-900/80 border-r border-slate-800 flex flex-col">
        <div className="p-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center">
              <Shield size={16} className="text-red-500" />
            </div>
            <div>
              <h2 className="text-xs font-black text-white tracking-wide">SOC DASHBOARD</h2>
              <p className="text-[9px] text-slate-500 flex items-center gap-1">
                <Radio size={8} className="text-emerald-500 animate-pulse" /> LIVE
              </p>
            </div>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
          {MODULES.map((m) => {
            const Icon = m.icon;
            const active = activeModule === m.id;
            return (
              <button
                key={m.id}
                onClick={() => setActiveModule(m.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left transition-all text-xs font-semibold ${
                  active
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <Icon size={15} className={active ? m.color : 'text-slate-500'} />
                <span className="truncate">{m.label}</span>
              </button>
            );
          })}
        </nav>
        <div className="p-3 border-t border-slate-800">
          <div className="text-[9px] text-slate-600 text-center">OWASP · SIEM · Zero Trust</div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/40">
          <div className="flex items-center gap-3">
            <current.icon size={20} className={current.color} />
            <div>
              <h1 className="text-lg font-bold text-white">{current.label}</h1>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">
                Module {MODULES.findIndex(m => m.id === activeModule) + 1} / 10
              </p>
            </div>
          </div>
          <button
            onClick={refresh}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs font-semibold text-slate-300 transition-all"
          >
            <RefreshCw size={13} />
            Refresh
          </button>
        </div>

        {/* Module content */}
        <div className="flex-1 overflow-y-auto p-6">
          {renderModule()}
        </div>
      </main>
    </div>
  );
}
