import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { leadsApi, brandsApi, publicApi } from '../../lib/api';
import toast from 'react-hot-toast';

export default function VendorLeads() {
  const [showImportModal, setShowImportModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedBrand, setSelectedBrand] = useState('');
  const [csvData, setCsvData] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const [newLead, setNewLead] = useState({
    fullName: '',
    phone: '',
    whatsapp: '',
    city: '',
    address: '',
    brandId: '',
    notes: '',
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
      toast.success('Prospects importés avec succès!');
      setShowImportModal(false);
      setCsvData([]);
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Erreur');
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => leadsApi.create(data),
    onSuccess: () => {
      toast.success('Prospect ajouté!');
      setShowAddModal(false);
      setNewLead({ fullName: '', phone: '', whatsapp: '', city: '', address: '', brandId: '', notes: '' });
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Prospects</h1>
          <p className="text-gray-500 mt-1">{leads.length} prospects au total</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setShowAddModal(true)} className="btn-secondary">
            + Ajouter
          </button>
          <button onClick={() => setShowImportModal(true)} className="btn-primary">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Importer CSV
          </button>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-4">
        <select
          className="input w-48"
          value={selectedBrand}
          onChange={(e) => setSelectedBrand(e.target.value)}
        >
          <option value="">Toutes les marques</option>
          {brands.map((brand: any) => (
            <option key={brand.id} value={brand.id}>{brand.name}</option>
          ))}
        </select>
      </div>

      {/* Leads Table */}
      {isLoading ? (
        <div className="text-center py-12">Chargement...</div>
      ) : leads.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">📞</span>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Aucun prospect</h3>
          <p className="text-gray-500 mb-6">Importez vos prospects pour commencer</p>
          <button onClick={() => setShowImportModal(true)} className="btn-primary">
            Importer des prospects
          </button>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Nom</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Téléphone</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Ville</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Marque</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Statut</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Agent</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {leads.map((lead: any) => (
                <tr key={lead.id} className="hover:bg-gray-50">
                  <td className="py-3 px-4 font-medium text-gray-900">{lead.fullName}</td>
                  <td className="py-3 px-4 text-gray-600">{lead.phone}</td>
                  <td className="py-3 px-4 text-gray-600">{lead.city || '-'}</td>
                  <td className="py-3 px-4 text-gray-600">{lead.brand?.name || '-'}</td>
                  <td className="py-3 px-4">
                    <span className={`badge-${statusColors[lead.status] || 'gray'}`}>
                      {lead.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-gray-600">{lead.assignedAgent?.fullName || '-'}</td>
                  <td className="py-3 px-4 text-gray-500 text-sm">
                    {new Date(lead.createdAt).toLocaleDateString('fr-FR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
                  <p className="text-sm font-medium text-gray-700 mb-2">
                    {csvData.length} prospects détectés
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

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900">Ajouter un prospect</h2>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createMutation.mutate(newLead);
              }}
              className="p-6 space-y-4"
            >
              <div>
                <label className="label">Nom complet *</label>
                <input
                  type="text"
                  className="input"
                  value={newLead.fullName}
                  onChange={(e) => setNewLead({ ...newLead, fullName: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="label">Téléphone *</label>
                <input
                  type="tel"
                  className="input"
                  placeholder="+212 6XX-XXXXXX"
                  value={newLead.phone}
                  onChange={(e) => setNewLead({ ...newLead, phone: e.target.value })}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Ville</label>
                  <select
                    className="input"
                    value={newLead.city}
                    onChange={(e) => setNewLead({ ...newLead, city: e.target.value })}
                  >
                    <option value="">Sélectionner</option>
                    {cities.map((city: any) => (
                      <option key={city.id} value={city.nameFr}>{city.nameFr}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Marque *</label>
                  <select
                    className="input"
                    value={newLead.brandId}
                    onChange={(e) => setNewLead({ ...newLead, brandId: e.target.value })}
                    required
                  >
                    <option value="">Sélectionner</option>
                    {brands.map((brand: any) => (
                      <option key={brand.id} value={brand.id}>{brand.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowAddModal(false)} className="btn-secondary flex-1">
                  Annuler
                </button>
                <button type="submit" className="btn-primary flex-1" disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Ajout...' : 'Ajouter'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
