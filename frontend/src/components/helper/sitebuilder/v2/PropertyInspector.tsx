import React, { useState } from 'react';
import { 
  X, Layers, Trash2, Plus, Upload, Loader2, GripVertical, 
  ExternalLink, Music, Video, ShoppingBag, ShoppingCart, 
  Sliders, Palette, Box, Sparkles, Check
} from 'lucide-react';
import { EditorBlock, BlockType } from './types';
import { IconRenderer } from '../../../public/WhatsAppWidget';
import { uploadApi } from '../../../../lib/api';
import toast from 'react-hot-toast';

interface PropertyInspectorProps {
  block: EditorBlock | null;
  onUpdateContent: (key: string, value: any) => void;
  onClose: () => void;
  socketId?: string | null;
  accounts: any[];
  ownerId?: number | null;
  ownerSubdomain?: string | null;
  ownerCustomDomain?: string | null;
  ownerCustomDomainStatus?: string | null;
  buildReferralUrlFn: (code: string, sub?: string | null, custom?: string | null, customStatus?: string | null) => string;
}

export default function PropertyInspector({
  block,
  onUpdateContent,
  onClose,
  socketId,
  accounts,
  ownerId,
  ownerSubdomain,
  ownerCustomDomain,
  ownerCustomDomainStatus,
  buildReferralUrlFn
}: PropertyInspectorProps) {
  const [activeTab, setActiveTab] = useState<'content' | 'style' | 'spacing' | 'advanced'>('content');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadPipelineStage, setUploadPipelineStage] = useState<'idle' | 'vps_upload' | 'vps_compress' | 'cloudinary_upload' | 'vps_cleanup'>('idle');
  const [stagePercentages, setStagePercentages] = useState({ vpsUpload: 0, vpsCompress: 0, cloudinaryUpload: 0, vpsCleanup: 0 });
  const [uploadProgressMsg, setUploadProgressMsg] = useState('');
  const [uploadingAudioId, setUploadingAudioId] = useState<string | null>(null);

  if (!block) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-center text-slate-400 bg-white">
        <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
          <Layers className="w-6 h-6 opacity-40" />
        </div>
        <h4 className="text-xs font-bold text-slate-700 mb-1">Aucun bloc sélectionné</h4>
        <p className="text-[11px] text-slate-400 max-w-xs">
          Cliquez sur un composant dans le canevas ou dans l'arborescence pour modifier ses propriétés.
        </p>
      </div>
    );
  }

  const { type, content } = block;

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, targetKey = 'url') => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsUploading(true);
      const formData = new FormData();
      formData.append('file', file);
      const res = await uploadApi.image(formData);
      onUpdateContent(targetKey, res.data.data.url);
      toast.success('Image téléchargée avec succès !');
    } catch (err) {
      toast.error('Erreur lors du téléchargement');
    } finally {
      setIsUploading(false);
    }
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const maxSizeBytes = 200 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      toast.error(`La vidéo dépasse la limite de 200 Mo (${(file.size / (1024 * 1024)).toFixed(1)} Mo).`);
      return;
    }

    try {
      setIsUploading(true);
      setUploadPipelineStage('vps_upload');
      setStagePercentages({ vpsUpload: 0, vpsCompress: 0, cloudinaryUpload: 0, vpsCleanup: 0 });
      const fileSizeMB = (file.size / (1024 * 1024)).toFixed(1);
      setUploadProgressMsg(`Envoi vers VPS (${fileSizeMB} Mo)...`);

      const formData = new FormData();
      formData.append('file', file);
      if (socketId) formData.append('socketId', socketId);

      const res = await uploadApi.cloudinaryVideo(formData, (percent) => {
        setStagePercentages(prev => ({ ...prev, vpsUpload: percent }));
        if (percent < 100) {
          setUploadProgressMsg(`Upload VPS : ${percent}%`);
        } else {
          setUploadProgressMsg('Upload VPS terminé ! Compression FFmpeg en cours...');
        }
      });

      setStagePercentages({ vpsUpload: 100, vpsCompress: 100, cloudinaryUpload: 100, vpsCleanup: 100 });
      setUploadPipelineStage('vps_cleanup');
      setUploadProgressMsg('Traitement terminé avec succès !');

      if (res.data?.data?.url) {
        onUpdateContent('url', res.data.data.url);
      }
      toast.success('Vidéo optimisée et intégrée !');
      await new Promise(r => setTimeout(r, 2000));
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Erreur lors du traitement');
    } finally {
      setIsUploading(false);
      setUploadPipelineStage('idle');
      setStagePercentages({ vpsUpload: 0, vpsCompress: 0, cloudinaryUpload: 0, vpsCleanup: 0 });
      setUploadProgressMsg('');
    }
  };

  const overallPercent = Math.min(100, Math.round(
    stagePercentages.vpsUpload * 0.25 +
    stagePercentages.vpsCompress * 0.35 +
    stagePercentages.cloudinaryUpload * 0.30 +
    stagePercentages.vpsCleanup * 0.10
  ));

  return (
    <div className="h-full flex flex-col bg-white select-none">
      {/* Header */}
      <div className="p-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 bg-orange-100 text-orange-700 rounded-md">
            {type}
          </span>
          <h3 className="text-xs font-bold text-slate-800 truncate">Propriétés</h3>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition-all"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-4 p-1.5 border-b border-slate-100 bg-slate-50/30 gap-1 text-[11px] font-bold">
        <button
          onClick={() => setActiveTab('content')}
          className={`py-1.5 rounded-lg flex items-center justify-center gap-1 transition-all ${
            activeTab === 'content' ? 'bg-white text-slate-900 shadow-2xs border border-slate-200/60' : 'text-slate-500 hover:text-slate-800'
          }`}
          title="Contenu"
        >
          <Sliders className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Contenu</span>
        </button>

        <button
          onClick={() => setActiveTab('style')}
          className={`py-1.5 rounded-lg flex items-center justify-center gap-1 transition-all ${
            activeTab === 'style' ? 'bg-white text-slate-900 shadow-2xs border border-slate-200/60' : 'text-slate-500 hover:text-slate-800'
          }`}
          title="Style"
        >
          <Palette className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Style</span>
        </button>

        <button
          onClick={() => setActiveTab('spacing')}
          className={`py-1.5 rounded-lg flex items-center justify-center gap-1 transition-all ${
            activeTab === 'spacing' ? 'bg-white text-slate-900 shadow-2xs border border-slate-200/60' : 'text-slate-500 hover:text-slate-800'
          }`}
          title="Espacement"
        >
          <Box className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Espaces</span>
        </button>

        <button
          onClick={() => setActiveTab('advanced')}
          className={`py-1.5 rounded-lg flex items-center justify-center gap-1 transition-all ${
            activeTab === 'advanced' ? 'bg-white text-slate-900 shadow-2xs border border-slate-200/60' : 'text-slate-500 hover:text-slate-800'
          }`}
          title="Animations & Délais"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Effets</span>
        </button>
      </div>

      {/* Dynamic Announcement Banner for Audio Block */}
      {type === 'audio' && (
        <div className="mx-3 mt-3 p-3 bg-emerald-50 border-2 border-emerald-300 rounded-2xl flex flex-col gap-2 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xl">💬</span>
              <div>
                <div className="text-xs font-black text-emerald-950">Option Style du Lecteur</div>
                <div className="text-[10px] text-emerald-700 font-medium">Bulle vocale WhatsApp avec onde sonore</div>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-emerald-100/70 rounded-xl">
            <button
              type="button"
              onClick={() => onUpdateContent('themeStyle', 'whatsapp')}
              className={`py-1.5 px-2 rounded-lg text-[11px] font-black transition-all flex items-center justify-center gap-1.5 ${
                (content.themeStyle || 'whatsapp') === 'whatsapp'
                  ? 'bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-700'
                  : 'bg-white/80 text-emerald-900 hover:bg-white'
              }`}
            >
              <span>💬 WhatsApp UI</span>
            </button>
            <button
              type="button"
              onClick={() => onUpdateContent('themeStyle', 'classic')}
              className={`py-1.5 px-2 rounded-lg text-[11px] font-black transition-all flex items-center justify-center gap-1.5 ${
                content.themeStyle === 'classic'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-white/80 text-slate-700 hover:bg-white'
              }`}
            >
              <span>🎵 Classique</span>
            </button>
          </div>
        </div>
      )}

      {/* Tab Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* ================= CONTENU ================= */}
        {activeTab === 'content' && (
          <div className="space-y-4">
            {/* HERO */}
            {type === 'hero' && (
              <>
                <FieldInput label="Titre Principal" type="text" value={content.title} onChange={(v) => onUpdateContent('title', v)} />
                <FieldInput label="Sous-titre" type="textarea" value={content.subtitle} onChange={(v) => onUpdateContent('subtitle', v)} />
              </>
            )}

            {/* HEADER */}
            {type === 'header' && (
              <FieldInput label="Nom de la marque / Titre" type="text" value={content.text} onChange={(v) => onUpdateContent('text', v)} />
            )}

            {/* TEXT */}
            {type === 'text' && (
              <>
                <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                  <input type="checkbox" checked={!!content.isHeading} onChange={(e) => onUpdateContent('isHeading', e.target.checked)} className="rounded text-orange-500 accent-orange-500" />
                  Titre de section (Balise h3)
                </label>
                <FieldInput label="Contenu du texte" type="textarea" value={content.text} onChange={(v) => onUpdateContent('text', v)} />
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Alignement Horizontal</label>
                    <select value={content.align || 'left'} onChange={(e) => onUpdateContent('align', e.target.value)} className="w-full text-xs border border-slate-200 rounded-xl p-2 bg-white">
                      <option value="left">Gauche</option>
                      <option value="center">Centre</option>
                      <option value="right">Droite</option>
                      <option value="justify">Justifié</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Alignement Vertical</label>
                    <select value={content.verticalAlign || 'center'} onChange={(e) => onUpdateContent('verticalAlign', e.target.value)} className="w-full text-xs border border-slate-200 rounded-xl p-2 bg-white">
                      <option value="top">Haut</option>
                      <option value="center">Centre</option>
                      <option value="bottom">Bas</option>
                    </select>
                  </div>
                </div>
              </>
            )}

            {/* IMAGE */}
            {type === 'image' && (
              <>
                <FieldInput label="URL de l'image" type="text" value={content.url} onChange={(v) => onUpdateContent('url', v)} placeholder="https://..." />
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Ou Uploader un fichier</label>
                  <label className="flex items-center justify-center gap-2 p-3.5 border-2 border-dashed border-slate-200 rounded-2xl hover:border-orange-500 hover:bg-orange-50/40 cursor-pointer transition-all">
                    {isUploading ? <Loader2 className="w-4 h-4 animate-spin text-orange-500" /> : <Upload className="w-4 h-4 text-slate-400" />}
                    <span className="text-xs font-bold text-slate-600">
                      {isUploading ? 'Téléchargement...' : 'Choisir une image'}
                    </span>
                    <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e)} disabled={isUploading} />
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <FieldInput label="Largeur (%)" type="number" value={content.width || 100} onChange={(v) => onUpdateContent('width', v)} />
                  <FieldInput label="Hauteur Max (px)" type="number" value={content.maxHeight || ''} onChange={(v) => onUpdateContent('maxHeight', v)} placeholder="Infini" />
                </div>
              </>
            )}

            {/* VIDEO */}
            {type === 'video' && (
              <div className="space-y-4">
                <FieldInput 
                  label="Lien Vidéo (YouTube, Vimeo, MP4, Cloudinary)" 
                  type="text" 
                  value={content.url} 
                  onChange={(v) => onUpdateContent('url', v)} 
                  placeholder="https://www.youtube.com/watch?v=..." 
                />

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase">Uploader une vidéo locale</label>
                    <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">Max 200 Mo</span>
                  </div>
                  <label className="flex flex-col items-center justify-center gap-2 p-4 border-2 border-dashed border-slate-200 rounded-2xl hover:border-orange-500 hover:bg-orange-50/40 cursor-pointer transition-all">
                    {isUploading ? (
                      <div className="flex flex-col items-center gap-2 w-full">
                        <div className="relative w-12 h-12 flex items-center justify-center">
                          <svg viewBox="0 0 72 72" className="w-12 h-12 transform -rotate-90">
                            <circle cx="36" cy="36" r="28" stroke="currentColor" strokeWidth="4" className="text-orange-100" fill="transparent" />
                            <circle cx="36" cy="36" r="28" stroke="currentColor" strokeWidth="4" className="text-orange-500 transition-all duration-300" fill="transparent" strokeDasharray={2 * Math.PI * 28} strokeDashoffset={2 * Math.PI * 28 * (1 - overallPercent / 100)} strokeLinecap="round" />
                          </svg>
                          <span className="absolute font-black text-[11px] text-orange-600">{overallPercent}%</span>
                        </div>
                        <span className="text-[11px] font-bold text-slate-700">{uploadProgressMsg}</span>
                      </div>
                    ) : (
                      <>
                        <Upload className="w-5 h-5 text-slate-400" />
                        <span className="text-xs font-bold text-slate-600">Choisir un fichier vidéo (MP4, WebM)</span>
                      </>
                    )}
                    <input type="file" className="hidden" accept="video/*" onChange={handleVideoUpload} disabled={isUploading} />
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs text-slate-700">
                  <label className="flex items-center gap-2"><input type="checkbox" checked={!!content.autoplay} onChange={(e) => onUpdateContent('autoplay', e.target.checked)} /> Autoplay</label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={!!content.loop} onChange={(e) => onUpdateContent('loop', e.target.checked)} /> En boucle</label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={!!content.muted} onChange={(e) => onUpdateContent('muted', e.target.checked)} /> Muet</label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={content.controls !== false} onChange={(e) => onUpdateContent('controls', e.target.checked)} /> Contrôles</label>
                </div>

                {content.autoplay && (
                  <div className="p-3 bg-orange-50/70 border border-orange-100 rounded-2xl space-y-3">
                    <h5 className="text-[10px] font-extrabold uppercase text-orange-800">Bouton Flottant "Activer le son"</h5>
                    <FieldInput label="Texte du bouton" type="text" value={content.unmuteText ?? 'برك باش تسمع الصوت'} onChange={(v) => onUpdateContent('unmuteText', v)} />
                    <div className="grid grid-cols-2 gap-2">
                      <FieldInput label="Couleur texte" type="color" value={content.unmuteTextColor || '#ffffff'} onChange={(v) => onUpdateContent('unmuteTextColor', v)} />
                      <FieldInput label="Couleur bouton" type="color" value={content.unmuteBtnColor || '#ea580c'} onChange={(v) => onUpdateContent('unmuteBtnColor', v)} />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* BUTTON */}
            {type === 'button' && (
              <div className="space-y-4">
                <FieldInput label="Texte du Bouton" type="text" value={content.text} onChange={(v) => onUpdateContent('text', v)} />
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Comportement du Clic</label>
                  <select value={content.behavior || 'link'} onChange={(e) => onUpdateContent('behavior', e.target.value)} className="w-full text-xs border border-slate-200 rounded-xl p-2 bg-white">
                    <option value="link">Rediriger vers un lien externe</option>
                    <option value="checkout">Défiler vers le formulaire Checkout</option>
                  </select>
                </div>
                {content.behavior !== 'checkout' && (
                  <div className="space-y-2">
                    <FieldInput label="URL de redirection" type="text" value={content.link} onChange={(v) => onUpdateContent('link', v)} placeholder="https://..." />
                    <label className="flex items-center gap-2 text-xs font-bold text-slate-700 bg-orange-50/70 p-2.5 rounded-xl border border-orange-100 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!content.attachSourceToken}
                        onChange={(e) => onUpdateContent('attachSourceToken', e.target.checked)}
                        className="rounded text-orange-500 accent-orange-500 w-4 h-4"
                      />
                      <span>Transmettre le jeton de provenance (<code className="text-orange-600 font-mono text-[10px]">?_s=...</code>) pour le Cloaking</span>
                    </label>
                  </div>
                )}
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-700">
                    <input type="checkbox" checked={!!content.stickyMobile} onChange={(e) => onUpdateContent('stickyMobile', e.target.checked)} />
                    Bouton Sticky sur Mobile (Fixé en bas)
                  </label>
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-700">
                    <input type="checkbox" checked={!!content.stickyDesktop} onChange={(e) => onUpdateContent('stickyDesktop', e.target.checked)} />
                    Bouton Sticky sur Ordinateur
                  </label>
                </div>
              </div>
            )}

            {/* COUNTDOWN */}
            {type === 'countdown' && (
              <FieldInput label="Texte d'urgence" type="text" value={content.text} onChange={(v) => onUpdateContent('text', v)} />
            )}

            {/* SPACER */}
            {type === 'spacer' && (
              <FieldInput label="Hauteur en pixels (px)" type="number" value={content.height || 32} onChange={(v) => onUpdateContent('height', Number(v))} />
            )}

            {/* CHECKOUT */}
            {type === 'express_checkout' && (
              <div className="space-y-4">
                <FieldInput label="Titre du Formulaire" type="text" value={content.title} onChange={(v) => onUpdateContent('title', v)} />
                <FieldInput label="Sous-titre / Description" type="textarea" value={content.subtitle} onChange={(v) => onUpdateContent('subtitle', v)} />
                <FieldInput label="Texte du Bouton de confirmation" type="text" value={content.buttonText} onChange={(v) => onUpdateContent('buttonText', v)} />

                {/* Multi-Pack Options */}
                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <h5 className="text-[10px] font-extrabold uppercase text-slate-700">Options & Packs Multi-Unités</h5>
                    <button
                      onClick={() => {
                        const newOpts = [...(content.options || []), { id: crypto.randomUUID(), name: '', quantity: 1, price: 199, oldPrice: 350, color: '#ea580c' }];
                        onUpdateContent('options', newOpts);
                      }}
                      className="flex items-center gap-1 text-[10px] font-bold text-orange-600 bg-orange-100 hover:bg-orange-200 px-2 py-1 rounded-lg transition-all"
                    >
                      <Plus className="w-3 h-3" /> Ajouter un pack
                    </button>
                  </div>

                  <div className="space-y-2">
                    {(content.options || []).map((opt: any, idx: number) => (
                      <div key={opt.id || idx} className="p-3 bg-white border border-slate-200 rounded-xl space-y-2 relative group">
                        <button
                          onClick={() => {
                            const newOpts = content.options.filter((_: any, i: number) => i !== idx);
                            onUpdateContent('options', newOpts);
                          }}
                          className="absolute top-2 right-2 p-1 text-slate-300 hover:text-rose-500 transition-all opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <FieldInput label={`Nom de la variante #${idx + 1}`} type="text" value={opt.name} onChange={(v) => {
                          const newOpts = [...content.options];
                          newOpts[idx] = { ...newOpts[idx], name: v };
                          onUpdateContent('options', newOpts);
                        }} placeholder="Ex: 2 Pièces + 1 Gratuite" />
                        {/* Units shipped by the pack, deducted from stock on order creation.
                            Independent of the price below, which is already the bundle total. */}
                        <FieldInput label="Quantité (unités)" type="number" value={opt.quantity} onChange={(v) => {
                          const newOpts = [...content.options];
                          newOpts[idx] = { ...newOpts[idx], quantity: v };
                          onUpdateContent('options', newOpts);
                        }} placeholder="Ex: 3 (2 Pièces + 1 Gratuite)" />
                        <div className="grid grid-cols-2 gap-2">
                          <FieldInput label="Prix (MAD)" type="number" value={opt.price} onChange={(v) => {
                            const newOpts = [...content.options];
                            newOpts[idx] = { ...newOpts[idx], price: v };
                            onUpdateContent('options', newOpts);
                          }} />
                          <FieldInput label="Ancien Prix" type="number" value={opt.oldPrice || ''} onChange={(v) => {
                            const newOpts = [...content.options];
                            newOpts[idx] = { ...newOpts[idx], oldPrice: v };
                            onUpdateContent('options', newOpts);
                          }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Form Field Placeholders */}
                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2.5">
                  <h5 className="text-[10px] font-extrabold uppercase text-slate-700">Libellés des Champs</h5>
                  <div className="grid grid-cols-2 gap-2">
                    <FieldInput label="Label Nom" type="text" value={content.nameLabel} onChange={(v) => onUpdateContent('nameLabel', v)} />
                    <FieldInput label="Placeholder Nom" type="text" value={content.namePlaceholder} onChange={(v) => onUpdateContent('namePlaceholder', v)} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <FieldInput label="Label Téléphone" type="text" value={content.phoneLabel} onChange={(v) => onUpdateContent('phoneLabel', v)} />
                    <FieldInput label="Placeholder Tél." type="text" value={content.phonePlaceholder} onChange={(v) => onUpdateContent('phonePlaceholder', v)} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <FieldInput label="Label Ville" type="text" value={content.cityLabel} onChange={(v) => onUpdateContent('cityLabel', v)} />
                    <FieldInput label="Placeholder Ville" type="text" value={content.cityPlaceholder} onChange={(v) => onUpdateContent('cityPlaceholder', v)} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <FieldInput label="Label Adresse" type="text" value={content.addressLabel} onChange={(v) => onUpdateContent('addressLabel', v)} />
                    <FieldInput label="Placeholder Adresse" type="text" value={content.addressPlaceholder} onChange={(v) => onUpdateContent('addressPlaceholder', v)} />
                  </div>
                </div>
              </div>
            )}

            {/* WHATSAPP WIDGET */}
            {type === 'whatsapp' && (
              <div className="space-y-4">
                <FieldInput label="Numéro WhatsApp (avec indicatif)" type="text" value={content.phoneNumber} onChange={(v) => onUpdateContent('phoneNumber', v)} placeholder="Ex: 212600000000" />
                <FieldInput label="Titre Principal de l'en-tête" type="text" value={content.headline} onChange={(v) => onUpdateContent('headline', v)} placeholder="Service Client WhatsApp" />
                <FieldInput label="Nom de l'agent" type="text" value={content.nickname} onChange={(v) => onUpdateContent('nickname', v)} placeholder="Ex: Sarah" />
                <FieldInput label="Message de bienvenue (Bulle)" type="textarea" value={content.welcomeMessage} onChange={(v) => onUpdateContent('welcomeMessage', v)} />
                <FieldInput label="Message pré-rempli pour le client" type="textarea" value={content.preSetMessage} onChange={(v) => onUpdateContent('preSetMessage', v)} placeholder="Bonjour, je souhaite commander..." />

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Icône du Bouton</label>
                  <div className="grid grid-cols-5 gap-1.5">
                    {['whatsapp', 'message-circle', 'message-square', 'headset', 'bot'].map(icon => {
                      const isSel = (content.iconType || 'whatsapp') === icon;
                      return (
                        <button
                          key={icon}
                          type="button"
                          onClick={() => onUpdateContent('iconType', icon)}
                          className={`p-2.5 rounded-xl border flex items-center justify-center transition-all ${
                            isSel ? 'border-emerald-500 bg-emerald-50 text-emerald-600 shadow-2xs' : 'border-slate-200 hover:border-slate-300 text-slate-400'
                          }`}
                        >
                          <IconRenderer type={icon} className="w-5 h-5" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* SLIDER */}
            {type === 'slider' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h5 className="text-[10px] font-extrabold uppercase text-slate-700">Cartes du Carrousel ({(content.slides || []).length})</h5>
                  <button
                    onClick={() => {
                      const newSlides = [...(content.slides || []), { title: 'Nouveau Témoignage', description: 'Description...', mediaUrl: '' }];
                      onUpdateContent('slides', newSlides);
                    }}
                    className="flex items-center gap-1 text-[10px] font-bold text-purple-600 bg-purple-100 hover:bg-purple-200 px-2 py-1 rounded-lg transition-all"
                  >
                    <Plus className="w-3 h-3" /> Ajouter une carte
                  </button>
                </div>

                <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                  {(content.slides || []).map((slide: any, idx: number) => (
                    <div key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 relative group">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-500">Carte #{idx + 1}</span>
                        <button
                          onClick={() => {
                            const newSlides = content.slides.filter((_: any, i: number) => i !== idx);
                            onUpdateContent('slides', newSlides);
                          }}
                          className="p-1 text-slate-300 hover:text-rose-500 transition-all opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <FieldInput label="Titre" type="text" value={slide.title} onChange={(v) => {
                        const newSlides = [...content.slides];
                        newSlides[idx] = { ...newSlides[idx], title: v };
                        onUpdateContent('slides', newSlides);
                      }} />
                      <FieldInput label="Description" type="textarea" value={slide.description} onChange={(v) => {
                        const newSlides = [...content.slides];
                        newSlides[idx] = { ...newSlides[idx], description: v };
                        onUpdateContent('slides', newSlides);
                      }} />
                      <FieldInput label="URL Média (Image/Vidéo/GIF)" type="text" value={slide.mediaUrl} onChange={(v) => {
                        const newSlides = [...content.slides];
                        newSlides[idx] = { ...newSlides[idx], mediaUrl: v };
                        onUpdateContent('slides', newSlides);
                      }} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* AUDIO */}
            {type === 'audio' && (
              <div className="space-y-4">
                {/* Theme Switcher: WhatsApp vs Classic */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Style / Thème du Lecteur</label>
                  <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-xl">
                    <button
                      type="button"
                      onClick={() => onUpdateContent('themeStyle', 'whatsapp')}
                      className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                        (content.themeStyle || 'whatsapp') === 'whatsapp'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <span>💬 WhatsApp UI</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onUpdateContent('themeStyle', 'classic')}
                      className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                        content.themeStyle === 'classic'
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <span>🎵 Classique</span>
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <h5 className="text-[10px] font-extrabold uppercase text-slate-700">
                    {(content.themeStyle || 'whatsapp') === 'whatsapp' ? 'Notes Vocales WhatsApp' : 'Pistes Audio'} ({(content.audios || []).length})
                  </h5>
                  <button
                    onClick={() => {
                      const newAudios = [
                        ...(content.audios || []),
                        {
                          id: crypto.randomUUID(),
                          title: `Avis Vocal ${(content.audios?.length || 0) + 1}`,
                          senderName: `Client ${(content.audios?.length || 0) + 1}`,
                          time: '11:42',
                          url: '',
                          avatarUrl: ''
                        }
                      ];
                      onUpdateContent('audios', newAudios);
                    }}
                    className="flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 hover:bg-emerald-200 px-2.5 py-1 rounded-lg transition-all"
                  >
                    <Plus className="w-3 h-3" /> Ajouter un audio
                  </button>
                </div>

                <div className="space-y-3">
                  {(content.audios || [{ id: '1', title: 'Avis Client', senderName: 'Fatima (Casablanca)', time: '11:42', url: '' }]).map((audio: any, idx: number) => (
                    <div key={audio.id || idx} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5 relative group">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-600 flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          {(content.themeStyle || 'whatsapp') === 'whatsapp' ? `Message Vocal #${idx + 1}` : `Piste #${idx + 1}`}
                        </span>
                        {(content.audios || []).length > 1 && (
                          <button
                            onClick={() => {
                              const newAudios = content.audios.filter((_: any, i: number) => i !== idx);
                              onUpdateContent('audios', newAudios);
                            }}
                            className="p-1 text-slate-300 hover:text-rose-500 transition-all opacity-0 group-hover:opacity-100"
                            title="Supprimer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {(content.themeStyle || 'whatsapp') === 'whatsapp' && (
                        <>
                          <div className="grid grid-cols-2 gap-2">
                            <FieldInput 
                              label="Nom du Contact / Client" 
                              type="text" 
                              value={audio.senderName || audio.title} 
                              onChange={(v) => {
                                const newAudios = [...(content.audios || [])];
                                newAudios[idx] = { ...newAudios[idx], senderName: v, title: v };
                                onUpdateContent('audios', newAudios);
                              }} 
                              placeholder="Ex: Fatima (Casablanca)"
                            />
                            <FieldInput 
                              label="Heure du message" 
                              type="text" 
                              value={audio.time || '11:42'} 
                              onChange={(v) => {
                                const newAudios = [...(content.audios || [])];
                                newAudios[idx] = { ...newAudios[idx], time: v };
                                onUpdateContent('audios', newAudios);
                              }} 
                              placeholder="11:42"
                            />
                          </div>

                          <FieldInput 
                            label="Photo de profil (Avatar URL)" 
                            type="text" 
                            value={audio.avatarUrl} 
                            onChange={(v) => {
                              const newAudios = [...(content.audios || [])];
                              newAudios[idx] = { ...newAudios[idx], avatarUrl: v };
                              onUpdateContent('audios', newAudios);
                            }} 
                            placeholder="https://... ou laisser vide pour avatar WhatsApp"
                          />
                        </>
                      )}

                      {content.themeStyle === 'classic' && (
                        <FieldInput 
                          label="Titre de la carte audio" 
                          type="text" 
                          value={audio.title} 
                          onChange={(v) => {
                            const newAudios = [...(content.audios || [])];
                            newAudios[idx] = { ...newAudios[idx], title: v };
                            onUpdateContent('audios', newAudios);
                          }} 
                        />
                      )}

                      <FieldInput 
                        label="Lien Fichier Audio MP3 / Voix" 
                        type="text" 
                        value={audio.url} 
                        onChange={(v) => {
                          const newAudios = [...(content.audios || [])];
                          newAudios[idx] = { ...newAudios[idx], url: v };
                          onUpdateContent('audios', newAudios);
                        }} 
                        placeholder="https://.../vocal.mp3"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================= STYLE & DESIGN ================= */}
        {activeTab === 'style' && (
          <div className="space-y-4">
            {type === 'hero' && (
              <>
                <FieldInput label="Couleur de Fond" type="color" value={content.bgColor || '#f8fafc'} onChange={(v) => onUpdateContent('bgColor', v)} />
                <FieldInput label="Couleur du Titre" type="color" value={content.titleColor || '#0f172a'} onChange={(v) => onUpdateContent('titleColor', v)} />
                <FieldInput label="Couleur du Sous-titre" type="color" value={content.subtitleColor || '#475569'} onChange={(v) => onUpdateContent('subtitleColor', v)} />
              </>
            )}

            {type === 'header' && (
              <>
                <FieldInput label="Couleur de Fond" type="color" value={content.bgColor || '#0f172a'} onChange={(v) => onUpdateContent('bgColor', v)} />
                <FieldInput label="Couleur du Texte" type="color" value={content.color || '#ffffff'} onChange={(v) => onUpdateContent('color', v)} />
              </>
            )}

            {type === 'text' && (
              <FieldInput label="Couleur du Texte" type="color" value={content.color || '#334155'} onChange={(v) => onUpdateContent('color', v)} />
            )}

            {type === 'button' && (
              <>
                <FieldInput label="Couleur de Fond du Bouton" type="color" value={content.bgColor || '#ea580c'} onChange={(v) => onUpdateContent('bgColor', v)} />
                <FieldInput label="Couleur du Texte" type="color" value={content.textColor || '#ffffff'} onChange={(v) => onUpdateContent('textColor', v)} />
                <div className="grid grid-cols-2 gap-2">
                  <FieldInput label="Taille Texte (px)" type="number" value={content.textSize || 18} onChange={(v) => onUpdateContent('textSize', v)} />
                  <FieldInput label="Rayon Arrondi (px)" type="number" value={content.buttonBorderRadius ?? 16} onChange={(v) => onUpdateContent('buttonBorderRadius', v)} />
                </div>
              </>
            )}

            {type === 'express_checkout' && (
              <>
                <FieldInput label="Couleur Principale du Thème" type="color" value={content.themeColor || '#ea580c'} onChange={(v) => onUpdateContent('themeColor', v)} />
                <div className="grid grid-cols-2 gap-2">
                  <FieldInput label="Fond Formulaire" type="color" value={content.formBgColor || '#ffffff'} onChange={(v) => onUpdateContent('formBgColor', v)} />
                  <FieldInput label="Fond du Bloc" type="color" value={content.containerBgColor || '#ffffff'} onChange={(v) => onUpdateContent('containerBgColor', v)} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <FieldInput label="Bordure (px)" type="number" value={content.borderWidth ?? 1} onChange={(v) => onUpdateContent('borderWidth', v)} />
                  <FieldInput label="Couleur Bordure" type="color" value={content.borderColor || '#e2e8f0'} onChange={(v) => onUpdateContent('borderColor', v)} />
                </div>
                <FieldInput label="Arrondi des Coins (px)" type="number" value={content.borderRadiusTL ?? 24} onChange={(v) => {
                  onUpdateContent('borderRadiusTL', v);
                  onUpdateContent('borderRadiusTR', v);
                  onUpdateContent('borderRadiusBL', v);
                  onUpdateContent('borderRadiusBR', v);
                }} />
              </>
            )}

            {type === 'slider' && (
              <>
                <FieldInput label="Fond des Cartes" type="color" value={content.cardBg || '#ffffff'} onChange={(v) => onUpdateContent('cardBg', v)} />
                <FieldInput label="Couleur Titre" type="color" value={content.titleColor || '#0f172a'} onChange={(v) => onUpdateContent('titleColor', v)} />
                <FieldInput label="Couleur Description" type="color" value={content.descColor || '#475569'} onChange={(v) => onUpdateContent('descColor', v)} />
                <FieldInput label="Rayon de Bordure (px)" type="number" value={content.cardRadius ?? 20} onChange={(v) => onUpdateContent('cardRadius', v)} />
              </>
            )}

            {type === 'audio' && (
              <div className="space-y-4">
                {(content.themeStyle || 'whatsapp') === 'whatsapp' ? (
                  <>
                    <h5 className="text-[10px] font-extrabold uppercase text-slate-700">Apparence WhatsApp</h5>
                    
                    <div>
                      <FieldInput 
                        label="Couleur de la Bulle" 
                        type="color" 
                        value={content.bubbleColor || '#ffffff'} 
                        onChange={(v) => onUpdateContent('bubbleColor', v)} 
                      />
                      <div className="flex gap-1.5 mt-1.5 flex-wrap">
                        {[
                          { label: 'Blanc', val: '#ffffff' },
                          { label: 'Vert Clair', val: '#E7FFDB' },
                          { label: 'Vert WhatsApp', val: '#DCF8C6' },
                          { label: 'Gris Neutre', val: '#f8fafc' },
                        ].map(sw => (
                          <button
                            key={sw.val}
                            type="button"
                            onClick={() => onUpdateContent('bubbleColor', sw.val)}
                            className="px-2 py-0.5 rounded text-[10px] font-bold border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 transition-all"
                          >
                            {sw.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <FieldInput 
                        label="Bouton Play" 
                        type="color" 
                        value={content.playBtnColor || '#25D366'} 
                        onChange={(v) => onUpdateContent('playBtnColor', v)} 
                      />
                      <FieldInput 
                        label="Onde Active" 
                        type="color" 
                        value={content.activeWaveColor || '#34B7F1'} 
                        onChange={(v) => onUpdateContent('activeWaveColor', v)} 
                      />
                    </div>

                    <div className="space-y-2 pt-2 border-t border-slate-100">
                      <label className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
                        <span className="text-xs font-bold text-slate-700">Doubles coches bleues (✓✓)</span>
                        <input 
                          type="checkbox" 
                          checked={content.showCheckmarks !== false} 
                          onChange={(e) => onUpdateContent('showCheckmarks', e.target.checked)} 
                          className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                        />
                      </label>

                      <label className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
                        <span className="text-xs font-bold text-slate-700">Bouton de vitesse (1x, 1.5x, 2x)</span>
                        <input 
                          type="checkbox" 
                          checked={content.showSpeedToggle !== false} 
                          onChange={(e) => onUpdateContent('showSpeedToggle', e.target.checked)} 
                          className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                        />
                      </label>
                    </div>
                  </>
                ) : (
                  <>
                    <FieldInput label="Couleur de Fond" type="color" value={content.bgColor || '#ffffff'} onChange={(v) => onUpdateContent('bgColor', v)} />
                    <FieldInput label="Couleur de Bordure" type="color" value={content.borderColor || '#f3f4f6'} onChange={(v) => onUpdateContent('borderColor', v)} />
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* ================= ESPACEMENT (BOX MODEL) ================= */}
        {activeTab === 'spacing' && (
          <div className="space-y-4">
            <h5 className="text-[10px] font-extrabold uppercase text-slate-700 mb-2">Modèle de Boîte (Marges & Rembourrages)</h5>
            
            {/* Visual Box Model Graphical Scrubber */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-3xl space-y-3">
              <div className="border border-dashed border-amber-300 bg-amber-50/50 p-4 rounded-2xl relative text-center">
                <span className="text-[9px] font-extrabold uppercase tracking-widest text-amber-700 absolute top-1 left-2">Margin</span>
                <div className="flex justify-center mb-2">
                  <input
                    type="number"
                    value={content.marginTop ?? 0}
                    onChange={(e) => onUpdateContent('marginTop', Number(e.target.value))}
                    className="w-14 text-center text-xs font-bold py-1 bg-white border border-amber-200 rounded-lg"
                    title="Margin Top"
                  />
                </div>

                <div className="border border-dashed border-blue-300 bg-blue-50/60 p-4 rounded-xl relative">
                  <span className="text-[9px] font-extrabold uppercase tracking-widest text-blue-700 absolute top-1 left-2">Padding</span>
                  <div className="flex justify-center mb-2">
                    <input
                      type="number"
                      value={content.paddingTop ?? 16}
                      onChange={(e) => onUpdateContent('paddingTop', Number(e.target.value))}
                      className="w-14 text-center text-xs font-bold py-1 bg-white border border-blue-200 rounded-lg"
                      title="Padding Top"
                    />
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <input
                      type="number"
                      value={content.paddingLeft ?? 16}
                      onChange={(e) => onUpdateContent('paddingLeft', Number(e.target.value))}
                      className="w-14 text-center text-xs font-bold py-1 bg-white border border-blue-200 rounded-lg"
                      title="Padding Left"
                    />
                    <span className="text-[10px] font-bold text-slate-400">Contenu</span>
                    <input
                      type="number"
                      value={content.paddingRight ?? 16}
                      onChange={(e) => onUpdateContent('paddingRight', Number(e.target.value))}
                      className="w-14 text-center text-xs font-bold py-1 bg-white border border-blue-200 rounded-lg"
                      title="Padding Right"
                    />
                  </div>

                  <div className="flex justify-center mt-2">
                    <input
                      type="number"
                      value={content.paddingBottom ?? 16}
                      onChange={(e) => onUpdateContent('paddingBottom', Number(e.target.value))}
                      className="w-14 text-center text-xs font-bold py-1 bg-white border border-blue-200 rounded-lg"
                      title="Padding Bottom"
                    />
                  </div>
                </div>

                <div className="flex justify-center mt-2">
                  <input
                    type="number"
                    value={content.marginBottom ?? 0}
                    onChange={(e) => onUpdateContent('marginBottom', Number(e.target.value))}
                    className="w-14 text-center text-xs font-bold py-1 bg-white border border-amber-200 rounded-lg"
                    title="Margin Bottom"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= ANIMATIONS & DÉLAIS ================= */}
        {activeTab === 'advanced' && (
          <div className="space-y-4">
            {type === 'button' && (
              <>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Animation du Bouton</label>
                  <select value={content.animationLayout || 'none'} onChange={(e) => onUpdateContent('animationLayout', e.target.value)} className="w-full text-xs border border-slate-200 rounded-xl p-2 bg-white">
                    <option value="none">Aucune</option>
                    <option value="bounceVertical">Rebond Vertical (Bounce)</option>
                    <option value="bounceHorizontal">Rebond Horizontal</option>
                    <option value="scale">Pulsation (Scale)</option>
                    <option value="fade">Fondu (Fade)</option>
                  </select>
                </div>

                <div className="p-3.5 bg-blue-50/70 border border-blue-100 rounded-2xl space-y-2">
                  <h5 className="text-[10px] font-extrabold uppercase text-blue-800">Délai d'affichage synchronisé à la Vidéo</h5>
                  <FieldInput 
                    label="Afficher après X secondes de vidéo (0 = immédiat)" 
                    type="number" 
                    value={content.showAfterVideoSeconds || 0} 
                    onChange={(v) => onUpdateContent('showAfterVideoSeconds', Number(v))} 
                  />
                  <p className="text-[10px] text-blue-600">
                    Idéal pour les pages VSL (Video Sales Letter) : le bouton d'achat n'apparaît qu'au moment opportun.
                  </p>
                </div>

                <div className="p-3.5 bg-purple-50/70 border border-purple-100 rounded-2xl space-y-2">
                  <h5 className="text-[10px] font-extrabold uppercase text-purple-800">Limite de Clics Visiteur (Disparition)</h5>
                  <FieldInput 
                    label="Nombre max de clics (0 = illimité)" 
                    type="number" 
                    value={content.maxClicks || 0} 
                    onChange={(v) => onUpdateContent('maxClicks', Number(v))} 
                  />
                  <p className="text-[10px] text-purple-600">
                    Le bouton disparaît définitivement de la page du visiteur une fois la limite de clics atteinte.
                  </p>
                </div>
              </>
            )}

            {type === 'whatsapp' && (
              <div className="space-y-3">
                <FieldInput label="Nombre de badges non-lus" type="number" value={content.badgeCount || 0} onChange={(v) => onUpdateContent('badgeCount', Number(v))} />
                <FieldInput label="Texte bulle notification" type="text" value={content.badgeMessage || ''} onChange={(v) => onUpdateContent('badgeMessage', v)} placeholder="Ex: 👋 1 offre vous attend !" />
              </div>
            )}

            {type !== 'button' && type !== 'whatsapp' && (
              <div className="p-4 text-center text-xs text-slate-400">
                Aucun réglage d'animation supplémentaire requis pour ce composant.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Helpers
interface FieldInputProps {
  label: string;
  type: string;
  value: any;
  onChange: (value: any) => void;
  placeholder?: string;
}

const FieldInput: React.FC<FieldInputProps> = ({ label, type, value, onChange, placeholder }) => (
  <div>
    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{label}</label>
    {type === 'textarea' ? (
      <textarea
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full text-xs border border-slate-200 rounded-xl p-2.5 bg-white focus:outline-none focus:border-orange-500 min-h-[80px]"
      />
    ) : type === 'color' ? (
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value || '#000000'}
          onChange={(e) => onChange(e.target.value)}
          className="w-9 h-9 rounded-xl border border-slate-200 p-0.5 cursor-pointer shrink-0"
        />
        <input
          type="text"
          value={value || '#000000'}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 text-xs font-mono font-bold uppercase border border-slate-200 rounded-xl px-2.5 py-1.5 bg-white text-slate-700"
        />
      </div>
    ) : (
      <input
        type={type}
        value={value || ''}
        onChange={(e) => onChange(type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value)}
        placeholder={placeholder}
        className="w-full text-xs border border-slate-200 rounded-xl px-2.5 py-2 bg-white focus:outline-none focus:border-orange-500 text-slate-700"
      />
    )}
  </div>
);
