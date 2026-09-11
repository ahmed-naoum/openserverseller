import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useStore } from '../../contexts/StoreContext';
import { storePublicApi } from '../../lib/api';
import { ArrowLeft, FileText } from 'lucide-react';
import StoreDocument from '../../components/store/StoreDocument';
import { flatBlocks } from '@shared/document/migrate.js';

export default function StoreCustomPage() {
  const { slug } = useParams<{ slug: string }>();
  const { store } = useStore();

  const [page, setPage] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!store?.id || !slug) return;

    setLoading(true);
    setError(null);
    storePublicApi
      .getPage(slug, store.id)
      .then((res) => {
        setPage(res.data?.data?.page || null);
      })
      .catch((err) => {
        console.error('Failed to load page:', err);
        setError('Page introuvable');
      })
      .finally(() => setLoading(false));
  }, [store?.id, slug]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 flex justify-center">
        <div className="w-8 h-8 border-3 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !page) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center space-y-4">
        <h2 className="text-xl font-bold text-gray-900">Page introuvable</h2>
        <Link to="/" className="inline-block px-6 py-2.5 bg-gray-900 text-white font-bold text-xs rounded-xl">
          Retour à l'accueil
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8">
      <Link to="/" className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-gray-900">
        <ArrowLeft className="w-4 h-4" />
        <span>Retour à l'accueil</span>
      </Link>

      <div className="bg-white rounded-3xl p-6 sm:p-12 border border-gray-100 shadow-sm space-y-6">
        <div className="flex items-center gap-2 text-xs font-bold text-orange-600">
          <FileText className="w-4 h-4" />
          <span>Information & Politique</span>
        </div>

        <h1 className="text-2xl sm:text-4xl font-black text-gray-900 tracking-tight">{page.title}</h1>

        {flatBlocks(page.customStructure).length ? (
          <div className="border-t border-gray-100 pt-6">
            <StoreDocument structure={page.customStructure} kind="page" store={store} />
          </div>
        ) : page.contentHtml ? (
          <div
            className="prose prose-sm sm:prose max-w-none text-gray-700 leading-relaxed border-t border-gray-100 pt-6"
            dangerouslySetInnerHTML={{ __html: page.contentHtml }}
          />
        ) : null}
      </div>
    </div>
  );
}
