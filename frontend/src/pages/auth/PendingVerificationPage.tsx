import { Link } from 'react-router-dom';
import { Clock, ShieldCheck, Mail, Sparkles, CheckCircle2, UserCheck } from 'lucide-react';

export default function PendingVerificationPage() {
  return (
    <div className="min-h-screen relative flex items-center justify-center bg-[#F8FAFC] p-4 overflow-hidden font-['Inter'] bg-noise">
      {/* Dynamic Mesh Background Glows */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-amber-400/8 rounded-full blur-[120px] animate-mesh-light" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[70%] h-[70%] bg-primary-400/8 rounded-full blur-[150px] animate-mesh-light [animation-delay:3s]" />
      </div>

      {/* Floating decorative icons */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
        <div className="absolute top-[15%] left-[10%] animate-float [animation-delay:0s] text-amber-300">
          <Clock size={64} strokeWidth={1} />
        </div>
        <div className="absolute bottom-[20%] right-[10%] animate-float [animation-delay:2s] text-primary-300">
          <ShieldCheck size={70} strokeWidth={1} />
        </div>
        <div className="absolute top-[25%] right-[15%] animate-float [animation-delay:4s] text-emerald-300">
          <Sparkles size={50} strokeWidth={1} />
        </div>
      </div>

      <div className="relative z-10 w-full max-w-lg animate-in fade-in slide-in-from-bottom-2 duration-1000">
        {/* Branding */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex flex-col items-center gap-4 group">
            <div className="w-16 h-16 bg-white rounded-full shadow-xl shadow-slate-200/50 flex items-center justify-center group-hover:scale-110 transition-transform duration-500 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-tr from-primary-500/10 to-transparent animate-pulse" />
              <img src="/new logo/logo filess-25.svg" alt="SILACOD" className="w-10 h-10 relative z-10 object-contain" />
            </div>
            <img src="/new logo/logo filess-24.svg" alt="SILACOD" className="h-7 object-contain" />
          </Link>
        </div>

        {/* Main Card */}
        <div className="bg-white/90 backdrop-blur-xl border border-white/50 rounded-[2.5rem] p-8 sm:p-10 shadow-2xl relative overflow-hidden">
          {/* Top gradient bar */}
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500" />

          {/* Animated Icon */}
          <div className="relative w-24 h-24 mx-auto mb-8">
            <div className="absolute inset-0 bg-amber-100 rounded-full animate-ping opacity-20" />
            <div className="absolute inset-[-4px] bg-gradient-to-br from-amber-200/30 to-orange-200/30 rounded-full animate-pulse" />
            <div className="relative w-24 h-24 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center shadow-xl shadow-amber-500/25">
              <Clock className="w-12 h-12 text-white" />
            </div>
          </div>

          <div className="text-center mb-8">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-amber-600 to-orange-600 mb-3">
              En Attente d'Approbation
            </h1>
            <p className="text-slate-500 text-sm font-medium leading-relaxed max-w-sm mx-auto">
              Votre compte a été créé avec succès ! Notre équipe examine votre demande et vous recevrez une notification dès que votre accès sera activé.
            </p>
          </div>

          {/* Steps Timeline */}
          <div className="bg-slate-50/80 rounded-2xl p-6 mb-8 space-y-0">
            {/* Step 1 - Completed */}
            <div className="flex items-start gap-4 relative">
              <div className="flex flex-col items-center">
                <div className="w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center flex-shrink-0 shadow-lg shadow-emerald-500/20 z-10">
                  <CheckCircle2 className="w-5 h-5 text-white" />
                </div>
                <div className="w-0.5 h-6 bg-emerald-300 mt-1" />
              </div>
              <div className="pb-6">
                <p className="text-sm font-bold text-slate-900">Inscription Terminée</p>
                <p className="text-xs text-slate-500 mt-0.5">Vos informations ont été enregistrées avec succès.</p>
              </div>
            </div>

            {/* Step 2 - In Progress */}
            <div className="flex items-start gap-4 relative">
              <div className="flex flex-col items-center">
                <div className="w-10 h-10 bg-amber-500 rounded-full flex items-center justify-center flex-shrink-0 shadow-lg shadow-amber-500/20 z-10 animate-pulse">
                  <UserCheck className="w-5 h-5 text-white" />
                </div>
                <div className="w-0.5 h-6 bg-slate-200 mt-1" />
              </div>
              <div className="pb-6">
                <p className="text-sm font-bold text-slate-900">Vérification en Cours</p>
                <p className="text-xs text-slate-500 mt-0.5">Un administrateur examine votre dossier d'inscription.</p>
              </div>
            </div>

            {/* Step 3 - Pending */}
            <div className="flex items-start gap-4 relative">
              <div className="flex flex-col items-center">
                <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center flex-shrink-0 z-10">
                  <Mail className="w-5 h-5 text-slate-400" />
                </div>
              </div>
              <div>
                <p className="text-sm font-bold text-slate-400">Notification d'Activation</p>
                <p className="text-xs text-slate-400 mt-0.5">Vous serez notifié dès que votre compte sera activé.</p>
              </div>
            </div>
          </div>

          {/* Info Banner */}
          <div className="bg-amber-50 border border-amber-100/60 rounded-2xl px-5 py-4 mb-8 flex items-start gap-3">
            <div className="bg-amber-400/20 text-amber-600 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <Sparkles className="w-4 h-4" />
            </div>
            <p className="text-xs text-amber-800 font-medium leading-relaxed">
              Le délai d'approbation est généralement de <strong>24 à 48 heures</strong>. Vous recevrez un email ou une notification WhatsApp dès l'activation.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <Link 
              to="/login" 
              className="w-full flex items-center justify-center gap-2 bg-slate-900 text-white font-bold py-4 rounded-full shadow-lg shadow-slate-900/10 hover:bg-primary-600 transition-all hover:scale-[1.02] active:scale-[0.98] hover:shadow-primary-600/20"
            >
              Retour à la Connexion
            </Link>
            <Link 
              to="/" 
              className="w-full flex items-center justify-center gap-2 bg-slate-50 text-slate-600 font-bold py-3.5 rounded-full hover:bg-slate-100 transition-all active:scale-[0.98] text-sm"
            >
              Retour à l'Accueil
            </Link>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center mt-6 text-sm text-slate-400 font-medium">
          Besoin d'aide ?{' '}
          <a href="mailto:support@silacod.com" className="text-primary-600 hover:text-primary-700 font-bold hover:underline underline-offset-4 decoration-2">
            support@silacod.com
          </a>
        </p>
      </div>
    </div>
  );
}
