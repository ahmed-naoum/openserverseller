import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Phone, MapPin, Send, Loader2, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { publicApi } from '../lib/api';
import { useLanguage } from '../contexts/LanguageContext';
import { Seo } from '../components/Seo';
import { FooterMeta } from '../components/common/FooterMeta';
import LanguageSwitcherWidget from '../components/common/LanguageSwitcherWidget';

const translations = {
  ar: {
    login: "تسجيل الدخول",
    backToHome: "العودة إلى الرئيسية",
    title: "اتصل بنا",
    subtitle: "تواصل معنا — نحن في خدمتكم على مدار الساعة 24/7",
    infoCardTitle: "معلومات الاتصال",
    infoCardDesc: "هل لديك سؤال أو استفسار؟ لا تتردد في الاتصال بنا عبر أي من القنوات المتاحة، وسيقوم فريقنا بالرد عليك في أقرب وقت ممكن.",
    emailLabel: "البريد الإلكتروني",
    phoneLabel: "الهاتف / واتساب",
    locationLabel: "الموقع",
    locationValue: " المغرب - أكادير (Agadir, Maroc)",
    formNameLabel: "الاسم الكامل",
    formNamePlaceholder: "الاسم الكامل",
    formEmailLabel: "البريد الإلكتروني",
    formEmailPlaceholder: "vous@exemple.com",
    formSubjectLabel: "الموضوع",
    formSubjectPlaceholder: "موضوع رسالتك",
    formMessageLabel: "الرسالة",
    formMessagePlaceholder: "اكتب رسالتك هنا...",
    btnSending: "جاري الإرسال...",
    btnSend: "إرسال الرسالة",
    successToast: "تم إرسال رسالتك بنجاح! سيرد عليك فريقنا قريباً.",
    errorToastDefault: "حدث خطأ أثناء إرسال الرسالة.",
    termsOfUse: "شروط الاستخدام",
    privacyPolicy: "سياسة الخصوصية",
    footerText: "© 2026 SILACOD. جميع الحقوق محفوظة."
  },
  fr: {
    login: "Connexion",
    backToHome: "Retour à l'accueil",
    title: "Contactez-nous",
    subtitle: "Contactez-nous — Nous sommes à votre écoute 24/7",
    infoCardTitle: "Informations de contact",
    infoCardDesc: "Vous avez une question ou une demande ? N'hésitez pas à nous contacter via l'un des canaux disponibles, et notre équipe vous répondra dans les plus brefs délais.",
    emailLabel: "E-mail",
    phoneLabel: "Téléphone / WhatsApp",
    locationLabel: "Localisation",
    locationValue: "Agadir, Maroc",
    formNameLabel: "Nom Complet",
    formNamePlaceholder: "Votre nom complet",
    formEmailLabel: "E-mail",
    formEmailPlaceholder: "vous@exemple.com",
    formSubjectLabel: "Sujet",
    formSubjectPlaceholder: "Sujet de votre message",
    formMessageLabel: "Message",
    formMessagePlaceholder: "Votre message ici...",
    btnSending: "Envoi en cours...",
    btnSend: "Envoyer le message",
    successToast: "Votre message a été envoyé avec succès ! Notre équipe vous répondra bientôt.",
    errorToastDefault: "Une erreur est survenue lors de l'envoi du message.",
    termsOfUse: "Conditions d'utilisation",
    privacyPolicy: "Politique de confidentialité",
    footerText: "© 2026 SILACOD. Tous droits réservés."
  },
  en: {
    login: "Login",
    backToHome: "Back to Home",
    title: "Contact Us",
    subtitle: "Contact Us — We are here for you 24/7",
    infoCardTitle: "Contact Information",
    infoCardDesc: "Have a question or inquiry? Feel free to contact us through any of the available channels, and our team will get back to you as soon as possible.",
    emailLabel: "Email",
    phoneLabel: "Phone / WhatsApp",
    locationLabel: "Location",
    locationValue: "Casablanca, Morocco",
    formNameLabel: "Full Name",
    formNamePlaceholder: "Your full name",
    formEmailLabel: "Email",
    formEmailPlaceholder: "you@example.com",
    formSubjectLabel: "Subject",
    formSubjectPlaceholder: "Subject of your message",
    formMessageLabel: "Message",
    formMessagePlaceholder: "Write your message here...",
    btnSending: "Sending...",
    btnSend: "Send Message",
    successToast: "Your message has been sent successfully! Our team will reply soon.",
    errorToastDefault: "An error occurred while sending the message.",
    termsOfUse: "Terms of Use",
    privacyPolicy: "Privacy Policy",
    footerText: "© 2026 SILACOD. All rights reserved."
  }
};

