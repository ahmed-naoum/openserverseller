import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { authApi, api, uploadApi } from '../../lib/api';
import toast from 'react-hot-toast';
import {
  Mail, Shield, Building2, CreditCard, CheckCircle2, Clock, Lock,
  ChevronDown, ChevronUp, Upload, FileText, X, Loader2, Send,
  Building, Landmark, ArrowRight, Sparkles, AlertTriangle,
  Camera, CameraOff, RefreshCw, Smartphone, Book, Car, User, Trash2, Plus
} from 'lucide-react';
import BankSelect from '../../components/common/BankSelect';

type StepStatus = 'COMPLETED' | 'IN_PROGRESS' | 'PENDING' | 'LOCKED' | 'REJECTED';

// ─── Helper: compute verification progress ─────────────────────────────
export function getVerificationStatus(user: any) {
  const emailVerified = !!user?.emailVerified;
  const kycStatus = user?.kycStatus || 'PENDING';
  const contractAccepted = !!user?.contractAccepted;

  const identityDone = kycStatus === 'APPROVED';
  const identityInProgress = kycStatus === 'UNDER_REVIEW';

  const hasBankAccounts = (user?.bankAccounts?.length ?? 0) > 0;
  const allBanksRejected = hasBankAccounts && user.bankAccounts.every((ba: any) => ba.status === 'REJECTED');
  const anyBankApproved = user?.bankAccounts?.some((ba: any) => ba.status === 'APPROVED');
  const anyBankPending = user?.bankAccounts?.some((ba: any) => ba.status === 'PENDING');
  const bankDone = anyBankApproved; // For final completion
  const bankUnlockingContract = anyBankApproved || anyBankPending; // To allow signing while pending

  const steps = {
    email: emailVerified ? 'COMPLETED' as StepStatus : 'PENDING' as StepStatus,
    identity: identityDone ? 'COMPLETED' as StepStatus
      : identityInProgress ? 'IN_PROGRESS' as StepStatus
      : (kycStatus === 'REJECTED' ? 'REJECTED' as StepStatus : (emailVerified ? 'PENDING' as StepStatus : 'LOCKED' as StepStatus)),
    bank: (identityDone || identityInProgress) 
      ? (anyBankApproved ? 'COMPLETED' as StepStatus 
        : (anyBankPending ? 'IN_PROGRESS' as StepStatus 
          : (allBanksRejected ? 'REJECTED' as StepStatus : 'PENDING' as StepStatus))) 
      : 'LOCKED' as StepStatus,
    contract: contractAccepted ? 'COMPLETED' as StepStatus : (bankUnlockingContract && (identityDone || identityInProgress) ? 'PENDING' as StepStatus : 'LOCKED' as StepStatus),
  };

  const completed = Object.values(steps).filter(s => s === 'COMPLETED').length;
  const total = 4;
  const percentage = Math.round((completed / total) * 100);

  return { steps, completed, total, percentage };
}

