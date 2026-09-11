import React, { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Check,
  Palette,
  LayoutTemplate,
  Sparkles,
  Eye,
  Search,
  SlidersHorizontal,
  Star,
  Zap,
  TrendingUp,
  Award,
  Layers,
  Flame,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { themeSummaries, getTheme, type StoreTheme } from '@shared/templates/themes.js';
import { studioApi } from '../../../studio/api';
import { currentBasePath } from '../../../lib/dashboardBase';
import { BACKEND_URL } from '../../../lib/api';
import { useAuth } from '../../../contexts/AuthContext';
import ThemePreviewModal from './ThemePreviewModal';
import OpenDesignModal from './OpenDesignModal';

const CATEGORIES = [
  { id: 'all', label: 'Tous les modèles' },
  { id: 'tech', label: '⚡ Tech & Crypto' },
  { id: 'luxury', label: '💎 Luxe & Déco' },
  { id: 'energy', label: '🌱 Énergie & Éco' },
  { id: 'food', label: '🍵 Bio & Matcha' },
  { id: 'fashion', label: '👟 Mode & Sneaker' },
  { id: 'office', label: '💼 Bureau & Tech' },
  { id: 'beauty', label: '🌸 Beauté & Soins' },
];

export default function StoreThemes() {
  const navigate = useNavigate();
  const { user } = useAuth() as any;
  const base = currentBasePath(user?.role);

  const [installing, setInstalling] = useState<string | null>(null);
  const [installed, setInstalled] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals state
  const [previewTheme, setPreviewTheme] = useState<StoreTheme | null>(null);
  const [isOpenDesignOpen, setIsOpenDesignOpen] = useState<boolean>(false);

  const rawThemes = themeSummaries();

  const filteredThemes = useMemo(() => {
    return rawThemes.filter((t: any) => {
      const matchCategory = selectedCategory === 'all' || t.category === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      if (!q) return matchCategory;

      const matchSearch =
        t.label.fr.toLowerCase().includes(q) ||
        t.description.fr.toLowerCase().includes(q) ||
        t.audience.fr.toLowerCase().includes(q) ||
        (t.tags && t.tags.some((tag: string) => tag.toLowerCase().includes(q)));

      return matchCategory && matchSearch;
    });
  }, [rawThemes, selectedCategory, searchQuery]);

  const install = async (id: string, label: string) => {
    const ok = window.confirm(
      `Installer le modèle « ${label} » ?\n\nCela remplace l'accueil, l'en-tête, le pied de page et les modèles produit et catalogue de votre boutique, et applique ses couleurs. Les pages actuelles sont conservées dans l'historique de Studio.`
    );
    if (!ok) return;

    setInstalling(id);
    try {
      await studioApi.installTheme(id);
      setInstalled(id);
      toast.success(`Modèle « ${label} » installé avec succès`);
      if (previewTheme && previewTheme.id === id) {
        setPreviewTheme(null);
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Échec de l'installation");
    } finally {
      setInstalling(null);
    }
  };

  const handleOpenPreview = (themeId: string) => {
    const full = getTheme(themeId);
    if (full) {
      setPreviewTheme(full);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-16">
      {/* Top Navigation & Breadcrumbs */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <Link
            to={`${base}/store`}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-gray-900 mb-2 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Ma boutique
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-black text-gray-900 tracking-tight">Modèles de boutique</h1>
            <span className="px-2.5 py-1 rounded-full text-xs font-black bg-gradient-to-r from-indigo-500/10 to-purple-500/10 text-indigo-700 border border-indigo-200">
              {rawThemes.length} boutiques complètes
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1 max-w-2xl leading-relaxed">
            Chaque modèle est une boutique entière, pas une palette : accueil de 8 à 11 sections (accroche, garanties, catalogue, promotion, étapes, avis, FAQ, appel à l'action), fiche produit enrichie, catalogue, en-tête et pied de page — avec une mise en page différente pour chacun. L'aperçu est compilé avec vos propres produits.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsOpenDesignOpen(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-black text-white bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 shadow-lg shadow-indigo-600/25 transition-all transform hover:-translate-y-0.5"
          >
            <Sparkles className="w-4 h-4 animate-pulse" />
            Créer avec OpenDesign AI
          </button>

          <Link
            to={`${base}/store/theme`}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl text-xs font-bold text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 shadow-xs transition-colors"
          >
            <Palette className="w-4 h-4" /> Personnaliser les couleurs
          </Link>
        </div>
      </div>

      {/* Featured Banner: OpenDesign Studio Announcement */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-gray-950 via-indigo-950 to-purple-950 border border-indigo-900/50 p-6 sm:p-8 text-white shadow-xl">
        <div className="relative z-10 max-w-2xl space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-extrabold tracking-wide uppercase bg-white/10 backdrop-blur-md border border-white/15 text-indigo-200">
            <Zap className="w-3.5 h-3.5 text-amber-300" />
            Nouveau : Moteur de Design OpenDesign
          </div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight leading-tight">
            Envie d'un modèle unique généré sur-mesure ?
          </h2>
          <p className="text-xs sm:text-sm text-indigo-200/80 leading-relaxed">
            Décrivez votre boutique en une phrase — ce que vous vendez, l'ambiance, une couleur — et OpenDesign compose une boutique complète (accueil, fiche produit, catalogue, en-tête, pied de page), l'affiche avec vos produits, et vous laisse changer de variante, de couleurs et de police avant de l'appliquer.
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setIsOpenDesignOpen(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-white text-gray-950 hover:bg-gray-100 shadow-md transition-all font-sans"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              Lancer le Générateur OpenDesign
            </button>
          </div>
        </div>

        {/* Ambient background glow */}
        <div className="absolute -right-16 -bottom-16 w-80 h-80 rounded-full bg-gradient-to-br from-indigo-500/20 to-pink-500/30 blur-3xl pointer-events-none" />
        <div className="absolute right-12 top-8 opacity-10 hidden sm:block pointer-events-none">
          <Layers className="w-56 h-56 text-white" />
        </div>
      </div>

      {/* Filters & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        {/* Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0 scrollbar-none">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                selectedCategory === cat.id
                  ? 'bg-gray-900 text-white shadow-sm'
                  : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200/80'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative min-w-[240px]">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher par mot-clé, tag ou niche…"
            className="w-full pl-9 pr-4 py-2 rounded-xl text-xs bg-white border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-indigo-500 shadow-2xs"
          />
        </div>
      </div>

      {/* Grid of Theme Cards */}
      {filteredThemes.length === 0 ? (
        <div className="p-12 text-center rounded-3xl border border-gray-200 bg-white space-y-3">
          <SlidersHorizontal className="w-8 h-8 text-gray-400 mx-auto" />
          <h3 className="text-base font-bold text-gray-900">Aucun modèle ne correspond à votre recherche</h3>
          <p className="text-xs text-gray-500">Essayez de modifier votre catégorie ou de réinitialiser le filtre de recherche.</p>
          <button
            type="button"
            onClick={() => {
              setSelectedCategory('all');
              setSearchQuery('');
            }}
            className="px-4 py-2 rounded-xl text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100"
          >
            Réinitialiser les filtres
          </button>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredThemes.map((t: any) => {
            const isThemeInstalled = installed === t.id;
            const isThemeInstalling = installing === t.id;

            return (
              <div
                key={t.id}
                className="group bg-white rounded-3xl border border-gray-200/90 hover:border-indigo-300 shadow-xs hover:shadow-xl transition-all duration-300 flex flex-col overflow-hidden"
              >
                {/* Visual Preview Image Card */}
                <div className="relative aspect-[16/10] bg-gray-900 overflow-hidden cursor-pointer" onClick={() => handleOpenPreview(t.id)}>
                  {(t.previewImage || t.assets?.hero) ? (
                    <img
                      src={t.previewImage ? t.previewImage : `${BACKEND_URL}${t.assets!.hero}`}
                      alt={t.label.fr}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      loading="lazy"
                    />
                  ) : (
                    <div
                      className="w-full h-full flex items-center justify-center p-6 text-center text-white"
                      style={{ background: t.palette.secondary }}
                    >
                      <span className="font-bold text-sm">{t.label.fr}</span>
                    </div>
                  )}

                  {/* Dark gradient overlay on hover */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-between p-4">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenPreview(t.id);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-white/95 text-gray-900 hover:bg-white shadow-lg backdrop-blur-sm transition-all"
                    >
                      <Eye className="w-3.5 h-3.5 text-indigo-600" />
                      Aperçu en direct
                    </button>
                    <span className="text-[11px] font-bold text-white/90">Cliquez pour tester</span>
                  </div>

                  {/* Floating Badges */}
                  <div className="absolute top-3 left-3 flex items-center gap-1.5">
                    {t.badge && (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-gray-950/80 backdrop-blur-md text-white border border-white/20 shadow-sm flex items-center gap-1">
                        <Flame className="w-3 h-3 text-amber-400" />
                        {t.badge}
                      </span>
                    )}
                  </div>

                  <div className="absolute top-3 right-3">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-black/60 backdrop-blur-md text-white flex items-center gap-1 border border-white/10">
                      <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                      {t.rating || 4.9}
                    </span>
                  </div>
                </div>

                {/* Theme Details Body */}
                <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  <div>
                    {/* Header line: Title & Color Swatches */}
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="text-base font-black text-gray-900 tracking-tight group-hover:text-indigo-600 transition-colors">
                        {t.label.fr}
                      </h2>
                      <div className="flex items-center gap-1">
                        {[t.palette.primary, t.palette.secondary, t.palette.bg].map((c: string, i: number) => (
                          <span
                            key={i}
                            title={c}
                            className="w-4 h-4 rounded-full border border-black/10 shadow-2xs"
                            style={{ background: c }}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Description */}
                    <p className="text-xs text-gray-500 mt-2 leading-relaxed line-clamp-2">
                      {t.description.fr}
                    </p>

                    {/* Tags & Audience */}
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {t.tags &&
                        t.tags.slice(0, 3).map((tag: string, idx: number) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-gray-100 text-gray-600"
                          >
                            {tag}
                          </span>
                        ))}
                    </div>

                    <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between gap-2 text-[11px] text-gray-400 font-medium">
                      <span className="truncate">Idéal pour : <strong className="text-gray-700 font-bold">{t.audience.fr}</strong></span>
                      <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-bold" title={(t.sections || []).join(' · ')}>
                        <Layers className="w-3 h-3" /> {(t.sections || []).length} sections
                      </span>
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="flex items-center gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => handleOpenPreview(t.id)}
                      className="p-2.5 rounded-xl border border-gray-200 text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors"
                      title="Aperçu interactif"
                    >
                      <Eye className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      disabled={installing !== null}
                      onClick={() => void install(t.id, t.label.fr)}
                      className={`flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-black transition-all ${
                        isThemeInstalled
                          ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                          : 'bg-gray-900 text-white hover:bg-indigo-600 shadow-xs'
                      } disabled:opacity-50`}
                    >
                      {isThemeInstalled ? (
                        <>
                          <Check className="w-4 h-4" /> Installé
                        </>
                      ) : isThemeInstalling ? (
                        'Installation…'
                      ) : (
                        'Installer ce modèle'
                      )}
                    </button>

                    {isThemeInstalled && (
                      <button
                        type="button"
                        onClick={() => navigate(`${base}/store/studio/home`)}
                        className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 transition-colors"
                        title="Ouvrir dans Studio pour éditer"
                      >
                        <LayoutTemplate className="w-4 h-4" /> Studio
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Interactive Device Preview Modal */}
      {previewTheme && (
        <ThemePreviewModal
          theme={previewTheme}
          onClose={() => setPreviewTheme(null)}
          onInstall={(id, label) => install(id, label)}
          isInstalling={installing === previewTheme.id}
          isInstalled={installed === previewTheme.id}
          onOpenStudio={() => {
            setPreviewTheme(null);
            navigate(`${base}/store/studio/home`);
          }}
        />
      )}

      {/* OpenDesign Studio AI & Template Builder Modal */}
      <OpenDesignModal
        isOpen={isOpenDesignOpen}
        onClose={() => setIsOpenDesignOpen(false)}
        onSuccess={() => {
          setIsOpenDesignOpen(false);
          navigate(`${base}/store/studio/home`);
        }}
      />
    </div>
  );
}
