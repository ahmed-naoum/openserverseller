import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { authApi } from '../../lib/api';

export default function Profile() {
  const [activeTab, setActiveTab] = useState<'general' | 'banking' | 'kyc'>('general');

  const { data: userData, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: () => authApi.me(),
  });

  const user = userData?.data?.data?.user;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mon Profil</h1>
          <p className="mt-1 text-sm text-gray-500">Gérez vos informations B2B, vos coordonnées bancaires et vos documents légaux.</p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar Tabs */}
        <div className="w-full lg:w-64 flex-shrink-0">
          <div className="card sticky top-6 overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-grosseller-100 flex items-center justify-center text-grosseller-700 font-bold text-lg">
                {user?.fullName?.charAt(0) || 'G'}
              </div>
              <div>
                <p className="font-semibold text-gray-900">{user?.fullName}</p>
                <p className="text-xs text-gray-500 capitalize">{user?.roleName?.toLowerCase()}</p>
              </div>
            </div>
            <nav className="p-2 flex flex-col gap-1">
              <button
                onClick={() => setActiveTab('general')}
                className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === 'general' ? 'bg-grosseller-50 text-grosseller-700' : 'text-gray-600 hover:bg-gray-50'}`}
              >
                <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                Informations Générales
              </button>
              <button
                onClick={() => setActiveTab('banking')}
                className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === 'banking' ? 'bg-grosseller-50 text-grosseller-700' : 'text-gray-600 hover:bg-gray-50'}`}
              >
                <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
                Coordonnées Bancaires
              </button>
              <button
                onClick={() => setActiveTab('kyc')}
                className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === 'kyc' ? 'bg-grosseller-50 text-grosseller-700' : 'text-gray-600 hover:bg-gray-50'}`}
              >
                <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                Documents & KYC
              </button>
            </nav>
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1">
          <div className="card p-6 min-h-[500px]">
            {isLoading ? (
              <div className="text-center py-12 text-gray-500">Chargement...</div>
            ) : (
              <>
                {activeTab === 'general' && (
                  <div className="space-y-6 animate-in fade-in">
                    <h2 className="text-lg font-bold text-gray-900 mb-6 border-b pb-2">Informations Générales</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="label">Nom Complet</label>
                        <input type="text" className="input" defaultValue={user?.fullName || ''} />
                      </div>
                      <div>
                        <label className="label">Email de contact</label>
                        <input type="email" className="input bg-gray-50 text-gray-500" readOnly defaultValue={user?.email || ''} />
                        <p className="text-xs text-gray-400 mt-1">L'email ne peut être changé que par le support.</p>
                      </div>
                      <div>
                        <label className="label">Numéro de téléphone</label>
                        <input type="tel" className="input" defaultValue={user?.phone || ''} />
                      </div>
                      <div>
                        <label className="label">Nom de l'entreprise (Optionnel)</label>
                        <input type="text" className="input" placeholder="Ex: Ma Société SARL" />
                      </div>
                    </div>
                    <div className="pt-4 flex justify-end">
                      <button className="btn bg-grosseller-600 hover:bg-grosseller-700 text-white">Enregistrer les modifications</button>
                    </div>
                  </div>
                )}

                {activeTab === 'banking' && (
                  <div className="space-y-6 animate-in fade-in">
                    <h2 className="text-lg font-bold text-gray-900 mb-6 border-b pb-2">Coordonnées Bancaires (RIB)</h2>
                    <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-6 flex gap-3 text-blue-800 text-sm">
                      <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      <p>Ces informations seront utilisées pour traiter vos paiements et retraits. Assurez-vous qu'elles sont exactes.</p>
                    </div>
                    <div className="grid grid-cols-1 gap-6">
                      <div>
                        <label className="label">Nom de la Banque</label>
                        <input type="text" className="input" placeholder="Ex: Attijariwafa Bank, BMCE..." />
                      </div>
                      <div>
                        <label className="label">Nom du Titulaire</label>
                        <input type="text" className="input" placeholder="Le nom tel qu'il apparaît sur votre compte" />
                      </div>
                      <div>
                        <label className="label">RIB à 24 chiffres</label>
                        <input type="text" className="input font-mono" placeholder="000 000 000 000 000 000 000 000" maxLength={24} />
                      </div>
                    </div>
                    <div className="pt-4 flex justify-end">
                      <button className="btn bg-grosseller-600 hover:bg-grosseller-700 text-white">Mettre à jour le RIB</button>
                    </div>
                  </div>
                )}

                {activeTab === 'kyc' && (
                  <div className="space-y-6 animate-in fade-in">
                    <h2 className="text-lg font-bold text-gray-900 mb-6 border-b pb-2">Documents & KYC</h2>
                    
                    <div className="border border-gray-200 rounded-lg p-5 flex items-start gap-4 hover:border-grosseller-300 transition-colors">
                      <div className="p-3 bg-gray-50 rounded-lg text-gray-500">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" /></svg>
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 mb-1">Pièce d'identité (CIN / Passeport)</h3>
                        <p className="text-sm text-gray-500 mb-3">Requis pour vérifier votre identité afin de traiter les paiements.</p>
                        <button className="text-sm font-medium text-grosseller-600 hover:text-grosseller-700 flex items-center gap-1">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                          Téléverser un document
                        </button>
                      </div>
                      <div className="flex-shrink-0">
                        <span className="px-2.5 py-1 bg-yellow-100 text-yellow-700 text-xs font-bold rounded-full">Non vérifié</span>
                      </div>
                    </div>

                    <div className="border border-gray-200 rounded-lg p-5 flex items-start gap-4 hover:border-grosseller-300 transition-colors">
                      <div className="p-3 bg-gray-50 rounded-lg text-gray-500">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 mb-1">Registre de Commerce / Patente (Optionnel)</h3>
                        <p className="text-sm text-gray-500 mb-3">Si vous opérez en tant qu'entité commerciale.</p>
                        <button className="text-sm font-medium text-grosseller-600 hover:text-grosseller-700 flex items-center gap-1">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                          Téléverser un document
                        </button>
                      </div>
                      <div className="flex-shrink-0">
                        <span className="px-2.5 py-1 bg-gray-100 text-gray-600 text-xs font-bold rounded-full">Facultatif</span>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
