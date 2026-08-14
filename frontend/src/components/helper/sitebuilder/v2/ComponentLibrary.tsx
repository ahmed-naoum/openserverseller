import React, { useState } from 'react';
import { 
  ShoppingCart, Link as LinkIcon, Clock, ShoppingBag, Image as ImageIcon,
  Video, Layers, Music, Type, Heading, Space, MessageSquare, Sparkles,
  Search, Plus, Check, ChevronRight, Wand2
} from 'lucide-react';
import { BlockType, EditorBlock, PageSettings } from './types';
import { STARTER_TEMPLATES } from './templates';
import toast from 'react-hot-toast';

interface ComponentLibraryProps {
  onAddBlock: (type: BlockType, targetIndex?: number) => void;
  onApplyTemplate: (blocks: EditorBlock[], settings: PageSettings) => void;
}

interface ComponentItem {
  type: BlockType;
  name: string;
  category: 'conversion' | 'media' | 'structure' | 'engagement';
  description: string;
  icon: React.ReactNode;
  badge?: string;
}

export const COMPONENT_CATALOG: ComponentItem[] = [
  // Conversion & Vente
  {
    type: 'express_checkout',
    name: 'Formulaire Checkout (COD)',
    category: 'conversion',
    description: 'Formulaire de commande optimisé pour le paiement à la livraison (Multi-packs, villes, prix barré).',
    icon: <ShoppingCart className="w-4 h-4 text-orange-500" />,
    badge: 'Essentiel'
  },
  {
    type: 'button',
    name: 'Bouton d\'Action (CTA)',
    category: 'conversion',
    description: 'Bouton d\'achat avec animations de rebond, redirection ou défilement instantané vers le checkout.',
    icon: <LinkIcon className="w-4 h-4 text-emerald-500" />,
    badge: 'Sticky'
  },
  {
    type: 'countdown',
    name: 'Compteur d\'Urgence',
    category: 'conversion',
    description: 'Bannière de compte à rebours pour stimuler l\'achat impulsif et créer un sentiment d\'urgence.',
    icon: <Clock className="w-4 h-4 text-rose-500" />
  },
  {
    type: 'products',
    name: 'Propositions Produits',
    category: 'conversion',
    description: 'Grille ou carrousel dynamique de produits issus de votre catalogue vendeur ou influenceur.',
    icon: <ShoppingBag className="w-4 h-4 text-amber-500" />
  },

  // Médias
  {
    type: 'video',
    name: 'Lecteur Vidéo HD',
    category: 'media',
    description: 'Support YouTube, Vimeo ou fichier local compressé avec bouton "Activer le son" et lecture auto.',
    icon: <Video className="w-4 h-4 text-rose-500" />,
    badge: 'Ultra-Rapide'
  },
  {
    type: 'slider',
    name: 'Slider / Carrousel',
    category: 'media',
    description: 'Carrousel multi-cartes pour les témoignages, fonctionnalités ou galerie avant/après.',
    icon: <Layers className="w-4 h-4 text-purple-500" />
  },
  {
    type: 'image',
    name: 'Image & Bannière',
    category: 'media',
    description: 'Image haute résolution avec contrôle de largeur, hauteur et espacement.',
    icon: <ImageIcon className="w-4 h-4 text-blue-500" />
  },
  {
    type: 'audio',
    name: 'Message Vocal WhatsApp (Audio)',
    category: 'engagement',
    description: 'Bulle de message vocal WhatsApp avec onde sonore interactive, avatar et double coche bleue.',
    icon: <MessageSquare className="w-4 h-4 text-emerald-500" />,
    badge: '💬 WhatsApp'
  },

  // Structure & Typographie
  {
    type: 'hero',
    name: 'Section Hero (Titre & Sous-titre)',
    category: 'structure',
    description: 'Grand titre percutant avec sous-titre explicatif et couleur de fond personnalisée.',
    icon: <Heading className="w-4 h-4 text-slate-700" />
  },
  {
    type: 'header',
    name: 'En-tête de Marque',
    category: 'structure',
    description: 'Barre de marque supérieure avec logo ou texte.',
    icon: <Type className="w-4 h-4 text-slate-700" />
  },
  {
    type: 'text',
    name: 'Texte & Paragraphe',
    category: 'structure',
    description: 'Bloc de texte personnalisable avec alignement horizontal et vertical.',
    icon: <Type className="w-4 h-4 text-slate-700" />
  },
  {
    type: 'spacer',
    name: 'Séparateur d\'Espace',
    category: 'structure',
    description: 'Espacement vertical ajustable en pixels.',
    icon: <Space className="w-4 h-4 text-slate-400" />
  },

  // Engagement
  {
    type: 'whatsapp',
    name: 'Widget WhatsApp Flottant',
    category: 'engagement',
    description: 'Bouton de chat WhatsApp flottant avec message de bienvenue pré-rempli et badge de notification.',
    icon: <MessageSquare className="w-4 h-4 text-emerald-500" />,
    badge: 'Flottant'
  }
];

