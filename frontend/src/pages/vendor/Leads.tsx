import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { leadsApi, brandsApi, publicApi } from '../../lib/api';
import toast from 'react-hot-toast';
import { Search, Filter, Phone, Mail, MapPin, Building2, UploadCloud, Plus, ChevronRight, User } from 'lucide-react';

export default function VendorLeads() {
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedBrand, setSelectedBrand] = useState('');
  const [csvData, setCsvData] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const [newLead, setNewLead] = useState({
    brandId: '',
  });

  const { data: brandsData } = useQuery({
    queryKey: ['brands'],
    queryFn: () => brandsApi.list(),
  });

  const { data: citiesData } = useQuery({
    queryKey: ['cities'],
    queryFn: () => publicApi.cities(),
  });

  const { data: leadsData, isLoading } = useQuery({
    queryKey: ['leads', { brandId: selectedBrand }],
    queryFn: () => leadsApi.list(),
  });

  const brands = brandsData?.data?.data?.brands || [];
  const cities = citiesData?.data?.data?.cities || [];
  const leads = leadsData?.data?.data?.leads || [];

  const importMutation = useMutation({
    mutationFn: (data: { brandId: string; leads: any[] }) => leadsApi.import(data),
    onSuccess: () => {
      toast.success('Leads importés avec succès!');
      setShowImportModal(false);
      setCsvData([]);
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Erreur');
    },
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n').filter((line) => line.trim());
      const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());

      const parsed = lines.slice(1).map((line) => {
        const values = line.split(',');
        const obj: any = {};
        headers.forEach((header, index) => {
          obj[header] = values[index]?.trim();
        });
        return obj;
      });

      setCsvData(parsed);
    };
    reader.readAsText(file);
  };

  const statusColors: Record<string, string> = {
    NEW: 'primary',
    ASSIGNED: 'purple',
    CONTACTED: 'warning',
    INTERESTED: 'success',
    NOT_INTERESTED: 'danger',
    ORDERED: 'success',
    UNREACHABLE: 'gray',
    INVALID: 'danger',
  };

  return (
    <div className="space-y-6 pt-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-none">Base de Leads</h1>
          <p className="text-slate-500 mt-2 font-medium flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            {leads.length} Leads disponibles pour conversion
          </p>
        </div>
        <div className="flex gap-3">
          <Link 
            to="/dashboard/orders" 
            className="btn-premium px-6 py-3 bg-[#2c2f74] text-white flex items-center gap-2 rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-indigo-500/20 hover:-translate-y-0.5 transition-all"
          >
            <Plus size={16} /> Ajouter un Lead via Commandes
          </Link>
          <button 
            onClick={() => setShowImportModal(true)} 
            className="px-6 py-3 bg-white text-slate-600 border border-slate-200 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800 flex items-center gap-2 rounded-xl text-xs font-black uppercase tracking-widest shadow-sm transition-all"
          >
            <UploadCloud size={16} /> Importer Leads (CSV)
          </button>
        </div>
      </div>

      {/* Filter Bento Block */}
      <div className="bento-card bg-white border-none p-6 shadow-sm flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-3 text-sm font-black text-slate-400 uppercase tracking-widest bg-slate-50 px-4 py-2 rounded-xl">
          <Filter size={14} /> Filtres
        </div>
        <select
          className="bg-white border text-sm font-medium border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all text-slate-700 w-full sm:w-auto shadow-sm"
          value={selectedBrand}
          onChange={(e) => setSelectedBrand(e.target.value)}
        >
          <option value="">Toutes les marques (Global)</option>
          {brands.map((brand: any) => (
            <option key={brand.id} value={brand.id}>{brand.name}</option>
          ))}
        </select>
      </div>

      {/* Leads Main Area */}
      {isLoading ? (
        <div className="text-center py-20 flex flex-col items-center">
          <div className="w-12 h-12 border-4 border-slate-200 border-t-primary-500 rounded-full animate-spin mb-4" />
          <p className="font-black text-slate-400 uppercase tracking-widest text-xs">Chargement de la base...</p>
        </div>
      ) : leads.length === 0 ? (
        <div className="bento-card border-none bg-white p-12 text-center shadow-sm">
          <div className="w-24 h-24 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner border border-indigo-100">
            <User size={40} className="text-indigo-400" />
          </div>
          <h3 className="text-2xl font-black text-slate-900 tracking-tight leading-none mb-3">Votre base est vide</h3>
          <p className="text-slate-500 font-medium mb-8 max-w-sm mx-auto">Commencez par importer une liste de leads ou convertissez vos commandes en leads depuis le panneau de gestion.</p>
          <div className="flex items-center justify-center gap-4">
             <Link to="/dashboard/orders" className="btn-premium px-8 py-4 bg-[#2c2f74] text-white flex items-center gap-2 rounded-[1.5rem] text-xs font-black uppercase tracking-widest shadow-xl shadow-indigo-500/20 hover:-translate-y-1 transition-transform">
               Aller aux Commandes <ChevronRight size={16} />
             </Link>
          </div>
        </div>
      ) : (
        <div className="bento-card border-none bg-white overflow-hidden shadow-sm p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="text-left py-4 px-6 text-[10px] uppercase font-black tracking-widest text-slate-400">Origine & Contact</th>
                  <th className="text-left py-4 px-6 text-[10px] uppercase font-black tracking-widest text-slate-400">Coordonnées</th>
                  <th className="text-left py-4 px-6 text-[10px] uppercase font-black tracking-widest text-slate-400">Marque Partenaire</th>
                  <th className="text-left py-4 px-6 text-[10px] uppercase font-black tracking-widest text-slate-400">Statut CRM</th>
                  <th className="text-left py-4 px-6 text-[10px] uppercase font-black tracking-widest text-slate-400">Agent Délégué</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {leads.map((lead: any) => (
                  <tr key={lead.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 font-black shrink-0 border border-slate-200">
                          {lead.fullName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                           <div className="font-bold text-slate-900">{lead.fullName}</div>
                           <div className="text-xs text-slate-400 mt-0.5">{new Date(lead.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-2 text-sm text-slate-600 font-medium">
                          <Phone size={14} className="text-slate-400" /> {lead.phone}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                          <MapPin size={12} /> {lead.city || 'Non renseigné'}
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      {lead.brand ? (
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-bold border border-indigo-100">
                          <Building2 size={12} /> {lead.brand.name}
                        </div>
                      ) : (
                        <span className="text-slate-300 italic text-sm">-</span>
                      )}
                    </td>
                    <td className="py-4 px-6">
                      <span className={`px-3 py-1.5 rounded-lg text-[10px] uppercase font-black tracking-widest shadow-sm badge-${statusColors[lead.status] || 'gray'}`}>
                        {lead.status}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      {lead.assignedAgent ? (
                        <div className="flex items-center gap-2">
                           <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 text-[10px] font-black">{lead.assignedAgent.fullName.charAt(0)}</div>
                           <span className="text-sm font-semibold text-slate-700">{lead.assignedAgent.fullName}</span>
                        </div>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-1 rounded bg-slate-100 text-slate-400 text-[10px] font-black uppercase tracking-widest">En attente</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900">Importer des prospects</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="label">Marque *</label>
                <select
                  className="input"
                  value={newLead.brandId}
                  onChange={(e) => setNewLead({ ...newLead, brandId: e.target.value })}
                >
                  <option value="">Sélectionner une marque</option>
                  {brands.map((brand: any) => (
                    <option key={brand.id} value={brand.id}>{brand.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Fichier CSV</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  className="input"
                  onChange={handleFileUpload}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Format: fullName, phone, city, address (colonnes requises)
                </p>
              </div>

              {csvData.length > 0 && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm font-medium text-slate-700 mb-2">
                    {csvData.length} Leads détectés
                  </p>
                  <div className="text-xs text-gray-500 max-h-32 overflow-y-auto">
                    {csvData.slice(0, 5).map((row, i) => (
                      <div key={i}>{row.fullname || row.fullName} - {row.phone}</div>
                    ))}
                    {csvData.length > 5 && <div>...et {csvData.length - 5} autres</div>}
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button onClick={() => setShowImportModal(false)} className="btn-secondary flex-1">
                  Annuler
                </button>
                <button
                  onClick={() => {
                    if (!newLead.brandId) {
                      toast.error('Veuillez sélectionner une marque');
                      return;
                    }
                    importMutation.mutate({ brandId: newLead.brandId, leads: csvData });
                  }}
                  className="btn-primary flex-1"
                  disabled={csvData.length === 0 || importMutation.isPending}
                >
                  {importMutation.isPending ? 'Import...' : 'Importer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
