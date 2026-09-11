import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { vendorStoreApi } from '../../../lib/api';
import toast from 'react-hot-toast';
import { ArrowLeft, Save, Globe, Phone, Mail, MessageCircle, Truck, Image, FileText } from 'lucide-react';

export default function StoreSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: '',
    slug: '',
    tagline: '',
    description: '',
    logoUrl: '',
    bannerUrl: '',
    faviconUrl: '',
    contactEmail: '',
    contactPhone: '',
    whatsappNumber: '',
    instagramUrl: '',
    facebookUrl: '',
    tiktokUrl: '',
    standardShippingFee: 0,
    freeShippingThreshold: '',
  });

  useEffect(() => {
    vendorStoreApi
      .getMyStore()
      .then((res) => {
        const s = res.data?.data?.store;
        if (s) {
          setForm({
            name: s.name || '',
            slug: s.slug || '',
            tagline: s.tagline || '',
            description: s.description || '',
            logoUrl: s.logoUrl || '',
            bannerUrl: s.bannerUrl || '',
            faviconUrl: s.faviconUrl || '',
            contactEmail: s.contactEmail || '',
            contactPhone: s.contactPhone || '',
            whatsappNumber: s.whatsappNumber || '',
            instagramUrl: s.instagramUrl || '',
            facebookUrl: s.facebookUrl || '',
            tiktokUrl: s.tiktokUrl || '',
            standardShippingFee: s.standardShippingFee || 0,
            freeShippingThreshold: s.freeShippingThreshold !== null && s.freeShippingThreshold !== undefined ? String(s.freeShippingThreshold) : '',
          });
        }
      })
      .catch((err) => console.error('Failed to load store settings:', err))
      .finally(() => setLoading(false));
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.name.trim()) {
      toast.error('Le nom de la boutique est obligatoire.');
      return;
    }

    try {
      setSaving(true);

      const payload = {
        ...form,
        standardShippingFee: Number(form.standardShippingFee) || 0,
        freeShippingThreshold: form.freeShippingThreshold.trim() ? Number(form.freeShippingThreshold) : null,
      };

      await vendorStoreApi.updateMyStore(payload);
      toast.success('Paramètres de la boutique enregistrés avec succès !');
    } catch (err: any) {
      console.error('Failed to save store:', err);
      toast.error(err?.response?.data?.message || 'Erreur lors de la sauvegarde.');
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
      {/* Top Action Bar */}
      <div className="flex items-center justify-between">
        <Link
          to="/dashboard/store"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Retour à l'aperçu boutique</span>
        </Link>

        <button
          type="submit"
          disabled={saving}
          className="px-6 py-2.5 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          <span>{saving ? 'Enregistrement...' : 'Enregistrer les modifications'}</span>
        </button>
      </div>

      <div className="space-y-6">
        {/* Section 1: Identity */}
        <div className="bg-white rounded-3xl border border-gray-100 p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex items-center gap-2.5 pb-4 border-b border-gray-100">
            <Globe className="w-5 h-5 text-orange-500" />
            <h2 className="text-base font-black text-gray-900">Identité & Informations Générales</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Nom de la boutique *</label>
              <input
                type="text"
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="Ex: Atlas Cuir Maroc"
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Identifiant URL (Slug)</label>
              <input
                type="text"
                name="slug"
                value={form.slug}
                onChange={handleChange}
                placeholder="Ex: atlas-cuir"
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Slogan / Tagline</label>
            <input
              type="text"
              name="tagline"
              value={form.tagline}
              onChange={handleChange}
              placeholder="Ex: Artisanat authentique et maroquinerie de luxe"
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Description</label>
            <textarea
              name="description"
              rows={3}
              value={form.description}
              onChange={handleChange}
              placeholder="Présentez brièvement votre boutique et vos engagements qualité..."
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
            />
          </div>
        </div>

        {/* Section 2: Branding Images */}
        <div className="bg-white rounded-3xl border border-gray-100 p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex items-center gap-2.5 pb-4 border-b border-gray-100">
            <Image className="w-5 h-5 text-purple-500" />
            <h2 className="text-base font-black text-gray-900">Images de Marque & Logo</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">URL du Logo</label>
              <input
                type="text"
                name="logoUrl"
                value={form.logoUrl}
                onChange={handleChange}
                placeholder="https://..."
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
              {form.logoUrl && (
                <div className="mt-2 p-2 bg-gray-50 rounded-xl border border-gray-100 flex items-center justify-center h-16">
                  <img src={form.logoUrl} alt="Logo" className="max-h-full max-w-full object-contain" />
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">URL de la Bannière</label>
              <input
                type="text"
                name="bannerUrl"
                value={form.bannerUrl}
                onChange={handleChange}
                placeholder="https://..."
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
              {form.bannerUrl && (
                <div className="mt-2 p-2 bg-gray-50 rounded-xl border border-gray-100 flex items-center justify-center h-16">
                  <img src={form.bannerUrl} alt="Bannière" className="max-h-full max-w-full object-cover rounded" />
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">URL du Favicon</label>
              <input
                type="text"
                name="faviconUrl"
                value={form.faviconUrl}
                onChange={handleChange}
                placeholder="https://..."
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Contact & Support */}
        <div className="bg-white rounded-3xl border border-gray-100 p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex items-center gap-2.5 pb-4 border-b border-gray-100">
            <MessageCircle className="w-5 h-5 text-emerald-500" />
            <h2 className="text-base font-black text-gray-900">Coordonnées & Support Client</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Numéro WhatsApp Support</label>
              <input
                type="text"
                name="whatsappNumber"
                value={form.whatsappNumber}
                onChange={handleChange}
                placeholder="Ex: 0612345678"
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Téléphone Appel</label>
              <input
                type="text"
                name="contactPhone"
                value={form.contactPhone}
                onChange={handleChange}
                placeholder="Ex: 0522000000"
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Email de Contact</label>
              <input
                type="email"
                name="contactEmail"
                value={form.contactEmail}
                onChange={handleChange}
                placeholder="contact@boutique.ma"
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
          </div>
        </div>

        {/* Section 4: Shipping Settings */}
        <div className="bg-white rounded-3xl border border-gray-100 p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex items-center gap-2.5 pb-4 border-b border-gray-100">
            <Truck className="w-5 h-5 text-indigo-500" />
            <h2 className="text-base font-black text-gray-900">Tarification de la Livraison</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Frais de livraison standard (MAD)
              </label>
              <input
                type="number"
                name="standardShippingFee"
                value={form.standardShippingFee}
                onChange={handleChange}
                min="0"
                placeholder="0 = Gratuit"
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
              <span className="text-[11px] text-gray-400 mt-1 block">
                Ex: 0 pour livraison 100% offerte, ou 35 MAD.
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Seuil pour livraison gratuite (MAD)
              </label>
              <input
                type="number"
                name="freeShippingThreshold"
                value={form.freeShippingThreshold}
                onChange={handleChange}
                min="0"
                placeholder="Ex: 300"
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
              <span className="text-[11px] text-gray-400 mt-1 block">
                La livraison devient gratuite dès que le sous-total dépasse ce montant.
              </span>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