export default function ComponentLibrary({ onAddBlock, onApplyTemplate }: ComponentLibraryProps) {
  const [activeTab, setActiveTab] = useState<'components' | 'templates'>('components');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const filteredComponents = COMPONENT_CATALOG.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          item.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Top Switcher: Composants vs Modèles */}
      <div className="p-3 border-b border-slate-100 bg-slate-50/50">
        <div className="grid grid-cols-2 p-1 bg-slate-200/60 rounded-xl">
          <button
            onClick={() => setActiveTab('components')}
            className={`py-1.5 text-xs font-bold rounded-lg transition-all ${
              activeTab === 'components'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Composants
          </button>
          <button
            onClick={() => setActiveTab('templates')}
            className={`flex items-center justify-center gap-1.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
              activeTab === 'templates'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-orange-500" />
            <span>Modèles</span>
          </button>
        </div>
      </div>

      {activeTab === 'components' ? (
        <div className="flex-1 flex flex-col min-h-0">
          {/* Search Bar */}
          <div className="p-3 border-b border-slate-100 space-y-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Rechercher un composant..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:border-orange-500 focus:bg-white transition-all"
              />
            </div>

            {/* Category Pills */}
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
              {[
                { id: 'all', label: 'Tous' },
                { id: 'conversion', label: '⚡ Vente' },
                { id: 'media', label: '🎬 Médias' },
                { id: 'structure', label: '📝 Texte' },
                { id: 'engagement', label: '💬 Chat' }
              ].map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-lg shrink-0 transition-all ${
                    selectedCategory === cat.id
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Components List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
            {filteredComponents.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                Aucun composant correspondant à "{searchQuery}"
              </div>
            ) : (
              filteredComponents.map((item) => (
                <div
                  key={item.type}
                  onClick={() => {
                    onAddBlock(item.type);
                    toast.success(`Bloc ${item.name} ajouté !`, { icon: '✨' });
                  }}
                  className="group relative p-3 bg-white hover:bg-orange-50/40 border border-slate-200 hover:border-orange-500/80 rounded-2xl cursor-pointer transition-all duration-200 shadow-2xs hover:shadow-sm flex items-start gap-3"
                >
                  <div className="p-2.5 rounded-xl bg-slate-50 group-hover:bg-white border border-slate-100 group-hover:border-orange-200 text-slate-700 transition-all shrink-0">
                    {item.icon}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <h4 className="text-xs font-bold text-slate-800 group-hover:text-orange-950 truncate">
                        {item.name}
                      </h4>
                      {item.badge && (
                        <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded-md bg-orange-100 text-orange-700 uppercase tracking-tight shrink-0">
                          {item.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                      {item.description}
                    </p>
                  </div>

                  <div className="w-6 h-6 rounded-lg bg-slate-100 group-hover:bg-orange-500 text-slate-400 group-hover:text-white flex items-center justify-center transition-all shrink-0 self-center">
                    <Plus className="w-3.5 h-3.5" />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
        /* STARTER TEMPLATES */
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          <div className="p-3 bg-gradient-to-br from-orange-50 to-amber-50 rounded-2xl border border-orange-100">
            <div className="flex items-center gap-2 mb-1 text-orange-950 font-bold text-xs">
              <Wand2 className="w-4 h-4 text-orange-600" />
              <span>Modèles Prêts à l'Emploi</span>
            </div>
            <p className="text-[11px] text-orange-800/80 leading-relaxed">
              Sélectionnez un modèle pour charger une structure complète de landing page hautement convertible en 1 clic.
            </p>
          </div>

          <div className="space-y-3">
            {STARTER_TEMPLATES.map((tmpl) => (
              <div
                key={tmpl.id}
                className="p-3.5 bg-white border border-slate-200 hover:border-orange-500 rounded-2xl transition-all shadow-2xs hover:shadow-md space-y-2.5 group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{tmpl.icon}</span>
                    <h4 className="text-xs font-bold text-slate-900 group-hover:text-orange-600 transition-colors">
                      {tmpl.name}
                    </h4>
                  </div>
                  {tmpl.badge && (
                    <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 uppercase">
                      {tmpl.badge}
                    </span>
                  )}
                </div>

                <p className="text-[11px] text-slate-500 leading-relaxed">
                  {tmpl.description}
                </p>

                <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[10px] text-slate-400 font-medium">
                  <span>{tmpl.blocks.length} composants inclus</span>
                  <button
                    onClick={() => {
                      if (window.confirm(`Appliquer le modèle "${tmpl.name}" ? Cela remplacera le layout actuel.`)) {
                        onApplyTemplate(tmpl.blocks, tmpl.settings);
                        toast.success(`Modèle "${tmpl.name}" appliqué !`);
                      }
                    }}
                    className="flex items-center gap-1 px-3 py-1 bg-slate-900 hover:bg-orange-600 text-white font-bold rounded-lg transition-all"
                  >
                    <span>Appliquer</span>
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
