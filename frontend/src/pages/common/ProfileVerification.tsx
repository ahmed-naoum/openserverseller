import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { authApi, api, uploadApi, BACKEND_URL } from '../../lib/api';
import toast from 'react-hot-toast';
import {
  Mail, Shield, Building2, CreditCard, CheckCircle2, Clock, Lock,
  ChevronDown, ChevronUp, Upload, FileText, X, Loader2, Send,
  Building, Landmark, ArrowRight, Sparkles, AlertTriangle,
  Camera, CameraOff, RefreshCw, Smartphone, Book, Car, User, Trash2, Plus
} from 'lucide-react';
import BankSelect from '../../components/common/BankSelect';
import { useLanguage } from '../../contexts/LanguageContext';
import { compressToWebP, blobToWebPFile } from '../../utils/imageCompressor';

type StepStatus = 'COMPLETED' | 'IN_PROGRESS' | 'PENDING' | 'LOCKED' | 'REJECTED';

// ─── Helper: compute verification progress ─────────────────────────────
export function getVerificationStatus(user: any) {
  const hasSubdomain = !!user?.subdomain;
  const emailVerified = !!user?.emailVerified;
  const kycStatus = user?.kycStatus || 'PENDING';
  const contractAccepted = !!user?.contractAccepted;

  const identityDone = kycStatus === 'APPROVED';
  const identityInProgress = kycStatus === 'UNDER_REVIEW';

  const hasBankAccounts = (user?.bankAccounts?.length ?? 0) > 0;
  const allBanksRejected = hasBankAccounts && user.bankAccounts.every((ba: any) => ba.status === 'REJECTED');
  const anyBankApproved = user?.bankAccounts?.some((ba: any) => ba.status === 'APPROVED');
  const anyBankPending = user?.bankAccounts?.some((ba: any) => ba.status === 'PENDING');

  const steps = {
    subdomain: hasSubdomain ? 'COMPLETED' as StepStatus : 'PENDING' as StepStatus,
    email: emailVerified 
      ? 'COMPLETED' as StepStatus 
      : (hasSubdomain ? 'PENDING' as StepStatus : 'LOCKED' as StepStatus),
    identity: identityDone ? 'COMPLETED' as StepStatus
      : identityInProgress ? 'IN_PROGRESS' as StepStatus
      : (kycStatus === 'REJECTED' ? 'REJECTED' as StepStatus : (emailVerified ? 'PENDING' as StepStatus : 'LOCKED' as StepStatus)),
    bank: (identityDone || identityInProgress) 
      ? (anyBankApproved ? 'COMPLETED' as StepStatus 
        : (anyBankPending ? 'IN_PROGRESS' as StepStatus 
          : (allBanksRejected ? 'REJECTED' as StepStatus : 'PENDING' as StepStatus))) 
      : 'LOCKED' as StepStatus,
    contract: contractAccepted 
      ? 'COMPLETED' as StepStatus 
      : (identityDone && anyBankApproved 
        ? 'PENDING' as StepStatus 
        : 'LOCKED' as StepStatus),
  };

  const completed = Object.values(steps).filter(s => s === 'COMPLETED').length;
  const total = 5;
  const percentage = Math.round((completed / total) * 100);

  return { steps, completed, total, percentage };
}