export default function ContactPage() {
  const { language } = useLanguage();
  const t = translations[language as keyof typeof translations] || translations.en;
  const isRtl = language === 'ar';
  const textAlign = isRtl ? 'text-right' : 'text-left';
  const flexAlign = isRtl ? 'flex-row-reverse' : 'flex-row';

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      await publicApi.submitContact(formData);
      toast.success(t.successToast);
      setFormData({
        name: '',
        email: '',
        subject: '',
        message: ''
      });
    } catch (err: any) {
      const errMsg = err?.response?.data?.message || t.errorToastDefault;
      toast.error(errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-['29LT_Kaff',_Cairo,_Inter,_sans-serif] text-slate-700 relative overflow-x-hidden selection:bg-[#ff5722]/10 selection:text-[#ff5722]">
      <Seo page="contact" />
      {/* Decorative background glows */}
      <div className="absolute top-[-10%] right-[-10%] w-[60%] h-[500px] bg-gradient-to-br from-[#ff5722]/8 to-transparent blur-[140px] rounded-full pointer-events-none animate-pulse duration-[8s]" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[60%] h-[500px] bg-gradient-to-tr from-[#2e315e]/6 to-transparent blur-[140px] rounded-full pointer-events-none animate-pulse duration-[10s]" />

      {/* Header / Navbar */}
      <header className="sticky top-0 z-50 bg-white/70 backdrop-blur-xl border-b border-slate-100 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link to="/" dir="ltr" className="flex items-center gap-2 group">
            <img src="/new logo/logo filess-25.svg" alt="SILACOD" className="w-9 h-9 object-contain group-hover:rotate-6 transition-transform duration-300" />
            <img src="/new logo/logo filess-24.svg" alt="SILACOD" className="h-6 object-contain" />
          </Link>
          <div className="flex items-center gap-4">
            <LanguageSwitcherWidget />
            <Link
              to="/login"
              className="bg-gradient-to-r from-[#2e315e] to-indigo-950 hover:from-[#ff5722] hover:to-[#e64a19] text-white font-extrabold px-6 py-2.5 rounded-xl text-sm transition-all duration-300 shadow-md shadow-[#2e315e]/10 hover:shadow-lg hover:shadow-[#ff5722]/20 transform hover:-translate-y-0.5"
            >
              {t.login}
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-6 py-12 relative z-10">
        {/* Back Link */}
        <div className={`mb-10 flex ${isRtl ? 'justify-end' : 'justify-start'}`}>
          <Link
            to="/"
            className={`inline-flex items-center gap-2 text-sm font-extrabold text-slate-500 hover:text-[#ff5722] transition-colors group ${isRtl ? 'flex-row-reverse' : 'flex-row'}`}
          >
            <ArrowLeft size={16} className={`transition-transform duration-300 ${isRtl ? 'rotate-180 group-hover:translate-x-1' : 'group-hover:-translate-x-1'}`} />
            {t.backToHome}
          </Link>
        </div>

        {/* Page Title Hero */}
        <div className={`space-y-4 mb-16 text-center lg:${textAlign}`} dir={isRtl ? 'rtl' : 'ltr'}>
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-[#ff5722] to-[#e64a19] text-white mb-2 shadow-lg shadow-[#ff5722]/20 opacity-0">
            <Mail size={26} className="animate-pulse" />
          </div>
          <h1 className="pt-1 text-4xl sm:text-5xl font-black text-[#2e315e] tracking-tight leading-none bg-gradient-to-r from-[#2e315e] via-[#2e315e] to-[#ff5722] bg-clip-text text-transparent inline-block">
            {t.title}
          </h1>
          <p className="text-[#ff5722] font-black text-sm tracking-wider uppercase opacity-95">
            {t.subtitle}
          </p>
        </div>

        {/* Split Layout: Contact Info & Form */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Right/Left Column: Contact Details */}
          <div className="lg:col-span-5 space-y-6" dir={isRtl ? 'rtl' : 'ltr'}>
            <div className={`bg-white/80 backdrop-blur-md rounded-[2.5rem] p-8 shadow-[0_10px_35px_rgba(0,0,0,0.015)] border border-slate-100/80 space-y-8 ${textAlign}`}>
              <h3 className="text-xl font-black text-[#2e315e]">{t.infoCardTitle}</h3>
              <p className="text-slate-500 text-xs sm:text-sm font-semibold leading-relaxed">
                {t.infoCardDesc}
              </p>

              <div className="space-y-6">
                {/* Email */}
                <div className={`flex gap-4 items-center ${flexAlign} p-4 bg-slate-50/50 border border-slate-100 rounded-2xl hover:border-[#ff5722]/10 transition-colors group`}>
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center flex-shrink-0 shadow-lg shadow-blue-500/10 group-hover:scale-105 transition-transform duration-300">
                    <Mail size={20} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{t.emailLabel}</p>
                    <a href="mailto:support@silacod.com" className="text-sm font-black text-[#2e315e] hover:text-[#ff5722] transition-colors">
                      support@silacod.com
                    </a>
                  </div>
                </div>

                {/* Phone */}
                <div className={`flex gap-4 items-center ${flexAlign} p-4 bg-slate-50/50 border border-slate-100 rounded-2xl hover:border-[#ff5722]/10 transition-colors group`}>
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#ff5722] to-rose-600 text-white flex items-center justify-center flex-shrink-0 shadow-lg shadow-[#ff5722]/10 group-hover:scale-105 transition-transform duration-300">
                    <Phone size={20} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{t.phoneLabel}</p>
                    <a href="tel:+212660517679" className="text-sm font-black text-[#2e315e] hover:text-[#ff5722] transition-colors" dir="ltr">
                      +212 660-517679
                    </a>
                  </div>
                </div>

                {/* Location */}
                <div className={`flex gap-4 items-center ${flexAlign} p-4 bg-slate-50/50 border border-slate-100 rounded-2xl hover:border-[#ff5722]/10 transition-colors group`}>
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center flex-shrink-0 shadow-lg shadow-emerald-500/10 group-hover:scale-105 transition-transform duration-300">
                    <MapPin size={20} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{t.locationLabel}</p>
                    <p className="text-sm font-black text-[#2e315e]">
                      {t.locationValue}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Left/Right Column: Form Card */}
          <div className="lg:col-span-7" dir={isRtl ? 'rtl' : 'ltr'}>
            <div className="bg-white/80 backdrop-blur-md rounded-[2.5rem] p-8 sm:p-10 shadow-[0_10px_35px_rgba(0,0,0,0.015)] border border-slate-100/80">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Name Input */}
                  <div className="space-y-2">
                    <label className={`text-xs font-black text-slate-700 block ${isRtl ? 'pe-1' : 'ps-1'}`}>{t.formNameLabel}</label>
                    <input
                      type="text"
                      className={`w-full bg-[#f8f9fa] focus:bg-white border-transparent focus:border-[#ff5722] focus:ring-4 focus:ring-[#ff5722]/10 rounded-xl py-2.5 px-4 transition-all outline-none border text-[13px] text-slate-700 font-semibold placeholder:text-slate-400 ${textAlign}`}
                      placeholder={t.formNamePlaceholder}
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>

                  {/* Email Input */}
                  <div className="space-y-2">
                    <label className={`text-xs font-black text-slate-700 block ${isRtl ? 'pe-1' : 'ps-1'}`}>{t.formEmailLabel}</label>
                    <input
                      type="email"
                      className={`w-full bg-[#f8f9fa] focus:bg-white border-transparent focus:border-[#ff5722] focus:ring-4 focus:ring-[#ff5722]/10 rounded-xl py-2.5 px-4 transition-all outline-none border text-[13px] text-slate-700 font-semibold placeholder:text-slate-400 ${textAlign}`}
                      placeholder={t.formEmailPlaceholder}
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                    />
                  </div>
                </div>

                {/* Subject Input */}
                <div className="space-y-2">
                  <label className={`text-xs font-black text-slate-700 block ${isRtl ? 'pe-1' : 'ps-1'}`}>{t.formSubjectLabel}</label>
                  <input
                    type="text"
                    className={`w-full bg-[#f8f9fa] focus:bg-white border-transparent focus:border-[#ff5722] focus:ring-4 focus:ring-[#ff5722]/10 rounded-xl py-2.5 px-4 transition-all outline-none border text-[13px] text-slate-700 font-semibold placeholder:text-slate-400 ${textAlign}`}
                    placeholder={t.formSubjectPlaceholder}
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    required
                  />
                </div>

                {/* Message Input */}
                <div className="space-y-2">
                  <label className={`text-xs font-black text-slate-700 block ${isRtl ? 'pe-1' : 'ps-1'}`}>{t.formMessageLabel}</label>
                  <textarea
                    rows={5}
                    className={`w-full bg-[#f8f9fa] focus:bg-white border-transparent focus:border-[#ff5722] focus:ring-4 focus:ring-[#ff5722]/10 rounded-xl py-2.5 px-4 transition-all outline-none border text-[13px] text-slate-700 font-semibold placeholder:text-slate-400 resize-none ${textAlign}`}
                    placeholder={t.formMessagePlaceholder}
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    required
                  />
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-gradient-to-r from-[#ff5722] to-[#e64a19] text-white font-extrabold py-3.5 rounded-xl hover:opacity-95 transition-all text-sm shadow-[0_4px_14px_0_rgba(255,87,34,0.35)] disabled:opacity-50 flex items-center justify-center gap-2 transform hover:-translate-y-0.5"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      {t.btnSending}
                    </>
                  ) : (
                    <>
                      <Send size={16} className={isRtl ? 'rotate-180' : ''} />
                      {t.btnSend}
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-100 py-10 text-center text-xs text-slate-400 font-semibold mt-16">
        <div className="max-w-7xl mx-auto px-6 space-y-3">
          <p className="text-slate-500 font-bold">{t.footerText}</p>
          <div className="flex justify-center gap-4 text-[13px]">
            <Link to="/terms" className="hover:text-[#ff5722] transition-colors">{t.termsOfUse}</Link>
            <span className="text-slate-300">•</span>
            <Link to="/privacy" className="hover:text-[#ff5722] transition-colors">{t.privacyPolicy}</Link>
          </div>
          <FooterMeta />
        </div>
      </footer>
    </div>
  );
}
