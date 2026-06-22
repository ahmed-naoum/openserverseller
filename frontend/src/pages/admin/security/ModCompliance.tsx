import { useState, useEffect, useCallback } from 'react';
import { securityApi } from '../../../lib/api';
import toast from 'react-hot-toast';
import { FileText, Download, Plus, Database } from 'lucide-react';
import { useSocket } from '../../../contexts/SocketContext';

const S = 'bg-slate-900 rounded-2xl border border-slate-800 p-5';

export default function ModCompliance() {
  const [compliance, setCompliance] = useState<any[]>([]);
  const [pentest, setPentest] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [ptForm, setPtForm] = useState({ title: '', severity: 'MEDIUM', owner: '' });
  const { socket } = useSocket();

  const load = useCallback(async () => {
    try {
      const [cR, pR, aR] = await Promise.all([securityApi.getCompliance(), securityApi.getPentest(), securityApi.getAuditLogs()]);
      setCompliance(cR.data.data||[]); setPentest(pR.data.data||[]); setAuditLogs(aR.data.data||[]);
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!socket) return;
    const handleUpdate = (event: any) => {
      load();
    };
    socket.on('security:update', handleUpdate);
    socket.on('security_event', handleUpdate);
    return () => {
      socket.off('security:update', handleUpdate);
      socket.off('security_event', handleUpdate);
    };
  }, [socket, load]);

  const verifyCompliance = async (id: string, status: string) => {
    try { await securityApi.verifyCompliance(id, { status } as any); toast.success('Updated'); load(); } catch { toast.error('Failed'); }
  };

  const exportPdf = async () => {
    try {
      const res = await securityApi.exportCompliancePdf();
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a'); a.href = url; a.download = 'compliance_report.pdf'; a.click();
      toast.success('PDF downloaded');
    } catch { toast.error('Export failed'); }
  };

  const createPentest = async (e: React.FormEvent) => {
    e.preventDefault(); if (!ptForm.title || !ptForm.owner) return;
    try { await securityApi.createPentest(ptForm as any); toast.success('Finding added'); setPtForm({title:'',severity:'MEDIUM',owner:''}); load(); }
    catch { toast.error('Failed'); }
  };

  if (loading) return <div className="text-slate-500 text-sm text-center py-20 animate-pulse">Loading compliance data...</div>;

  return (
    <div className="space-y-6">
      {/* Compliance Checklist */}
      <div className={S + ' space-y-4'}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <FileText size={16} className="text-indigo-400" /> Compliance Framework (GDPR / PCI DSS / ISO 27001)
          </h3>
          <button onClick={exportPdf}
            className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-[10px] font-bold text-white">
            <Download size={12} /> Export PDF
          </button>
        </div>
        <div className="divide-y divide-slate-800">
          {compliance.length === 0 ? <p className="text-slate-500 text-xs text-center py-6">No compliance items</p> :
          compliance.map(item => (
            <div key={item.id} className="py-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <span className="text-[9px] font-black px-2 py-0.5 rounded bg-slate-800 text-indigo-400 mr-2">{item.standard}</span>
                <span className="text-xs font-semibold text-white">{item.requirement}</span>
                {item.verifiedAt && <span className="text-[9px] text-slate-500 ml-2">Verified {new Date(item.verifiedAt).toLocaleDateString()}</span>}
              </div>
              <select value={item.status} onChange={e => verifyCompliance(item.id, e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-[10px] text-white shrink-0">
                <option value="COMPLIANT">Compliant</option>
                <option value="PARTIAL">Partial</option>
                <option value="NON_COMPLIANT">Non-Compliant</option>
              </select>
            </div>
          ))}
        </div>
      </div>

      {/* Pentest Findings */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className={S + ' lg:col-span-2 space-y-4'}>
          <h3 className="text-sm font-bold text-white">Penetration Test Findings</h3>
          <div className="space-y-2">
            {pentest.length === 0 ? <p className="text-slate-500 text-xs text-center py-6">No findings</p> :
            pentest.map(f => (
              <div key={f.id} className="bg-slate-950 rounded-xl border border-slate-800 p-3 flex items-center justify-between">
                <div>
                  <span className={`text-[9px] font-black px-2 py-0.5 rounded mr-2 ${
                    f.severity==='CRITICAL'?'bg-red-500/10 text-red-400':f.severity==='HIGH'?'bg-orange-500/10 text-orange-400':'bg-amber-500/10 text-amber-400'}`}>
                    {f.severity}</span>
                  <span className="text-xs font-semibold text-white">{f.title}</span>
                  <span className="text-[10px] text-slate-500 ml-2">Owner: {f.owner} • {f.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={S + ' space-y-4'}>
          <h3 className="text-sm font-bold text-white">Add Finding</h3>
          <form onSubmit={createPentest} className="space-y-3">
            <input value={ptForm.title} onChange={e=>setPtForm({...ptForm,title:e.target.value})} placeholder="Finding title..." required
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none" />
            <select value={ptForm.severity} onChange={e=>setPtForm({...ptForm,severity:e.target.value})}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white">
              <option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option><option value="CRITICAL">Critical</option>
            </select>
            <input value={ptForm.owner} onChange={e=>setPtForm({...ptForm,owner:e.target.value})} placeholder="Owner name..." required
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none" />
            <button type="submit" className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-xs font-bold text-white">Add</button>
          </form>
        </div>
      </div>

      {/* Immutable Audit Log */}
      <div className={S + ' space-y-3'}>
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Database size={16} className="text-red-400" /> Immutable Audit Log (SHA-256 Chain)
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-800 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="pb-3 pr-4">Timestamp</th>
                <th className="pb-3 pr-4">Action</th>
                <th className="pb-3 pr-4">IP</th>
                <th className="pb-3">Hash</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50 text-xs">
              {auditLogs.length === 0 ? (
                <tr><td colSpan={4} className="py-8 text-center text-slate-500">No audit logs</td></tr>
              ) : auditLogs.slice(0,50).map((log:any)=>(
                <tr key={log.id} className="hover:bg-slate-800/30 font-mono">
                  <td className="py-2 pr-4 text-slate-400">{new Date(log.timestamp).toLocaleString()}</td>
                  <td className="py-2 pr-4 text-white max-w-[200px] truncate">{log.action}</td>
                  <td className="py-2 pr-4 text-slate-400">{log.ipAddress || log.ip}</td>
                  <td className="py-2 text-[9px] text-red-400/60 max-w-[150px] truncate" title={log.hash}>{log.hash}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