// ─── Subdomain Configuration Form ────────────────────────────────────
function SubdomainConfigurationForm({ onComplete }: { onComplete: () => void }) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const tVerif = (key: string, fallback?: string) => t(key, 'verification', fallback);

  const [subdomain, setSubdomain] = useState(user?.subdomain || '');
  const [checking, setChecking] = useState(false);
  const [status, setStatus] = useState<'idle' | 'available' | 'taken' | 'invalid' | 'reserved' | 'blocked'>('idle');
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!subdomain) {
      setStatus('idle');
      setFeedbackMessage('');
      return;
    }

    const cleaned = subdomain.trim().toLowerCase();
    if (cleaned.length < 3 || cleaned.length > 30) {
      setStatus('invalid');
      setFeedbackMessage(tVerif('subdomain_invalid', 'Only lowercase letters, numbers, and hyphens are allowed (3-30 chars).'));
      return;
    }

    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(cleaned)) {
      setStatus('invalid');
      setFeedbackMessage(tVerif('subdomain_invalid', 'Only lowercase letters, numbers, and hyphens are allowed (3-30 chars).'));
      return;
    }

    setChecking(true);
    setStatus('idle');
    const delayDebounce = setTimeout(async () => {
      try {
        const response = await authApi.checkSubdomain(cleaned);
        const data = response.data;
        if (data.available) {
          setStatus('available');
          setFeedbackMessage(tVerif('subdomain_available', 'This subdomain name is available!'));
        } else {
          if (data.message && (data.message.includes('réservé') || data.message.includes('reserved'))) {
            setStatus('reserved');
          } else {
            setStatus('taken');
          }
          setFeedbackMessage(data.message || tVerif('subdomain_taken', 'This subdomain is already taken. Please try another.'));
        }
      } catch (err: any) {
        setStatus('taken');
        setFeedbackMessage(err.response?.data?.message || tVerif('subdomain_taken', 'This subdomain is already taken. Please try another.'));
      } finally {
        setChecking(false);
      }
    }, 500);

    return () => clearTimeout(delayDebounce);
  }, [subdomain]);

  const handleSave = async () => {
    if (status !== 'available') return;
    setSaving(true);
    try {
      await authApi.saveSubdomain(subdomain.trim().toLowerCase());
      toast.success(tVerif('subdomain_toast_success', 'Subdomain configured successfully!'));
      onComplete();
    } catch (err: any) {
      toast.error(err.response?.data?.message || tVerif('subdomain_toast_error', 'Failed to save subdomain.'));
    } finally {
      setSaving(false);
    }
  };

  const currentHost = window.location.host;
  const domainSuffix = currentHost.replace(/^www\./, '');

  return (
    <div className="space-y-6 max-w-md mx-auto py-4">
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3 shadow-sm">
        <h4 className="text-sm font-bold text-slate-800">
          {tVerif('subdomain_title', 'Custom Subdomain')}
        </h4>
        <p className="text-xs text-slate-600 leading-relaxed">
          {tVerif('subdomain_desc', 'Set your personalized subdomain name to host your landing pages and product offers')}
        </p>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-bold text-slate-700">
          {tVerif('subdomain_label', 'Choose your Subdomain name')}
        </label>
        <div className="relative flex items-center rounded-xl border-2 border-slate-200 bg-white focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-500/20 transition-all overflow-hidden">
          <input
            type="text"
            value={subdomain}
            onChange={(e) => setSubdomain(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
            disabled={saving || !!user?.subdomain}
            placeholder={tVerif('subdomain_placeholder', 'my-store')}
            className="w-full bg-transparent px-4 py-3 text-sm focus:outline-none text-slate-800 font-medium placeholder:text-slate-400"
          />
          <span className="flex-shrink-0 text-xs font-semibold text-slate-500 border-l border-slate-200 px-4 py-3 bg-slate-50">
            .{domainSuffix}
          </span>
        </div>

        {checking && (
          <p className="text-[11px] text-slate-600 flex items-center gap-1.5 px-1 font-medium">
            <Loader2 size={12} className="animate-spin" />
            {tVerif('subdomain_checking', 'Checking availability...')}
          </p>
        )}
        {!checking && status === 'available' && (
          <p className="text-[11px] text-emerald-600 font-semibold px-1">
            ✓ {feedbackMessage}
          </p>
        )}
        {!checking && (status === 'taken' || status === 'invalid' || status === 'reserved' || status === 'blocked') && (
          <p className="text-[11px] text-rose-600 font-semibold px-1">
            ⚠ {feedbackMessage}
          </p>
        )}

        <p className="text-[11px] text-slate-500 px-1 pt-1 italic">
          {tVerif('subdomain_suffix', 'Your links will look like: {subdomain}.silacod.ma/r/link-code').replace('{subdomain}', subdomain || 'your-store')}
        </p>
      </div>

      {!user?.subdomain && (
        <button
          onClick={handleSave}
          disabled={status !== 'available' || saving}
          className="w-full bg-primary-600 hover:bg-primary-700 text-white font-bold text-sm py-3 px-4 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-primary-600/10 hover:shadow-primary-600/20 active:scale-[0.98] transition-all"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
          {tVerif('subdomain_btn_save', 'Confirm Subdomain')}
        </button>
      )}
    </div>
  );
}

// ─── OTP Email Verification Form ─────────────────────────────────────
function EmailVerificationForm({ onComplete }: { onComplete: () => void }) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const tVerif = (key: string, fallback?: string) => t(key, 'verification', fallback);

  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown > 0) {
      const tId = setTimeout(() => setResendCooldown(c => c - 1), 1000);
      return () => clearTimeout(tId);
    }
  }, [resendCooldown]);

  const handleSendOtp = async () => {
    setLoading(true);
    try {
      await authApi.resendOtp({ email: user?.email || undefined });
      setOtpSent(true);
      setResendCooldown(60);
      toast.success(tVerif('email_toast_sent', 'Code de vérification envoyé !'));
    } catch (err: any) {
      toast.error(err.response?.data?.message || tVerif('email_toast_error_send', 'Erreur lors de l\'envoi'));
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (otp.length !== 6) return toast.error(tVerif('email_toast_length', 'Le code doit contenir 6 chiffres'));
    setLoading(true);
    try {
      await authApi.verifyOtp({ email: user?.email || undefined, otp });
      toast.success(tVerif('email_toast_verified', 'Email vérifié avec succès !'));
      onComplete();
    } catch {
      toast.error(tVerif('email_toast_invalid', 'Code invalide ou expiré'));
    } finally {
      setLoading(false);
    }
  };

  if (!otpSent) {
    return (
      <div className="space-y-4">
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-700">
          <p className="font-semibold mb-1">📧 {tVerif('email_notice_to_send', 'Nous allons envoyer un code de vérification à :')}</p>
          <p className="font-black">{user?.email}</p>
        </div>
        <button
          onClick={handleSendOtp}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-xl shadow-lg shadow-primary-500/20 transition-all disabled:opacity-50"
        >
          {loading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          {tVerif('email_btn_send', 'Envoyer le code de vérification')}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 text-sm text-emerald-700">
        <p>✅ {tVerif('email_code_sent', 'Un code a été envoyé à {email}').replace('{email}', user?.email || '')}</p>
        <p className="text-xs mt-1 text-emerald-500">{tVerif('email_spam_check', 'Vérifiez votre boîte de réception et vos spams')}</p>
      </div>

      <div>
        <label className="block text-sm font-bold text-slate-600 mb-2">{tVerif('email_code_label', 'Code de vérification (6 chiffres)')}</label>
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
          {tVerif('email_btn_verify', 'Vérifier')}
        </button>
        <button
          onClick={handleSendOtp}
          disabled={resendCooldown > 0 || loading}
          className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl transition-all disabled:opacity-50 text-sm"
        >
          {resendCooldown > 0 ? `${resendCooldown}s` : tVerif('email_btn_resend', 'Renvoyer')}
        </button>
      </div>
    </div>
  );
}

// ─── Identity Verification Form (KYC Document Upload) ──────────────
function IdentityVerificationForm({ onComplete }: { onComplete: () => void }) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const tVerif = (key: string, fallback?: string) => t(key, 'verification', fallback);

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
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [extractionData, setExtractionData] = useState<{ recto?: any; verso?: any; rectoText?: string; versoText?: string; }>({});

  // Camera state
  const [cameraOpen, setCameraOpen] = useState<number | null>(null); // 0=recto, 1=verso
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const rectoInputRef = useRef<HTMLInputElement>(null);
  const versoInputRef = useRef<HTMLInputElement>(null);

  const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp', 'application/pdf'];

  // ── Validation helpers ──
  const CIN_REGEX = /^[A-Z]{1,2}\d{5,7}$/;
  const PASSPORT_REGEX = /^[A-Z0-9]{6,9}$/;
  const NAME_REGEX = /^[A-ZÀ-ÖØ-Ý\u0600-\u06FF\s'-]{4,60}$/;

  const validateField = (name: string, value: string) => {
    let error = '';
    switch (name) {
      case 'fullName':
        if (!value.trim()) error = 'Le nom complet est requis';
        else if (value.trim().length < 4) error = 'Min 4 caractères';
        else if (value.trim().length > 60) error = 'Max 60 caractères';
        else if (!NAME_REGEX.test(value.trim())) error = 'Caractères invalides (lettres uniquement)';
        else if (value.trim().split(/\s+/).length < 2) error = 'Prénom et nom requis';
        break;
      case 'cinNumber':
        if (!value.trim()) error = 'Numéro requis';
        else if (documentType === 'CIN' && !CIN_REGEX.test(value.trim())) error = 'Format CIN invalide (ex: AB123456)';
        else if (documentType === 'PASSPORT' && !PASSPORT_REGEX.test(value.trim())) error = 'Format passeport invalide';
        break;
      case 'birthDate':
        if (!value) error = 'Date requise';
        else {
          const d = new Date(value);
          const now = new Date();
          const age = now.getFullYear() - d.getFullYear();
          if (age < 18) error = 'Vous devez avoir au moins 18 ans';
          else if (age > 100) error = 'Date invalide';
        }
        break;
      case 'city':
        if (!value.trim()) error = 'Ville requise';
        else if (value.trim().length < 2) error = 'Min 2 caractères';
        break;
      case 'address':
        if (!value.trim()) error = 'Adresse requise';
        else if (value.trim().length < 5) error = 'Min 5 caractères';
        break;
    }
    return error;
  };

  const handleFieldChange = (name: string, value: string) => {
    const upper = name === 'fullName' || name === 'cinNumber' ? value.toUpperCase() : value;
    setKycForm(prev => ({ ...prev, [name]: upper }));
    const err = validateField(name, upper);
    setFieldErrors(prev => ({ ...prev, [name]: err }));
  };

  // ── Camera helpers ──
  const openCamera = async (index: number) => {
    setCameraOpen(index);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch {
      toast.error('Impossible d\'accéder à la caméra');
      setCameraOpen(null);
    }
  };

  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current || cameraOpen === null) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')!.drawImage(video, 0, 0);

    canvas.toBlob(async (blob) => {
      if (!blob) return;
      closeCamera();
      const label = cameraOpen === 0 ? 'recto' : 'verso';
      const webpFile = await blobToWebPFile(blob, `kyc_${label}`, 1920, 0.82);
      setFileAtIndex(cameraOpen!, webpFile);
    }, 'image/jpeg', 0.95);
  };

  const closeCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setCameraOpen(null);
  };

  // ── File handling with WebP compression ──
  const setFileAtIndex = async (index: number, file: File) => {
    let processed = file;
    if (file.type.startsWith('image/')) {
      try { processed = await compressToWebP(file, 1920, 0.82); } catch { /* fallback to original */ }
    }

    setDocumentFiles(prev => { const n = [...prev]; n[index] = processed; return n; });
    const reader = new FileReader();
    reader.onload = () => {
      setDocumentPreviews(prev => { const n = [...prev]; n[index] = reader.result as string; return n; });
    };
    reader.readAsDataURL(processed);
    handleExtraction(processed, index);
  };

  const handleSingleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!allowedTypes.includes(file.type)) { toast.error('Format non supporté (JPG, PNG, WEBP, PDF)'); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error('Fichier trop volumineux (max 10MB)'); return; }
    await setFileAtIndex(index, file);
    e.target.value = '';
  };

  const handleExtraction = async (file: File, fileIndex: number) => {
    setExtractionLoading(true);
    try {
      const type = fileIndex === 0 ? 'recto' : 'verso';
      const res = await authApi.extractKycData(file, type);
      const data = res.data.data;
      setExtractionData(prev => ({ ...prev, [type]: data, [`${type}Text`]: data.rawText || '' }));
      toast.success(`Analyse ${fileIndex === 0 ? 'du Recto' : 'du Verso'} terminée.`);
    } catch { /* silent */ } finally { setExtractionLoading(false); }
  };

  const removeFile = (index: number) => {
    setDocumentFiles(prev => { const n = [...prev]; delete n[index]; return n; });
    setDocumentPreviews(prev => { const n = [...prev]; delete n[index]; return n; });
  };

  // ── Form validation ──
  const allErrors = Object.entries(kycForm).reduce((acc, [k, v]) => {
    const e = validateField(k, v);
    if (e) acc[k] = e;
    return acc;
  }, {} as Record<string, string>);

  const isFormValid = !!documentFiles[0] && !!documentFiles[1] && Object.keys(allErrors).length === 0
    && !!kycForm.fullName.trim() && !!kycForm.cinNumber.trim() && !!kycForm.birthDate && !!kycForm.city.trim() && !!kycForm.address.trim();

  const handleSubmit = async () => {
    // Trigger all field errors
    const errs: Record<string, string> = {};
    Object.entries(kycForm).forEach(([k, v]) => { const e = validateField(k, v); if (e) errs[k] = e; });
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) { toast.error('Veuillez corriger les erreurs'); return; }

    const validDocs = [documentFiles[0], documentFiles[1]].filter(Boolean);
    if (validDocs.length !== 2) { toast.error('Les deux faces du document sont requises'); return; }

    setLoading(true);
    try {
      const formData = new FormData();
      validDocs.forEach(file => formData.append('files', file));
      const uploadRes = await api.post('/upload/kyc', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      const uploadedFiles = uploadRes.data.data.files;
      await authApi.submitKyc({
        documents: uploadedFiles.map((f: any, idx: number) => ({
          type: documentType, url: f.url, metadata: idx === 0 ? extractionData : null
        })),
        ...kycForm
      });
      toast.success(tVerif('identity_toast_success', 'Documents et informations soumis avec succès !'));
      onComplete();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Erreur lors de la soumission');
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-6">
      {/* Hidden canvas for camera capture */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Camera Modal */}
      {cameraOpen !== null && (
        <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg rounded-2xl overflow-hidden bg-black shadow-2xl">
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-auto rounded-2xl" />
            <div className="absolute bottom-4 left-0 right-0 flex items-center justify-center gap-6">
              <button onClick={closeCamera} className="w-12 h-12 rounded-full bg-white/20 backdrop-blur text-white flex items-center justify-center hover:bg-white/30 transition-all">
                <CameraOff size={22} />
              </button>
              <button onClick={capturePhoto} className="w-16 h-16 rounded-full bg-white border-4 border-white/50 flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-xl">
                <Camera size={28} className="text-slate-800" />
              </button>
              <button onClick={() => { closeCamera(); openCamera(cameraOpen); }} className="w-12 h-12 rounded-full bg-white/20 backdrop-blur text-white flex items-center justify-center hover:bg-white/30 transition-all">
                <RefreshCw size={20} />
              </button>
            </div>
          </div>
          <p className="text-white/70 text-xs font-bold mt-4 uppercase tracking-widest">
            {cameraOpen === 0 ? 'Photographier le Recto' : 'Photographier le Verso'}
          </p>
        </div>
      )}

      {user?.kycStatus === 'REJECTED' && (
        <div className="bg-rose-50 border border-rose-100 rounded-xl p-4 text-sm text-rose-700 flex items-start gap-3">
          <AlertTriangle className="flex-shrink-0 mt-0.5" size={18} />
          <div>
            <p className="font-bold">{tVerif('identity_rejected', "Votre vérification d'identité a été rejetée")}</p>
            <p className="text-xs mt-1 opacity-80 text-rose-600 font-medium">{tVerif('identity_rejected_desc', 'Veuillez soumettre des documents valides et clairs pour réessayer.')}</p>
          </div>
        </div>
      )}
      <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 text-sm text-slate-600">
        <p className="font-semibold text-slate-700 mb-1">📋 {tVerif('identity_instructions', 'Instructions')}</p>
        <ul className="list-disc list-inside space-y-1 text-xs">
          <li>{tVerif('identity_inst_1', "Sélectionnez le type de votre pièce d'identité.")}</li>
          <li>{tVerif('identity_inst_2', "Uploadez ou photographiez les recto et verso de votre document.")}</li>
          <li>Les images sont automatiquement compressées et converties en WebP.</li>
        </ul>
      </div>

      {/* Document Type Selector */}
      <div>
        <label className="block text-sm font-bold text-slate-600 mb-2">{tVerif('identity_doc_type', '1. Type de document')}</label>
        <div className="grid grid-cols-2 gap-2">
          {[
            { value: 'CIN', label: tVerif('identity_doc_cin', 'CIN / Carte ID'), icon: User },
            { value: 'PASSPORT', label: tVerif('identity_doc_passport', 'Passeport'), icon: Book },
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

      {/* Upload Zones with Camera buttons */}
      <div className="grid grid-cols-2 gap-4">
        {[0, 1].map(index => {
          const label = index === 0 ? tVerif('identity_photo_recto', 'Photo Recto') : tVerif('identity_photo_verso', 'Photo Verso');
          const placeholder = index === 0 ? tVerif('identity_recto_cin', 'Recto CIN') : tVerif('identity_verso_cin', 'Verso CIN');
          const inputRef = index === 0 ? rectoInputRef : versoInputRef;
          const extractKey = index === 0 ? 'rectoText' : 'versoText';
          return (
            <div key={index} className="space-y-2">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</label>
              <div
                onClick={() => inputRef.current?.click()}
                className={`relative border-2 border-dashed rounded-2xl p-4 transition-all cursor-pointer group flex flex-col items-center justify-center min-h-[144px] ${
                  documentPreviews[index] ? 'border-emerald-200 bg-emerald-50/20' : 'border-slate-200 hover:border-primary-400 hover:bg-primary-50/20'
                }`}
              >
                {documentPreviews[index] ? (
                  <div className="relative w-full h-full rounded-xl overflow-hidden shadow-sm">
                    <img src={documentPreviews[index]} alt={label} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <p className="text-white text-[10px] font-black uppercase">{tVerif('identity_change', 'Changer')}</p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); removeFile(index); }}
                      className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-red-600 transition-all"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                      <Upload size={20} />
                    </div>
                    <p className="text-[11px] font-bold text-slate-500">{placeholder}</p>
                  </>
                )}
                {extractionLoading && documentFiles[index] && !(extractionData as any)?.[extractKey] && (
                  <div className="absolute inset-0 bg-white/80 backdrop-blur-[1px] rounded-2xl flex flex-col items-center justify-center gap-2">
                    <Loader2 className="animate-spin text-primary-500" size={20} />
                    <span className="text-[9px] font-black uppercase text-primary-600">{tVerif('identity_analyzing', 'Analyse...')}</span>
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); openCamera(index); }}
                className="w-full flex items-center justify-center gap-2 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all"
              >
                <Camera size={14} /> Utiliser la caméra
              </button>
              <input type="file" ref={inputRef} className="hidden" accept="image/*,application/pdf" onChange={(e) => handleSingleFileChange(e, index)} />
            </div>
          );
        })}
      </div>

      {/* Identity Details Form with validation */}
      <div className="space-y-4 pt-4 border-t border-slate-100 animate-in fade-in slide-in-from-top-4 duration-500">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <FileText size={16} className="text-primary-500" />
            {tVerif('identity_details_title', "Détails de l'identité")}
            {extractionLoading && <Loader2 size={14} className="animate-spin text-primary-500" />}
          </h3>
        </div>
        <p className="text-[10px] text-slate-400 font-bold uppercase leading-relaxed">
          {tVerif('identity_details_instructions', 'Veuillez entrer vos informations manuellement pour validation. Tous les champs sont obligatoires (*).')}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">{tVerif('identity_fullname', 'Nom complet (comme sur la CIN) *')}</label>
            <input type="text" value={kycForm.fullName} onChange={(e) => handleFieldChange('fullName', e.target.value)}
              className={`w-full px-4 py-3 bg-white border-2 rounded-xl focus:ring-4 outline-none transition-all font-medium ${fieldErrors.fullName ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/10' : 'border-slate-200 focus:border-primary-500 focus:ring-primary-500/10'}`}
              placeholder={tVerif('identity_fullname_placeholder', 'EX: AHMED KHALID')} />
            {fieldErrors.fullName && <p className="text-[10px] text-rose-500 font-bold mt-1 flex items-center gap-1"><AlertTriangle size={10} />{fieldErrors.fullName}</p>}
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">{documentType === 'CIN' ? tVerif('identity_cin', 'N° CIN *') : 'N° Passeport *'}</label>
            <input type="text" value={kycForm.cinNumber} onChange={(e) => handleFieldChange('cinNumber', e.target.value)}
              className={`w-full px-4 py-3 bg-white border-2 rounded-xl focus:ring-4 outline-none transition-all font-mono font-bold ${fieldErrors.cinNumber ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/10' : 'border-slate-200 focus:border-primary-500 focus:ring-primary-500/10'}`}
              placeholder={documentType === 'CIN' ? 'EX: AB123456' : 'EX: AB1234567'} />
            {fieldErrors.cinNumber && <p className="text-[10px] text-rose-500 font-bold mt-1 flex items-center gap-1"><AlertTriangle size={10} />{fieldErrors.cinNumber}</p>}
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">{tVerif('identity_birthdate', 'Date de naissance *')}</label>
            <input type="date" value={kycForm.birthDate} onChange={(e) => handleFieldChange('birthDate', e.target.value)}
              max={new Date(new Date().setFullYear(new Date().getFullYear() - 18)).toISOString().split('T')[0]}
              className={`w-full px-4 py-3 bg-white border-2 rounded-xl focus:ring-4 outline-none transition-all font-medium ${fieldErrors.birthDate ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/10' : 'border-slate-200 focus:border-primary-500 focus:ring-primary-500/10'}`} />
            {fieldErrors.birthDate && <p className="text-[10px] text-rose-500 font-bold mt-1 flex items-center gap-1"><AlertTriangle size={10} />{fieldErrors.birthDate}</p>}
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">{tVerif('identity_city', 'Ville *')}</label>
            <input type="text" value={kycForm.city} onChange={(e) => handleFieldChange('city', e.target.value)}
              className={`w-full px-4 py-3 bg-white border-2 rounded-xl focus:ring-4 outline-none transition-all font-medium ${fieldErrors.city ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/10' : 'border-slate-200 focus:border-primary-500 focus:ring-primary-500/10'}`}
              placeholder={tVerif('identity_city_placeholder', 'Casablanca')} />
            {fieldErrors.city && <p className="text-[10px] text-rose-500 font-bold mt-1 flex items-center gap-1"><AlertTriangle size={10} />{fieldErrors.city}</p>}
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">{tVerif('identity_address', 'Adresse *')}</label>
            <input type="text" value={kycForm.address} onChange={(e) => handleFieldChange('address', e.target.value)}
              className={`w-full px-4 py-3 bg-white border-2 rounded-xl focus:ring-4 outline-none transition-all font-medium ${fieldErrors.address ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/10' : 'border-slate-200 focus:border-primary-500 focus:ring-primary-500/10'}`}
              placeholder={tVerif('identity_address_placeholder', 'Rue...')} />
            {fieldErrors.address && <p className="text-[10px] text-rose-500 font-bold mt-1 flex items-center gap-1"><AlertTriangle size={10} />{fieldErrors.address}</p>}
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
        {tVerif('identity_btn_submit', 'Soumettre pour vérification')}
      </button>
    </div>
  );
}


