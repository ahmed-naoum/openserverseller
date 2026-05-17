import React, { useState } from 'react';
import { Landmark, X, Search, ChevronDown, Check } from 'lucide-react';

export const MOROCCAN_BANKS = [
  { id: 'cih', name: 'CIH BANK', logo: '/banks/cih.png' },
  { id: 'attijari', name: 'ATTIJARIWAFA BANK', logo: '/banks/attijari.png' },
  { id: 'barid', name: 'AL BARID BANK', logo: '/banks/albarid-bank.png' },
  { id: 'boa', name: 'BANK OF AFRICA', logo: '/banks/boa_nouveau_logo.png' },
  { id: 'bp', name: 'BANQUE POPULAIRE', logo: '/banks/bcp_logo.png' },
  { id: 'bmci', name: 'BMCI', logo: '/banks/bmci.png' },
  { id: 'cam', name: 'CREDIT AGRICOLE', logo: '/banks/ca.png' },
  { id: 'cfg', name: 'CFG BANK', logo: '/banks/cfg.png' },
  { id: 'cdg', name: 'CDG CAPITAL', logo: '/banks/cdg_capital_logo.png' },
  { id: 'cdm', name: 'CREDIT DU MAROC', logo: '/banks/cdm.png' },
  { id: 'sg', name: 'SOCIETE GENERALE', logo: '/banks/logo-societe-generale.png' },
  { id: 'assafa', name: 'BANK ASSAFA', logo: '/banks/bank_assafa.png' },
  { id: 'alyousr', name: 'BANK AL YOUSR', logo: '/banks/Bank_Al_Yousr.png' },
  { id: 'umnia', name: 'UMNIA BANK', logo: '/banks/Umnia_Bank.png' },
];

interface BankSelectProps {
  value: string;
  onChange: (bankName: string) => void;
}

export default function BankSelect({ value, onChange }: BankSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [customBank, setCustomBank] = useState('');

  const isPredefinedBank = MOROCCAN_BANKS.some((b) => b.name === value);
  const displayValue = value || 'Sélectionner une banque';
  
  // Find selected bank object for logo display in the trigger button
  const selectedBankObj = MOROCCAN_BANKS.find(b => b.name === value);

  const handleSelect = (name: string) => {
    onChange(name);
    setIsOpen(false);
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (customBank.trim()) {
      handleSelect(customBank.trim());
    }
  };

  const filteredBanks = MOROCCAN_BANKS.filter(b => 
    b.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <>
      {/* Trigger Button */}
      <div className="space-y-1.5">
        <label className="block text-sm font-bold text-slate-600">Banque *</label>
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="w-full flex items-center justify-between px-4 py-3 bg-white border-2 border-slate-200 rounded-xl focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 outline-none transition-all text-sm font-medium text-left"
        >
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-8 h-8 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center flex-shrink-0 p-1">
              {selectedBankObj ? (
                <img 
                  src={selectedBankObj.logo} 
                  alt={selectedBankObj.name} 
                  className="max-h-full max-w-full object-contain"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    if (e.currentTarget.nextElementSibling) {
                      (e.currentTarget.nextElementSibling as HTMLElement).style.display = 'block';
                    }
                  }}
                />
              ) : (
                <Landmark size={14} className="text-slate-400" />
              )}
              <div style={{ display: selectedBankObj ? 'none' : 'block' }} className="text-slate-400">
                <Landmark size={14} />
              </div>
            </div>
            <span className={`truncate ${!value ? 'text-slate-400' : 'text-slate-800 font-bold'}`}>
              {displayValue}
            </span>
          </div>
          <ChevronDown size={18} className="text-slate-400 flex-shrink-0" />
        </button>
      </div>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col relative animate-in zoom-in-95 duration-200">
            
            {/* Header */}
            <div className="flex items-center justify-between p-5 sm:p-6 border-b border-slate-100 bg-slate-50 rounded-t-3xl">
              <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                <Landmark size={20} className="text-primary-500" />
                Sélectionner votre banque
              </h3>
              <button 
                onClick={() => setIsOpen(false)}
                className="p-2 bg-white hover:bg-slate-200 text-slate-500 rounded-full transition-colors border border-slate-200"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 sm:p-6 overflow-y-auto custom-scrollbar flex-1">
              
              {/* Search */}
              <div className="relative mb-6">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Rechercher une banque..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-primary-500 focus:bg-white outline-none transition-all text-sm font-medium"
                />
              </div>

              {/* Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {filteredBanks.map((bank) => {
                  const isSelected = value === bank.name;
                  return (
                    <button
                      key={bank.id}
                      type="button"
                      onClick={() => handleSelect(bank.name)}
                      className={`relative flex flex-col items-center justify-center p-3 h-28 rounded-xl border-2 transition-all group ${
                        isSelected
                          ? 'border-primary-600 bg-primary-50/50 shadow-md transform scale-[1.02]'
                          : 'border-slate-100 bg-white hover:border-primary-300 hover:shadow-sm'
                      }`}
                    >
                      {isSelected && (
                        <div className="absolute top-2 right-2 w-5 h-5 bg-primary-600 rounded-full flex items-center justify-center text-white shadow-sm">
                          <Check size={12} strokeWidth={3} />
                        </div>
                      )}
                      <div className="flex-1 flex items-center justify-center w-full mb-2">
                        <img 
                          src={bank.logo} 
                          alt={bank.name} 
                          className="max-h-8 max-w-full object-contain transition-transform group-hover:scale-105"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            if (e.currentTarget.nextElementSibling) {
                              (e.currentTarget.nextElementSibling as HTMLElement).style.display = 'block';
                            }
                          }}
                        />
                        <div style={{ display: 'none' }} className={`transition-colors ${isSelected ? 'text-primary-500' : 'text-slate-300 group-hover:text-primary-400'}`}>
                          <Landmark size={24} />
                        </div>
                      </div>
                      <span className={`text-[10px] sm:text-[11px] font-black text-center leading-tight uppercase tracking-wider ${
                        isSelected ? 'text-primary-800' : 'text-slate-600 group-hover:text-slate-800'
                      }`}>
                        {bank.name}
                      </span>
                    </button>
                  );
                })}
              </div>
              
              {filteredBanks.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-slate-500 text-sm font-medium">Aucune banque trouvée pour "{searchTerm}"</p>
                </div>
              )}

              {/* Custom Bank */}
              <div className="mt-8 pt-6 border-t border-slate-100">
                <h4 className="text-sm font-bold text-slate-700 mb-3">Votre banque n'est pas dans la liste ?</h4>
                <form onSubmit={handleCustomSubmit} className="flex gap-2">
                  <input
                    type="text"
                    value={customBank}
                    onChange={(e) => setCustomBank(e.target.value)}
                    placeholder="Saisissez le nom de votre banque..."
                    className="flex-1 px-4 py-3 bg-white border border-slate-200 rounded-xl focus:border-primary-500 outline-none transition-all text-sm font-medium"
                  />
                  <button
                    type="submit"
                    disabled={!customBank.trim()}
                    className="px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold transition-all disabled:opacity-50 text-sm whitespace-nowrap"
                  >
                    Confirmer
                  </button>
                </form>
              </div>

            </div>
          </div>
        </div>
      )}
    </>
  );
}
