import { useState, useEffect, useCallback } from 'react';
import { securityApi } from '../../../lib/api';
import toast from 'react-hot-toast';
import { AlertTriangle, Plus, Trash2, ToggleLeft, ToggleRight, CheckCircle, Clock, CheckSquare } from 'lucide-react';
import { useSocket } from '../../../contexts/SocketContext';

const S = 'bg-slate-900 rounded-2xl border border-slate-800 p-5';

export default function ModIncidents() {
  const [incidents, setIncidents] = useState<any[]>([]);
  const [rules, setRules] = useState<any[]>([]);
  const [playbooks, setPlaybooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [incForm, setIncForm] = useState({ title: '', severity: 'WARNING', recommendedSteps: '' });
  const [ruleForm, setRuleForm] = useState({ name: '', eventType: '', condition: 'COUNT_GREATER_THAN', threshold: 5, action: 'BLOCK_IP' });
  const { socket } = useSocket();

  const load = useCallback(async () => {
    try {
      const [iR, rR, pR] = await Promise.all([securityApi.getIncidents(), securityApi.getAlertRules(), securityApi.getPlaybooks()]);
      setIncidents(iR.data.data||[]); setRules(rR.data.data||[]); setPlaybooks(pR.data.data||[]);
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!socket) return;
    const handleUpdate = (event: any) => {
      if (['incidents', 'rules', 'playbooks'].includes(event.type)) {
        load();
      }
    };
    socket.on('security:update', handleUpdate);
    return () => {
      socket.off('security:update', handleUpdate);
    };
  }, [socket, load]);

  const createIncident = async (e: React.FormEvent) => {
    e.preventDefault(); if (!incForm.title) return;
    try { await securityApi.createIncident(incForm as any); toast.success('Incident created'); setIncForm({title:'',severity:'WARNING',recommendedSteps:''}); load(); }
    catch { toast.error('Failed'); }
  };

  const updateIncidentStatus = async (id: string, status: string) => {
    try { await securityApi.updateIncident(id, { status } as any); toast.success('Updated'); load(); } catch { toast.error('Failed'); }
  };

  const createRule = async (e: React.FormEvent) => {
    e.preventDefault(); if (!ruleForm.name || !ruleForm.eventType) return;
    try { await securityApi.createAlertRule(ruleForm); toast.success('Rule created'); setRuleForm({name:'',eventType:'',condition:'COUNT_GREATER_THAN',threshold:5,action:'BLOCK_IP'}); load(); }
    catch { toast.error('Failed'); }
  };

  const toggleRule = async (id: string, active: boolean) => {
    try { await securityApi.toggleAlertRule(id, active); load(); } catch { toast.error('Failed'); }
  };

  const deleteRule = async (id: string) => {
    try { await securityApi.deleteAlertRule(id); toast.success('Deleted'); load(); } catch { toast.error('Failed'); }
  };

  const toggleStep = async (pbId: string, stepId: string, done: boolean) => {
    const pb = playbooks.find(p=>p.id===pbId); if (!pb) return;
    const steps = pb.steps.map((s:any)=>s.id===stepId?{...s,completed:!done}:s);
    try { await securityApi.updatePlaybookStep(pbId, steps); load(); } catch { toast.error('Failed'); }
  };

  if (loading) return <div className="text-slate-500 text-sm text-center py-20 animate-pulse">Loading...</div>;

  return (
    <div className="space-y-6">
      {/* Incidents */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className={S + ' lg:col-span-2 space-y-4'}>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <AlertTriangle size={16} className="text-orange-400" /> Security Incidents ({incidents.length})
          </h3>
          <div className="space-y-3 max-h-[350px] overflow-y-auto">
            {incidents.length === 0 ? <p className="text-slate-500 text-xs text-center py-8">No incidents</p> :
            incidents.map(inc => (
              <div key={inc.id} className="bg-slate-950 rounded-xl border border-slate-800 p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <span className={`text-[9px] font-black px-2 py-0.5 rounded ${
                    inc.severity==='CRITICAL'?'bg-red-500/10 text-red-400':inc.severity==='WARNING'?'bg-amber-500/10 text-amber-400':'bg-blue-500/10 text-blue-400'}`}>
                    {inc.severity}</span>
                  <span className={`text-[9px] font-black px-2 py-0.5 rounded ${
                    inc.status==='RESOLVED'?'bg-emerald-500/10 text-emerald-400':inc.status==='INVESTIGATING'?'bg-indigo-500/10 text-indigo-400':'bg-orange-500/10 text-orange-400'}`}>
                    {inc.status}</span>
                  <span className="text-[10px] text-slate-500 ml-auto">{new Date(inc.createdAt).toLocaleDateString()}</span>
                </div>
                <p className="text-xs font-semibold text-white">{inc.title}</p>
                {inc.recommendedSteps && <p className="text-[10px] text-slate-400 bg-slate-900/60 p-2 rounded">{inc.recommendedSteps}</p>}
                <div className="flex gap-2 pt-1">
                  {['INVESTIGATING','RESOLVED','FALSE_POSITIVE'].map(s=>(
                    <button key={s} onClick={()=>updateIncidentStatus(inc.id,s)} className="px-2 py-1 bg-slate-900 text-slate-400 hover:text-white rounded text-[10px] font-semibold">{s.replace('_',' ')}</button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Create Incident Form */}
        <div className={S + ' space-y-4'}>
          <h3 className="text-sm font-bold text-white">Create Incident</h3>
          <form onSubmit={createIncident} className="space-y-3">
            <input value={incForm.title} onChange={e=>setIncForm({...incForm,title:e.target.value})} placeholder="Incident title..." required
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500" />
            <select value={incForm.severity} onChange={e=>setIncForm({...incForm,severity:e.target.value})}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white">
              <option value="INFO">Info</option><option value="WARNING">Warning</option><option value="CRITICAL">Critical</option>
            </select>
            <textarea value={incForm.recommendedSteps} onChange={e=>setIncForm({...incForm,recommendedSteps:e.target.value})} placeholder="Recommended steps..."
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white h-20 focus:outline-none focus:border-orange-500" />
            <button type="submit" className="w-full py-2 bg-orange-600 hover:bg-orange-500 rounded-lg text-xs font-bold text-white">Create</button>
          </form>
        </div>
      </div>

      {/* Alert Rules */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className={S + ' lg:col-span-2 space-y-4'}>
          <h3 className="text-sm font-bold text-white">Custom Alert Rules</h3>
          <div className="space-y-2">
            {rules.length === 0 ? <p className="text-slate-500 text-xs text-center py-6">No rules configured</p> :
            rules.map(rule=>(
              <div key={rule.id} className="bg-slate-950 rounded-xl border border-slate-800 p-3 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-white">{rule.name}</p>
                  <p className="text-[10px] text-slate-500">IF {rule.eventType} {'>'} {rule.threshold} THEN {rule.action}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={()=>toggleRule(rule.id,!rule.isActive)} className="text-slate-400 hover:text-white">
                    {rule.isActive ? <ToggleRight className="text-emerald-500" size={28}/> : <ToggleLeft size={28}/>}
                  </button>
                  <button onClick={()=>deleteRule(rule.id)} className="text-slate-500 hover:text-red-400"><Trash2 size={14}/></button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={S + ' space-y-4'}>
          <h3 className="text-sm font-bold text-white">Create Rule</h3>
          <form onSubmit={createRule} className="space-y-3">
            <input value={ruleForm.name} onChange={e=>setRuleForm({...ruleForm,name:e.target.value})} placeholder="Rule name..." required
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none" />
            <input value={ruleForm.eventType} onChange={e=>setRuleForm({...ruleForm,eventType:e.target.value})} placeholder="Event type (e.g. FAILED_LOGIN)" required
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none" />
            <input type="number" value={ruleForm.threshold} onChange={e=>setRuleForm({...ruleForm,threshold:Number(e.target.value)})} min={1}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none" />
            <select value={ruleForm.action} onChange={e=>setRuleForm({...ruleForm,action:e.target.value})}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white">
              <option value="BLOCK_IP">Block IP</option><option value="TRIGGER_ALERT">Send Alert</option><option value="LOG_EVENT">Log Event</option>
            </select>
            <button type="submit" className="w-full py-2 bg-amber-600 hover:bg-amber-500 rounded-lg text-xs font-bold text-white">Create Rule</button>
          </form>
        </div>
      </div>

      {/* Playbooks */}
      <div className={S + ' space-y-4'}>
        <h3 className="text-sm font-bold text-white flex items-center gap-2"><CheckSquare size={16} className="text-orange-400" /> Incident Playbooks</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {playbooks.map(pb=>(
            <div key={pb.id} className="bg-slate-950 rounded-xl border border-slate-800 p-4 space-y-3">
              <h4 className="text-xs font-bold text-white">{pb.scenario}</h4>
              <div className="space-y-1.5">
                {(pb.steps||[]).map((step:any)=>(
                  <div key={step.id} onClick={()=>toggleStep(pb.id,step.id,step.completed)}
                    className="flex items-center gap-2 p-2 bg-slate-900/60 hover:bg-slate-900 rounded-lg cursor-pointer">
                    {step.completed ? <CheckCircle className="text-emerald-500" size={15}/> : <Clock className="text-slate-600" size={15}/>}
                    <span className={`text-[11px] ${step.completed?'line-through text-slate-500':'text-slate-300'}`}>{step.label}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