// ─── OTP Email Verification Form ─────────────────────────────────────
function EmailVerificationForm({ onComplete }: { onComplete: () => void }) {
  const { user } = useAuth();
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown > 0) {
      const t = setTimeout(() => setResendCooldown(c => c - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [resendCooldown]);

  const handleSendOtp = async () => {
    setLoading(true);
    try {
      await authApi.resendOtp({ email: user?.email || undefined });
      setOtpSent(true);
      setResendCooldown(60);
      toast.success('Code de vérification envoyé !');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erreur lors de l\'envoi');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (otp.length !== 6) return toast.error('Le code doit contenir 6 chiffres');
    setLoading(true);
    try {
      await authApi.verifyOtp({ email: user?.email || undefined, otp });
      toast.success('Email vérifié avec succès !');
      onComplete();
    } catch {
      toast.error('Code invalide ou expiré');
    } finally {
      setLoading(false);
    }
  };

  if (!otpSent) {
    return (
      <div className="space-y-4">
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-700">
          <p className="font-semibold mb-1">📧 Nous allons envoyer un code de vérification à :</p>
          <p className="font-black">{user?.email}</p>
        </div>
        <button
          onClick={handleSendOtp}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-xl shadow-lg shadow-primary-500/20 transition-all disabled:opacity-50"
        >
          {loading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          Envoyer le code de vérification
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 text-sm text-emerald-700">
        <p>✅ Un code a été envoyé à <span className="font-black">{user?.email}</span></p>
        <p className="text-xs mt-1 text-emerald-500">Vérifiez votre boîte de réception et vos spams</p>
      </div>

      <div>
        <label className="block text-sm font-bold text-slate-600 mb-2">Code de vérification (6 chiffres)</label>
        <div className="flex gap-2">
          <input
            type="text"
            maxLength={6}
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
            placeholder="000000"
            className="flex-1 px-4 py-3 bg-white border-2 border-slate-200 rounded-xl text-center text-2xl font-black tracking-[0.5em] focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 outline-none transition-all"
          />
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={handleVerify}
          disabled={loading || otp.length !== 6}
          className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-xl shadow-lg shadow-primary-500/20 transition-all disabled:opacity-50"
        >
          {loading ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
          Vérifier
        </button>
        <button
          onClick={handleSendOtp}
          disabled={resendCooldown > 0 || loading}
          className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl transition-all disabled:opacity-50 text-sm"
        >
          {resendCooldown > 0 ? `${resendCooldown}s` : 'Renvoyer'}
        </button>
      </div>
    </div>
  );
}

// ─── Identity Verification Form (KYC Document Upload) ──────────────
function IdentityVerificationForm({ onComplete }: { onComplete: () => void }) {
  const { user } = useAuth();
  const [documentType, setDocumentType] = useState('CIN');
  const [documentFiles, setDocumentFiles] = useState<File[]>([]);
  const [documentPreviews, setDocumentPreviews] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [extractionLoading, setExtractionLoading] = useState(false);
  const [kycForm, setKycForm] = useState({
    fullName: user?.profile?.fullName || '',
    cinNumber: '',
    birthDate: '',
    address: '',
    city: '',
  });
  const [extractionData, setExtractionData] = useState<{
    recto?: any;
    verso?: any;
    rectoText?: string;
    versoText?: string;
  }>({});

  const rectoInputRef = useRef<HTMLInputElement>(null);
  const versoInputRef = useRef<HTMLInputElement>(null);

  const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp', 'application/pdf'];

  const handleSingleFileChange = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!allowedTypes.includes(file.type)) {
      toast.error('Format de fichier non supporté. Veuillez utiliser JPG, PNG, WEBP ou PDF.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Fichier trop volumineux. La taille maximale est de 10MB.');
      return;
    }

    setDocumentFiles(prev => {
      const next = [...prev];
      next[index] = file;
      return next;
    });

    const reader = new FileReader();
    reader.onload = () => {
      setDocumentPreviews(prev => {
        const next = [...prev];
        next[index] = reader.result as string;
        return next;
      });
    };
    reader.readAsDataURL(file);

    handleExtraction(file, index);
    e.target.value = '';
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const newFiles = Array.from(e.target.files);
    const validFiles = newFiles.filter(file => allowedTypes.includes(file.type));
    const availableSlots = 2 - documentFiles.length;
    const toAdd = validFiles.slice(0, availableSlots);

    if (toAdd.length > 0) {
      const newFilesArr = [...documentFiles, ...toAdd];
      setDocumentFiles(newFilesArr);
      toAdd.forEach((file, idx) => {
        const fileIndex = documentFiles.length + idx;
        if (fileIndex < 2) handleExtraction(file, fileIndex);
      });
      toAdd.forEach(file => {
        const reader = new FileReader();
        reader.onload = () => setDocumentPreviews(p => [...p, reader.result as string]);
        reader.readAsDataURL(file);
      });
    }
    e.target.value = '';
  };

  const handleExtraction = async (file: File, fileIndex: number) => {
    setExtractionLoading(true);
    try {
      const type = fileIndex === 0 ? 'recto' : 'verso';
      const res = await authApi.extractKycData(file, type);
      const data = res.data.data;
      
      setExtractionData(prev => ({ 
        ...prev, 
        [type]: data,
        [`${type}Text`]: data.rawText || ''
      }));
      
      const fileName = fileIndex === 0 ? 'du Recto' : 'du Verso';
      toast.success(`Analyse ${fileName} terminée.`);
    } catch (err) {
      console.error('Extraction error:', err);
    } finally {
      setExtractionLoading(false);
    }
  };

  const isFormValid = !!documentFiles[0] && !!documentFiles[1] &&
    !!kycForm.fullName.trim() && !!kycForm.cinNumber.trim() &&
    !!kycForm.birthDate && !!kycForm.city.trim() && !!kycForm.address.trim();

  const removeFile = (index: number) => {
    setDocumentFiles(prev => prev.filter((_, i) => i !== index));
    setDocumentPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    const validDocs = documentFiles.filter(Boolean);
    if (validDocs.length !== 2) return toast.error('Veuillez uploader les deux faces du document (Recto et Verso)');
    
    if (!kycForm.fullName.trim()) return toast.error('Le nom complet est requis');
    if (!kycForm.cinNumber.trim()) return toast.error('Le numéro de CIN est requis');
    if (!kycForm.birthDate) return toast.error('La date de naissance est requise');
    if (!kycForm.city.trim()) return toast.error('La ville est requise');
    if (!kycForm.address.trim()) return toast.error('L\'adresse est requise');

    setLoading(true);
    try {
      const formData = new FormData();
      validDocs.forEach(file => formData.append('files', file));
      const uploadRes = await api.post('/upload/kyc', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const uploadedFiles = uploadRes.data.data.files;
      await authApi.submitKyc({
        documents: uploadedFiles.map((f: any, idx: number) => ({
          type: documentType,
          url: f.url,
          metadata: idx === 0 ? extractionData : null 
        })),
        ...kycForm
      });
      toast.success('Documents et informations soumis avec succès !');
      onComplete();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Erreur lors de la soumission');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {user?.kycStatus === 'REJECTED' && (
        <div className="bg-rose-50 border border-rose-100 rounded-xl p-4 text-sm text-rose-700 flex items-start gap-3">
          <AlertTriangle className="flex-shrink-0 mt-0.5" size={18} />
          <div>
            <p className="font-bold">Votre vérification d'identité a été rejetée</p>
            <p className="text-xs mt-1 opacity-80 text-rose-600 font-medium">Veuillez soumettre des documents valides et clairs pour réessayer.</p>
          </div>
        </div>
      )}
      <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 text-sm text-slate-600">
        <p className="font-semibold text-slate-700 mb-1">📋 Instructions</p>
        <ul className="list-disc list-inside space-y-1 text-xs">
          <li>Sélectionnez le type de votre pièce d'identité.</li>
          <li>Uploadez les photos recto et verso de votre document.</li>
        </ul>
      </div>

      {/* Document Type Selector */}
      <div>
        <label className="block text-sm font-bold text-slate-600 mb-2">1. Type de document</label>
        <div className="grid grid-cols-2 gap-2">
          {[
            { value: 'CIN', label: 'CIN / Carte ID', icon: User },
            { value: 'PASSPORT', label: 'Passeport', icon: Book },
          ].map(opt => {
            const Icon = opt.icon;
            return (
              <button
                key={opt.value}
                onClick={() => setDocumentType(opt.value)}
                className={`p-3 rounded-xl border-2 text-center transition-all flex flex-col items-center gap-2 ${
                  documentType === opt.value
                    ? 'border-primary-500 bg-primary-50 text-primary-700 shadow-sm'
                    : 'border-slate-200 hover:border-slate-300 text-slate-500'
                }`}
              >
                <Icon size={24} className={documentType === opt.value ? 'text-primary-600' : 'text-slate-400'} />
                <span className="text-xs font-bold leading-tight">{opt.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Separate Upload Zones */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Photo Recto</label>
          <div 
            onClick={() => rectoInputRef.current?.click()}
            className={`relative border-2 border-dashed rounded-2xl p-4 transition-all cursor-pointer group flex flex-col items-center justify-center min-h-[144px] ${
              documentPreviews[0] ? 'border-emerald-200 bg-emerald-50/20' : 'border-slate-200 hover:border-primary-400 hover:bg-primary-50/20'
            }`}
          >
            {documentPreviews[0] ? (
              <div className="relative w-full h-full rounded-xl overflow-hidden shadow-sm">
                <img src={documentPreviews[0]} alt="Recto" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <p className="text-white text-[10px] font-black uppercase">Changer</p>
                </div>
              </div>
            ) : (
              <>
                <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                  <Camera size={20} />
                </div>
                <p className="text-[11px] font-bold text-slate-500">Recto CIN</p>
              </>
            )}
            {extractionLoading && documentFiles[0] && !extractionData?.rectoText && (
              <div className="absolute inset-0 bg-white/80 backdrop-blur-[1px] rounded-2xl flex flex-col items-center justify-center gap-2">
                <Loader2 className="animate-spin text-primary-500" size={20} />
                <span className="text-[9px] font-black uppercase text-primary-600">Analyse...</span>
              </div>
            )}
          </div>
          <input type="file" ref={rectoInputRef} className="hidden" accept="image/*,application/pdf" onChange={(e) => handleSingleFileChange(e, 0)} />
        </div>

        <div className="space-y-2">
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Photo Verso</label>
          <div 
            onClick={() => versoInputRef.current?.click()}
            className={`relative border-2 border-dashed rounded-2xl p-4 transition-all cursor-pointer group flex flex-col items-center justify-center min-h-[144px] ${
              documentPreviews[1] ? 'border-emerald-200 bg-emerald-50/20' : 'border-slate-200 hover:border-primary-400 hover:bg-primary-50/20'
            }`}
          >
            {documentPreviews[1] ? (
              <div className="relative w-full h-full rounded-xl overflow-hidden shadow-sm">
                <img src={documentPreviews[1]} alt="Verso" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <p className="text-white text-[10px] font-black uppercase">Changer</p>
                </div>
              </div>
            ) : (
              <>
                <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                  <Camera size={20} />
                </div>
                <p className="text-[11px] font-bold text-slate-500">Verso CIN</p>
              </>
            )}
            {extractionLoading && documentFiles[1] && !extractionData?.versoText && (
              <div className="absolute inset-0 bg-white/80 backdrop-blur-[1px] rounded-2xl flex flex-col items-center justify-center gap-2">
                <Loader2 className="animate-spin text-primary-500" size={20} />
                <span className="text-[9px] font-black uppercase text-primary-600">Analyse...</span>
              </div>
            )}
          </div>
          <input type="file" ref={versoInputRef} className="hidden" accept="image/*,application/pdf" onChange={(e) => handleSingleFileChange(e, 1)} />
        </div>
      </div>

      {/* File Previews */}
      {documentPreviews.length > 0 && (
        <div className="space-y-2">
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
            Documents Prêts à l'envoi ({documentPreviews.length})
          </label>
          <div className="flex gap-3 flex-wrap p-3 bg-slate-50 border border-slate-100 rounded-xl">
            {documentPreviews.map((preview, i) => (
              <div key={i} className="relative group w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden border-2 border-slate-200 shadow-sm">
                {preview.startsWith('data:image') ? (
                  <img src={preview} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-slate-100 flex items-center justify-center">
                    <FileText size={20} className="text-slate-400" />
                  </div>
                )}
                <button
                  onClick={() => removeFile(i)}
                  className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                >
                  <X size={10} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Identity Details Form */}
      <div className="space-y-4 pt-4 border-t border-slate-100 animate-in fade-in slide-in-from-top-4 duration-500">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <FileText size={16} className="text-primary-500" />
            Détails de l'identité
            {extractionLoading && <Loader2 size={14} className="animate-spin text-primary-500" />}
          </h3>
        </div>

        <p className="text-[10px] text-slate-400 font-bold uppercase leading-relaxed">
          Veuillez entrer vos informations manuellement pour validation. Tous les champs sont obligatoires (*).
        </p>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">Nom complet (comme sur la CIN) *</label>
            <input
              type="text"
              required
              value={kycForm.fullName}
              onChange={(e) => setKycForm({...kycForm, fullName: e.target.value.toUpperCase()})}
              className="w-full px-4 py-3 bg-white border-2 border-slate-200 rounded-xl focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 outline-none transition-all font-medium"
              placeholder="EX: AHMED KHALID"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">N° CIN *</label>
            <input
              type="text"
              required
              value={kycForm.cinNumber}
              onChange={(e) => setKycForm({...kycForm, cinNumber: e.target.value.toUpperCase()})}
              className="w-full px-4 py-3 bg-white border-2 border-slate-200 rounded-xl focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 outline-none transition-all font-mono font-bold"
              placeholder="EX: AB123456"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">Date de naissance *</label>
            <input
              type="date"
              required
              value={kycForm.birthDate}
              onChange={(e) => setKycForm({...kycForm, birthDate: e.target.value})}
              className="w-full px-4 py-3 bg-white border-2 border-slate-200 rounded-xl focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 outline-none transition-all font-medium"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">Ville *</label>
            <input
              type="text"
              required
              value={kycForm.city}
              onChange={(e) => setKycForm({...kycForm, city: e.target.value})}
              className="w-full px-4 py-3 bg-white border-2 border-slate-200 rounded-xl focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 outline-none transition-all font-medium"
              placeholder="Casablanca"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">Adresse *</label>
            <input
              type="text"
              required
              value={kycForm.address}
              onChange={(e) => setKycForm({...kycForm, address: e.target.value})}
              className="w-full px-4 py-3 bg-white border-2 border-slate-200 rounded-xl focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 outline-none transition-all font-medium"
              placeholder="Rue..."
            />
          </div>
        </div>
      </div>

      <button
        onClick={handleSubmit}
        disabled={loading || !isFormValid}
        className={`w-full flex items-center justify-center gap-2 px-6 py-4 text-white font-black rounded-xl shadow-lg transition-all disabled:opacity-50 text-base ${
          isFormValid ? 'bg-primary-600 hover:bg-primary-700 shadow-primary-500/20' : 'bg-slate-400 cursor-not-allowed'
        }`}
      >
        {loading ? <Loader2 size={20} className="animate-spin" /> : <Shield size={20} />}
        Soumettre pour vérification
      </button>
    </div>
  );
}


// ─── Bank Payment Method Form ──────────────────────────────────────
function BankPaymentForm({ onComplete }: { onComplete: () => void }) {
  const { user, refreshUser } = useAuth();
  const [formData, setFormData] = useState({
    bankName: '',
    ribAccount: '',
    iceNumber: '',
  });
  const [loading, setLoading] = useState(false);

  // Bank OTP verification states
  const [bankOtpStep, setBankOtpStep] = useState<'idle' | 'sending' | 'verify'>('idle');
  const [bankOtpValue, setBankOtpValue] = useState('');
  const [bankOtpMaskedEmail, setBankOtpMaskedEmail] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.bankName) return toast.error('Le nom de la banque est requis');
    if (!formData.ribAccount) return toast.error('Le RIB est requis');
    if (formData.ribAccount.length !== 24)
      return toast.error('Le RIB doit contenir 24 chiffres');
    
    setBankOtpStep('sending');
    setLoading(true);
    try {
      const res = await authApi.sendBankOtp(formData);
      const maskedEmail = res.data?.data?.maskedEmail || res.data?.maskedEmail || '***';
      setBankOtpMaskedEmail(maskedEmail);
      setBankOtpValue('');
      setBankOtpStep('verify');
      toast.success('Code de vérification envoyé !');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err.message || 'Erreur lors de l\'envoi du code');
      setBankOtpStep('idle');
    } finally {
      setLoading(false);
    }
  };

  const handleBankOtpVerify = async () => {
    if (bankOtpValue.length !== 6) return;
    setLoading(true);
    try {
      await authApi.verifyBankOtp(bankOtpValue);
      toast.success('Compte bancaire ajouté avec succès !');
      await refreshUser();
      setFormData({ bankName: '', ribAccount: '', iceNumber: '' });
      setBankOtpStep('idle');
      setBankOtpValue('');
      onComplete();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Code incorrect ou expiré');
    } finally {
      setLoading(false);
    }
  };

  const anyBankRejected = user?.bankAccounts?.some((ba: any) => ba.status === 'REJECTED');

  const getBankStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED': return { icon: CheckCircle2, label: 'Approuvé', color: 'text-emerald-600 bg-emerald-50 border-emerald-100' };
      case 'REJECTED': return { icon: AlertTriangle, label: 'Rejeté', color: 'text-rose-600 bg-rose-50 border-rose-100' };
      default: return { icon: Clock, label: 'En attente', color: 'text-amber-600 bg-amber-50 border-amber-100' };
    }
  };

  return (
    <div className="space-y-6">
      {/* Existing Accounts List */}
      {user?.bankAccounts && user.bankAccounts.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <Landmark size={16} className="text-primary-500" />
            Vos méthodes de paiement
          </h4>
          <div className="grid grid-cols-1 gap-3">
            {user.bankAccounts.map((ba: any) => {
              const badge = getBankStatusBadge(ba.status);
              const BadgeIcon = badge.icon;
              return (
                <div key={ba.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transform hover:scale-[1.01] transition-all">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-700">{ba.bankName}</span>
                      <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[9px] font-black uppercase tracking-tighter ${badge.color}`}>
                        <BadgeIcon size={10} />
                        {badge.label}
                      </div>
                    </div>
                    <p className="text-xs font-mono text-slate-500 tracking-wider">
                      {ba.ribAccount.replace(/(.{4})/g, '$1 ').trim()}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {anyBankRejected && !user?.bankAccounts?.some((ba: any) => ba.status === 'APPROVED' || ba.status === 'PENDING') && (
        <div className="bg-rose-50 border border-rose-100 rounded-xl p-4 text-sm text-rose-700 flex items-start gap-3">
          <AlertTriangle className="flex-shrink-0 mt-0.5" size={18} />
          <div>
            <p className="font-bold">Coordonnées bancaires rejetées</p>
            <p className="text-xs mt-1 opacity-80 text-rose-600 font-medium">Veuillez vérifier vos informations (RIB à 24 chiffres) et soumettre à nouveau.</p>
          </div>
        </div>
      )}

      {/* Add New Bank Account Section */}
      <div className="pt-6 border-t border-slate-100 space-y-4">
        <div>
          <h4 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <Plus size={16} className="text-primary-500" /> Ajouter un nouveau compte
          </h4>
          <p className="text-xs text-slate-400 font-medium mt-1">
            Toutes les nouvelles méthodes sont soumises à une vérification manuelle.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-5 bg-slate-50/50 p-5 sm:p-6 rounded-2xl border border-slate-100">
          <div className="space-y-3">
            <BankSelect 
              value={formData.bankName} 
              onChange={(name) => setFormData(prev => ({ ...prev, bankName: name }))} 
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-bold text-slate-600 uppercase tracking-wider flex items-center gap-2">
              RIB Bancaire (24 chiffres)
            </label>
            <input
              type="text"
              maxLength={24}
              placeholder="RIB à 24 chiffres"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 outline-none transition-all font-mono font-bold text-sm tracking-wider"
              value={formData.ribAccount}
              onChange={(e) => setFormData(prev => ({ ...prev, ribAccount: e.target.value.replace(/\D/g, '').slice(0, 24) }))}
            />
          </div>
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={loading || bankOtpStep === 'verify'}
              className="px-8 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-bold shadow-lg shadow-primary-600/20 transition-all flex items-center gap-2 disabled:opacity-50 text-sm"
            >
              {loading && bankOtpStep === 'sending' ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}
              Envoyer le code de vérification
            </button>
          </div>
        </form>

        {/* OTP Verification Step */}
        {bankOtpStep === 'verify' && (
          <div className="mt-4 p-5 sm:p-6 bg-blue-50/50 rounded-2xl border-2 border-blue-100 animate-in slide-in-from-bottom-4 duration-300">
            <div className="text-center mb-5">
              <div className="w-12 h-12 bg-blue-100 rounded-full mx-auto mb-3 flex items-center justify-center">
                <Mail size={22} className="text-blue-600" />
              </div>
              <h4 className="text-base font-black text-slate-800">Vérification par Email</h4>
              <p className="text-xs text-slate-400 font-medium mt-1">
                Un code à 6 chiffres a été envoyé à <strong>{bankOtpMaskedEmail}</strong>
              </p>
            </div>

            <div className="flex justify-center gap-2 mb-3">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <input
                  key={i}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  className="w-10 h-12 bg-white border-2 border-slate-200 rounded-lg text-center text-lg font-black text-slate-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                  value={bankOtpValue[i] || ''}
                  autoFocus={i === 0}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '');
                    if (!val && e.target.value) return;
                    const newValue = bankOtpValue.split('');
                    newValue[i] = val;
                    const joined = newValue.join('').slice(0, 6);
                    setBankOtpValue(joined);
                    if (val && i < 5) {
                      const next = e.target.parentElement?.children[i + 1] as HTMLInputElement;
                      next?.focus();
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Backspace' && !bankOtpValue[i] && i > 0) {
                      const prev = (e.target as HTMLElement).parentElement?.children[i - 1] as HTMLInputElement;
                      prev?.focus();
                    }
                  }}
                  onPaste={(e) => {
                    e.preventDefault();
                    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
                    setBankOtpValue(pasted);
                    const target = (e.target as HTMLElement).parentElement?.children[Math.min(pasted.length, 5)] as HTMLInputElement;
                    target?.focus();
                  }}
                />
              ))}
            </div>

            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest text-center mb-5">
              ⏱ Le code expire dans 10 minutes
            </p>

            <div className="flex gap-3 justify-center">
              <button
                type="button"
                onClick={() => { setBankOtpStep('idle'); setBankOtpValue(''); }}
                className="px-5 py-2.5 bg-white border border-slate-200 text-slate-500 rounded-xl font-bold text-xs hover:bg-slate-50 transition-all"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleBankOtpVerify}
                disabled={bankOtpValue.length !== 6 || loading}
                className="px-6 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-bold shadow-lg shadow-primary-600/20 transition-all flex items-center gap-2 disabled:opacity-50 text-xs"
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                Confirmer et Ajouter
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Contract Signing Form ───────────────────────────────────────────
function ContractSigningForm({ onComplete }: { onComplete: () => void }) {
  const { user, refreshUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [accepted, setAccepted] = useState(false);

  const handleSign = async () => {
    if (!accepted) return toast.error('Veuillez accepter les termes du contrat');
    setLoading(true);
    try {
      await api.post('/auth/sign-contract');
      toast.success('Contrat signé avec succès !');
      await refreshUser();
      onComplete();
    } catch {
      toast.error('Erreur lors de la signature');
    } finally {
      setLoading(false);
    }
  };

  const getContractContent = () => {
    const role = user?.role;
    
    const generalText = `
      <div class="mt-6 pt-6 border-t border-slate-100">
        <h4 class="font-black text-slate-900 mb-3 text-right">4. نص مشترك لجميع المستخدمين (General)</h4>
        <div class="text-right text-slate-600 text-sm leading-relaxed space-y-2">
          <p><strong>الأمان والملكية الفكرية:</strong></p>
          <p>• جميع البرمجيات والأنظمة والذكاء الاصطناعي المشغل للمنصة هي ملكية حصرية لشركة Silacod.</p>
          <p>• باستخدامك للمنصة، فإنك توافق على التوقيع الرقمي على العقود والوصولات عبر خدمة Damanesign المدمجة، وتعتبر هذه التوقيعات ملزمة قانوناً.</p>
          <p>• تخضع جميع النزاعات التجارية للقانون المغربي، ويكون الاختصاص الحصري لمحاكم مدينة الدار البيضاء.</p>
        </div>
      </div>
    `;

    if (role === 'VENDOR') {
      return `
        <div class="space-y-4">
          <h4 class="font-black text-slate-900 mb-3 text-right">1. لتجار الجملة (Wholesalers)</h4>
          <div class="text-right text-slate-600 text-sm leading-relaxed space-y-2">
            <p><strong>شروط العرض والتوريد:</strong></p>
            <p>• يتعهد تاجر الجملة بأن جميع المنتجات المعروضة أصلية ومطابقة للصور والأوصاف المقدمة.</p>
            <p>• يجب تحديث حالة المخزون بصفة دورية؛ المنصة غير مسؤولة عن الطلبات التي تتم على منتجات غير متوفرة.</p>
            <p>• يقر التاجر بمسؤوليته القانونية الكاملة عن جودة المنتج وعيوبه الخفية وفقاً للقانون المغربي.</p>
            <p>• يتم تحصيل مستحقات التاجر بعد تأكيد استلام الزبون النهائي للمنتج وانقضاء فترة الاسترجاع القانونية.</p>
          </div>
          ${generalText}
        </div>
      `;
    }

    if (role === 'INFLUENCER') {
      return `
        <div class="space-y-4">
          <h4 class="font-black text-slate-900 mb-3 text-right">2. للمؤثرين (Influencers)</h4>
          <div class="text-right text-slate-600 text-sm leading-relaxed space-y-2">
            <p><strong>ميثاق الترويج والعمولة:</strong></p>
            <p>• يلتزم المؤثر بالترويج للمنتجات بطريقة مهنية وعدم تقديم وعود كاذبة للمستهلكين.</p>
            <p>• جميع المحتويات التسويقية (صور/فيديوهات) التي توفرها المنصة هي ملكية فكرية محمية، ويُسمح باستخدامها فقط داخل نطاق حملات Silacod.</p>
            <p>• لا تظهر المنتجات التي يتم اختيارها (Claimed) في حساب المؤثر إلا بعد مراجعة وقبول فريق الدعم التقني للمنصة.</p>
            <p>• يتم احتساب العمولات بناءً على المبيعات المحققة والمدفوعة فعلياً، وتُصرف وفق الجدول الزمني المحدد في لوحة التحكم.</p>
          </div>
          ${generalText}
        </div>
      `;
    }

    return `
      <div class="space-y-4">
        <h4 class="font-black text-slate-900 mb-3 text-right">3. للبائعين (Sellers)</h4>
        <div class="text-right text-slate-600 text-sm leading-relaxed space-y-2">
          <p><strong>إدارة المبيعات والطلبات:</strong></p>
          <p>• يقر "البائع" بأن دوره يقتصر على تسويق وبيع المنتجات المتوفرة في مستودعات المنصة/الموردين فقط، ولا يحق له إضافة منتجات خارجية.</p>
          <p>• جميع الطلبات المودعة تخضع للتدقيق من قبل إدارة المنصة قبل إرسالها لشركة الشحن.</p>
          <p>• يلتزم البائع بحماية خصوصية بيانات الزبائن (Leads) وعدم استخدامها خارج إطار إتمام عملية البيع عبر المنصة، وذلك تماشياً مع قوانين الـ CNDP.</p>
          <p>• أي محاولة للتلاعب بالنظام أو التحايل على العمولات تؤدي لإيقاف الحساب فوراً.</p>
        </div>
        ${generalText}
      </div>
    `;
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 max-h-[400px] overflow-y-auto custom-scrollbar shadow-inner" 
           dangerouslySetInnerHTML={{ __html: getContractContent() }} 
           dir="rtl" />

      <div className="flex items-start gap-3 p-4 bg-primary-50 border border-primary-100 rounded-xl">
        <input 
          type="checkbox" 
          id="accept-contract"
          checked={accepted}
          onChange={(e) => setAccepted(e.target.checked)}
          className="mt-1 w-5 h-5 rounded border-primary-300 text-primary-600 focus:ring-primary-500"
        />
        <label htmlFor="accept-contract" className="text-sm font-bold text-primary-900 cursor-pointer">
          أقر بأنني قرأت ووافقت على جميع شروط العقد المذكورة أعلاه.
        </label>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 text-xs text-slate-400 font-medium px-1">
          <Shield size={14} className="text-slate-300" />
          Signature sécurisée via le service intégré Damanesign
        </div>
        <button
          onClick={handleSign}
          disabled={loading || !accepted}
          className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-slate-900 hover:bg-slate-800 text-white font-black rounded-2xl shadow-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed group"
        >
          {loading ? <Loader2 size={20} className="animate-spin" /> : <FileText size={20} className="group-hover:scale-110 transition-transform" />}
          Signer le contrat numériquement
        </button>
      </div>
    </div>
  );
}

// ─── Main ProfileVerification Page ──────────────────────────────────
export default function ProfileVerification({ hideHeader = false }: { hideHeader?: boolean }) {
  const { user, refreshUser } = useAuth();
  const [expandedStep, setExpandedStep] = useState<number | null>(null);
  const { steps, percentage, completed, total } = getVerificationStatus(user);

  const handleStepComplete = async () => {
    await refreshUser();
    setExpandedStep(null);
  };

  const stepConfigs = [
    {
      id: 1,
      key: 'email' as const,
      title: 'Vérification Email',
      description: `Confirmez votre adresse email: ${user?.email || 'Non renseigné'}`,
      icon: Mail,
      gradient: 'from-blue-500 to-cyan-500',
      form: <EmailVerificationForm onComplete={handleStepComplete} />,
    },
    {
      id: 2,
      key: 'identity' as const,
      title: "Vérification d'Identité",
      description: 'Vérifiez votre identité en fournissant les documents requis (CIN ou Passeport)',
      icon: Shield,
      gradient: 'from-violet-500 to-purple-500',
      form: <IdentityVerificationForm onComplete={handleStepComplete} />,
    },
    {
      id: 3,
      key: 'bank' as const,
      title: 'Méthode de Paiement Bancaire',
      description: 'Ajoutez au moins une méthode de paiement bancaire (RIB)',
      icon: CreditCard,
      gradient: 'from-amber-500 to-orange-500',
      form: <BankPaymentForm onComplete={handleStepComplete} />,
    },
    {
      id: 4,
      key: 'contract' as const,
      title: 'Contrat & Engagement',
      description: 'Prenez connaissance de nos conditions et signez votre contrat',
      icon: FileText,
      gradient: 'from-slate-700 to-slate-900',
      form: <ContractSigningForm onComplete={handleStepComplete} />,
    },
  ];

  const getStatusBadge = (status: StepStatus) => {
    const configs = {
      COMPLETED: { icon: CheckCircle2, label: 'Terminé', bg: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
      IN_PROGRESS: { icon: Loader2, label: 'En cours de vérification', bg: 'bg-blue-50 text-blue-600 border-blue-100' },
      PENDING: { icon: Clock, label: 'En attente', bg: 'bg-amber-50 text-amber-600 border-amber-100' },
      REJECTED: { icon: AlertTriangle, label: 'Rejeté', bg: 'bg-rose-50 text-rose-600 border-rose-100' },
      LOCKED: { icon: Lock, label: 'Verrouillé', bg: 'bg-slate-50 text-slate-400 border-slate-100' },
    };
    const c = configs[status];
    const Icon = c.icon;
    return (
      <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border ${c.bg}`}>
        <Icon size={14} className={`flex-shrink-0 ${status === 'IN_PROGRESS' ? 'animate-spin' : ''}`} />
        <span className="text-[11px] font-black uppercase tracking-wider">{c.label}</span>
      </div>
    );
  };

  const getStepClasses = (status: StepStatus) => {
    switch (status) {
      case 'COMPLETED': return 'border-emerald-200 bg-white hover:border-emerald-300';
      case 'IN_PROGRESS': return 'border-blue-200 bg-white ring-2 ring-blue-500/10 hover:border-blue-300';
      case 'PENDING': return 'border-amber-200 bg-white ring-2 ring-amber-500/10 hover:border-amber-300';
      case 'REJECTED': return 'border-rose-200 bg-white ring-2 ring-rose-500/10 hover:border-rose-300';
      case 'LOCKED': return 'border-slate-100 bg-slate-50/50 opacity-60';
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-4 sm:py-8 font-['Inter']">

      {/* ── Header ── */}
      {!hideHeader && (
        <div className="text-center mb-8 sm:mb-10 space-y-4">
          <div className="inline-flex items-center justify-center p-4 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-xl shadow-purple-500/20 mb-2 transform hover:scale-105 transition-transform">
            <Sparkles size={32} className="text-white" />
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">
            🚀 Prêt à débloquer votre potentiel ?
          </h1>
          <p className="text-sm sm:text-lg text-slate-500 font-medium max-w-2xl mx-auto leading-relaxed">
            Complétez ces étapes de vérification pour accéder à toutes les fonctionnalités de la plateforme
          </p>

          {percentage < 100 && (
            <div className="inline-flex items-center gap-2 px-4 py-2.5 bg-rose-50 text-rose-600 font-bold rounded-xl text-sm border border-rose-100/50 shadow-sm">
              <AlertTriangle size={16} />
              Vous ne pourrez pas effectuer d'actions importantes tant que votre profil n'est pas vérifié
            </div>
          )}
        </div>
      )}

      {/* ── Progress Card ── */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-xl shadow-slate-200/40 border border-slate-100 mb-6 sm:mb-8 relative overflow-hidden">
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary-100 rounded-full blur-[60px] opacity-60 pointer-events-none" />
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4 relative z-10">
          <div>
            <h3 className="text-base sm:text-lg font-black text-slate-800 tracking-tight">Progression de votre profil</h3>
            <p className="text-xs sm:text-sm font-medium text-slate-400 mt-0.5">
              {completed}/{total} étapes complétées
              {percentage < 100 ? ' • Complétez les étapes restantes' : ' • Profil vérifié ✓'}
            </p>
          </div>
          <div className="text-3xl sm:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-primary-600 to-accent-600">
            {percentage}%
          </div>
        </div>
        <div className="w-full h-3 sm:h-4 bg-slate-100 rounded-full overflow-hidden shadow-inner relative z-10">
          <div
            className="h-full bg-gradient-to-r from-primary-500 to-accent-500 rounded-full relative transition-all duration-1000 ease-out"
            style={{ width: `${percentage}%` }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse" />
          </div>
        </div>
        {/* Step dots */}
        <div className="flex justify-between mt-3 relative z-10">
          {stepConfigs.map((s) => {
            const status = steps[s.key];
            return (
              <div key={s.id} className="flex flex-col items-center gap-1">
                <div className={`w-3 h-3 rounded-full transition-all ${
                  status === 'COMPLETED' ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50' :
                  status === 'IN_PROGRESS' ? 'bg-blue-500 animate-pulse' :
                  status === 'PENDING' ? 'bg-amber-400' :
                  'bg-slate-200'
                }`} />
                <span className="text-[9px] font-bold text-slate-400 hidden sm:block">{s.id}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Steps ── */}
      <div className="space-y-4">
        {stepConfigs.map((step) => {
          const status = steps[step.key];
          const Icon = step.icon;
          const isExpanded = expandedStep === step.id;
          
          // Bank step is always expandable to allow adding more methods
          // Identity and Email are expandable if pending/rejected
          const canExpand = step.key === 'bank' || status === 'PENDING' || status === 'REJECTED';

          return (
            <div
              key={step.id}
              className={`relative rounded-2xl shadow-lg transition-all duration-300 border overflow-hidden ${getStepClasses(status)}`}
            >
              {/* Step Header */}
              <button
                onClick={() => {
                  if (canExpand) setExpandedStep(isExpanded ? null : step.id);
                }}
                disabled={!canExpand}
                className={`w-full p-5 sm:p-6 flex flex-col sm:flex-row gap-4 sm:gap-5 items-start sm:items-center text-left ${canExpand ? 'cursor-pointer' : 'cursor-default'}`}
              >
                {/* Step Number + Icon */}
                <div className={`w-12 h-12 flex-shrink-0 flex items-center justify-center rounded-2xl text-white shadow-lg bg-gradient-to-br ${step.gradient} ${
                  status === 'LOCKED' ? 'opacity-40 grayscale' : ''
                }`}>
                  {status === 'COMPLETED' ? (
                    <CheckCircle2 size={22} />
                  ) : (
                    <span className="text-lg font-black">{step.id}</span>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-1">
                    <h3 className={`text-base sm:text-lg font-black tracking-tight ${status === 'LOCKED' ? 'text-slate-400' : 'text-slate-900'}`}>
                      {step.title}
                    </h3>
                    {getStatusBadge(status)}
                  </div>
                  <p className={`text-xs sm:text-sm font-medium ${status === 'LOCKED' ? 'text-slate-400' : 'text-slate-500'}`}>
                    {step.description}
                  </p>
                </div>

                {/* Expand arrow */}
                {canExpand && (
                  <div className="flex-shrink-0 hidden sm:block">
                    {isExpanded ? (
                      <ChevronUp size={20} className="text-slate-400" />
                    ) : (
                      <div className={`flex items-center gap-2 ${status === 'REJECTED' ? 'text-rose-600' : 'text-primary-600'}`}>
                        <span className="text-xs font-bold">{status === 'REJECTED' ? 'Réessayer' : 'Compléter'}</span>
                        <ArrowRight size={16} />
                      </div>
                    )}
                  </div>
                )}
              </button>

              {/* IN_PROGRESS notice (Hidden for bank to show the form/list) */}
              {status === 'IN_PROGRESS' && step.key !== 'bank' && (
                <div className="px-5 sm:px-6 pb-5 sm:pb-6">
                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-700 flex items-start gap-3">
                    <Loader2 size={18} className="animate-spin flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">Documents en cours de vérification</p>
                      <p className="text-xs text-blue-500 mt-1">Notre équipe examine vos documents. Vous serez notifié dès la validation (généralement sous 24-48h).</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Expanded Form (Always mounted to preserve state/files) */}
              <div 
                className={`px-5 sm:px-6 pb-5 sm:pb-6 border-t border-slate-100 ${
                  isExpanded && canExpand ? 'block' : 'hidden'
                }`}
              >
                <div className="pt-5">
                  {step.form}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Success state ── */}
      {percentage === 100 && (
        <div className="mt-8 text-center bg-gradient-to-br from-emerald-50 to-teal-50 rounded-3xl p-8 border border-emerald-100 shadow-lg">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-500 rounded-full shadow-xl shadow-emerald-500/30 mb-4">
            <CheckCircle2 size={32} className="text-white" />
          </div>
          <h3 className="text-2xl font-extrabold text-slate-900 mb-2">
            🎉 Profil entièrement vérifié !
          </h3>
          <p className="text-slate-500 font-medium">
            Vous avez maintenant accès à toutes les fonctionnalités de la plateforme.
          </p>
        </div>
      )}
    </div>
  );
}
