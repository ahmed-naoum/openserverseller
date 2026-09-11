import React, { useMemo, useState } from 'react';
import { Search, LayoutTemplate, Layers, Box, Sparkles, Plus, Check } from 'lucide-react';
import { catalogue, type BlockCategory } from '@shared/blocks/index.js';
import { useStudio, defaultInsertTarget } from './store';
import { templatesFor } from '@shared/templates/index.js';
import { SECTIONS_CATALOG, type SectionCategory, type SectionDefinition } from '@shared/templates/sections.js';

const BLOCK_CATEGORIES: { key: BlockCategory | 'all'; label: string }[] = [
  { key: 'all', label: 'Tous' },
  { key: 'commerce', label: 'Vente' },
  { key: 'conversion', label: 'Conversion' },
  { key: 'content', label: 'Contenu' },
  { key: 'media', label: 'Médias' },
  { key: 'chrome', label: 'En-tête / Pied' },
  { key: 'engagement', label: 'Chat' },
];

const SECTION_CATEGORIES: { key: SectionCategory | 'all'; label: string }[] = [
  { key: 'all', label: 'Toutes (73)' },
  { key: 'hero', label: 'Accroches (10)' },
  { key: 'trust', label: 'Garanties (9)' },
  { key: 'product', label: 'Produits (8)' },
  { key: 'bundles', label: 'Packs & Offres (6)' },
  { key: 'social_proof', label: 'Avis Clients (9)' },
  { key: 'how_to', label: 'Commander (5)' },
  { key: 'urgency', label: 'Vente Flash (6)' },
  { key: 'story', label: 'Histoire (6)' },
  { key: 'features', label: 'Avantages (2)' },
  { key: 'gallery', label: 'Galeries (1)' },
  { key: 'faq', label: 'FAQ (5)' },
  { key: 'cta', label: 'Appels à l\'action (6)' },
];

