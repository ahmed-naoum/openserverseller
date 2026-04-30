import { useState, useEffect } from 'react';
import { X, Palette, Type, Check, LayoutTemplate, Loader2, Save } from 'lucide-react';
import { helperApi } from '../../lib/api';
import toast from 'react-hot-toast';

interface LandingPageBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  linkId: number;
}

export default function LandingPageBuilderModal({ isOpen, onClose, linkId }: LandingPageBuilderModalProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    buttonText: 'Commander Maintenant',
    themeColor: '#f97316',
    customStructure: {} as any
  });

  useEffect(() => {
    if (isOpen && linkId) {
      loadData();
    }
  }, [isOpen, linkId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await helperApi.getLandingPage(linkId);
      if (res.data) {
        setFormData({
          title: res.data.title || '',
          description: res.data.description || '',
          buttonText: res.data.buttonText || 'Commander Maintenant',
          themeColor: res.data.themeColor || '#f97316',
          customStructure: res.data.customStructure || {}
        });
      }
    } catch {
      toast.error('Erreur lors du chargement des paramètres');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await helperApi.updateLandingPage(linkId, formData);
      toast.success('Paramètres sauvegardés avec succès !');
      onClose();
    } catch {
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center">
              <LayoutTemplate className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-black text-gray-900 tracking-tight">Constructeur de Page</h2>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mt-0.5">Configurer l'apparence et le texte</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-48 space-y-4">
              <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
              <p className="text-sm font-medium text-gray-500">Chargement des paramètres...</p>
            </div>
          ) : (
            <form id="builder-form" onSubmit={handleSubmit} className="space-y-6">
              
              {/* Theme Settings */}
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/80 flex items-center gap-2">
                  <Palette className="w-4 h-4 text-orange-500" />
                  <h3 className="text-sm font-bold text-gray-900">Apparence</h3>
                </div>
                <div className="p-5">
                  <label className="block text-sm font-bold text-gray-700 mb-2">Couleur Principale</label>
                  <div className="flex items-center gap-4">
                    <input
                      type="color"
                      value={formData.themeColor}
                      onChange={(e) => setFormData(prev => ({ ...prev, themeColor: e.target.value }))}
                      className="h-10 w-20 p-1 rounded-lg border border-gray-200 cursor-pointer bg-white"
                    />
                    <input
                      type="text"
                      value={formData.themeColor}
                      onChange={(e) => setFormData(prev => ({ ...prev, themeColor: e.target.value }))}
                      className="input flex-1 font-mono uppercase"
                      pattern="^#[0-9A-Fa-f]{6}$"
                      placeholder="#F97316"
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-2">Utilisée pour les boutons et les éléments d'accentuation.</p>
                </div>
              </div>

              {/* Text Settings */}
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/80 flex items-center gap-2">
                  <Type className="w-4 h-4 text-orange-500" />
                  <h3 className="text-sm font-bold text-gray-900">Mots Clés & Textes</h3>
                </div>
                <div className="p-5 space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Titre de la Page (Optionnel)</label>
                    <input
                      type="text"
                      className="input w-full font-medium"
                      placeholder="Ex: Offre Spéciale Exclusivité !"
                      value={formData.title}
                      onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Description / Accroche (Optionnel)</label>
                    <textarea
                      rows={3}
                      className="input w-full resize-none font-medium"
                      placeholder="Saisissez une courte description incitative..."
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Texte du Bouton d'Achat</label>
                    <input
                      type="text"
                      required
                      className="input w-full font-medium"
                      placeholder="Commander Maintenant"
                      value={formData.buttonText}
                      onChange={(e) => setFormData(prev => ({ ...prev, buttonText: e.target.value }))}
                    />
                  </div>
                </div>
              </div>

            </form>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-100 bg-gray-50/50 flex gap-3 justify-end items-center">
          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary px-6"
            disabled={loading || saving}
          >
            Annuler
          </button>
          <button
            type="submit"
            form="builder-form"
            disabled={loading || saving}
            className="btn btn-primary px-8 flex items-center gap-2"
          >
            {saving ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="font-bold">Enregistrement...</span>
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                <span className="font-bold">Sauvegarder</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
