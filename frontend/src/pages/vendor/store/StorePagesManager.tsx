import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { vendorStoreApi } from '../../../lib/api';
import { buildStoreUrl } from '../../../utils/referral';
import toast from 'react-hot-toast';
import { ArrowLeft, Plus, Edit2, Trash2, FileText, X, ExternalLink, LayoutTemplate } from 'lucide-react';
import { swal } from '../../../components/ui/SweetAlert';
import { currentBasePath } from '../../../lib/dashboardBase';
import { useAuth } from '../../../contexts/AuthContext';

export default function StorePagesManager() {
  const { user } = useAuth() as any;
  const [pages, setPages] = useState<any[]>([]);
  const [store, setStore] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPage, setEditingPage] = useState<any>(null);

  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    contentHtml: '',
    isPublished: true,
  });

  const loadPages = async () => {
    try {
      setLoading(true);
      const [pagesRes, storeRes] = await Promise.all([
        vendorStoreApi.getPages(),
        vendorStoreApi.getMyStore().catch(() => ({ data: { data: { store: null } } })),
      ]);
      setPages(pagesRes.data?.data?.pages || []);
      setStore(storeRes.data?.data?.store || null);
    } catch (err) {
      console.error('Failed to load store pages:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPages();
  }, []);

  const openCreateModal = () => {
    setEditingPage(null);
    setFormData({
      title: '',
      slug: '',
      contentHtml: '',
      isPublished: true,
    });
    setModalOpen(true);
  };

  const openEditModal = (pg: any) => {
    setEditingPage(pg);
    setFormData({
      title: pg.title || '',
      slug: pg.slug || '',
      contentHtml: pg.contentHtml || '',
      isPublished: pg.isPublished !== false,
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      toast.error('Le titre est requis.');
      return;
    }

    try {
      if (editingPage) {
        await vendorStoreApi.updatePage(editingPage.id, formData);
        toast.success('Page mise à jour !');
      } else {
        await vendorStoreApi.createPage(formData);
        toast.success('Page créée avec succès !');
      }
      setModalOpen(false);
      loadPages();
    } catch (err: any) {
      console.error('Save page error:', err);
      toast.error('Erreur lors de la sauvegarde de la page.');
    }
  };

  const handleDelete = async (id: number) => {
    if (!(await swal.danger({ title: 'Supprimer cette page ?', text: 'Cette action est irréversible.', confirmText: 'Supprimer' }))) return;
    try {
      await vendorStoreApi.deletePage(id);
      toast.success('Page supprimée.');
      loadPages();
    } catch (err: any) {
      console.error('Delete page error:', err);
      toast.error('Erreur lors de la suppression.');
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
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link
          to="/dashboard/store"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Retour à l'aperçu boutique</span>
        </Link>

        <button
          onClick={openCreateModal}
          className="px-5 py-2.5 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>Nouvelle Page</span>
        </button>
      </div>

      <div className="bg-white rounded-3xl border border-gray-100 p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex items-center gap-2.5 pb-4 border-b border-gray-100">
          <FileText className="w-5 h-5 text-emerald-500" />
          <div>
            <h1 className="text-lg font-black text-gray-900">Pages Personnalisées & Politiques</h1>
            <p className="text-xs text-gray-500 mt-0.5">Ajoutez vos politiques de retour, livraison, à propos et mentions légales.</p>
          </div>
        </div>

        {pages.length === 0 ? (
          <div className="py-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-500 flex items-center justify-center mx-auto">
              <FileText className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-gray-900">Aucune page personnalisée</h3>
            <p className="text-xs text-gray-500 max-w-sm mx-auto">
              Créez des pages statiques pour rassurer vos clients et présenter votre marque.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {pages.map((pg) => (
              <div key={pg.id} className="py-4 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-gray-900">{pg.title}</h3>
                  <span className="text-xs font-mono text-gray-400">/pages/{pg.slug}</span>
                </div>

                <div className="flex items-center gap-2">
                  <a
                    href={buildStoreUrl(`/pages/${pg.slug}`, store?.user?.subdomain || store?.slug, store?.user?.customDomain, store?.user?.customDomainStatus)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 text-gray-500 hover:text-orange-600 rounded-lg hover:bg-orange-50 transition-colors flex items-center gap-1.5 text-xs font-semibold"
                    title="Voir la page"
                  >
                    <ExternalLink className="w-4 h-4 text-orange-500" />
                    <span className="hidden sm:inline">Voir la page</span>
                  </a>
                  <Link
                    to={`${currentBasePath(user?.role)}/store/studio/pages/${pg.id}`}
                    className="p-2 text-indigo-600 hover:text-indigo-800 rounded-lg hover:bg-indigo-50 flex items-center gap-1.5 text-xs font-bold"
                    title="Ouvrir dans Studio"
                  >
                    <LayoutTemplate className="w-4 h-4" />
                    <span className="hidden sm:inline">Studio</span>
                  </Link>
                  <button
                    onClick={() => openEditModal(pg)}
                    className="p-2 text-gray-400 hover:text-gray-900 rounded-lg hover:bg-gray-100"
                    title="Modifier"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(pg.id)}
                    className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-gray-100"
                    title="Supprimer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal: Create / Edit Page */}
      {modalOpen && createPortal(
        <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="text-base font-black text-gray-900">
                {editingPage ? 'Modifier la Page' : 'Nouvelle Page'}
              </h3>
              <button onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Titre de la page *</label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Ex: Politique de Retours & Échanges"
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Slug URL</label>
                <input
                  type="text"
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  placeholder="Ex: retours-echanges"
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Contenu (HTML ou texte)</label>
                <textarea
                  rows={8}
                  value={formData.contentHtml}
                  onChange={(e) => setFormData({ ...formData, contentHtml: e.target.value })}
                  placeholder="<p>Rédigez le contenu de votre page ici...</p>"
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-gray-500 hover:text-gray-800"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-xl shadow-sm"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
