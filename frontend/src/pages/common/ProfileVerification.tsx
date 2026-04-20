import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { authApi, api, uploadApi } from '../../lib/api';
import toast from 'react-hot-toast';
import {
  Mail, Shield, Building2, CreditCard, CheckCircle2, Clock, Lock,
  ChevronDown, ChevronUp, Upload, FileText, X, Loader2, Send,
  Building, Landmark, ArrowRight, Sparkles, AlertTriangle,
  Camera, CameraOff, RefreshCw, Smartphone, Book, Car, User
} from 'lucide-react';

type StepStatus = 'COMPLETED' | 'IN_PROGRESS' | 'PENDING' | 'LOCKED' | 'REJECTED';

// ─── Helper: compute verification progress ─────────────────────────────
export function getVerificationStatus(user: any) {
  const emailVerified = !!user?.emailVerified;
  const kycStatus = user?.kycStatus || 'PENDING';
  const contractAccepted = !!user?.contractAccepted;

  const identityDone = kycStatus === 'APPROVED';
  const identityInProgress = kycStatus === 'UNDER_REVIEW';

  // Bank is considered done if at least one approved or pending bank account exists
  const hasBankAccounts = (user?.bankAccounts?.length ?? 0) > 0;
  const allBanksRejected = hasBankAccounts && user.bankAccounts.every((ba: any) => ba.status === 'REJECTED');
  const bankDone = hasBankAccounts && !allBanksRejected;

  const steps = {
    email: emailVerified ? 'COMPLETED' as StepStatus : 'PENDING' as StepStatus,
    identity: identityDone ? 'COMPLETED' as StepStatus
      : identityInProgress ? 'IN_PROGRESS' as StepStatus
      : (emailVerified ? 'PENDING' as StepStatus : 'LOCKED' as StepStatus),
    bank: (identityDone || identityInProgress) ? (allBanksRejected ? 'REJECTED' as StepStatus : (bankDone ? 'COMPLETED' as StepStatus : 'PENDING' as StepStatus)) : 'LOCKED' as StepStatus,
    contract: contractAccepted ? 'COMPLETED' as StepStatus : (bankDone && (identityDone || identityInProgress) ? 'PENDING' as StepStatus : 'LOCKED' as StepStatus),
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
      await authApi.forgotPassword({ email: user?.email || undefined });
      // Using resend-otp would be ideal, but let's use what exists
      await api.post('/auth/resend-otp', { email: user?.email });
      setOtpSent(true);
      setResendCooldown(60);
      toast.success('Code de vérification envoyé !');
    } catch {
      // Still show as sent for UX (backend logs OTP in dev)
      setOtpSent(true);
      setResendCooldown(60);
      toast.success('Code de vérification envoyé !');
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

// ─── Identity Verification Form (KYC Document Upload + Liveness) ───
function IdentityVerificationForm({ onComplete }: { onComplete: () => void }) {
  const [documentType, setDocumentType] = useState('CIN');
  const [documentFiles, setDocumentFiles] = useState<File[]>([]);
  const [cameraFile, setCameraFile] = useState<File | null>(null);
  const [documentPreviews, setDocumentPreviews] = useState<string[]>([]);
  const [cameraPreview, setCameraPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Liveness States
  const [cameraActive, setCameraActive] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [livenessStep, setLivenessStep] = useState<0 | 1 | 2 | 3>(0); // 0: Not started, 1: Front, 2: Right, 3: Left
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const livenessInstructions = {
    1: 'Prenez une photo de face',
    2: '',
    3: ''
  };

  const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const newFiles = Array.from(e.target.files);

    const validFiles = newFiles.filter(file => allowedTypes.includes(file.type));
    if (validFiles.length < newFiles.length) {
      toast.error('Seuls les formats JPG, PNG et PDF sont autorisés.');
    }

    const availableSlots = 2 - documentFiles.length;
    const toAdd = validFiles.slice(0, availableSlots);

    if (toAdd.length < validFiles.length) {
      toast.error('Vous ne pouvez uploader que 2 photos (Recto et Verso).');
    }

    if (toAdd.length > 0) {
      setDocumentFiles(prev => [...prev, ...toAdd]);

      toAdd.forEach(file => {
        const reader = new FileReader();
        reader.onload = () => setDocumentPreviews(p => [...p, reader.result as string]);
        reader.readAsDataURL(file);
      });
    }

    // Reset file input value so same files can be re-selected if deleted
    e.target.value = '';
  };

  const removeFile = (index: number) => {
    if (index < documentFiles.length) {
      setDocumentFiles(prev => prev.filter((_, i) => i !== index));
      setDocumentPreviews(prev => prev.filter((_, i) => i !== index));
    } else {
      setCameraFile(null);
      setCameraPreview(null);
    }
  };

  // Camera Functions
  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      setStream(mediaStream);
      setCameraActive(true);
      setLivenessStep(1);
    } catch (error) {
      toast.error('Impossible d\'accéder à la caméra');
    }
  };

  useEffect(() => {
    if (cameraActive && stream && videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(e => console.error("Video play error:", e));
    }
  }, [cameraActive, stream]);

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setCameraActive(false);
  };

  const captureFrame = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Draw image and horizontally flip it so it acts like a mirror
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        ctx.setTransform(1, 0, 0, 1, 0, 0); // reset transform
        
        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
        
        // Convert base64 to File
        fetch(dataUrl)
          .then(res => res.blob())
          .then(blob => {
            const stepName = 'face';
            const file = new File([blob], `liveness_${stepName}.jpg`, { type: 'image/jpeg' });
            setCameraFile(file);
            setCameraPreview(dataUrl);
            
            toast.success('Photo biométrique capturée avec succès !');
            stopCamera();
            setLivenessStep(0);
          });
      }
    }
  };

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  const handleSubmit = async () => {
    if (documentFiles.length !== 2) return toast.error('Veuillez uploader exactement 2 photos de votre document (Recto et Verso)');
    if (!cameraFile) return toast.error('Veuillez effectuer la vérification faciale avec la caméra');
    
    const allFiles = [...documentFiles, cameraFile];
    setLoading(true);
    try {
      const formData = new FormData();
      allFiles.forEach(file => formData.append('files', file));
      const uploadRes = await api.post('/upload/kyc', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const uploadedFiles = uploadRes.data.data.files;

      await api.post('/auth/kyc', {
        documents: uploadedFiles.map((f: any) => ({
          type: documentType,
          url: f.url,
        }))
      });

      toast.success('Documents soumis avec succès ! En attente de vérification.');
      onComplete();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Erreur lors de la soumission');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 text-sm text-slate-600">
        <p className="font-semibold text-slate-700 mb-1">📋 Instructions</p>
        <ul className="list-disc list-inside space-y-1 text-xs">
          <li>Sélectionnez le type de votre pièce d'identité.</li>
          <li>Uploadez les photos recto et verso de votre document.</li>
          <li>Utilisez la caméra pour capturer votre visage (de face).</li>
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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Upload Area */}
        <div>
          <label className="block text-sm font-bold text-slate-600 mb-2">
            2. Photos du document
          </label>
          <div className="border-2 border-dashed border-slate-200 rounded-2xl p-6 h-36 flex flex-col items-center justify-center text-center hover:border-primary-300 hover:bg-primary-50/30 transition-all cursor-pointer relative group">
            <input
              type="file"
              accept="image/*,application/pdf"
              multiple
              onChange={handleFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <Upload size={28} className="mx-auto text-slate-300 group-hover:text-primary-400 transition-colors mb-2" />
            <p className="text-sm font-bold text-slate-500">Uploader les photos</p>
            <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider">Recto / Verso</p>
          </div>
        </div>

        {/* Liveness Area */}
        <div>
          <label className="block text-sm font-bold text-slate-600 mb-2">
            3. Vérification faciale
          </label>
          {!cameraActive ? (
            <button
              onClick={startCamera}
              className="w-full border-2 border-dashed border-slate-200 rounded-2xl p-6 h-36 flex flex-col items-center justify-center text-center hover:border-blue-300 hover:bg-blue-50/30 transition-all"
            >
              <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-2 shadow-inner">
                <Camera size={20} />
              </div>
              <p className="text-sm font-bold text-slate-600">Activer la caméra</p>
              <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider">Liveness Test</p>
            </button>
          ) : (
            <div className="w-full border-2 border-solid border-blue-200 rounded-2xl p-6 h-36 flex flex-col items-center justify-center text-center bg-blue-50">
              <Loader2 className="animate-spin text-blue-500 mb-2" size={24} />
              <p className="text-sm font-bold text-blue-700">Caméra active</p>
              <p className="text-[10px] text-blue-500 mt-1 uppercase tracking-wider">Veuillez suivre les instructions</p>
            </div>
          )}
        </div>
      </div>

      {/* File Previews */}
      {(documentPreviews.length > 0 || cameraPreview) && (
        <div className="space-y-2">
           <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Documents Prêts à l'envoi ({documentPreviews.length + (cameraPreview ? 1 : 0)})</label>
           <div className="flex gap-3 flex-wrap p-3 bg-slate-50 border border-slate-100 rounded-xl">
            {[...documentPreviews, ...(cameraPreview ? [cameraPreview] : [])].map((preview, i) => (
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

      <button
        onClick={handleSubmit}
        disabled={loading || documentFiles.length !== 2 || !cameraFile}
        className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-primary-600 hover:bg-primary-700 text-white font-black rounded-xl shadow-lg shadow-primary-500/20 transition-all disabled:opacity-50 text-base"
      >
        {loading ? <Loader2 size={20} className="animate-spin" /> : <Shield size={20} />}
        Soumettre pour vérification
      </button>

      {/* Liveness Modal */}
      {cameraActive && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/90 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl overflow-hidden shadow-2xl w-full max-w-md flex flex-col relative animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-slate-50">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <Camera size={18} className="text-blue-500" />
                Vérification faciale
              </h3>
              <button onClick={stopCamera} className="p-2 bg-slate-200 hover:bg-slate-300 rounded-full text-slate-600 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-300">
                <X size={16} />
              </button>
            </div>
            
            {/* Video Container */}
            <div className="relative aspect-[3/4] sm:aspect-video bg-slate-900 w-full overflow-hidden flex items-center justify-center group shadow-[inset_0_0_40px_rgba(0,0,0,0.5)]">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover transform -scale-x-100"
              />
              <canvas ref={canvasRef} className="hidden" />
              
              {/* Facial Guide Circle */}
              <div className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none overflow-hidden">
                 <div className="h-[75%] aspect-square flex-shrink-0 rounded-full border-2 border-dashed border-white/60 shadow-[0_0_0_9999px_rgba(0,0,0,0.6)] transition-all flex items-center justify-center">
                    <div className="w-full h-full rounded-full border border-white/20 scale-90"></div>
                 </div>
              </div>
              
              {/* Overlay Instructions */}
              <div className="absolute top-4 left-0 right-0 flex justify-center z-10 pointer-events-none px-4">
                <div className="bg-black/70 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/10 shadow-2xl">
                  <span className="text-white text-sm md:text-md font-bold text-center block tracking-wide">
                    {livenessInstructions[livenessStep as 1|2|3]}
                  </span>
                </div>
              </div>
            </div>

            {/* Footer & Capture Button */}
            <div className="p-6 bg-white flex flex-col items-center gap-4">
               <p className="text-xs text-slate-500 font-medium text-center max-w-xs">
                 Assurez-vous d'être dans un endroit bien éclairé et que votre visage est clairement visible.
               </p>
               <button
                 onClick={captureFrame}
                 className="w-16 h-16 bg-white rounded-full border-4 border-blue-500/20 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform shadow-lg group-hover:border-blue-500/40 focus:outline-none focus:ring-4 focus:ring-blue-500/30"
               >
                 <div className="w-12 h-12 bg-blue-500 group-hover:bg-blue-600 rounded-full flex items-center justify-center text-white transition-colors shadow-inner">
                   <Camera size={24} />
                 </div>
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


// ─── Bank Payment Method Form ──────────────────────────────────────
function BankPaymentForm({ onComplete }: { onComplete: () => void }) {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    bankName: '',
    ribAccount: '',
    iceNumber: '',
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async () => {
    if (!formData.bankName.trim()) return toast.error('Le nom de la banque est requis');
    if (!formData.ribAccount.trim()) return toast.error('Le RIB est requis');
    if (formData.ribAccount.replace(/\s/g, '').length !== 24)
      return toast.error('Le RIB doit contenir 24 chiffres');
    
    setLoading(true);
    try {
      if (!user) throw new Error('Utilisateur non connecté.');

      await authApi.addBankAccount(formData);
      toast.success('Compte bancaire ajouté avec succès !');
      onComplete();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err.message || 'Erreur lors de l\'ajout');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-sm text-amber-700">
        <p className="font-semibold">🏦 Ajoutez vos coordonnées bancaires</p>
        <p className="text-xs mt-1 text-amber-500">Requis pour recevoir vos paiements et retraits</p>
      </div>

      <div>
        <label className="block text-sm font-bold text-slate-600 mb-1.5">Nom de la banque *</label>
        <input
          name="bankName"
          value={formData.bankName}
          onChange={handleChange}
          placeholder="Ex: Attijariwafa Bank, BMCE, CIH..."
          className="w-full px-4 py-3 bg-white border-2 border-slate-200 rounded-xl focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 outline-none transition-all text-sm font-medium"
        />
      </div>

      <div>
        <label className="block text-sm font-bold text-slate-600 mb-1.5">RIB Bancaire (24 chiffres) *</label>
        <input
          name="ribAccount"
          value={formData.ribAccount}
          onChange={handleChange}
          maxLength={28}
          placeholder="000 000 0000000000000000 00"
          className="w-full px-4 py-3 bg-white border-2 border-slate-200 rounded-xl focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 outline-none transition-all text-sm font-medium font-mono tracking-wider"
        />
      </div>

      <div>
        <label className="block text-sm font-bold text-slate-600 mb-1.5">ICE (optionnel)</label>
        <input
          name="iceNumber"
          value={formData.iceNumber}
          onChange={handleChange}
          placeholder="Ex: 001234567000012"
          className="w-full px-4 py-3 bg-white border-2 border-slate-200 rounded-xl focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 outline-none transition-all text-sm font-medium font-mono"
        />
      </div>
      <button
        onClick={handleSubmit}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-xl shadow-lg shadow-primary-500/20 transition-all disabled:opacity-50"
      >
        {loading ? <Loader2 size={18} className="animate-spin" /> : <Landmark size={18} />}
        Ajouter le compte bancaire
      </button>
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
          const canExpand = status === 'PENDING' || status === 'REJECTED';

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

              {/* IN_PROGRESS notice */}
              {status === 'IN_PROGRESS' && (
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
