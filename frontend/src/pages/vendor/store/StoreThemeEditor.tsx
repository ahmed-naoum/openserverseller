import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { vendorStoreApi } from '../../../lib/api';
import toast from 'react-hot-toast';
import { ArrowLeft, Save, Palette, Type, Bell, Layout, Check, Sparkles } from 'lucide-react';

const COLOR_PRESETS = [
  { name: 'Orange Sila', value: '#f97316' },
  { name: 'Bleu Royal', value: '#2563eb' },
  { name: 'Vert Émeraude', value: '#10b981' },
  { name: 'Violet Luxe', value: '#8b5cf6' },
  { name: 'Rose Boutique', value: '#ec4899' },
  { name: 'Noir Élégant', value: '#0f172a' },
  { name: 'Rouge Passion', value: '#ef4444' },
  { name: 'Doré Ambre', value: '#d97706' },
];

const THEME_PRESETS = [
  {
    id: 'MODERN_MINIMAL',
    name: 'Modern Minimal',
    desc: 'Design épuré et moderne, idéal pour tout type de produits et marques.',
  },
  {
    id: 'HIGH_CONVERT_COD',
    name: 'High-Conversion COD',
    desc: 'Optimisé pour le marché marocain avec badges de réassurance et boutons d\'action proéminents.',
  },
  {
    id: 'BOUTIQUE',
    name: 'Boutique Élégante',
    desc: 'Ambiance raffinée mettant en valeur la photographie et les collections.',
  },
];

const FONT_PRESETS = ['Inter', 'Cairo', 'Tajawal', 'Outfit', 'Poppins'];

export default function StoreThemeEditor() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    themeName: 'MODERN_MINIMAL',
    primaryColor: '#f97316',
    secondaryColor: '#1e293b',
    fontFamily: 'Inter',
    headerStyle: 'STICKY',
    announcementText: '',
    announcementActive: true,
  });

  useEffect(() => {
    vendorStoreApi
      .getMyStore()
      .then((res) => {
        const s = res.data?.data?.store;
        if (s) {
          setForm({
            themeName: s.themeName || 'MODERN_MINIMAL',
            primaryColor: s.primaryColor || '#f97316',
            secondaryColor: s.secondaryColor || '#1e293b',
            fontFamily: s.fontFamily || 'Inter',
            headerStyle: s.headerStyle || 'STICKY',
            announcementText: s.announcementText || '',
            announcementActive: s.announcementActive !== false,
          });
        }
      })
      .catch((err) => console.error('Failed to load theme settings:', err))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      await vendorStoreApi.updateMyStore(form);
      toast.success('Thème et apparence mis à jour !');
    } catch (err: any) {
      console.error('Failed to save theme:', err);
      toast.error('Erreur lors de la sauvegarde du thème.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link
          to="/dashboard/store"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Retour à l'aperçu</span>
        </Link>

        <button
          type="submit"
          disabled={saving}
          className="px-6 py-2.5 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          <span>{saving ? 'Enregistrement...' : 'Enregistrer le thème'}</span>
        </button>
      </div>

      <div className="space-y-6">
        {/* 1. Theme Presets */}
        <div className="bg-white rounded-3xl border border-gray-100 p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex items-center gap-2.5 pb-4 border-b border-gray-100">
            <Layout className="w-5 h-5 text-purple-500" />
            <h2 className="text-base font-black text-gray-900">Modèle de Thème</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {THEME_PRESETS.map((t) => {
              const isSelected = form.themeName === t.id;
              return (
                <div
                  key={t.id}
                  onClick={() => setForm((prev) => ({ ...prev, themeName: t.id }))}
                  className={`p-5 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                    isSelected ? 'border-orange-500 bg-orange-50/20 shadow-md' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-black text-gray-900">{t.name}</h3>
                      {isSelected && <Check className="w-4 h-4 text-orange-600" />}
                    </div>
                    <p className="text-xs text-gray-500">{t.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 2. Brand Colors */}
        <div className="bg-white rounded-3xl border border-gray-100 p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex items-center gap-2.5 pb-4 border-b border-gray-100">
            <Palette className="w-5 h-5 text-orange-500" />
            <h2 className="text-base font-black text-gray-900">Couleurs de la Marque</h2>
          </div>

          <div className="space-y-4">
            <label className="block text-xs font-bold text-gray-700">Couleur Principale (Boutons, Accents, Prix)</label>

            {/* Presets */}
            <div className="flex flex-wrap gap-3">
              {COLOR_PRESETS.map((c) => {
                const isSelected = form.primaryColor.toLowerCase() === c.value.toLowerCase();
                return (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, primaryColor: c.value }))}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold transition-all ${
                      isSelected ? 'border-gray-900 shadow-sm' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <span className="w-4 h-4 rounded-full border border-black/10" style={{ backgroundColor: c.value }} />
                    <span>{c.name}</span>
                  </button>
                );
              })}
            </div>

            {/* Custom Input */}
            <div className="flex items-center gap-3 pt-2 max-w-xs">
              <input
                type="color"
                value={form.primaryColor}
                onChange={(e) => setForm((prev) => ({ ...prev, primaryColor: e.target.value }))}
                className="w-10 h-10 rounded-xl cursor-pointer border-0 p-0"
              />
              <input
                type="text"
                value={form.primaryColor}
                onChange={(e) => setForm((prev) => ({ ...prev, primaryColor: e.target.value }))}
                placeholder="#f97316"
                className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono font-bold"
              />
            </div>
          </div>
        </div>

        {/* 3. Typography & Fonts */}
        <div className="bg-white rounded-3xl border border-gray-100 p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex items-center gap-2.5 pb-4 border-b border-gray-100">
            <Type className="w-5 h-5 text-blue-500" />
            <h2 className="text-base font-black text-gray-900">Typographie</h2>
          </div>

          <div className="space-y-3">
            <label className="block text-xs font-bold text-gray-700">Police de Caractères</label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {FONT_PRESETS.map((f) => {
                const isSelected = form.fontFamily === f;
                return (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, fontFamily: f }))}
                    className={`p-3 rounded-xl border text-xs font-bold transition-all text-center ${
                      isSelected ? 'border-orange-500 bg-orange-50 text-orange-950 font-black' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {f}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* 4. Top Announcement Bar */}
        <div className="bg-white rounded-3xl border border-gray-100 p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-gray-100">
            <div className="flex items-center gap-2.5">
              <Bell className="w-5 h-5 text-amber-500" />
              <h2 className="text-base font-black text-gray-900">Bandeau d'Annonce Supérieur</h2>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={form.announcementActive}
                onChange={(e) => setForm((prev) => ({ ...prev, announcementActive: e.target.checked }))}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-600" />
            </label>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Texte de l'annonce</label>
            <input
              type="text"
              value={form.announcementText}
              onChange={(e) => setForm((prev) => ({ ...prev, announcementText: e.target.value }))}
              placeholder="Ex: Livraison express 24/48h partout au Maroc — Paiement à la livraison !"
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
        </div>
      </div>
    </form>
  );
}