// ─── Bank Payment Method Form ──────────────────────────────────────
function BankPaymentForm({ onComplete }: { onComplete: () => void }) {
  const { user, refreshUser } = useAuth();
  const { t } = useLanguage();
  const tVerif = (key: string, fallback?: string) => t(key, 'verification', fallback);

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
    if (!formData.bankName) return toast.error(tVerif('bank_toast_bank_req', 'Le nom de la banque est requis'));
    if (!formData.ribAccount) return toast.error(tVerif('bank_toast_rib_req', 'Le RIB est requis'));
    if (formData.ribAccount.length !== 24)
      return toast.error(tVerif('bank_toast_rib_length', 'Le RIB doit contenir 24 chiffres'));
    
    setBankOtpStep('sending');
    setLoading(true);
    try {
      const res = await authApi.sendBankOtp(formData);
      const maskedEmail = res.data?.data?.maskedEmail || res.data?.maskedEmail || '***';
      setBankOtpMaskedEmail(maskedEmail);
      setBankOtpValue('');
      setBankOtpStep('verify');
      toast.success(tVerif('email_toast_sent', 'Code de vérification envoyé !'));
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err.message || tVerif('bank_toast_error_send', 'Erreur lors de l\'envoi du code'));
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
      toast.success(tVerif('bank_toast_success', 'Compte bancaire ajouté avec succès !'));
      await refreshUser();
      setFormData({ bankName: '', ribAccount: '', iceNumber: '' });
      setBankOtpStep('idle');
      setBankOtpValue('');
      onComplete();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || tVerif('bank_toast_invalid_otp', 'Code incorrect ou expiré'));
    } finally {
      setLoading(false);
    }
  };

  const anyBankRejected = user?.bankAccounts?.some((ba: any) => ba.status === 'REJECTED');

  const getBankStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED': return { icon: CheckCircle2, label: tVerif('status_completed', 'Approuvé'), color: 'text-emerald-600 bg-emerald-50 border-emerald-100' };
      case 'REJECTED': return { icon: AlertTriangle, label: tVerif('status_rejected', 'Rejeté'), color: 'text-rose-600 bg-rose-50 border-rose-100' };
      default: return { icon: Clock, label: tVerif('status_pending', 'En attente'), color: 'text-amber-600 bg-amber-50 border-amber-100' };
    }
  };

  return (
    <div className="space-y-6">
      {/* Existing Accounts List */}
      {user?.bankAccounts && user.bankAccounts.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <Landmark size={16} className="text-primary-500" />
            {tVerif('bank_methods_title', 'Vos méthodes de paiement')}
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
            <p className="font-bold">{tVerif('bank_rejected', 'Coordonnées bancaires rejetées')}</p>
            <p className="text-xs mt-1 opacity-80 text-rose-600 font-medium">{tVerif('bank_rejected_desc', 'Veuillez vérifier vos informations (RIB à 24 chiffres) et soumettre à nouveau.')}</p>
          </div>
        </div>
      )}

      {/* Add New Bank Account Section */}
      <div className="pt-6 border-t border-slate-100 space-y-4">
        <div>
          <h4 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <Plus size={16} className="text-primary-500" /> {tVerif('bank_add_title', 'Ajouter un nouveau compte')}
          </h4>
          <p className="text-xs text-slate-400 font-medium mt-1">
            {tVerif('bank_add_desc', 'Toutes les nouvelles méthodes sont soumises à une vérification manuelle.')}
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
              {tVerif('bank_rib_label', 'RIB Bancaire (24 chiffres)')}
            </label>
            <input
              type="text"
              maxLength={24}
              placeholder={tVerif('bank_rib_placeholder', 'RIB à 24 chiffres')}
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
              {tVerif('bank_btn_send_code', 'Envoyer le code de vérification')}
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
              <h4 className="text-base font-black text-slate-800">{tVerif('bank_otp_title', 'Vérification par Email')}</h4>
              <p className="text-xs text-slate-400 font-medium mt-1">
                {tVerif('bank_otp_desc', 'Un code à 6 chiffres a été envoyé à {email}').replace('{email}', bankOtpMaskedEmail)}
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
              ⏱ {tVerif('bank_otp_expire', 'Le code expire dans 10 minutes')}
            </p>

            <div className="flex gap-3 justify-center">
              <button
                type="button"
                onClick={() => { setBankOtpStep('idle'); setBankOtpValue(''); }}
                className="px-5 py-2.5 bg-white border border-slate-200 text-slate-500 rounded-xl font-bold text-xs hover:bg-slate-50 transition-all"
              >
                {tVerif('bank_btn_cancel', 'Annuler')}
              </button>
              <button
                type="button"
                onClick={handleBankOtpVerify}
                disabled={bankOtpValue.length !== 6 || loading}
                className="px-6 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-bold shadow-lg shadow-primary-600/20 transition-all flex items-center gap-2 disabled:opacity-50 text-xs"
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                {tVerif('bank_btn_confirm', 'Confirmer et Ajouter')}
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
  const { t, language } = useLanguage();
  const tVerif = (key: string, fallback?: string) => t(key, 'verification', fallback);

  const [loading, setLoading] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(true);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const res = await api.get('/auth/contract-status');
        if (res.data?.data?.signed) {
          onComplete();
        }
      } catch (err) {
        console.error('Error checking contract status:', err);
      }
    };
    checkStatus();
  }, []);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;

    const fetchPdf = async () => {
      setPdfLoading(true);
      setPdfError(null);
      try {
        const response = await api.get('/auth/contract-preview', {
          responseType: 'blob'
        });
        
        if (!active) return;
        
        const blob = new Blob([response.data], { type: 'application/pdf' });
        objectUrl = URL.createObjectURL(blob);
        setPdfUrl(objectUrl);
      } catch (err: any) {
        if (!active) return;
        console.error('Failed to load contract PDF:', err);
        
        if (err.response?.data instanceof Blob) {
          try {
            const text = await err.response.data.text();
            const parsed = JSON.parse(text);
            setPdfError(parsed.message || parsed.error || 'Failed to load PDF');
          } catch {
            setPdfError('Failed to load PDF');
          }
        } else {
          setPdfError(err.response?.data?.message || err.message || 'Failed to load PDF');
        }
      } finally {
        if (active) {
          setPdfLoading(false);
        }
      }
    };

    fetchPdf();

    return () => {
      active = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [user]);

  const handleSign = async () => {
    if (!accepted) return toast.error(tVerif('contract_toast_accept', 'Veuillez accepter les termes du contrat'));
    setLoading(true);
    try {
      const res = await api.post('/auth/sign-contract');
      if (res.data?.data?.signed) {
        toast.success(tVerif('contract_toast_success', 'Contrat signé avec succès !'));
        await refreshUser();
        onComplete();
      } else {
        toast.error(tVerif('contract_toast_fail_link', 'Impossible de valider la signature.'));
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || tVerif('contract_toast_error', 'Erreur lors de la préparation du contrat'));
    } finally {
      setLoading(false);
    }
  };

  const getContractPreviewUrl = () => {
    if (BACKEND_URL.includes('localhost:3001')) {
      return `/api/v1/auth/contract-preview?token=${localStorage.getItem('accessToken')}`;
    }
    return `${BACKEND_URL}/api/v1/auth/contract-preview?token=${localStorage.getItem('accessToken')}`;
  };

  const handleDownload = async () => {
    if (pdfUrl) {
      const link = document.createElement('a');
      link.href = pdfUrl;
      link.download = 'contrat.fin.silacod.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      window.open(getContractPreviewUrl(), '_blank');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 bg-slate-50/50 p-5 rounded-2xl border border-slate-100">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h4 className="text-sm font-black text-slate-800 uppercase tracking-wider">{tVerif('contract_preview_title', 'Aperçu de votre contrat')}</h4>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">{tVerif('contract_preview_desc', 'Le contrat sera personnalisé avec vos informations (Nom, CIN, Adresse, RIB)')}</p>
          </div>
          <button
            onClick={handleDownload}
            disabled={pdfLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:border-slate-300 disabled:opacity-50 text-slate-700 rounded-xl font-bold text-xs transition-all shadow-sm group"
          >
            <FileText size={14} className="text-primary-500 group-hover:scale-110 transition-transform" />
            {tVerif('contract_btn_download', 'Télécharger le contrat PDF')}
          </button>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-inner min-h-[500px] flex flex-col justify-center items-center relative">
          {pdfLoading ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-10 h-10 text-primary-600 animate-spin" />
              <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">{tVerif('pdf_loading', 'Chargement du contrat...')}</p>
            </div>
          ) : pdfError ? (
            <div className="flex flex-col items-center max-w-md p-6 text-center gap-3">
              <AlertTriangle className="w-12 h-12 text-red-500" />
              <h5 className="text-sm font-black text-red-800 uppercase tracking-wider">{tVerif('pdf_error_title', 'Erreur de génération du PDF')}</h5>
              <p className="text-xs text-slate-500 font-medium leading-relaxed">
                {pdfError.includes('Missing required details') || pdfError.includes('bank') || pdfError.includes('profile')
                  ? tVerif('pdf_error_missing_info', 'Veuillez remplir vos informations de profil (Nom, CIN, Adresse, Banque, RIB) dans les étapes précédentes pour générer le contrat.')
                  : pdfError}
              </p>
            </div>
          ) : (
            <iframe
              src={pdfUrl || undefined}
              className="w-full border-0"
              style={{ height: '500px' }}
              title="Contract Preview"
            />
          )}
        </div>
      </div>

      <div className="flex items-start gap-3 p-4 bg-primary-50 border border-primary-100 rounded-xl">
        <input 
          type="checkbox" 
          id="accept-contract"
          checked={accepted}
          onChange={(e) => setAccepted(e.target.checked)}
          className="mt-1 w-5 h-5 rounded border-primary-300 text-primary-600 focus:ring-primary-500"
        />
        <label htmlFor="accept-contract" className="text-sm font-bold text-primary-900 cursor-pointer">
          {tVerif('contract_accept_label', 'أقر بأنني قرأت ووافقت على جميع شروط العقد المذكورة أعلاه.')}
        </label>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 text-xs text-slate-400 font-medium px-1">
          <Shield size={14} className="text-slate-300" />
          {tVerif('contract_secure_sig', 'Approbation et validation sécurisée du contrat')}
        </div>
        <button
          onClick={handleSign}
          disabled={loading || !accepted}
          className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-slate-900 hover:bg-slate-800 text-white font-black rounded-2xl shadow-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed group"
        >
          {loading ? <Loader2 size={20} className="animate-spin" /> : <FileText size={20} className="group-hover:scale-110 transition-transform" />}
          {tVerif('contract_btn_sign', 'Valider la signature du contrat')}
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
  const { t, language } = useLanguage();
  const tVerif = (key: string, fallback?: string) => t(key, 'verification', fallback);

  const handleStepComplete = async () => {
    await refreshUser();
    setExpandedStep(null);
  };

  const stepConfigs = [
    {
      id: 1,
      key: 'subdomain' as const,
      title: tVerif('subdomain_title', 'Custom Subdomain'),
      description: tVerif('subdomain_desc', 'Set your personalized subdomain name to host your landing pages and product offers'),
      icon: Sparkles,
      gradient: 'from-indigo-500 to-purple-500',
      form: <SubdomainConfigurationForm onComplete={handleStepComplete} />,
    },
    {
      id: 2,
      key: 'email' as const,
      title: tVerif('email_title', 'Vérification Email'),
      description: tVerif('email_desc', 'Confirmez votre adresse email : {email}').replace('{email}', user?.email || ''),
      icon: Mail,
      gradient: 'from-blue-500 to-cyan-500',
      form: <EmailVerificationForm onComplete={handleStepComplete} />,
    },
    {
      id: 3,
      key: 'identity' as const,
      title: tVerif('identity_title', "Vérification d'Identité"),
      description: tVerif('identity_desc', 'Vérifiez votre identité en fournissant les documents requis (CIN ou Passeport)'),
      icon: Shield,
      gradient: 'from-violet-500 to-purple-500',
      form: <IdentityVerificationForm onComplete={handleStepComplete} />,
    },
    {
      id: 4,
      key: 'bank' as const,
      title: tVerif('bank_title', 'Méthode de Paiement Bancaire'),
      description: tVerif('bank_desc', 'Ajoutez au moins une méthode de paiement bancaire (RIB)'),
      icon: CreditCard,
      gradient: 'from-amber-500 to-orange-500',
      form: <BankPaymentForm onComplete={handleStepComplete} />,
    },
    {
      id: 5,
      key: 'contract' as const,
      title: tVerif('contract_title', 'Contrat & Engagement'),
      description: tVerif('contract_desc', 'Prenez connaissance de nos conditions et signez votre contrat'),
      icon: FileText,
      gradient: 'from-slate-700 to-slate-900',
      form: <ContractSigningForm onComplete={handleStepComplete} />,
    },
  ];

  const getStatusBadge = (status: StepStatus) => {
    const configs = {
      COMPLETED: { icon: CheckCircle2, label: tVerif('status_completed', 'Terminé'), bg: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
      IN_PROGRESS: { icon: Loader2, label: tVerif('status_in_progress', 'En cours de vérification'), bg: 'bg-blue-50 text-blue-600 border-blue-100' },
      PENDING: { icon: Clock, label: tVerif('status_pending', 'En attente'), bg: 'bg-amber-50 text-amber-600 border-amber-100' },
      REJECTED: { icon: AlertTriangle, label: tVerif('status_rejected', 'Rejeté'), bg: 'bg-rose-50 text-rose-600 border-rose-100' },
      LOCKED: { icon: Lock, label: tVerif('status_locked', 'Verrouillé'), bg: 'bg-slate-50 text-slate-400 border-slate-100' },
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
    <div className="max-w-4xl mx-auto py-4 sm:py-8 font-['29LT_Kaff',_Cairo,_Inter,_sans-serif]" dir={language === 'ar' ? 'rtl' : 'ltr'}>

      {/* ── Header ── */}
      {!hideHeader && (
        <div className="text-center mb-8 sm:mb-10 space-y-4">
          <div className="inline-flex items-center justify-center p-4 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-xl shadow-purple-500/20 mb-2 transform hover:scale-105 transition-transform">
            <Sparkles size={32} className="text-white" />
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">
            🚀 {tVerif('header_title', 'Prêt à débloquer votre potentiel ?')}
          </h1>
          <p className="text-sm sm:text-lg text-slate-500 font-medium max-w-2xl mx-auto leading-relaxed">
            {tVerif('header_subtitle', 'Complétez ces étapes de vérification pour accéder à toutes les fonctionnalités de la plateforme')}
          </p>

          {percentage < 100 && (
            <div className="inline-flex items-center gap-2 px-4 py-2.5 bg-rose-50 text-rose-600 font-bold rounded-xl text-sm border border-rose-100/50 shadow-sm">
              <AlertTriangle size={16} />
              {tVerif('header_warning', "Vous ne pourrez pas effectuer d'actions importantes tant que votre profil n'est pas vérifié")}
            </div>
          )}
        </div>
      )}

      {/* ── Progress Card ── */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-xl shadow-slate-200/40 border border-slate-100 mb-6 sm:mb-8 relative overflow-hidden">
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary-100 rounded-full blur-[60px] opacity-60 pointer-events-none" />
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4 relative z-10">
          <div>
            <h3 className="text-base sm:text-lg font-black text-slate-800 tracking-tight">{tVerif('progress_title', 'Progression de votre profil')}</h3>
            <p className="text-xs sm:text-sm font-medium text-slate-400 mt-0.5">
              {tVerif('progress_step', '{completed}/{total} étapes complétées').replace('{completed}', String(completed)).replace('{total}', String(total))}
              {percentage < 100 ? tVerif('progress_desc_pending', ' • Complétez les étapes restantes') : tVerif('progress_desc_verified', ' • Profil vérifié ✓')}
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
                className={`w-full p-5 sm:p-6 flex flex-col sm:flex-row gap-4 sm:gap-5 items-start sm:items-center text-left rtl:text-right ${canExpand ? 'cursor-pointer' : 'cursor-default'}`}
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
                        <span className="text-xs font-bold">{status === 'REJECTED' ? tVerif('step_retry', 'Réessayer') : tVerif('step_complete', 'Compléter')}</span>
                        <ArrowRight size={16} className="rtl:rotate-180" />
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
                      <p className="font-bold">{tVerif('step_in_progress_title', 'Documents en cours de vérification')}</p>
                      <p className="text-xs text-blue-500 mt-1">{tVerif('step_in_progress_desc', 'Notre équipe examine vos documents. Vous serez notifié dès la validation (généralement sous 24-48h).')}</p>
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
            🎉 {tVerif('profile_verified_success_title', 'Profil entièrement vérifié !')}
          </h3>
          <p className="text-slate-500 font-medium">
            {tVerif('profile_verified_success_desc', 'Vous avez maintenant accès à toutes les fonctionnalités de la plateforme.')}
          </p>
        </div>
      )}
    </div>
  );
}