export default function Library() {
  const [activeTab, setActiveTab] = useState<'sections' | 'blocks'>('sections');
  const [query, setQuery] = useState('');
  const [blockCategory, setBlockCategory] = useState<BlockCategory | 'all'>('all');
  const [sectionCategory, setSectionCategory] = useState<SectionCategory | 'all'>('all');

  const doc = useStudio((s) => s.doc);
  const selectedId = useStudio((s) => s.selectedId);
  const insertBlock = useStudio((s) => s.insertBlock);
  const insertSection = useStudio((s) => s.insertSection);
  const applyTemplate = useStudio((s) => s.applyTemplate);

  const templates = doc ? templatesFor(doc.kind) : [];

  // Filtered blocks
  const filteredBlocks = useMemo(() => {
    const q = query.trim().toLowerCase();
    return catalogue(blockCategory === 'all' ? undefined : blockCategory).filter(
      (b) =>
        !q ||
        b.meta.label.fr.toLowerCase().includes(q) ||
        b.meta.description.fr.toLowerCase().includes(q) ||
        b.type.includes(q)
    );
  }, [query, blockCategory]);

  // Filtered 60+ sections
  const filteredSections = useMemo(() => {
    const q = query.trim().toLowerCase();
    return SECTIONS_CATALOG.filter((s) => {
      const matchCat = sectionCategory === 'all' || s.category === sectionCategory;
      if (!matchCat) return false;
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.categoryLabel.toLowerCase().includes(q)
      );
    });
  }, [query, sectionCategory]);

  if (!doc) return null;

  return (
    <div className="p-3 space-y-3">
      {/* Top Switcher: Sections E-Commerce vs Blocs Élémentaires */}
      <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
        <button
          type="button"
          onClick={() => {
            setActiveTab('sections');
            setQuery('');
          }}
          className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'sections'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Sections (+70)</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveTab('blocks');
            setQuery('');
          }}
          className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'blocks'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Box className="w-3.5 h-3.5" />
          <span>Blocs simples</span>
        </button>
      </div>

      {/* Page Templates accordion if available */}
      {templates.length > 0 && activeTab === 'blocks' && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <LayoutTemplate className="w-3 h-3" /> Modèles de page complets
          </p>
          {templates.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                if (window.confirm(`Appliquer « ${t.label.fr} » ? Le contenu actuel sera remplacé (annulable avec Ctrl+Z).`)) {
                  applyTemplate(t);
                }
              }}
              className="w-full text-left p-2.5 rounded-lg border border-indigo-100 bg-indigo-50/40 hover:border-indigo-400 transition-colors"
            >
              <span className="text-xs font-bold text-slate-800">{t.label.fr}</span>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{t.description.fr}</p>
            </button>
          ))}
        </div>
      )}

      {/* Search Input */}
      <div className="relative">
        <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={activeTab === 'sections' ? 'Rechercher parmi les 60 sections…' : 'Rechercher un bloc…'}
          className="w-full pl-8 pr-2 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-300"
        />
      </div>

      {/* ─── TAB 1: 60+ SECTIONS E-COMMERCE & DROPSHIPPING ─── */}
      {activeTab === 'sections' && (
        <div className="space-y-3">
          {/* Section Category Filters */}
          <div className="flex flex-wrap gap-1 max-h-28 overflow-y-auto pb-1 scrollbar-thin">
            {SECTION_CATEGORIES.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => setSectionCategory(c.key)}
                className={`px-2 py-1 rounded-md text-[10px] font-bold transition-colors ${
                  sectionCategory === c.key
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400 font-semibold px-0.5">
            <span>{filteredSections.length} sections prêtes à l'emploi</span>
            <span className="text-indigo-600 font-bold">Optimisé COD Maroc</span>
          </div>

          {/* Sections List */}
          <div className="space-y-2">
            {filteredSections.map((s) => (
              <div
                key={s.id}
                className="group p-3 rounded-xl border border-slate-200/90 hover:border-indigo-400 hover:bg-indigo-50/30 transition-all bg-white shadow-2xs space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                      {s.categoryLabel}
                    </span>
                    <h4 className="text-xs font-black text-slate-800 mt-1 leading-snug group-hover:text-indigo-700 transition-colors">
                      {s.name}
                    </h4>
                  </div>
                  {s.badge && (
                    <span className="shrink-0 text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                      {s.badge}
                    </span>
                  )}
                </div>

                <p className="text-[11px] text-slate-500 leading-snug">
                  {s.description}
                </p>

                <div className="pt-1 flex justify-end">
                  <button
                    type="button"
                    onClick={() => insertSection(s.build())}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-xs transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Ajouter cette section
                  </button>
                </div>
              </div>
            ))}

            {!filteredSections.length && (
              <p className="text-xs text-slate-400 text-center py-6">
                Aucune section ne correspond à votre recherche.
              </p>
            )}
          </div>
        </div>
      )}

      {/* ─── TAB 2: PRIMITIVE BLOCKS ─── */}
      {activeTab === 'blocks' && (
        <div className="space-y-3">
          {/* Category Chips */}
          <div className="flex flex-wrap gap-1">
            {BLOCK_CATEGORIES.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => setBlockCategory(c.key)}
                className={`px-2 py-1 rounded-md text-[10px] font-bold ${
                  blockCategory === c.key ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          <div className="space-y-1.5">
            {filteredBlocks.map((b) => (
              <button
                key={b.type}
                type="button"
                onClick={() => {
                  const t = defaultInsertTarget(doc, selectedId);
                  insertBlock(b.type, t.parentId, t.index);
                }}
                className="w-full text-left p-2.5 rounded-lg border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/50 transition-colors bg-white"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-800">{b.meta.label.fr}</span>
                  <span className="flex items-center gap-1">
                    {b.meta.badge && (
                      <span className="text-[9px] font-black uppercase text-indigo-600">{b.meta.badge}</span>
                    )}
                    {!b.compiled && (
                      <span
                        className="text-[9px] font-bold text-amber-600"
                        title="Ce bloc n'est pas encore compilé : la page sera servie par l'application."
                      >
                        SPA
                      </span>
                    )}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{b.meta.description.fr}</p>
              </button>
            ))}
            {!filteredBlocks.length && (
              <p className="text-xs text-slate-400 text-center py-6">Aucun bloc ne correspond.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
