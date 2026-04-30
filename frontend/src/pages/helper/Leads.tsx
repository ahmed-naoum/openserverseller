import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../lib/api';
import toast from 'react-hot-toast';
import {
  Users, Plus, Search, Edit2, X, Save, ChevronLeft, ChevronRight,
  DollarSign, CheckCircle, AlertCircle, FileText, RefreshCw, ChevronDown, ShieldAlert
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────
interface Lead {
  id: number;
  fullName: string;
  phone: string;
  whatsapp?: string;
  city?: string;
  address?: string;
  status: string;
  paymentSituation?: string;
  notes?: string;
  coliatyPackageCode?: string | null;
  brand?: { id: number; name: string } | null;
  vendor?: { id: number; fullName: string, email: string } | null;
  createdAt: string;
}

interface Vendor { id: number; fullName?: string; email?: string; role?: string }

// ─── Constants ───────────────────────────────────────────────────────────────
const LEAD_STATUSES = [
  'NEW', 'ASSIGNED', 'CONTACTED', 'INTERESTED', 'NOT_INTERESTED',
  'CALLBACK_REQUESTED', 'ORDERED', 'PUSHED_TO_DELIVERY', 'UNREACHABLE', 'INVALID',
];

const PAYMENT_SITUATIONS = [
  { value: 'NOT_PAID', label: 'Non Payé', color: 'bg-rose-100 text-rose-700' },
  { value: 'PAID',     label: 'Payé',     color: 'bg-emerald-100 text-emerald-700' },
  { value: 'FACTURED', label: 'Facturé',  color: 'bg-blue-100 text-blue-700' },
];

const STATUS_COLORS: Record<string, string> = {
  NEW: 'bg-gray-100 text-gray-600',
  ASSIGNED: 'bg-blue-100 text-blue-700',
  CONTACTED: 'bg-indigo-100 text-indigo-700',
  INTERESTED: 'bg-yellow-100 text-yellow-700',
  NOT_INTERESTED: 'bg-rose-100 text-rose-700',
  CALLBACK_REQUESTED: 'bg-orange-100 text-orange-700',
  ORDERED: 'bg-emerald-100 text-emerald-700',
  PUSHED_TO_DELIVERY: 'bg-teal-100 text-teal-700',
  UNREACHABLE: 'bg-gray-200 text-gray-500',
  INVALID: 'bg-red-200 text-red-600',
};

// ─── Empty form state ─────────────────────────────────────────────────────────
const emptyForm = () => ({
  fullName: '', phone: '', whatsapp: '', city: '', address: '', notes: '', vendorId: '',
});

// ─── Main Component ───────────────────────────────────────────────────────────
export default function HelperLeads() {
  const { user } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);

  // Permission Guard
  if (user?.role === 'HELPER' && !user?.canManageLeads) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center px-4">
        <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-3xl flex items-center justify-center mb-6 animate-bounce">
          <ShieldAlert size={40} />
        </div>
        <h2 className="text-2xl font-black text-slate-800 mb-2">Accès Non Autorisé</h2>
        <p className="text-slate-500 max-w-md mb-8">
          Vous n'avez pas la permission de gérer les leads. Veuillez contacter un administrateur pour obtenir l'accès.
        </p>
        <Link 
          to="/helper" 
          className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all shadow-xl shadow-slate-200"
        >
          Retour au Tableau de Bord
        </Link>
      </div>
    );
  }
  const [search, setSearch] = useState('');
  const [vendorFilter, setVendorFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Modal state
  const [showCreate, setShowCreate] = useState(false);
  const [editLead, setEditLead] = useState<Lead | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [expandedNotes, setExpandedNotes] = useState<number | null>(null);

  // Fetch leads
  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ 
        page: String(page), 
        limit: '20',
        excludeProcessed: 'true'
      });
      if (search) params.set('search', search);
      if (vendorFilter) params.set('vendorId', vendorFilter);
      const res = await api.get(`/leads?${params}`);
      setLeads(res.data.data.leads);
      setTotalPages(res.data.data.pagination.totalPages);
      setTotal(res.data.data.pagination.total);
    } catch {
      toast.error('Erreur lors du chargement des leads');
    } finally {
      setLoading(false);
    }
  }, [page, search, vendorFilter]);

  const fetchVendors = useCallback(async () => {
    try {
      const res = await api.get('/users?limit=200');
      setVendors(res.data.data.users || []);
    } catch { /* silent */ }
  }, []);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);
  useEffect(() => { fetchVendors(); }, [fetchVendors]);

  // ─── Handlers ──────────────────────────────────────────────────────────────
  const openCreate = () => { setForm(emptyForm()); setShowCreate(true); };
  const openEdit = (lead: Lead) => {
    setEditLead(lead);
    setForm({
      fullName: lead.fullName,
      phone: lead.phone,
      whatsapp: lead.whatsapp || '',
      city: lead.city || '',
      address: lead.address || '',
      notes: lead.notes || '',
      vendorId: lead.vendor?.id ? String(lead.vendor.id) : '',
    });
  };
  const closeModals = () => { setShowCreate(false); setEditLead(null); };

  const handleCreate = async () => {
    if (!form.fullName || !form.phone) return toast.error('Nom et téléphone requis');
    if (!form.vendorId) return toast.error('Veuillez sélectionner un vendeur');
    setSaving(true);
    try {
      await api.post('/leads', { ...form, vendorId: Number(form.vendorId) });
      toast.success('Lead créé avec succès');
      closeModals();
      fetchLeads();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Erreur lors de la création');
    } finally { setSaving(false); }
  };

  const handleEdit = async () => {
    if (!editLead) return;
    setSaving(true);
    try {
      await api.patch(`/leads/${editLead.id}`, form);
      toast.success('Lead mis à jour');
      closeModals();
      fetchLeads();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Erreur lors de la mise à jour');
    } finally { setSaving(false); }
  };

  const handleStatusChange = async (lead: Lead, status: string) => {
    try {
      await api.patch(`/leads/${lead.id}/status`, { status });
      toast.success('Statut mis à jour');
      fetchLeads();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Erreur statut');
    }
  };

  const handlePaymentChange = async (lead: Lead, paymentSituation: string) => {
    try {
      await api.patch(`/leads/${lead.id}/payment-situation`, { paymentSituation });
      toast.success('Situation de paiement mise à jour');
      setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, paymentSituation } : l));
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Erreur paiement');
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="max-w-7xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 flex items-center gap-3">
            <Users className="text-indigo-600" size={32} /> Tous les Leads
          </h1>
          <p className="text-gray-500 mt-1">{total} leads au total</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={fetchLeads}
            className="p-3 bg-white border border-gray-100 rounded-2xl hover:bg-gray-50 text-gray-400 transition-all shadow-sm"
            title="Actualiser"
          >
            <RefreshCw size={18} />
          </button>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold shadow-lg shadow-indigo-600/20 transition-all hover:scale-105"
          >
            <Plus size={18} /> Nouveau Lead
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="flex gap-3 mb-6">
        <div className="relative flex-[2]">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher par nom, téléphone, ville ou adresse..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-11 pr-4 py-3 bg-white border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-300 shadow-sm transition-all"
          />
        </div>
        <div className="relative flex-1">
          <Users size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <select
            value={vendorFilter}
            onChange={(e) => { setVendorFilter(e.target.value); setPage(1); }}
            className="w-full pl-11 pr-10 py-3 bg-white border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-300 shadow-sm appearance-none transition-all"
          >
            <option value="">Tous les Comptes Assignés</option>
            {vendors.map(v => (
              <option key={v.id} value={v.id}>
                {v.fullName || v.email} {v.role ? `(${v.role})` : ''}
              </option>
            ))}
          </select>
          <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
            <ChevronDown size={16} />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-gray-400 text-sm font-medium">Chargement des données...</div>
        ) : leads.length === 0 ? (
          <div className="p-10 text-center text-gray-400">Aucun lead trouvé.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-50 text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-50/30">
                  <th className="px-6 py-4 text-left whitespace-nowrap">Infos Client & Notes</th>
                  <th className="px-4 py-4 text-left whitespace-nowrap">Contact & Livraison</th>
                  <th className="px-4 py-4 text-left whitespace-nowrap">Option</th>
                  <th className="px-4 py-4 text-left whitespace-nowrap">Source / Vendeur</th>
                  <th className="px-4 py-4 text-right whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {leads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-indigo-50/30 transition-colors group">
                    {/* Infos Client & Notes */}
                    <td className="px-6 py-4 align-top w-1/3">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-gray-900 text-[15px]">{lead.fullName}</p>
                          <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-mono font-bold">#{lead.id}</span>
                        </div>
                        <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider mb-1">
                          Créé le {new Date(lead.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                        {lead.notes && (
                          <div 
                            className={`mt-1 p-2 rounded-xl bg-amber-50/50 border border-amber-100/50 text-xs text-amber-800 ${expandedNotes === lead.id ? '' : 'line-clamp-2 cursor-pointer hover:bg-amber-50'}`}
                            onClick={() => setExpandedNotes(expandedNotes === lead.id ? null : lead.id)}
                            title={expandedNotes === lead.id ? "Masquer les notes" : "Afficher les notes complètes"}
                          >
                            <span className="font-bold text-amber-600 mr-1">Notes:</span>
                            {lead.notes}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Contact & Livraison */}
                    <td className="px-4 py-4 align-top">
                      <div className="flex flex-col gap-1.5">
                        <p className="text-sm text-gray-700 font-mono font-bold bg-gray-50 px-2 py-0.5 rounded inline-flex w-fit">
                          📞 {lead.phone}
                        </p>
                        {lead.whatsapp && lead.whatsapp !== lead.phone && (
                          <p className="text-[11px] text-emerald-600 font-mono font-bold">
                            💬 WA: {lead.whatsapp}
                          </p>
                        )}
                        <div className="mt-1">
                          <p className="text-xs text-gray-600 font-semibold">{lead.city || 'Ville non spécifiée'}</p>
                          {lead.address && <p className="text-[11px] text-gray-400 leading-tight mt-0.5 line-clamp-2" title={lead.address}>{lead.address}</p>}
                        </div>
                        {lead.coliatyPackageCode && (
                          <div className="mt-2 bg-indigo-50/50 border border-indigo-100 rounded-lg px-2 py-1 w-fit">
                            <span className="text-[9px] font-black tracking-widest text-indigo-400 uppercase block mb-0.5">Code Coliaty</span>
                            <span className="text-xs font-mono font-bold text-indigo-700">{lead.coliatyPackageCode}</span>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Option */}
                    <td className="px-4 py-4 align-top">
                      <div className="flex flex-col">
                        <span className="text-[9px] font-black tracking-widest text-gray-400 uppercase mb-1">Pack</span>
                        <span className="text-[13px] font-bold text-influencer-600 bg-influencer-50/50 px-2.5 py-1 rounded-xl border border-influencer-100 w-fit">
                           {lead.productVariant || '-'}
                        </span>
                      </div>
                    </td>

                    {/* Source / Vendeur */}
                    <td className="px-4 py-4 align-top">
                      {lead.vendor ? (
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-1 rounded-lg w-fit">
                            V: {lead.vendor.fullName || lead.vendor.email}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 italic">Non assigné</span>
                      )}
                      
                      {lead.brand && (
                        <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded mt-2 inline-block">
                          M: {lead.brand.name}
                        </span>
                      )}
                    </td>

                    {/* Status Leads */}
                    <td className="px-4 py-4 align-top">
                      <div className="flex flex-col gap-2">
                        <div className="flex flex-col gap-0.5">
                          <select
                            value={lead.status}
                            onChange={(e) => handleStatusChange(lead, e.target.value)}
                            className={`text-xs font-bold px-2.5 py-1.5 rounded-xl border-0 outline-none cursor-pointer transition-all focus:ring-2 focus:ring-indigo-300 w-full shadow-sm ${STATUS_COLORS[lead.status] || 'bg-gray-100 text-gray-500'}`}
                            style={{ appearance: 'none' }}
                          >
                            {LEAD_STATUSES.map(s => (
                              <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-4 align-top text-right">
                      <button
                        onClick={() => openEdit(lead)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 bg-indigo-50 hover:bg-indigo-600 text-indigo-600 hover:text-white rounded-xl transition-all shadow-sm group/btn"
                        title="Détails & Modification"
                      >
                        <Edit2 size={14} className="group-hover/btn:scale-110 transition-transform" />
                        <span className="text-xs font-bold">Éditer</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-50 bg-gray-50/50">

            <p className="text-sm text-gray-400">Page {page} / {totalPages}</p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 disabled:opacity-40 transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 disabled:opacity-40 transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Create Modal ─────────────────────────────────────────────────── */}
      {showCreate && (
        <Modal title="Nouveau Lead" onClose={closeModals}>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Nom complet *">
              <input value={form.fullName} onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))} placeholder="Ahmed Naoum" className={inputCls} />
            </Field>
            <Field label="Téléphone *">
              <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="0612345678" className={inputCls} />
            </Field>
            <Field label="WhatsApp">
              <input value={form.whatsapp} onChange={e => setForm(f => ({ ...f, whatsapp: e.target.value }))} placeholder="0612345678" className={inputCls} />
            </Field>
            <Field label="Ville">
              <input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} placeholder="Casablanca" className={inputCls} />
            </Field>
            <Field label="Adresse" className="col-span-2">
              <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Rue..." className={inputCls} />
            </Field>
            <Field label="Vendeur *" className="col-span-2">
              <select value={form.vendorId} onChange={e => setForm(f => ({ ...f, vendorId: e.target.value }))} className={inputCls}>
                <option value="">— Sélectionner un vendeur —</option>
                {vendors.map(v => (
                  <option key={v.id} value={v.id}>{v.fullName || v.email || `#${v.id}`}</option>
                ))}
              </select>
            </Field>
            <Field label="Notes" className="col-span-2">
              <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} placeholder="Notes..." className={inputCls} />
            </Field>
          </div>
          <div className="flex gap-3 mt-6">
            <button onClick={closeModals} className="flex-1 py-3 rounded-2xl border border-gray-200 text-gray-500 font-bold hover:bg-gray-50 transition-all">Annuler</button>
            <button onClick={handleCreate} disabled={saving} className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-60">
              <Save size={16} /> {saving ? 'Enregistrement...' : 'Créer'}
            </button>
          </div>
        </Modal>
      )}

      {/* ── Edit Modal ───────────────────────────────────────────────────── */}
      {editLead && (
        <Modal title={`Modifier — ${editLead.fullName}`} onClose={closeModals}>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Nom complet">
              <input value={form.fullName} onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))} className={inputCls} />
            </Field>
            <Field label="Téléphone">
              <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className={inputCls} />
            </Field>
            <Field label="WhatsApp">
              <input value={form.whatsapp} onChange={e => setForm(f => ({ ...f, whatsapp: e.target.value }))} className={inputCls} />
            </Field>
            <Field label="Ville">
              <input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} className={inputCls} />
            </Field>
            <Field label="Adresse" className="col-span-2">
              <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} className={inputCls} />
            </Field>
            <Field label="Notes" className="col-span-2">
              <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} className={inputCls} />
            </Field>
          </div>
          <div className="flex gap-3 mt-6">
            <button onClick={closeModals} className="flex-1 py-3 rounded-2xl border border-gray-200 text-gray-500 font-bold hover:bg-gray-50 transition-all">Annuler</button>
            <button onClick={handleEdit} disabled={saving} className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-60">
              <Save size={16} /> {saving ? 'Enregistrement...' : 'Sauvegarder'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Helper sub-components ────────────────────────────────────────────────────
const inputCls = 'w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-300 transition-all';

function Field({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">{label}</label>
      {children}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center px-4 pointer-events-none">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl pointer-events-auto overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center justify-between px-8 py-6 border-b border-gray-50">
            <h2 className="text-xl font-extrabold text-gray-900">{title}</h2>
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-all">
              <X size={20} />
            </button>
          </div>
          <div className="px-8 py-6">{children}</div>
        </div>
      </div>
    </>
  );
}
