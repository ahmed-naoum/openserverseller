import { useState, useEffect, useRef, useMemo } from 'react';
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../contexts/SocketContext';
import { settingsApi } from '../../lib/api';
import { Eye, EyeOff, User, Mail, Phone, Lock, Sparkles, Store, Link as LinkIcon } from 'lucide-react';
import { FaTiktok, FaFacebook, FaInstagram, FaSnapchatGhost, FaYoutube } from 'react-icons/fa';
import { GoogleLogin } from '@react-oauth/google';
import GoogleAuthProvider from '../../components/auth/GoogleAuthProvider';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '../../contexts/LanguageContext';
import LanguageSwitcherWidget from '../../components/common/LanguageSwitcherWidget';
import CguModal from '../../components/auth/CguModal';
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile';

interface FormErrors {
  fullName?: string;
  email?: string;
  phone?: string;
  password?: string;
  confirmPassword?: string;
  instagramUsername?: string;
  tiktokUsername?: string;
  facebookUsername?: string;
  youtubeUsername?: string;
  snapchatUsername?: string;
  instagramUrl?: string;
  tiktokUrl?: string;
  facebookUrl?: string;
  youtubeUrl?: string;
  snapchatUrl?: string;
}

interface FormDataType {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  role: 'VENDOR' | 'INFLUENCER';
  instagramUsername: string;
  tiktokUsername: string;
  facebookUsername: string;
  youtubeUsername: string;
  snapchatUsername: string;
  instagramUrl: string;
  tiktokUrl: string;
  facebookUrl: string;
  youtubeUrl: string;
  snapchatUrl: string;
  // Questionnaire fields
  sellingOnline: string;
  budget: string;
  ordersPerDay: string;
  experienceYears: string;
  markets: string[];
  totalSpend: string;
  niches: string[];
  biggestAchievement: string;
  biggestChallenge: string;
  partnerPriorities: string[];
  interviewAvailability: string;
  additionalNotes: string;
  // Influencer Questionnaire fields
  followersCount: string;
  contentType: string[];
  hasPriorExperience: string;
  desiredProductTypes: string;
  initialBudget: string;
  motivation: string;
}

const normalizePhone = (phone: string): string => {
  if (!phone) return '';
  const cleaned = phone.replace(/[\s\-]/g, '');
  if (cleaned.startsWith('+212')) return cleaned;
  if (/^[5678][0-9]{8}$/.test(cleaned)) return '+212' + cleaned;
  if (/^0[5678][0-9]{8}$/.test(cleaned)) return '+212' + cleaned.slice(1);
  return phone;
};

const validateField = (name: string, value: string, allValues?: FormDataType): string | undefined => {
  switch (name) {
    case 'fullName':
      if (!value.trim()) return 'name_required';
      if (value.trim().length < 4) return 'name_too_short';
      // Kept in lockstep with the backend bound (auth.routes.ts). 20 was far too
      // short for real Moroccan/French full names and silently 400'd them.
      if (value.trim().length > 60) return 'name_too_long';
      if (/[0-9]/.test(value)) return 'name_invalid_chars'; // Or a dedicated key like 'name_no_numbers' if translation exists
      return undefined;
    case 'email':
      if (!value) return 'email_required';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'email_invalid';
      return undefined;
    case 'phone':
      if (!value) return 'phone_required';
      if (!/^\+212[5678][0-9]{8}$/.test(value)) return 'phone_invalid';
      return undefined;
    case 'instagramUsername':
    case 'tiktokUsername':
    case 'facebookUsername':
    case 'youtubeUsername':
    case 'snapchatUsername':
      if (value) {
        const trimmed = value.trim();
        if (trimmed.includes(' ')) return 'username_no_spaces';
        if (trimmed.length < 3) return 'username_too_short';
        if (trimmed.length > 30) return 'username_too_long';
      }
      return undefined;
    case 'password':
      if (!value) return 'password_required';
      if (value.length < 8) return 'password_too_short';
      const criteriaMet = [/[A-Z]/, /[a-z]/, /[0-9]/, /[^A-Za-z0-9]/].filter(r => r.test(value)).length;
      if (criteriaMet < 3) return 'password_criteria_error';
      return undefined;
    case 'confirmPassword':
      if (!value) return 'confirm_password_required';
      if (allValues && value !== allValues.password) return 'passwords_dont_match';
      return undefined;
    default:
      return undefined;
  }
};

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || 
  (import.meta.env.PROD ? "0x4AAAAAADmEpM-gki0llHcX" : "1x00000000000000000000AA");

export default function RegisterPage() {
  const { language, t: tRaw } = useLanguage();
  const { socket } = useSocket();
  const t = (key: string) => tRaw(key, 'register');
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const refCode = searchParams.get('ref') || searchParams.get('referralCode') || undefined;
  const defaultRole = pathname.includes('/vendor') ? 'VENDOR' : 'INFLUENCER';

  const turnstileOptions = useMemo(() => ({
    theme: 'light' as const,
    language: language === 'ar' ? 'ar' : language === 'en' ? 'en' : 'fr',
    // Self-healing behaviour — without these the widget can silently go dead and the
    // user is left with a button that appears to do nothing:
    refreshExpired: 'auto' as const, // tokens expire after ~5 min; re-issue automatically
    retry: 'auto' as const,          // transient network/CDN failure -> retry instead of blank
    retryInterval: 2000,
    appearance: 'always' as const,   // always visible, so the user can see verification state
  }), [language]);

  const [formData, setFormData] = useState<FormDataType>({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    role: defaultRole,
    instagramUsername: '',
    tiktokUsername: '',
    facebookUsername: '',
    youtubeUsername: '',
    snapchatUsername: '',
    instagramUrl: '',
    tiktokUrl: '',
    facebookUrl: '',
    youtubeUrl: '',
    snapchatUrl: '',
    // Questionnaire fields default values
    sellingOnline: '',
    budget: '',
    ordersPerDay: '',
    experienceYears: '',
    markets: [],
    totalSpend: '',
    niches: [],
    biggestAchievement: '',
    biggestChallenge: '',
    partnerPriorities: [],
    interviewAvailability: '',
    additionalNotes: '',
    // Influencer Questionnaire fields default values
    followersCount: '',
    contentType: [],
    hasPriorExperience: '',
    desiredProductTypes: '',
    initialBudget: '',
    motivation: '',
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(false);
  const submittedRef = useRef(false);
  const [step, setStep] = useState(1);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  // Drives the visible captcha state so the user is never left guessing why the
  // submit button is inactive.
  const [captchaStatus, setCaptchaStatus] = useState<'loading' | 'ready' | 'expired' | 'error'>('loading');
  // Bumping this remounts the widget for a manual retry.
  const [captchaKey, setCaptchaKey] = useState(0);
  const [selectionConfirmed, setSelectionConfirmed] = useState(false);
  const turnstileRef = useRef<TurnstileInstance>(null);
  const [googleCredential, setGoogleCredential] = useState<string | null>(null);

  // Update role dynamically if URL changes without remounting the component
  useEffect(() => {
    const newRole = pathname.includes('/vendor') ? 'VENDOR' : 'INFLUENCER';
    if (formData.role !== newRole) {
      setFormData(prev => ({ ...prev, role: newRole }));
      setStep(1);
      setSelectionConfirmed(false);
      setTurnstileToken(null);
      // Clear validation state too — otherwise errors raised for the previous role
      // linger and mark fields red that the new role never even asks for.
      setErrors({});
      setTouched({});
    }
  }, [pathname]);

  // The Turnstile widget lives only on step 4; leaving that step destroys it and its
  // token dies with it. Drop our copy so the UI can never claim it is still solved.
  useEffect(() => {
    if (step !== 4) {
      setTurnstileToken(null);
      setCaptchaStatus('loading');
    }
  }, [step]);

  // Abandoned sign-up capture: stream identity fields (never the password) so an
  // admin can follow up on visitors who start registering but never finish.
  useEffect(() => {
    if (!socket || !selectionConfirmed) return;
    const hasData = formData.fullName || formData.email || formData.phone;
    if (!hasData) return;
    const timer = setTimeout(() => {
      socket.emit('signup:progress', {
        role: formData.role,
        step,
        fields: {
          fullName: formData.fullName,
          email: formData.email,
          phone: formData.phone,
        },
      });
    }, 700);
    return () => clearTimeout(timer);
  }, [socket, selectionConfirmed, step, formData.role, formData.fullName, formData.email, formData.phone]);

  
  // Influencer specific states
  const [activeSocial, setActiveSocial] = useState<'instagram' | 'tiktok' | 'facebook' | 'youtube' | 'snapchat'>('instagram');
  const [showUrlInputs, setShowUrlInputs] = useState<Record<string, boolean>>({});

  const toggleUrlInput = (social: string) => {
    setShowUrlInputs(prev => ({ ...prev, [social]: !prev[social] }));
  };
  
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [cguAccepted, setCguAccepted] = useState(false);
  const [showCguModal, setShowCguModal] = useState(false);
  
  const hasLength = formData.password.length >= 8;
  const hasUppercase = /[A-Z]/.test(formData.password);
  const hasLowercase = /[a-z]/.test(formData.password);
  const hasNumber = /[0-9]/.test(formData.password);
  const hasSymbol = /[^A-Za-z0-9]/.test(formData.password);
  const criteriaMet = [hasUppercase, hasLowercase, hasNumber, hasSymbol].filter(Boolean).length;
  const isPasswordStrong = hasLength && criteriaMet >= 3;
  const getStrengthPercentage = () => {
    if (!formData.password) return 0;
    let score = 0;
    if (hasLength) score += 20;
    if (hasUppercase) score += 20;
    if (hasLowercase) score += 20;
    if (hasNumber) score += 20;
    if (hasSymbol) score += 20;
    return score;
  };
  
  const { register, registerInfluencer, googleAuth } = useAuth();
  const navigate = useNavigate();

  /**
   * Writes a field error, or REMOVES the key entirely when the field is valid.
   *
   * Critical: never store `undefined` under a key. `Object.keys()` counts keys
   * regardless of their value, so a `{ email: undefined }` entry would make the
   * form look invalid forever and silently block submission.
   */
  const setFieldError = (name: string, error?: string) => {
    setErrors(prev => {
      if (error) return { ...prev, [name]: error };
      if (!(name in prev)) return prev;
      const next = { ...prev };
      delete next[name as keyof FormErrors];
      return next;
    });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    let processedValue = value;
    if (name === 'phone') {
        processedValue = normalizePhone(value);
    } else if (['instagramUsername', 'tiktokUsername', 'facebookUsername', 'youtubeUsername', 'snapchatUsername'].includes(name)) {
        processedValue = value.replace('@', '');
    }

    setFormData({ ...formData, [name]: processedValue });

    if (touched[name]) {
      const error = validateField(name, processedValue, { ...formData, [name]: processedValue });
      setFieldError(name, error);
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    let processedValue = value;
    if (name === 'phone') {
        processedValue = normalizePhone(value);
    } else if (['instagramUsername', 'tiktokUsername', 'facebookUsername', 'youtubeUsername', 'snapchatUsername'].includes(name)) {
        processedValue = value.replace('@', '');
    }

    setTouched(prev => ({ ...prev, [name]: true }));
    setFormData(prev => ({ ...prev, [name]: processedValue }));
    const error = validateField(name, processedValue, { ...formData, [name]: processedValue });
    setFieldError(name, error);
  };

  /**
   * Validates every field of the whole form.
   * Returns BOTH the verdict and the freshly-computed errors, because React state
   * set here is not readable until the next render — the caller must never re-read
   * `errors` in the same tick.
   */
  const validateForm = (): { valid: boolean; errors: FormErrors } => {
    const newErrors: FormErrors = {};
    let isValid = true;
    
    // Google sign-ups never render the password inputs (they are wrapped in
    // `{!googleCredential && ...}`), so requiring them would make submission
    // impossible with no visible error. Phone stays required — the backend
    // demands it and would otherwise loop back to needs_completion forever.
    const fieldsToValidate = googleCredential
      ? ['fullName', 'email', 'phone']
      : ['fullName', 'email', 'phone', 'password', 'confirmPassword'];
    if (formData.role === 'INFLUENCER') {
        fieldsToValidate.push('instagramUsername', 'tiktokUsername', 'facebookUsername', 'youtubeUsername', 'snapchatUsername');
    }

    fieldsToValidate.forEach(field => {
      const error = validateField(field, formData[field as keyof typeof formData] as string, formData);
      if (error) {
        newErrors[field as keyof FormErrors] = error;
        isValid = false;
      }
    });

    if (!formData.email) {
        newErrors.email = 'email_required';
        isValid = false;
    }
    if (!formData.phone) {
        newErrors.phone = 'phone_required';
        isValid = false;
    }

    if (formData.role === 'INFLUENCER' && !formData.instagramUsername && !formData.tiktokUsername && !formData.facebookUsername && !formData.youtubeUsername && !formData.snapchatUsername) {
        newErrors.instagramUsername = 'social_media_required';
        isValid = false;
    }

    setErrors(newErrors);
    
    const fieldsToTouch: Record<string, boolean> = { fullName: true, email: true, phone: true, password: true, confirmPassword: true };
    if (formData.role === 'INFLUENCER') {
        Object.assign(fieldsToTouch, { instagramUsername: true, tiktokUsername: true, facebookUsername: true, youtubeUsername: true, snapchatUsername: true });
    }
    setTouched(fieldsToTouch);

    return { valid: isValid, errors: newErrors };
  };

  /**
   * Turns a server rejection into inline field errors: marks the offending input red,
   * writes the message underneath it, navigates back to the step that owns it and
   * focuses it. Falls back to a plain toast when the server names no field.
   */
  const applyServerError = (error: any): void => {
    const data = error?.response?.data;
    const serverMessage: string | undefined = data?.message;

    // Preferred: the API tells us exactly which field failed.
    let field: string | undefined;
    let messageKey: string | undefined;

    const list = Array.isArray(data?.errors) ? data.errors : [];
    const first = list.find((it: any) => it?.path || it?.param);
    if (first) {
      field = first.path || first.param;
      messageKey = first.msg;
    }

    // Fallback: infer the field from the message text (older endpoints).
    if (!field && serverMessage) {
      const m = serverMessage.toLowerCase();
      if (m.includes('email') || m.includes('bericht') || m.includes('بريد')) field = 'email';
      else if (m.includes('phone') || m.includes('téléphone') || m.includes('telephone') || m.includes('هاتف')) field = 'phone';
    }

    if (!field || !(field in STEP_OF_FIELD)) {
      toast.error(serverMessage || "Erreur lors de l'inscription");
      return;
    }

    // `t()` returns the key unchanged when it is not a translation key, so a raw
    // server sentence still renders correctly.
    const display = messageKey ? t(messageKey) : (serverMessage || '');
    // Store the KEY (not the translated text): the input renders it through t(),
    // which translates known keys and passes raw sentences through untouched.
    setFieldError(field, messageKey || serverMessage);
    setTouched(prev => ({ ...prev, [field!]: true }));
    toast.error(display || serverMessage || '');

    const targetStep = STEP_OF_FIELD[field];
    if (targetStep !== step) setStep(targetStep);

    setTimeout(() => {
      const el = document.getElementsByName(field!)[0] as HTMLElement | undefined;
      el?.focus();
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 80);
  };

  /** Which wizard step a given field lives on, so we can send the user back to fix it. */
  const STEP_OF_FIELD: Record<string, number> = {
    fullName: 1, email: 1, phone: 1,
    instagramUsername: 2, tiktokUsername: 2, facebookUsername: 2, youtubeUsername: 2, snapchatUsername: 2,
    password: 4, confirmPassword: 4,
  };

  const handleNextStep = () => {
    let isValid = true;
    let newErrors = { ...errors };
    let newTouched = { ...touched };

    if (step === 1) {
      const fields = ['fullName', 'email', 'phone'];
      fields.forEach(field => {
        const err = validateField(field, formData[field as keyof typeof formData] as string, formData);
        if (err) { newErrors[field as keyof FormErrors] = err; isValid = false; }
        newTouched[field] = true;
      });
      if (!formData.email) {
        newErrors.email = 'email_required'; isValid = false;
      }
      if (!formData.phone) {
        newErrors.phone = 'phone_required'; isValid = false;
      }
    } else if (step === 2) {
      if (formData.role === 'INFLUENCER') {
        const socialFields = ['instagramUsername', 'tiktokUsername', 'facebookUsername', 'youtubeUsername', 'snapchatUsername'];
        let hasAtLeastOne = false;
        socialFields.forEach(field => {
          const val = formData[field as keyof typeof formData] as string;
          if (val) {
            hasAtLeastOne = true;
            const err = validateField(field, val, formData);
            if (err) {
              newErrors[field as keyof FormErrors] = err;
              isValid = false;
            }
            newTouched[field] = true;
          }
        });
        if (!hasAtLeastOne) {
          toast.error(t('social_media_required'));
          isValid = false;
        }
      }
    }

    setErrors(newErrors);
    setTouched(newTouched);

    if (isValid) setStep(step + 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Guard double submission (rapid double-click, or Enter + click together).
    if (submittedRef.current || isLoading) return;

    // Defensive: ignore any submit that did not come from the real "create account"
    // button. Keyboard/implicit submits have no submitter and still pass through.
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
    if (submitter && submitter.getAttribute('data-submit-role') !== 'create-account') return;

    // All four steps share a single <form>, so pressing Enter anywhere fires submit.
    // On steps 1-3 that must ADVANCE the wizard, never submit a half-filled form.
    if (step < 4) {
      handleNextStep();
      return;
    }

    // Use the FRESHLY returned errors. Reading the `errors` state here would read the
    // previous render's value and could block submission with no message at all.
    const { valid, errors: freshErrors } = validateForm();

    if (!valid) {
      const firstErrorField = Object.keys(freshErrors)[0];
      if (firstErrorField) {
        const errorKey = freshErrors[firstErrorField as keyof FormErrors];
        if (errorKey) toast.error(t(errorKey));

        // The offending field may live on an earlier step — take the user to it.
        const targetStep = STEP_OF_FIELD[firstErrorField] ?? step;
        if (targetStep !== step) setStep(targetStep);

        // It only exists in the DOM after that step renders, so focus on the next frame.
        setTimeout(() => {
          const el = document.getElementsByName(firstErrorField)[0] as HTMLElement | undefined;
          el?.focus();
          el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 80);
      }
      return;
    }

    if (!cguAccepted) {
      toast.error(
        language === 'ar' ? 'يجب قبول الشروط العامة للاستخدام'
        : language === 'fr' ? "Vous devez accepter les Conditions Générales d'Utilisation"
        : 'You must accept the Terms of Use'
      );
      return;
    }

    // Read the token from the WIDGET, not from React state. The widget is destroyed
    // whenever the user leaves step 4 or switches language, while the state value
    // survives — submitting that dead token makes Cloudflare answer
    // `timeout-or-duplicate` and the backend reject a perfectly legitimate signup.
    const canReadLive = typeof turnstileRef.current?.getResponse === 'function';
    const liveToken = canReadLive ? (turnstileRef.current!.getResponse() || null) : turnstileToken;

    if (!liveToken) {
      toast.error(
        language === 'ar' ? 'الرجاء إكمال التحقق من الكابتشا'
        : language === 'fr' ? 'Veuillez valider le captcha'
        : 'Please complete the captcha verification'
      );
      setTurnstileToken(null);
      setCaptchaStatus('loading');
      turnstileRef.current?.reset();
      return;
    }

    submittedRef.current = true;
    setIsLoading(true);

    try {
      if (googleCredential) {
        const payload = {
          credential: googleCredential,
          role: formData.role,
          phone: formData.phone || undefined,
          fullName: formData.fullName,
          instagramUsername: formData.instagramUsername || undefined,
          tiktokUsername: formData.tiktokUsername || undefined,
          facebookUsername: formData.facebookUsername || undefined,
          youtubeUsername: formData.youtubeUsername || undefined,
          snapchatUsername: formData.snapchatUsername || undefined,
          instagramUrl: formData.instagramUrl || undefined,
          tiktokUrl: formData.tiktokUrl || undefined,
          facebookUrl: formData.facebookUrl || undefined,
          youtubeUrl: formData.youtubeUrl || undefined,
          snapchatUrl: formData.snapchatUrl || undefined,
          sellingOnline: formData.sellingOnline || undefined,
          budget: formData.budget || undefined,
          ordersPerDay: formData.ordersPerDay || undefined,
          experienceYears: formData.experienceYears || undefined,
          markets: formData.markets,
          totalSpend: formData.totalSpend || undefined,
          niches: formData.niches,
          biggestAchievement: formData.biggestAchievement || undefined,
          biggestChallenge: formData.biggestChallenge || undefined,
          partnerPriorities: formData.partnerPriorities,
          interviewAvailability: formData.interviewAvailability || undefined,
          additionalNotes: formData.additionalNotes || undefined,
          followersCount: formData.followersCount || undefined,
          contentType: formData.contentType,
          hasPriorExperience: formData.hasPriorExperience || undefined,
          desiredProductTypes: formData.desiredProductTypes || undefined,
          initialBudget: formData.initialBudget || undefined,
          motivation: formData.motivation || undefined,
        };
        const userRes = await googleAuth(payload);
        toast.success(language === 'ar' ? 'تم إنشاء الحساب بنجاح!' : 'Compte créé avec succès !');
        
        const user = userRes.user || userRes;
        if (user?.roleName === 'SUPER_ADMIN' || user?.roleName === 'FINANCE_ADMIN') navigate('/admin');
        else if (user?.roleName === 'CALL_CENTER_AGENT') navigate('/agent');
        else if (user?.roleName === 'GROSSELLER') navigate('/grosseller');
        else if (user?.roleName === 'INFLUENCER' || user?.isInfluencer) {
          if (user.kycStatus !== 'APPROVED') {
            navigate('/influencer/verification');
          } else {
            navigate('/influencer');
          }
        } else {
          if (user?.kycStatus !== 'APPROVED') {
            navigate('/dashboard/verification');
          } else {
            navigate('/dashboard');
          }
        }
      } else {
        if (formData.role === 'INFLUENCER') {
          if (!registerInfluencer) throw new Error("registerInfluencer endpoint missing");
          
          await registerInfluencer({
              email: formData.email,
              phone: formData.phone || undefined,
              password: formData.password,
              fullName: formData.fullName,
              ref: refCode,
              instagramUsername: formData.instagramUsername || undefined,
              tiktokUsername: formData.tiktokUsername || undefined,
              facebookUsername: formData.facebookUsername || undefined,
              youtubeUsername: formData.youtubeUsername || undefined,
              snapchatUsername: formData.snapchatUsername || undefined,
              instagramUrl: formData.instagramUrl || undefined,
              tiktokUrl: formData.tiktokUrl || undefined,
              facebookUrl: formData.facebookUrl || undefined,
              youtubeUrl: formData.youtubeUrl || undefined,
              snapchatUrl: formData.snapchatUrl || undefined,
              cguAccepted: true,
              turnstileToken: liveToken,
              followersCount: formData.followersCount || undefined,
              contentType: formData.contentType,
              hasPriorExperience: formData.hasPriorExperience || undefined,
              desiredProductTypes: formData.desiredProductTypes || undefined,
              initialBudget: formData.initialBudget || undefined,
              motivation: formData.motivation || undefined,
          });
          toast.success('Compte créateur créé avec succès ! Bienvenue 🎉');
          socket?.emit('signup:complete');
          navigate('/verify-email', { state: { email: formData.email } });
        } else {
          const user = await register({
              email: formData.email,
              phone: formData.phone || undefined,
              password: formData.password,
              fullName: formData.fullName,
              role: 'VENDOR',
              ref: refCode,
              cguAccepted: true,
              turnstileToken: liveToken,
              sellingOnline: formData.sellingOnline || undefined,
              budget: formData.budget || undefined,
              ordersPerDay: formData.ordersPerDay || undefined,
              experienceYears: formData.experienceYears || undefined,
              markets: formData.markets,
              totalSpend: formData.totalSpend || undefined,
              niches: formData.niches,
              biggestAchievement: formData.biggestAchievement || undefined,
              biggestChallenge: formData.biggestChallenge || undefined,
              partnerPriorities: formData.partnerPriorities,
              interviewAvailability: formData.interviewAvailability || undefined,
              additionalNotes: formData.additionalNotes || undefined
          });
          toast.success('Compte créé avec succès !');
          socket?.emit('signup:complete');
          navigate('/verify-email', { state: { email: formData.email } });
        }
      }
    } catch (error: any) {
      // Show the failure ON the offending field and take the user back to its step,
      // instead of a toast that disappears and leaves them stranded on step 4.
      applyServerError(error);
      // The captcha token is single-use — it was consumed by the failed attempt.
      setTurnstileToken(null);
      setCaptchaStatus('loading');
      turnstileRef.current?.reset();
    } finally {
      setIsLoading(false);
      submittedRef.current = false;
    }
  };

  const handleGoogleSuccess = async (response: any) => {
    if (!response.credential) return;
    setIsLoading(true);
    try {
      const userRes = await googleAuth({ credential: response.credential, role: formData.role });
      
      if (userRes && userRes.status === 'needs_completion') {
        toast.success(
          language === 'ar' ? 'الرجاء إكمال معلوماتك للمتابعة'
          : language === 'fr' ? 'Veuillez compléter vos informations pour continuer.'
          : 'Please complete your information to continue.'
        );
        setGoogleCredential(response.credential);
        setFormData(prev => ({
          ...prev,
          email: userRes.email || '',
          fullName: userRes.fullName || ''
        }));
        setSelectionConfirmed(true);
        // Start at step 1, NOT step 2. The backend requires a phone number, and the
        // Google display name often fails our own fullName rules (too long / digits).
        // Both fields only exist on step 1 — skipping it left users stuck on a
        // validation error they had no field to fix.
        setStep(1);
        return;
      }

      toast.success('Compte Google connecté avec succès !');
      const user = userRes.user || userRes;
      if (user?.roleName === 'SUPER_ADMIN' || user?.roleName === 'FINANCE_ADMIN') navigate('/admin');
      else if (user?.roleName === 'CALL_CENTER_AGENT') navigate('/agent');
      else if (user?.roleName === 'GROSSELLER') navigate('/grosseller');
      else if (user?.roleName === 'INFLUENCER' || user?.isInfluencer) {
        if (user.kycStatus !== 'APPROVED') {
          navigate('/influencer/verification');
        } else {
          navigate('/influencer');
        }
      } else {
        if (user?.kycStatus !== 'APPROVED') {
          navigate('/dashboard/verification');
        } else {
          navigate('/dashboard');
        }
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erreur Google Login');
    } finally {
      setIsLoading(false);
    }
  };

  const currentImage = formData.role === 'VENDOR' 
    ? '/images/login-seller-img.webp' 
    : '/images/login-influencer-img.webp';

  return (
    <div dir={language === 'ar' ? 'rtl' : 'ltr'} className={`min-h-screen flex flex-col lg:flex-row font-['29LT_Kaff',_Cairo,_Inter,_sans-serif] bg-white overflow-x-hidden relative ${language === 'ar' ? 'text-right' : 'text-left'}`}>
      {/* Left Column: Form Area */}
      <div className="w-full lg:w-[50%] xl:w-[45%] flex flex-col justify-center items-center p-6 bg-[#f8f9fa] relative z-10 min-h-screen">
        {/* Language Switcher Widget */}
        <div className={`absolute top-6 ${language === 'ar' ? 'left-6' : 'right-6'} z-30`}>
          <LanguageSwitcherWidget />
        </div>
        
        {/* Mobile Logo */}
        <div className={`lg:hidden absolute top-8 ${language === 'ar' ? 'right-8' : 'left-8'}`}>
          <Link to="/" dir="ltr" className="flex items-center gap-2">
            <img src="/new logo/logo filess-25.svg" alt="SILACOD" className="w-8 h-8 object-contain" />
            <img src="/new logo/logo filess-24.svg" alt="SILACOD" className="h-5 object-contain" />
          </Link>
        </div>

        <div className="w-full max-w-[400px] py-6">
            <div className="text-center space-y-2 mb-6 mt-8 lg:mt-0">
                <h1 className="text-[32px] font-extrabold text-[#2e315e] tracking-tight">{t('register_title')}</h1>
                <p className="text-[17px] font-medium text-[#ff5722]">{t('register_subtitle')}</p>
            </div>

          <div className="bg-white rounded-[2rem] p-8 sm:p-10 shadow-[0_8px_30px_rgb(0,0,0,0.04)]" dir={language === 'ar' ? 'rtl' : 'ltr'}>
            {!selectionConfirmed ? (
              <div className="space-y-6">
                {/* Selection Cards */}
                <div className="space-y-4">
                  {/* Influencer Card */}
                  <div
                    onClick={() => setFormData({ ...formData, role: 'INFLUENCER' })}
                    className={`cursor-pointer p-5 rounded-2xl border-2 transition-all duration-300 flex items-center gap-4 relative overflow-hidden group ${
                      formData.role === 'INFLUENCER'
                        ? 'border-[#ff5722] bg-[#ff5722]/5 shadow-md shadow-[#ff5722]/10 scale-[1.01]'
                        : 'border-slate-100 bg-[#f8f9fa] hover:border-slate-200 hover:bg-slate-100/50'
                    }`}
                  >
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-all ${
                      formData.role === 'INFLUENCER' ? 'bg-[#ff5722] text-white shadow-md shadow-[#ff5722]/20' : 'bg-white text-slate-500'
                    }`}>
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div className={`min-w-0 flex-1 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
                      <h3 className={`text-[15px] font-extrabold transition-colors ${
                        formData.role === 'INFLUENCER' ? 'text-[#ff5722]' : 'text-[#2e315e]'
                      }`}>
                        {t('im_an_influencer')}
                      </h3>
                      <p className="text-[11px] text-slate-400 font-medium mt-0.5 leading-normal">
                        {language === 'ar' 
                          ? 'حققي أرباحاً من جمهورك، روجي للمنتجات، واكسبي عمولات'
                          : language === 'fr'
                          ? 'Monétisez votre audience, faites la promotion de produits et gagnez des commissions'
                          : 'Monetize your audience, promote products, and earn commissions'}
                      </p>
                    </div>
                    {formData.role === 'INFLUENCER' && (
                      <div className={`absolute top-3 ${language === 'ar' ? 'left-3' : 'right-3'} w-2.5 h-2.5 rounded-full bg-[#ff5722]`} />
                    )}
                  </div>

                  {/* Seller Card */}
                  <div
                    onClick={() => setFormData({ ...formData, role: 'VENDOR' })}
                    className={`cursor-pointer p-5 rounded-2xl border-2 transition-all duration-300 flex items-center gap-4 relative overflow-hidden group ${
                      formData.role === 'VENDOR'
                        ? 'border-[#ff5722] bg-[#ff5722]/5 shadow-md shadow-[#ff5722]/10 scale-[1.01]'
                        : 'border-slate-100 bg-[#f8f9fa] hover:border-slate-200 hover:bg-slate-100/50'
                    }`}
                  >
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-all ${
                      formData.role === 'VENDOR' ? 'bg-[#ff5722] text-white shadow-md shadow-[#ff5722]/20' : 'bg-white text-slate-500'
                    }`}>
                      <Store className="w-5 h-5" />
                    </div>
                    <div className={`min-w-0 flex-1 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
                      <h3 className={`text-[15px] font-extrabold transition-colors ${
                        formData.role === 'VENDOR' ? 'text-[#ff5722]' : 'text-[#2e315e]'
                      }`}>
                        {t('im_a_seller')}
                      </h3>
                      <p className="text-[11px] text-slate-400 font-medium mt-0.5 leading-normal">
                        {language === 'ar' 
                          ? 'أنتج منتجات مخصصة، أدر مخزونك وضاعف مبيعاتك'
                          : language === 'fr'
                          ? 'Produisez des produits personnalisés, gérez vos stocks et développez vos ventes'
                          : 'Produce custom products, manage inventory, and grow your sales'}
                      </p>
                    </div>
                    {formData.role === 'VENDOR' && (
                      <div className={`absolute top-3 ${language === 'ar' ? 'left-3' : 'right-3'} w-2.5 h-2.5 rounded-full bg-[#ff5722]`} />
                    )}
                  </div>
                </div>

                {/* Next Button */}
                <button
                  type="button"
                  onClick={() => setSelectionConfirmed(true)}
                  className="w-full bg-[#ff5722] text-white font-bold py-3 rounded-xl hover:bg-[#e64a19] transition-all text-sm shadow-[0_4px_14px_0_rgba(255,87,34,0.39)] flex items-center justify-center gap-2"
                >
                  {t('next_btn')}
                </button>

                {/* Google Login & Sign In Link */}
                <div className="mt-6 flex flex-col items-center gap-4 border-t border-slate-100 pt-6">
                  <div className="w-full flex justify-center">
                    <GoogleAuthProvider>
                      <GoogleLogin
                        onSuccess={handleGoogleSuccess}
                        onError={() => toast.error(t('google_login_failed'))}
                        useOneTap
                        theme="outline"
                        shape="pill"
                        size="large"
                        width="100%"
                      />
                    </GoogleAuthProvider>
                  </div>
                  <p className="text-[13px] font-semibold text-slate-500 mt-2">
                    {t('already_have_account')}{' '}
                    <Link to="/login" className="text-[#ff5722] hover:text-[#e64a19] transition-colors font-bold">
                      {t('sign_in_link')}
                    </Link>
                  </p>
                </div>

                <div className="mt-6 text-center">
                  <p className="text-[11px] font-semibold text-slate-400">
                    <Link to="/privacy" target="_blank" className="hover:text-[#ff5722] transition-colors">{t('privacy_notice')}</Link>
                    {' | '}
                    <Link to="/terms" target="_blank" className="hover:text-[#ff5722] transition-colors font-semibold">{t('terms_of_service')}</Link>
                  </p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} noValidate className="space-y-5">
                {/* noValidate: all validation is handled in JS so messages are translated
                    (fr/ar/en) and consistent. Native browser bubbles would appear in the
                    browser's own language and can block submit without visible feedback. */}
                {/* Onboarding steps progress bar */}
                <div className="mb-6 w-full max-w-[360px] mx-auto relative px-2">
                    {/* Background line */}
                    <div className="absolute top-3.5 left-[10%] w-[80%] h-1.5 bg-[#f4f5f7] rounded-full -z-10"></div>
                    
                    {/* Active line */}
                    <div className="absolute top-3.5 left-[10%] h-1.5 bg-[#ff5722] rounded-full -z-10 transition-all duration-500" style={{ width: step === 1 ? '0%' : step === 2 ? '33.33%' : step === 3 ? '66.66%' : '100%' }}></div>
                    
                    <div className="flex justify-between relative">
                        <div className="flex flex-col items-center">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${step >= 1 ? 'bg-[#ff5722] text-white shadow-[0_0_0_4px_#fff]' : 'bg-[#e2e8f0] text-slate-400'}`}>1</div>
                            <span className={`text-[11px] font-bold mt-2 ${step >= 1 ? 'text-[#ff5722]' : 'text-slate-300'}`}>{t('step_account')}</span>
                        </div>
                        <div className="flex flex-col items-center">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${step >= 2 ? 'bg-[#ff5722] text-white shadow-[0_0_0_4px_#fff]' : 'bg-[#e2e8f0] text-slate-400'}`}>2</div>
                            <span className={`text-[11px] font-bold mt-2 ${step >= 2 ? 'text-[#ff5722]' : 'text-slate-300'}`}>
                              {formData.role === 'VENDOR' ? t('step_activity') : t('step_social')}
                            </span>
                        </div>
                        <div className="flex flex-col items-center">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${step >= 3 ? 'bg-[#ff5722] text-white shadow-[0_0_0_4px_#fff]' : 'bg-[#e2e8f0] text-slate-400'}`}>3</div>
                            <span className={`text-[11px] font-bold mt-2 ${step >= 3 ? 'text-[#ff5722]' : 'text-slate-300'}`}>
                              {t('step_questionnaire')}
                            </span>
                        </div>
                        <div className="flex flex-col items-center">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${step >= 4 ? 'bg-[#ff5722] text-white shadow-[0_0_0_4px_#fff]' : 'bg-[#e2e8f0] text-slate-400'}`}>4</div>
                            <span className={`text-[11px] font-bold mt-2 ${step >= 4 ? 'text-slate-400' : 'text-slate-300'}`}>{t('step_password')}</span>
                        </div>
                    </div>
                </div>
              
              {step === 1 && (
                <>
                  <div className="space-y-1.5">
                    <label className={`text-xs font-bold text-slate-700 flex justify-between ${language === 'ar' ? 'mr-1' : 'ml-1'}`}>
                        <span>{t('full_name_label')} <span className="text-[#ff5722]">*</span></span>
                        {touched.fullName && (errors.fullName ? <span className="text-red-500 text-[10px]">{t(errors.fullName)}</span> : <span className="text-green-500 text-[10px]">{t('field_valid')}</span>)}
                    </label>
                    <div className="relative group/input">
                      <div className={`absolute ${language === 'ar' ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 text-slate-400`}>
                        <User size={18} />
                      </div>
                      <input
                        type="text"
                        name="fullName"
                        className={`w-full bg-[#f8f9fa] focus:bg-white border-transparent focus:border-[#ff5722] focus:ring-4 focus:ring-[#ff5722]/10 rounded-xl py-2.5 px-4 ${language === 'ar' ? 'pr-11 pl-4' : 'pl-11 pr-4'} transition-all outline-none border text-[13px] text-slate-700 font-medium placeholder:text-slate-400 ${touched.fullName && errors.fullName ? '!border-red-300 !ring-red-500/10' : ''}`}
                        placeholder={t('full_name_placeholder')}
                        value={formData.fullName}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        required
                      />
                    </div>
                  </div>
 
                  <div className="space-y-4">
                      <div className="space-y-1.5">
                        <label className={`text-xs font-bold text-slate-700 flex justify-between ${language === 'ar' ? 'mr-1' : 'ml-1'}`}>
                            <span>{t('email_label')} <span className="text-[#ff5722]">*</span></span>
                            {touched.email && errors.email && <span className="text-red-500 text-[10px] font-bold">{t(errors.email)}</span>}
                        </label>
                        <div className="relative group/input">
                          <div className={`absolute ${language === 'ar' ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 text-slate-400`}>
                            <Mail size={18} />
                          </div>
                          <input
                            type="email"
                            name="email"
                            className={`w-full bg-[#f8f9fa] focus:bg-white border-transparent focus:border-[#ff5722] focus:ring-4 focus:ring-[#ff5722]/10 rounded-xl py-2.5 px-4 ${language === 'ar' ? 'pr-11 pl-4' : 'pl-11 pr-4'} transition-all outline-none border text-[13px] text-slate-700 font-medium placeholder:text-slate-400 ${touched.email && errors.email ? '!border-red-300 !ring-red-500/10' : ''}`}
                            placeholder="votre@email.com"
                            value={formData.email}
                            onChange={handleChange}
                            onBlur={handleBlur}
                            required
                          />
                        </div>
                      </div>
 
                      <div className="space-y-1.5">
                        <label className={`text-xs font-bold text-slate-700 flex justify-between ${language === 'ar' ? 'mr-1' : 'ml-1'}`}>
                            <span>{t('phone_label')} <span className="text-[#ff5722]">*</span></span>
                            {touched.phone && errors.phone && <span className="text-red-500 text-[10px] font-bold">{t(errors.phone)}</span>}
                        </label>
                        <div className="relative group/input">
                          <div className={`absolute ${language === 'ar' ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 text-slate-400`}>
                            <Phone size={18} />
                          </div>
                          <input
                            type="tel"
                            name="phone"
                            className={`w-full bg-[#f8f9fa] focus:bg-white border-transparent focus:border-[#ff5722] focus:ring-4 focus:ring-[#ff5722]/10 rounded-xl py-2.5 px-4 ${language === 'ar' ? 'pr-11 pl-4' : 'pl-11 pr-4'} transition-all outline-none border text-[13px] text-slate-700 font-medium placeholder:text-slate-400 ${touched.phone && errors.phone ? '!border-red-300 !ring-red-500/10' : ''}`}
                            placeholder={t('phone_placeholder')}
                            value={formData.phone}
                            onChange={handleChange}
                            onBlur={handleBlur}
                            required
                          />
                        </div>
                      </div>
                  </div>
                </>
              )}

              {/* Influencer Specific Fields */}
              {formData.role === 'INFLUENCER' && step === 2 && (
                <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden px-2 -mx-2"
                >
                    <div className="py-2 border-t border-slate-100 mt-2 pt-4 space-y-4 px-2">
                        <label className={`block text-xs font-bold text-slate-700 ${language === 'ar' ? 'mr-1' : 'ml-1'} -mx-2`}>{t('social_media_section_title')} <span className="text-[#ff5722]">*</span></label>
                        <div className="flex flex-wrap gap-3 py-2">
                            <button type="button" onClick={() => setActiveSocial('instagram')} className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-300 ${activeSocial === 'instagram' || formData.instagramUsername ? 'bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 text-white shadow-md' : 'bg-[#f8f9fa] text-slate-400 hover:bg-slate-200'} ${activeSocial === 'instagram' ? 'ring-4 ring-offset-2 ring-pink-500/40 scale-105' : ''}`}><FaInstagram className="w-4 h-4" /></button>
                            <button type="button" onClick={() => setActiveSocial('tiktok')} className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-300 ${activeSocial === 'tiktok' || formData.tiktokUsername ? 'bg-black text-white shadow-md' : 'bg-[#f8f9fa] text-slate-400 hover:bg-slate-200'} ${activeSocial === 'tiktok' ? 'ring-4 ring-offset-2 ring-black/30 scale-105' : ''}`}><FaTiktok className="w-4 h-4" /></button>
                            <button type="button" onClick={() => setActiveSocial('facebook')} className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-300 ${activeSocial === 'facebook' || formData.facebookUsername ? 'bg-[#1877F2] text-white shadow-md' : 'bg-[#f8f9fa] text-slate-400 hover:bg-slate-200'} ${activeSocial === 'facebook' ? 'ring-4 ring-offset-2 ring-[#1877F2]/40 scale-105' : ''}`}><FaFacebook className="w-4 h-4" /></button>
                            <button type="button" onClick={() => setActiveSocial('youtube')} className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-300 ${activeSocial === 'youtube' || formData.youtubeUsername ? 'bg-[#FF0000] text-white shadow-md' : 'bg-[#f8f9fa] text-slate-400 hover:bg-slate-200'} ${activeSocial === 'youtube' ? 'ring-4 ring-offset-2 ring-[#FF0000]/40 scale-105' : ''}`}><FaYoutube className="w-4 h-4" /></button>
                            <button type="button" onClick={() => setActiveSocial('snapchat')} className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-300 ${activeSocial === 'snapchat' || formData.snapchatUsername ? 'bg-[#FFFC00] text-black shadow-md' : 'bg-[#f8f9fa] text-slate-400 hover:bg-slate-200'} ${activeSocial === 'snapchat' ? 'ring-4 ring-offset-2 ring-[#FFFC00]/60 scale-105' : ''}`}><FaSnapchatGhost className="w-4 h-4" /></button>
                        </div>
 
                        <div className="space-y-4 pt-4">
                            {activeSocial === 'instagram' && (
                                <div className="space-y-3">
                                    <div className="relative">
                                        <span className={`absolute inset-y-0 ${language === 'ar' ? 'right-0 pr-4' : 'left-0 pl-4'} flex items-center text-slate-400 font-bold`}>@</span>
                                        <input type="text" name="instagramUsername" className={`w-full bg-[#f8f9fa] rounded-xl py-2.5 px-4 ${language === 'ar' ? 'pr-10 pl-12' : 'pl-10 pr-12'} border border-transparent focus:bg-white focus:border-pink-500 focus:ring-4 focus:ring-pink-500/10 outline-none transition-all text-[13px] font-medium placeholder:text-slate-400 text-slate-700`} placeholder={t('instagram_username_placeholder')} value={formData.instagramUsername} onChange={handleChange} onBlur={handleBlur} />
                                        <button type="button" onClick={() => toggleUrlInput('instagram')} className={`absolute inset-y-0 ${language === 'ar' ? 'left-0 pl-4' : 'right-0 pr-4'} flex items-center transition-colors ${showUrlInputs['instagram'] ? 'text-pink-500' : 'text-slate-400 hover:text-slate-600'}`}>
                                            <LinkIcon size={20} />
                                        </button>
                                    </div>
                                    {touched.instagramUsername && errors.instagramUsername && (
                                        <p className="text-red-500 text-[10px] font-bold mt-1">{t(errors.instagramUsername)}</p>
                                    )}
                                    {showUrlInputs['instagram'] && (
                                        <div className="relative">
                                            <span className={`absolute inset-y-0 ${language === 'ar' ? 'right-0 pr-4' : 'left-0 pl-4'} flex items-center text-slate-400`}>
                                                <LinkIcon size={16} />
                                            </span>
                                            <input type="url" name="instagramUrl" className={`w-full bg-[#f8f9fa] rounded-xl py-2.5 px-4 ${language === 'ar' ? 'pr-10 pl-4' : 'pl-10 pr-4'} border border-transparent focus:bg-white focus:border-pink-500 focus:ring-4 focus:ring-pink-500/10 outline-none transition-all text-[13px] font-medium placeholder:text-slate-400 text-slate-700`} placeholder="https://instagram.com/..." value={formData.instagramUrl} onChange={handleChange} />
                                        </div>
                                    )}
                                </div>
                            )}
                            {activeSocial === 'tiktok' && (
                                <div className="space-y-3">
                                    <div className="relative">
                                        <span className={`absolute inset-y-0 ${language === 'ar' ? 'right-0 pr-4' : 'left-0 pl-4'} flex items-center text-slate-400 font-bold`}>@</span>
                                        <input type="text" name="tiktokUsername" className={`w-full bg-[#f8f9fa] rounded-xl py-2.5 px-4 ${language === 'ar' ? 'pr-10 pl-12' : 'pl-10 pr-12'} border border-transparent focus:bg-white focus:border-black focus:ring-4 focus:ring-black/5 outline-none transition-all text-[13px] font-medium placeholder:text-slate-400 text-slate-700`} placeholder={t('tiktok_username_placeholder')} value={formData.tiktokUsername} onChange={handleChange} onBlur={handleBlur} />
                                        <button type="button" onClick={() => toggleUrlInput('tiktok')} className={`absolute inset-y-0 ${language === 'ar' ? 'left-0 pl-4' : 'right-0 pr-4'} flex items-center transition-colors ${showUrlInputs['tiktok'] ? 'text-black' : 'text-slate-400 hover:text-slate-600'}`}>
                                            <LinkIcon size={20} />
                                        </button>
                                    </div>
                                    {touched.tiktokUsername && errors.tiktokUsername && (
                                        <p className="text-red-500 text-[10px] font-bold mt-1">{t(errors.tiktokUsername)}</p>
                                    )}
                                    {showUrlInputs['tiktok'] && (
                                        <div className="relative">
                                            <span className={`absolute inset-y-0 ${language === 'ar' ? 'right-0 pr-4' : 'left-0 pl-4'} flex items-center text-slate-400`}>
                                                <LinkIcon size={16} />
                                            </span>
                                            <input type="url" name="tiktokUrl" className={`w-full bg-[#f8f9fa] rounded-xl py-2.5 px-4 ${language === 'ar' ? 'pr-10 pl-4' : 'pl-10 pr-4'} border border-transparent focus:bg-white focus:border-black focus:ring-4 focus:ring-black/5 outline-none transition-all text-[13px] font-medium placeholder:text-slate-400 text-slate-700`} placeholder="https://tiktok.com/@..." value={formData.tiktokUrl} onChange={handleChange} />
                                        </div>
                                    )}
                                </div>
                            )}
                            {activeSocial === 'facebook' && (
                                <div className="space-y-3">
                                    <div className="relative">
                                        <span className={`absolute inset-y-0 ${language === 'ar' ? 'right-0 pr-4' : 'left-0 pl-4'} flex items-center text-slate-400 font-bold`}>@</span>
                                        <input type="text" name="facebookUsername" className={`w-full bg-[#f8f9fa] rounded-xl py-2.5 px-4 ${language === 'ar' ? 'pr-10 pl-12' : 'pl-10 pr-12'} border border-transparent focus:bg-white focus:border-[#1877F2] focus:ring-4 focus:ring-[#1877F2]/10 outline-none transition-all text-[13px] font-medium placeholder:text-slate-400 text-slate-700`} placeholder={t('facebook_username_placeholder')} value={formData.facebookUsername} onChange={handleChange} onBlur={handleBlur} />
                                        <button type="button" onClick={() => toggleUrlInput('facebook')} className={`absolute inset-y-0 ${language === 'ar' ? 'left-0 pl-4' : 'right-0 pr-4'} flex items-center transition-colors ${showUrlInputs['facebook'] ? 'text-[#1877F2]' : 'text-slate-400 hover:text-slate-600'}`}>
                                            <LinkIcon size={20} />
                                        </button>
                                    </div>
                                    {touched.facebookUsername && errors.facebookUsername && (
                                        <p className="text-red-500 text-[10px] font-bold mt-1">{t(errors.facebookUsername)}</p>
                                    )}
                                    {showUrlInputs['facebook'] && (
                                        <div className="relative">
                                            <span className={`absolute inset-y-0 ${language === 'ar' ? 'right-0 pr-4' : 'left-0 pl-4'} flex items-center text-slate-400`}>
                                                <LinkIcon size={16} />
                                            </span>
                                            <input type="url" name="facebookUrl" className={`w-full bg-[#f8f9fa] rounded-xl py-2.5 px-4 ${language === 'ar' ? 'pr-10 pl-4' : 'pl-10 pr-4'} border border-transparent focus:bg-white focus:border-[#1877F2] focus:ring-4 focus:ring-[#1877F2]/10 outline-none transition-all text-[13px] font-medium placeholder:text-slate-400 text-slate-700`} placeholder="https://facebook.com/..." value={formData.facebookUrl} onChange={handleChange} />
                                        </div>
                                    )}
                                </div>
                            )}
 
                            {activeSocial === 'youtube' && (
                                <div className="space-y-3">
                                    <div className="relative">
                                        <span className={`absolute inset-y-0 ${language === 'ar' ? 'right-0 pr-4' : 'left-0 pl-4'} flex items-center text-slate-400 font-bold`}>@</span>
                                        <input type="text" name="youtubeUsername" className={`w-full bg-[#f8f9fa] rounded-xl py-2.5 px-4 ${language === 'ar' ? 'pr-10 pl-12' : 'pl-10 pr-12'} border border-transparent focus:bg-white focus:border-[#FF0000] focus:ring-4 focus:ring-[#FF0000]/10 outline-none transition-all text-[13px] font-medium placeholder:text-slate-400 text-slate-700`} placeholder={t('youtube_username_placeholder')} value={formData.youtubeUsername} onChange={handleChange} onBlur={handleBlur} />
                                        <button type="button" onClick={() => toggleUrlInput('youtube')} className={`absolute inset-y-0 ${language === 'ar' ? 'left-0 pl-4' : 'right-0 pr-4'} flex items-center transition-colors ${showUrlInputs['youtube'] ? 'text-[#FF0000]' : 'text-slate-400 hover:text-slate-600'}`}>
                                            <LinkIcon size={20} />
                                        </button>
                                    </div>
                                    {touched.youtubeUsername && errors.youtubeUsername && (
                                        <p className="text-red-500 text-[10px] font-bold mt-1">{t(errors.youtubeUsername)}</p>
                                    )}
                                    {showUrlInputs['youtube'] && (
                                        <div className="relative">
                                            <span className={`absolute inset-y-0 ${language === 'ar' ? 'right-0 pr-4' : 'left-0 pl-4'} flex items-center text-slate-400`}>
                                                <LinkIcon size={16} />
                                            </span>
                                            <input type="url" name="youtubeUrl" className={`w-full bg-[#f8f9fa] rounded-xl py-2.5 px-4 ${language === 'ar' ? 'pr-10 pl-4' : 'pl-10 pr-4'} border border-transparent focus:bg-white focus:border-[#FF0000] focus:ring-4 focus:ring-[#FF0000]/10 outline-none transition-all text-[13px] font-medium placeholder:text-slate-400 text-slate-700`} placeholder="https://youtube.com/@..." value={formData.youtubeUrl} onChange={handleChange} />
                                        </div>
                                    )}
                                </div>
                            )}
                            {activeSocial === 'snapchat' && (
                                <div className="space-y-3">
                                    <div className="relative">
                                        <span className={`absolute inset-y-0 ${language === 'ar' ? 'right-0 pr-4' : 'left-0 pl-4'} flex items-center text-slate-400 font-bold`}>@</span>
                                        <input type="text" name="snapchatUsername" className={`w-full bg-[#f8f9fa] rounded-xl py-2.5 px-4 ${language === 'ar' ? 'pr-10 pl-12' : 'pl-10 pr-12'} border border-transparent focus:bg-white focus:border-[#FFFC00] focus:ring-4 focus:ring-[#FFFC00]/20 outline-none transition-all text-[13px] font-medium placeholder:text-slate-400 text-slate-700`} placeholder={t('snapchat_username_placeholder')} value={formData.snapchatUsername} onChange={handleChange} onBlur={handleBlur} />
                                        <button type="button" onClick={() => toggleUrlInput('snapchat')} className={`absolute inset-y-0 ${language === 'ar' ? 'left-0 pl-4' : 'right-0 pr-4'} flex items-center transition-colors ${showUrlInputs['snapchat'] ? 'text-[#d6d400]' : 'text-slate-400 hover:text-slate-600'}`}>
                                            <LinkIcon size={20} />
                                        </button>
                                    </div>
                                    {touched.snapchatUsername && errors.snapchatUsername && (
                                        <p className="text-red-500 text-[10px] font-bold mt-1">{t(errors.snapchatUsername)}</p>
                                    )}
                                    {showUrlInputs['snapchat'] && (
                                        <div className="relative">
                                            <span className={`absolute inset-y-0 ${language === 'ar' ? 'right-0 pr-4' : 'left-0 pl-4'} flex items-center text-slate-400`}>
                                                <LinkIcon size={16} />
                                            </span>
                                            <input type="url" name="snapchatUrl" className={`w-full bg-[#f8f9fa] rounded-xl py-2.5 px-4 ${language === 'ar' ? 'pr-10 pl-4' : 'pl-10 pr-4'} border border-transparent focus:bg-white focus:border-[#FFFC00] focus:ring-4 focus:ring-[#FFFC00]/20 outline-none transition-all text-[13px] font-medium placeholder:text-slate-400 text-slate-700`} placeholder="https://snapchat.com/add/..." value={formData.snapchatUrl} onChange={handleChange} />
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                        </div>
                </motion.div>
              )}

              {/* Influencer Specific Onboarding Questionnaire Step 3 */}
              {formData.role === 'INFLUENCER' && step === 3 && (
                <motion.div 
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-4 px-1"
                >
                    <div className="py-2 mt-2 pt-4 space-y-4 px-2">
                        <div className="text-center mb-1">
                            <h3 className="text-xs font-black text-[#2e315e] uppercase tracking-widest flex items-center justify-center gap-1.5">
                              <Sparkles className="w-3.5 h-3.5 text-[#ff5722] animate-pulse" />
                              {language === 'ar' ? 'معلومات صانع المحتوى' : language === 'fr' ? 'Informations Créateur' : 'Creator Information'}
                            </h3>
                            <p className="text-[9px] text-slate-400 font-bold mt-1">
                              {language === 'ar' ? 'ساعدنا في فهم احتياجاتك لتسريع معالجة حسابك' : language === 'fr' ? 'Aidez-nous à comprendre vos besoins pour accélérer le traitement' : 'Help us understand your needs to accelerate approval'}
                            </p>
                        </div>

                        <div className="space-y-4 max-h-[50vh] overflow-y-auto px-1 py-1 custom-scrollbar">
                            {/* Question 1: followersCount */}
                            <div className="bg-slate-50/40 border border-slate-100/80 p-3.5 rounded-2xl space-y-2.5 transition-all hover:bg-white hover:border-[#ff5722]/20 hover:shadow-[0_4px_20px_rgba(0,0,0,0.02)]">
                              <div>
                                <label className={`block text-[11px] font-extrabold text-slate-700 tracking-wide flex items-center gap-2 ${language === 'ar' ? 'text-right justify-start' : 'text-left justify-start'}`}>
                                  <span className="w-1.5 h-1.5 rounded-full bg-[#ff5722] flex-shrink-0" />
                                  <span>{language === 'ar' ? 'كم عدد المتابعين لديك في حسابك الرئيسي؟' : language === 'fr' ? "Combien d'abonnés avez-vous sur votre compte principal ?" : 'How many followers do you have on your main account?'}</span>
                                </label>
                                <p className={`text-[9px] font-bold text-[#ff5722]/80 mt-1 px-3 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
                                  * {language === 'ar' ? 'عذراً، لا نقبل الحسابات التي يقل عدد متابعيها عن 5,000' : language === 'fr' ? 'Nous n\'acceptons pas les comptes avec moins de 5 000 abonnés' : 'We do not accept accounts with less than 5,000 followers'}
                                </p>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                {[
                                  { key: '5k_50k', ar: '5,000 - 50,000 متابع', fr: '5k - 50k abonnés', en: '5k - 50k followers' },
                                  { key: '50k_100k', ar: '50,000 - 100,000 متابع', fr: '50k - 100k abonnés', en: '50k - 100k followers' },
                                  { key: '100k_500k', ar: '100,000 - 500,000 متابع', fr: '100k - 500k abonnés', en: '100k - 500k followers' },
                                  { key: '1m_plus', ar: 'أكثر من مليون متابع', fr: 'Plus de 1M abonnés', en: 'More than 1M followers' }
                                ].map((item) => {
                                  const label = language === 'ar' ? item.ar : language === 'fr' ? item.fr : item.en;
                                  return (
                                    <button
                                      key={item.key}
                                      type="button"
                                      onClick={() => setFormData({ ...formData, followersCount: item.key })}
                                      className={`py-2 px-2 rounded-xl border text-[10px] font-extrabold text-center transition-all duration-200 active:scale-[0.98] ${
                                        formData.followersCount === item.key
                                          ? 'border-[#ff5722] bg-[#ff5722]/5 text-[#ff5722] shadow-sm font-black'
                                          : 'border-slate-100 bg-[#f8f9fa] text-slate-500 hover:border-slate-200 hover:bg-slate-100/50'
                                      }`}
                                    >
                                      {label}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Question 2: contentType (multiple selection) */}
                            <div className="bg-slate-50/40 border border-slate-100/80 p-3.5 rounded-2xl space-y-2.5 transition-all hover:bg-white hover:border-[#ff5722]/20 hover:shadow-[0_4px_20px_rgba(0,0,0,0.02)]">
                              <label className={`block text-[11px] font-extrabold text-slate-700 tracking-wide flex items-center gap-2 ${language === 'ar' ? 'text-right justify-start' : 'text-left justify-start'}`}>
                                <span className="w-1.5 h-1.5 rounded-full bg-[#ff5722] flex-shrink-0" />
                                <span>{language === 'ar' ? 'ما هو نوع المحتوى الذي تقدمه لجمهورك؟ (اختر كل ما ينطبق)' : language === 'fr' ? "Quel type de contenu proposez-vous à votre audience ? (Plusieurs choix possibles)" : 'What type of content do you offer? (Select all that apply)'}</span>
                              </label>
                              <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
                                {[
                                  { key: 'comedy', ar: 'كوميديا وترفيه (Comedy & Entertainment)', fr: 'Humour & Divertissement', en: 'Comedy & Entertainment' },
                                  { key: 'lifestyle', ar: 'لايف ستايل ويوميات (Lifestyle & Vlogs)', fr: 'Style de vie & Vlogs', en: 'Lifestyle & Vlogs' },
                                  { key: 'beauty', ar: 'الجمال والموضة (Beauty & Fashion)', fr: 'Beauté & Mode', en: 'Beauty & Fashion' },
                                  { key: 'health', ar: 'الصحة والرياضة (Health & Fitness)', fr: 'Santé & Sport', en: 'Health & Fitness' },
                                  { key: 'tech', ar: 'تقنية ومعلومات (Tech & Education)', fr: 'Tech & Éducation', en: 'Tech & Education' },
                                  { key: 'other', ar: 'أخرى (Other)', fr: 'Autre', en: 'Other' },
                                ].map((item) => {
                                  const isChecked = formData.contentType.includes(item.key);
                                  const label = language === 'ar' ? item.ar : language === 'fr' ? item.fr : item.en;
                                  return (
                                    <label
                                      key={item.key}
                                      className={`flex items-center gap-2 cursor-pointer group ${language === 'ar' ? 'flex-row-reverse text-right' : ''}`}
                                      onClick={() => {
                                        const newTypes = isChecked
                                          ? formData.contentType.filter(x => x !== item.key)
                                          : [...formData.contentType, item.key];
                                        setFormData({ ...formData, contentType: newTypes });
                                      }}
                                    >
                                      <div className={`w-4.5 h-4.5 min-w-[18px] min-h-[18px] rounded border-2 flex items-center justify-center transition-all duration-200 ${
                                        isChecked
                                          ? 'bg-[#ff5722] border-[#ff5722] text-white shadow-sm'
                                          : 'bg-white border-slate-300 group-hover:border-slate-400'
                                      }`}>
                                        {isChecked && (
                                          <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                          </svg>
                                        )}
                                      </div>
                                      <span className={`text-[9px] font-semibold leading-tight ${isChecked ? 'text-slate-800' : 'text-slate-600'}`}>
                                        {label}
                                      </span>
                                    </label>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Question 3: hasPriorExperience */}
                            <div className="bg-slate-50/40 border border-slate-100/80 p-3.5 rounded-2xl space-y-2.5 transition-all hover:bg-white hover:border-[#ff5722]/20 hover:shadow-[0_4px_20px_rgba(0,0,0,0.02)]">
                              <label className={`block text-[11px] font-extrabold text-slate-700 tracking-wide flex items-center gap-2 ${language === 'ar' ? 'text-right justify-start' : 'text-left justify-start'}`}>
                                <span className="w-1.5 h-1.5 rounded-full bg-[#ff5722] flex-shrink-0" />
                                <span>{language === 'ar' ? 'هل سبق لك الترويج لمنتجات أو خدمة او العمل كمسوق بالعمولة من قبل؟' : language === 'fr' ? 'Avez-vous déjà promu des produits/services ou travaillé comme affilié ?' : 'Have you ever promoted products/services or worked as an affiliate?'}</span>
                              </label>
                              <div className="grid grid-cols-2 gap-2">
                                {[
                                  { key: 'YES', ar: 'نعم، لدي خبرة سابقة', fr: 'Oui, j\'ai de l\'expérience', en: 'Yes, I have experience' },
                                  { key: 'NO', ar: 'لا، هذه أول مرة سأبيع فيها منتجات عبر حسابي', fr: 'Non, c\'est ma première fois', en: 'No, this is my first time' }
                                ].map((item) => {
                                  const label = language === 'ar' ? item.ar : language === 'fr' ? item.fr : item.en;
                                  return (
                                    <button
                                      key={item.key}
                                      type="button"
                                      onClick={() => setFormData({ ...formData, hasPriorExperience: item.key })}
                                      className={`py-2 px-2 rounded-xl border text-[10px] font-extrabold text-center transition-all duration-200 active:scale-[0.98] ${
                                        formData.hasPriorExperience === item.key
                                          ? 'border-[#ff5722] bg-[#ff5722]/5 text-[#ff5722] shadow-sm font-black'
                                          : 'border-slate-100 bg-[#f8f9fa] text-slate-500 hover:border-slate-200 hover:bg-slate-100/50'
                                      }`}
                                    >
                                      {label}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Question 4: desiredProductTypes */}
                            <div className="bg-slate-50/40 border border-slate-100/80 p-3.5 rounded-2xl space-y-2.5 transition-all hover:bg-white hover:border-[#ff5722]/20 hover:shadow-[0_4px_20px_rgba(0,0,0,0.02)]">
                              <label className={`block text-[11px] font-extrabold text-slate-700 tracking-wide flex items-center gap-2 ${language === 'ar' ? 'text-right justify-start' : 'text-left justify-start'}`}>
                                <span className="w-1.5 h-1.5 rounded-full bg-[#ff5722] flex-shrink-0" />
                                <span>{language === 'ar' ? 'ما هو نوع المنتجات التي ترغب في إطلاق علامتك التجارية عليها؟' : language === 'fr' ? 'Sur quel type de produits souhaitez-vous lancer votre marque ?' : 'What type of products do you want to launch your brand on?'}</span>
                              </label>
                              <div className="grid grid-cols-2 gap-2">
                                {[
                                  { key: 'cosmetics', ar: 'مواد التجميل والمكملات الغذائية', fr: 'Cosmétiques & Compléments', en: 'Cosmetics & Supplements' },
                                  { key: 'other', ar: 'منتجات أخرى', fr: 'Autres produits', en: 'Other products' }
                                ].map((item) => {
                                  const label = language === 'ar' ? item.ar : language === 'fr' ? item.fr : item.en;
                                  return (
                                    <button
                                      key={item.key}
                                      type="button"
                                      onClick={() => setFormData({ ...formData, desiredProductTypes: item.key })}
                                      className={`py-2 px-2 rounded-xl border text-[10px] font-extrabold text-center transition-all duration-200 active:scale-[0.98] ${
                                        formData.desiredProductTypes === item.key
                                          ? 'border-[#ff5722] bg-[#ff5722]/5 text-[#ff5722] shadow-sm font-black'
                                          : 'border-slate-100 bg-[#f8f9fa] text-slate-500 hover:border-slate-200 hover:bg-slate-100/50'
                                      }`}
                                    >
                                      {label}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Question 5: initialBudget */}
                            <div className="bg-slate-50/40 border border-slate-100/80 p-3.5 rounded-2xl space-y-2.5 transition-all hover:bg-white hover:border-[#ff5722]/20 hover:shadow-[0_4px_20px_rgba(0,0,0,0.02)]">
                              <label className={`block text-[11px] font-extrabold text-slate-700 tracking-wide flex items-center gap-2 ${language === 'ar' ? 'text-right justify-start' : 'text-left justify-start'}`}>
                                <span className="w-1.5 h-1.5 rounded-full bg-[#ff5722] flex-shrink-0" />
                                <span>{language === 'ar' ? 'إطلاق علامتك التجارية يتطلب ميزانية أولية للسلعة، ما هي الميزانية التي خصصتها للبدء؟' : language === 'fr' ? 'Le lancement de votre marque nécessite un budget initial. Quel budget avez-vous alloué ?' : 'Launching your brand requires an initial budget. What budget have you allocated?'}</span>
                              </label>
                              <div className="grid grid-cols-2 gap-2">
                                {[
                                  { key: '1500_3000', ar: '1,500 - 3,000 درهم', fr: '1 500 - 3 000 DH', en: '1,500 - 3,000 DH' },
                                  { key: '3000_5000', ar: '3,000 - 5,000 درهم', fr: '3 000 - 5 000 DH', en: '3,000 - 5,000 DH' },
                                  { key: '5000_10000', ar: '5,000 - 10,000 درهم', fr: '5 000 - 10 000 DH', en: '5,000 - 10,000 DH' },
                                  { key: '10000_plus', ar: 'أكثر من 10,000 درهم', fr: 'Plus de 10 000 DH', en: 'More than 10,000 DH' }
                                ].map((item) => {
                                  const label = language === 'ar' ? item.ar : language === 'fr' ? item.fr : item.en;
                                  return (
                                    <button
                                      key={item.key}
                                      type="button"
                                      onClick={() => setFormData({ ...formData, initialBudget: item.key })}
                                      className={`py-2 px-2 rounded-xl border text-[10px] font-extrabold text-center transition-all duration-200 active:scale-[0.98] ${
                                        formData.initialBudget === item.key
                                          ? 'border-[#ff5722] bg-[#ff5722]/5 text-[#ff5722] shadow-sm font-black'
                                          : 'border-slate-100 bg-[#f8f9fa] text-slate-500 hover:border-slate-200 hover:bg-slate-100/50'
                                      }`}
                                    >
                                      {label}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Question 6: motivation */}
                            <div className="bg-slate-50/40 border border-slate-100/80 p-3.5 rounded-2xl space-y-2 transition-all hover:bg-white hover:border-[#ff5722]/20 hover:shadow-[0_4px_20px_rgba(0,0,0,0.02)]">
                              <label className={`block text-[11px] font-extrabold text-slate-700 tracking-wide flex items-center gap-2 ${language === 'ar' ? 'text-right justify-start' : 'text-left justify-start'}`}>
                                <span className="w-1.5 h-1.5 rounded-full bg-[#ff5722] flex-shrink-0" />
                                <span>{language === 'ar' ? 'لماذا قررت إنشاء علامة تجارية خاصة بك ؟' : language === 'fr' ? 'Pourquoi avez-vous décidé de créer votre propre marque ?' : 'Why did you decide to create your own brand?'}</span>
                              </label>
                              <span className="block text-[9px] text-slate-400 font-bold -mt-1.5 text-slate-500">
                                {language === 'ar' ? 'نريد أن نعرف طموحك وجديتك في بناء مشروعك الخاص' : language === 'fr' ? 'Nous voulons connaître votre ambition et votre sérieux' : 'We want to know your ambition and dedication'}
                              </span>
                              <textarea
                                rows={2}
                                value={formData.motivation}
                                onChange={(e) => setFormData({ ...formData, motivation: e.target.value })}
                                className={`w-full bg-[#f8f9fa] focus:bg-white border focus:border-[#ff5722] focus:ring-4 focus:ring-[#ff5722]/10 rounded-xl py-2 px-3 outline-none text-[11px] text-slate-700 font-medium resize-none border-slate-150 transition-all duration-200 ${language === 'ar' ? 'text-right' : 'text-left'}`}
                                placeholder={language === 'ar' ? 'اكتب طموحك هنا...' : language === 'fr' ? 'Écrivez votre ambition ici...' : 'Write your motivation here...'}
                              />
                            </div>
                        </div>
                    </div>
                </motion.div>
              )}

              {/* Seller Onboarding Questionnaire Step 2 */}
              {formData.role === 'VENDOR' && step === 2 && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4 px-1"
                >
                  <div className="text-center mb-1">
                    <h3 className="text-xs font-black text-[#2e315e] uppercase tracking-widest flex items-center justify-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-[#ff5722] animate-pulse" />
                      {language === 'ar' ? 'معلومات النشاط التجاري' : language === 'fr' ? 'Informations Commerciales' : 'Business Information'}
                    </h3>
                    <p className="text-[9px] text-slate-400 font-bold mt-1">
                      {language === 'ar' ? 'ساعدنا في فهم احتياجاتك لتسريع معالجة حسابك' : language === 'fr' ? 'Aidez-nous à comprendre vos besoins pour accélérer le traitement' : 'Help us understand your needs to accelerate approval'}
                    </p>
                  </div>

                  <div className="space-y-4 max-h-[50vh] overflow-y-auto px-3.5 py-1.5 -mx-3.5 custom-scrollbar">
                    {/* Question 1: sellingOnline */}
                    <div className="bg-slate-50/40 border border-slate-100/80 p-3.5 rounded-2xl space-y-2.5 transition-all hover:bg-white hover:border-[#ff5722]/20 hover:shadow-[0_4px_20px_rgba(0,0,0,0.02)]">
                      <label className={`block text-[11px] font-extrabold text-slate-700 tracking-wide flex items-center gap-2 ${language === 'ar' ? 'text-right justify-start' : 'text-left justify-start'}`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-[#ff5722] flex-shrink-0" />
                        <span>{language === 'ar' ? 'هل تبيع عبر الإنترنت؟' : language === 'fr' ? 'Vendez-vous en ligne ?' : 'Do you sell online?'}</span>
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {['Oui', 'Non'].map((opt) => {
                          const val = opt === 'Oui' ? 'YES' : 'NO';
                          const label = language === 'ar' ? (opt === 'Oui' ? 'نعم' : 'لا') : language === 'en' ? (opt === 'Oui' ? 'Yes' : 'No') : opt;
                          return (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => setFormData({ ...formData, sellingOnline: val })}
                              className={`py-2 px-3 rounded-xl border text-[11px] font-extrabold transition-all text-center duration-200 active:scale-[0.98] ${
                                formData.sellingOnline === val
                                  ? 'border-[#ff5722] bg-[#ff5722]/5 text-[#ff5722] shadow-sm font-black'
                                  : 'border-slate-100 bg-[#f8f9fa] text-slate-500 hover:border-slate-200 hover:bg-slate-100/50'
                              }`}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Question 2: budget */}
                    <div className="bg-slate-50/40 border border-slate-100/80 p-3.5 rounded-2xl space-y-2.5 transition-all hover:bg-white hover:border-[#ff5722]/20 hover:shadow-[0_4px_20px_rgba(0,0,0,0.02)]">
                      <label className={`block text-[11px] font-extrabold text-slate-700 tracking-wide flex items-center gap-2 ${language === 'ar' ? 'text-right justify-start' : 'text-left justify-start'}`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-[#ff5722] flex-shrink-0" />
                        <span>{language === 'ar' ? 'ما هي ميزانيتك لبدء هذا المشروع؟' : language === 'fr' ? 'Quel est votre budget pour démarrer ce projet ?' : 'What\'s the budget to start this project?'}</span>
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {['1,000 - 5,000 DH', '5,000 - 20,000 DH', '20,000 DH+'].map((b) => (
                          <button
                            key={b}
                            type="button"
                            onClick={() => setFormData({ ...formData, budget: b })}
                            className={`py-2 px-2.5 rounded-xl border text-[10px] font-extrabold text-center transition-all duration-200 active:scale-[0.98] ${b === '20,000 DH+' ? 'col-span-2' : ''} ${
                              formData.budget === b
                                ? 'border-[#ff5722] bg-[#ff5722]/5 text-[#ff5722] shadow-sm font-black'
                                : 'border-slate-100 bg-[#f8f9fa] text-slate-500 hover:border-slate-200 hover:bg-slate-100/50'
                            }`}
                          >
                            {b}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Question 3: ordersPerDay */}
                    <div className="bg-slate-50/40 border border-slate-100/80 p-3.5 rounded-2xl space-y-2.5 transition-all hover:bg-white hover:border-[#ff5722]/20 hover:shadow-[0_4px_20px_rgba(0,0,0,0.02)]">
                      <label className={`block text-[11px] font-extrabold text-slate-700 tracking-wide flex items-center gap-2 ${language === 'ar' ? 'text-right justify-start' : 'text-left justify-start'}`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-[#ff5722] flex-shrink-0" />
                        <span>{language === 'ar' ? 'عدد الطلبات التي سبق لك تحقيقها يومياً؟' : language === 'fr' ? 'Combien de commandes avez-vous déjà réalisées par jour ?' : 'How many orders have you fulfilled per day?'}</span>
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {['1-10', '11-50', '51-200', '200+'].map((o) => (
                          <button
                            key={o}
                            type="button"
                            onClick={() => setFormData({ ...formData, ordersPerDay: o })}
                            className={`flex-1 min-w-[55px] py-2 px-1.5 rounded-xl border text-[10px] font-extrabold text-center transition-all duration-200 active:scale-[0.98] ${
                              formData.ordersPerDay === o
                                ? 'border-[#ff5722] bg-[#ff5722]/5 text-[#ff5722] shadow-sm font-black'
                                : 'border-slate-100 bg-[#f8f9fa] text-slate-500 hover:border-slate-200 hover:bg-slate-100/50'
                            }`}
                          >
                            {o}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Question 4: experienceYears */}
                    <div className="bg-slate-50/40 border border-slate-100/80 p-3.5 rounded-2xl space-y-2.5 transition-all hover:bg-white hover:border-[#ff5722]/20 hover:shadow-[0_4px_20px_rgba(0,0,0,0.02)]">
                      <label className={`block text-[11px] font-extrabold text-slate-700 tracking-wide flex items-center gap-2 ${language === 'ar' ? 'text-right justify-start' : 'text-left justify-start'}`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-[#ff5722] flex-shrink-0" />
                        <span>{language === 'ar' ? 'كم سنوات الخبرة لديك في التجارة الالكترونية؟' : language === 'fr' ? "Combien d'années d'expérience avez-vous en e-commerce ?" : 'How many years of e-commerce experience do you have?'}</span>
                      </label>
                      <div className="grid grid-cols-2 gap-1.5">
                        {['Not yet', '< 1 year', '1-3 years', '3+ years'].map((y) => {
                          const label = language === 'ar'
                            ? (y === 'Not yet' ? 'لا توجد بعد' : y === '< 1 year' ? 'أقل من سنة' : y === '1-3 years' ? '1-3 سنوات' : 'أكثر من 3')
                            : language === 'fr'
                            ? (y === 'Not yet' ? 'Pas encore' : y === '< 1 year' ? 'Moins d\'un an' : y === '1-3 years' ? '1-3 ans' : 'Plus de 3 ans')
                            : y;
                          return (
                            <button
                              key={y}
                              type="button"
                              onClick={() => setFormData({ ...formData, experienceYears: y })}
                              className={`py-2 px-1.5 rounded-xl border text-[9px] font-extrabold text-center transition-all duration-200 active:scale-[0.98] ${
                                formData.experienceYears === y
                                  ? 'border-[#ff5722] bg-[#ff5722]/5 text-[#ff5722] shadow-sm font-black'
                                  : 'border-slate-100 bg-[#f8f9fa] text-slate-500 hover:border-slate-200 hover:bg-slate-100/50'
                              }`}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Question 5: markets */}
                    <div className="bg-slate-50/40 border border-slate-100/80 p-3.5 rounded-2xl space-y-2.5 transition-all hover:bg-white hover:border-[#ff5722]/20 hover:shadow-[0_4px_20px_rgba(0,0,0,0.02)]">
                      <label className={`block text-[11px] font-extrabold text-slate-700 tracking-wide flex items-center gap-2 ${language === 'ar' ? 'text-right justify-start' : 'text-left justify-start'}`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-[#ff5722] flex-shrink-0" />
                        <span>{language === 'ar' ? 'في أي أسواق عملت؟ (اختر كل ما ينطبق)' : language === 'fr' ? 'Dans quels marchés avez-vous travaillé ? (Sélectionnez tout ce qui s\'applique)' : 'Which markets have you worked in? (Select all that apply)'}</span>
                      </label>
                      <div className="flex flex-wrap gap-x-4 gap-y-2.5">
                        {[
                          { key: 'Morocco', en: 'Morocco', fr: 'Maroc', ar: 'المغرب' },
                          { key: 'Africa', en: 'Africa', fr: 'Afrique', ar: 'إفريقيا' },
                          { key: 'GCC', en: 'GCC (Gulf countries)', fr: 'GCC (Pays du Golfe)', ar: 'دول الخليج (GCC)' },
                          { key: 'Europe', en: 'Europe', fr: 'Europe', ar: 'أوروبا' },
                          { key: 'US', en: 'USA', fr: 'États-Unis', ar: 'الولايات المتحدة' },
                          { key: 'Other', en: 'Other', fr: 'Autre', ar: 'أخرى' },
                        ].map((item) => {
                          const isChecked = formData.markets.includes(item.key);
                          const label = language === 'ar' ? item.ar : language === 'fr' ? item.fr : item.en;
                          return (
                            <label
                              key={item.key}
                              className={`flex items-center gap-2 cursor-pointer group ${language === 'ar' ? 'flex-row-reverse' : ''}`}
                              onClick={() => {
                                const newMarkets = isChecked
                                  ? formData.markets.filter(x => x !== item.key)
                                  : [...formData.markets, item.key];
                                setFormData({ ...formData, markets: newMarkets });
                              }}
                            >
                              <div className={`w-4.5 h-4.5 min-w-[18px] min-h-[18px] rounded border-2 flex items-center justify-center transition-all duration-200 ${
                                isChecked
                                  ? 'bg-[#ff5722] border-[#ff5722] text-white shadow-sm'
                                  : 'bg-white border-slate-300 group-hover:border-slate-400'
                              }`}>
                                {isChecked && (
                                  <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                              </div>
                              <span className={`text-[10px] font-semibold leading-tight ${isChecked ? 'text-slate-800' : 'text-slate-600'}`}>
                                {label}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    {/* Question 6: totalSpend */}
                    <div className="bg-slate-50/40 border border-slate-100/80 p-3.5 rounded-2xl space-y-2.5 transition-all hover:bg-white hover:border-[#ff5722]/20 hover:shadow-[0_4px_20px_rgba(0,0,0,0.02)]">
                      <label className={`block text-[11px] font-extrabold text-slate-700 tracking-wide flex items-center gap-2 ${language === 'ar' ? 'text-right justify-start' : 'text-left justify-start'}`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-[#ff5722] flex-shrink-0" />
                        <span>{language === 'ar' ? 'كم إجمالي انفاقك في الإعلانات؟' : language === 'fr' ? 'Quel est votre total de dépenses publicitaires ?' : 'What is your total ad spend?'}</span>
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {['< 5,000 DH', '5,000 - 20,000 DH', '20,000 - 100,000 DH', '100,000 DH+'].map((ts) => (
                          <button
                            key={ts}
                            type="button"
                            onClick={() => setFormData({ ...formData, totalSpend: ts })}
                            className={`py-2 px-2.5 rounded-xl border text-[10px] font-extrabold text-center transition-all duration-200 active:scale-[0.98] ${
                              formData.totalSpend === ts
                                ? 'border-[#ff5722] bg-[#ff5722]/5 text-[#ff5722] shadow-sm font-black'
                                : 'border-slate-100 bg-[#f8f9fa] text-slate-500 hover:border-slate-200 hover:bg-slate-100/50'
                            }`}
                          >
                            {ts}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Seller Onboarding Questionnaire Step 3 */}
              {formData.role === 'VENDOR' && step === 3 && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4 px-1"
                >
                  <div className="text-center mb-1">
                    <h3 className="text-xs font-black text-[#2e315e] uppercase tracking-widest flex items-center justify-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-[#ff5722] animate-pulse" />
                      {language === 'ar' ? 'أهداف وأولويات النشاط' : language === 'fr' ? 'Objectifs & Priorités' : 'Goals & Priorities'}
                    </h3>
                    <p className="text-[9px] text-slate-400 font-bold mt-1">
                      {language === 'ar' ? 'ساعدنا في فهم احتياجاتك لتسريع معالجة حسابك' : language === 'fr' ? 'Aidez-nous à comprendre vos besoins pour accélérer le traitement' : 'Help us understand your needs to accelerate approval'}
                    </p>
                  </div>

                  <div className="space-y-4 max-h-[50vh] overflow-y-auto px-3.5 py-1.5 -mx-3.5 custom-scrollbar">
                    {/* Question 7: niches */}
                    <div className="bg-slate-50/40 border border-slate-100/80 p-3.5 rounded-2xl space-y-2.5 transition-all hover:bg-white hover:border-[#ff5722]/20 hover:shadow-[0_4px_20px_rgba(0,0,0,0.02)]">
                      <label className={`block text-[11px] font-extrabold text-slate-700 tracking-wide flex items-center gap-2 ${language === 'ar' ? 'text-right justify-start' : 'text-left justify-start'}`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-[#ff5722] flex-shrink-0" />
                        <span>{language === 'ar' ? 'المجالات المهتم بها؟' : language === 'fr' ? "Niches d'intérêt ?" : 'Niches of interest?'}</span>
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {['Beauty', 'Electronics', 'Fashion', 'Home', 'Health', 'Other'].map((n) => {
                          const label = language === 'ar'
                            ? (n === 'Beauty' ? 'التجميل' : n === 'Electronics' ? 'الإلكترونيات' : n === 'Fashion' ? 'الموضة' : n === 'Home' ? 'المنزل' : n === 'Health' ? 'الصحة' : 'أخرى')
                            : language === 'fr'
                            ? (n === 'Beauty' ? 'Beauté' : n === 'Electronics' ? 'Électronique' : n === 'Fashion' ? 'Mode' : n === 'Home' ? 'Maison' : n === 'Health' ? 'Santé' : 'Autre')
                            : n;
                          const isSelected = formData.niches.includes(n);
                          return (
                            <button
                              key={n}
                              type="button"
                              onClick={() => {
                                const newNiches = isSelected
                                  ? formData.niches.filter(x => x !== n)
                                  : [...formData.niches, n];
                                setFormData({ ...formData, niches: newNiches });
                              }}
                              className={`py-1.5 px-3 rounded-xl border text-[10px] font-extrabold text-center transition-all duration-200 active:scale-[0.98] ${
                                isSelected
                                  ? 'border-[#ff5722] bg-[#ff5722]/5 text-[#ff5722] shadow-sm font-black'
                                  : 'border-slate-100 bg-[#f8f9fa] text-slate-500 hover:border-slate-200 hover:bg-slate-100/50'
                              }`}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Question 8: biggestAchievement */}
                    <div className="bg-slate-50/40 border border-slate-100/80 p-3.5 rounded-2xl space-y-2 transition-all hover:bg-white hover:border-[#ff5722]/20 hover:shadow-[0_4px_20px_rgba(0,0,0,0.02)]">
                      <label className={`block text-[11px] font-extrabold text-slate-700 tracking-wide flex items-center gap-2 ${language === 'ar' ? 'text-right justify-start' : 'text-left justify-start'}`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-[#ff5722] flex-shrink-0" />
                        <span>{language === 'ar' ? 'ما هو أكبر إنجاز لك في التجارة الإلكترونية؟' : language === 'fr' ? 'Votre plus grande réussite en e-commerce ?' : 'What is your biggest eCommerce/affiliate achievement?'}</span>
                      </label>
                      <select
                        value={formData.biggestAchievement}
                        onChange={(e) => setFormData({ ...formData, biggestAchievement: e.target.value })}
                        className={`w-full bg-[#f8f9fa] focus:bg-white border focus:border-[#ff5722] focus:ring-4 focus:ring-[#ff5722]/10 rounded-xl py-2.5 px-3 outline-none text-[11px] text-slate-700 font-medium border-slate-150 transition-all duration-200 appearance-none cursor-pointer ${language === 'ar' ? 'text-right' : 'text-left'} ${!formData.biggestAchievement ? 'text-slate-400' : 'text-slate-700'}`}
                        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: language === 'ar' ? 'left 12px center' : 'right 12px center', paddingRight: language === 'ar' ? '12px' : '32px', paddingLeft: language === 'ar' ? '32px' : '12px' }}
                      >
                        <option value="">{language === 'ar' ? 'اختر خياراً' : language === 'fr' ? 'Sélectionnez une option' : 'Select an option'}</option>
                        <option value="10k+ sales">{language === 'ar' ? 'تحقيق مبيعات +10k$' : language === 'fr' ? 'Généré +10k$ de CA' : 'Generated $10k+ in sales'}</option>
                        <option value="loyal_customers">{language === 'ar' ? 'بناء قاعدة عملاء وفية' : language === 'fr' ? 'Construit une base clients fidèle' : 'Built a loyal customer base'}</option>
                        <option value="multiple_markets">{language === 'ar' ? 'التوسع في أسواق متعددة' : language === 'fr' ? 'Expansion sur plusieurs marchés' : 'Scaled to multiple markets'}</option>
                        <option value="product_line">{language === 'ar' ? 'إطلاق خط منتجات ناجح' : language === 'fr' ? 'Lancé une gamme de produits réussie' : 'Launched a successful product line'}</option>
                        <option value="brand_building">{language === 'ar' ? 'بناء علامة تجارية قوية' : language === 'fr' ? 'Construit une marque forte' : 'Built a strong brand'}</option>
                        <option value="none_yet">{language === 'ar' ? 'لا يوجد بعد' : language === 'fr' ? 'Pas encore' : 'None yet'}</option>
                      </select>
                    </div>

                    {/* Question 9: biggestChallenge */}
                    <div className="bg-slate-50/40 border border-slate-100/80 p-3.5 rounded-2xl space-y-2 transition-all hover:bg-white hover:border-[#ff5722]/20 hover:shadow-[0_4px_20px_rgba(0,0,0,0.02)]">
                      <label className={`block text-[11px] font-extrabold text-slate-700 tracking-wide flex items-center gap-2 ${language === 'ar' ? 'text-right justify-start' : 'text-left justify-start'}`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-[#ff5722] flex-shrink-0" />
                        <span>{language === 'ar' ? 'ما هو أكبر تحدٍّ يواجهك حالياً؟' : language === 'fr' ? 'Votre plus grand défi en e-commerce ?' : 'What is your biggest challenge in eCommerce/affiliate?'}</span>
                      </label>
                      <select
                        value={formData.biggestChallenge}
                        onChange={(e) => setFormData({ ...formData, biggestChallenge: e.target.value })}
                        className={`w-full bg-[#f8f9fa] focus:bg-white border focus:border-[#ff5722] focus:ring-4 focus:ring-[#ff5722]/10 rounded-xl py-2.5 px-3 outline-none text-[11px] text-slate-700 font-medium border-slate-150 transition-all duration-200 appearance-none cursor-pointer ${language === 'ar' ? 'text-right' : 'text-left'} ${!formData.biggestChallenge ? 'text-slate-400' : 'text-slate-700'}`}
                        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: language === 'ar' ? 'left 12px center' : 'right 12px center', paddingRight: language === 'ar' ? '12px' : '32px', paddingLeft: language === 'ar' ? '32px' : '12px' }}
                      >
                        <option value="">{language === 'ar' ? 'اختر خياراً' : language === 'fr' ? 'Sélectionnez une option' : 'Select an option'}</option>
                        <option value="finding_suppliers">{language === 'ar' ? 'العثور على موردين موثوقين' : language === 'fr' ? 'Trouver des fournisseurs fiables' : 'Finding reliable suppliers'}</option>
                        <option value="inventory">{language === 'ar' ? 'إدارة المخزون' : language === 'fr' ? 'Gestion des stocks' : 'Managing inventory/stock'}</option>
                        <option value="marketing">{language === 'ar' ? 'التسويق والإعلانات' : language === 'fr' ? 'Marketing & publicité' : 'Marketing & advertising'}</option>
                        <option value="shipping">{language === 'ar' ? 'الشحن واللوجستيك' : language === 'fr' ? 'Expédition & logistique' : 'Shipping & logistics'}</option>
                        <option value="customer_service">{language === 'ar' ? 'خدمة العملاء' : language === 'fr' ? 'Service client' : 'Customer service'}</option>
                        <option value="competition">{language === 'ar' ? 'المنافسة الشديدة' : language === 'fr' ? 'Concurrence intense' : 'High competition'}</option>
                        <option value="cashflow">{language === 'ar' ? 'التدفق النقدي' : language === 'fr' ? 'Trésorerie' : 'Cash flow'}</option>
                      </select>
                    </div>

                    {/* Question 10: partnerPriorities */}
                    <div className="bg-slate-50/40 border border-slate-100/80 p-3.5 rounded-2xl space-y-2.5 transition-all hover:bg-white hover:border-[#ff5722]/20 hover:shadow-[0_4px_20px_rgba(0,0,0,0.02)]">
                      <label className={`block text-[11px] font-extrabold text-slate-700 tracking-wide flex items-center gap-2 ${language === 'ar' ? 'text-right justify-start' : 'text-left justify-start'}`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-[#ff5722] flex-shrink-0" />
                        <span>{language === 'ar' ? 'ما الذي تبحث عنه في شريك/منصة جديدة؟ (اختر أولوياتك)' : language === 'fr' ? 'Que recherchez-vous chez un nouveau partenaire/plateforme ? (Priorités)' : 'What are you looking for in a new partner/platform? (Pick top priorities)'}</span>
                      </label>
                      <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
                        {[
                          { key: 'more_products', en: 'More products to sell', fr: 'Plus de produits à vendre', ar: 'منتجات أكثر للبيع' },
                          { key: 'logistics', en: 'Done-for-you logistics/fulfillment', fr: 'Logistique/fulfillment clé en main', ar: 'لوجستيك جاهز' },
                          { key: 'call_center', en: 'Call center/order confirmation', fr: 'Centre d\'appel/confirmation', ar: 'مركز اتصال/تأكيد الطلبات' },
                          { key: 'fast_delivery', en: 'Faster & more reliable delivery', fr: 'Livraison plus rapide et fiable', ar: 'توصيل أسرع وموثوق' },
                          { key: 'cod', en: 'Better cash collection (COD)', fr: 'Meilleur encaissement (COD)', ar: 'تحصيل نقدي أفضل (COD)' },
                          { key: 'commissions', en: 'Higher commission rates', fr: 'Commissions plus élevées', ar: 'عمولات أعلى' },
                          { key: 'community', en: 'Community/support', fr: 'Communauté/support', ar: 'مجتمع/دعم' },
                          { key: 'automation', en: 'Automation/less manual work', fr: 'Automatisation/moins de travail manuel', ar: 'أتمتة/عمل يدوي أقل' },
                          { key: 'transparency', en: 'Transparency/reporting', fr: 'Transparence/reporting', ar: 'شفافية/تقارير' },
                          { key: 'other', en: 'Other', fr: 'Autre', ar: 'أخرى' },
                        ].map((item) => {
                          const isChecked = formData.partnerPriorities.includes(item.key);
                          const label = language === 'ar' ? item.ar : language === 'fr' ? item.fr : item.en;
                          return (
                            <label
                              key={item.key}
                              className={`flex items-center gap-2 cursor-pointer group ${language === 'ar' ? 'flex-row-reverse text-right' : ''}`}
                              onClick={() => {
                                const newPriorities = isChecked
                                  ? formData.partnerPriorities.filter(x => x !== item.key)
                                  : [...formData.partnerPriorities, item.key];
                                setFormData({ ...formData, partnerPriorities: newPriorities });
                              }}
                            >
                              <div className={`w-4.5 h-4.5 min-w-[18px] min-h-[18px] rounded border-2 flex items-center justify-center transition-all duration-200 ${
                                isChecked
                                  ? 'bg-[#ff5722] border-[#ff5722] text-white shadow-sm'
                                  : 'bg-white border-slate-300 group-hover:border-slate-400'
                              }`}>
                                {isChecked && (
                                  <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                              </div>
                              <span className={`text-[10px] font-semibold leading-tight ${isChecked ? 'text-slate-800' : 'text-slate-600'}`}>
                                {label}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>


                    {/* Question 12: additionalNotes */}
                    <div className="bg-slate-50/40 border border-slate-100/80 p-3.5 rounded-2xl space-y-2 transition-all hover:bg-white hover:border-[#ff5722]/20 hover:shadow-[0_4px_20px_rgba(0,0,0,0.02)]">
                      <label className={`block text-[11px] font-extrabold text-slate-700 tracking-wide flex items-center gap-2 ${language === 'ar' ? 'text-right justify-start' : 'text-left justify-start'}`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-[#ff5722] flex-shrink-0" />
                        <span>{language === 'ar' ? 'ملاحظات إضافية؟' : language === 'fr' ? 'Notes additionnelles ?' : 'Additional notes?'}</span>
                      </label>
                      <textarea
                        rows={2}
                        value={formData.additionalNotes}
                        onChange={(e) => setFormData({ ...formData, additionalNotes: e.target.value })}
                        className={`w-full bg-[#f8f9fa] focus:bg-white border focus:border-[#ff5722] focus:ring-4 focus:ring-[#ff5722]/10 rounded-xl py-2 px-3 outline-none text-[11px] text-slate-700 font-medium resize-none border-slate-150 transition-all duration-200 ${language === 'ar' ? 'text-right' : 'text-left'}`}
                        placeholder={language === 'ar' ? 'أي معلومات أخرى تود مشاركتها...' : language === 'fr' ? 'Toute autre information que vous souhaitez partager...' : 'Any other information you want to share...'}
                      />
                    </div>
                  </div>
                </motion.div>
              )}

              {step === 4 && (
                <div className="space-y-5 pt-2">
                    {!googleCredential && (
                      <>
                        <div className="space-y-1.5">
                          <label className={`text-sm font-bold text-slate-700 ${language === 'ar' ? 'mr-1' : 'ml-1'}`}>{t('password_label')} <span className="text-[#ff5722]">*</span></label>
                          <div className="relative group/input">
                            <div className={`absolute ${language === 'ar' ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 ${formData.password.length > 0 && isPasswordStrong ? 'text-green-500' : 'text-slate-400'}`}>
                              <Lock size={20} />
                            </div>
                            <input
                              type={showPassword ? 'text' : 'password'}
                              name="password"
                              className={`w-full bg-transparent focus:bg-transparent border focus:ring-4 rounded-xl py-2.5 px-4 ${language === 'ar' ? 'pr-12 pl-11' : 'pl-12 pr-11'} transition-all outline-none text-[13px] font-medium ${formData.password.length > 0 && isPasswordStrong ? 'border-green-500 focus:ring-green-500/10 text-green-500' : 'border-slate-200 focus:border-[#ff5722] focus:ring-[#ff5722]/10 text-slate-700'} placeholder:text-slate-400 ${touched.password && errors.password ? '!border-red-300 !ring-red-500/10 !text-red-500 placeholder:!text-red-400' : ''}`}
                              placeholder={t('password_label')}
                              value={formData.password}
                              onChange={handleChange}
                              onBlur={handleBlur}
                              required={!googleCredential}
                              minLength={8}
                            />
                            <button
                              type="button"
                              className={`absolute ${language === 'ar' ? 'left-4' : 'right-4'} top-1/2 -translate-y-1/2 transition-colors ${formData.password.length > 0 && isPasswordStrong ? 'text-green-500/60 hover:text-green-500' : 'text-slate-400 hover:text-slate-600'}`}
                              onClick={() => setShowPassword(!showPassword)}
                            >
                              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                            </button>
                          </div>
                          {touched.password && errors.password && (
                            <p className="text-red-500 text-[10px] font-bold mt-1 ml-1">{t(errors.password)}</p>
                          )}
                        </div>

                        <div className="bg-[#f8f9fa] rounded-xl p-4 mt-2">
                          <div className="flex flex-wrap items-center gap-2 text-xs font-bold mb-2">
                            <span className={hasLength ? 'text-green-500' : 'text-slate-400'}>{t('criteria_chars')}</span>
                            <span className="text-slate-200">|</span>
                            <span className={hasUppercase ? 'text-green-500' : 'text-slate-400'}>A-Z</span>
                            <span className="text-slate-200">|</span>
                            <span className={hasLowercase ? 'text-green-500' : 'text-slate-400'}>a-z</span>
                            <span className="text-slate-200">|</span>
                            <span className={hasNumber ? 'text-green-500' : 'text-slate-400'}>0-9</span>
                            <span className="text-slate-200">|</span>
                            <span className={hasSymbol ? 'text-green-500' : 'text-slate-400'}>{t('criteria_symbols')}</span>
                          </div>
                          
                          <div className={`text-xs font-bold mb-2 ${isPasswordStrong ? 'text-green-500' : (formData.password.length > 0 ? 'text-orange-500' : 'text-slate-400')}`}>
                            {isPasswordStrong ? t('password_strength_good') : (formData.password.length > 0 ? t('password_strength_weak') : ' ')}
                          </div>
                          
                          <div className="flex h-1.5 bg-slate-200 rounded-full overflow-hidden">
                            <div className={`h-full transition-all duration-300 ${isPasswordStrong ? 'bg-[#51a729]' : (formData.password.length > 0 ? 'bg-[#ff9800]' : 'bg-transparent')}`} style={{ width: `${getStrengthPercentage()}%` }}></div>
                          </div>

                          {isPasswordStrong && (
                            <div className="text-xs text-slate-600 mt-3 flex items-center gap-1">
                              {t('password_strength_desc')}
                            </div>
                          )}
                        </div>
                      </>
                    )}
 
                    {!googleCredential && (
                      <div className="space-y-1.5">
                        <label className={`text-sm font-bold text-slate-700 ${language === 'ar' ? 'mr-1' : 'ml-1'}`}>{t('repeat_password_label')} <span className="text-[#ff5722]">*</span></label>
                        <div className="relative group/input">
                          <div className={`absolute ${language === 'ar' ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 ${formData.confirmPassword.length > 0 && formData.confirmPassword === formData.password ? 'text-green-500' : 'text-slate-400'}`}>
                            <Lock size={20} />
                          </div>
                          <input
                            type={showConfirmPassword ? 'text' : 'password'}
                            name="confirmPassword"
                            className={`w-full bg-transparent focus:bg-transparent border focus:ring-4 rounded-xl py-2.5 px-4 ${language === 'ar' ? 'pr-12 pl-11' : 'pl-12 pr-11'} transition-all outline-none text-[13px] font-medium ${formData.confirmPassword.length > 0 && formData.confirmPassword === formData.password ? 'border-green-500 focus:ring-green-500/10 text-green-500' : 'border-slate-200 focus:border-[#ff5722] focus:ring-[#ff5722]/10 text-slate-700'} placeholder:text-slate-400 ${touched.confirmPassword && errors.confirmPassword ? '!border-red-300 !ring-red-500/10 !text-red-500 placeholder:!text-red-400' : ''}`}
                            placeholder={t('password_label')}
                            value={formData.confirmPassword}
                            onChange={handleChange}
                            onBlur={handleBlur}
                            required={!googleCredential}
                          />
                          <button
                            type="button"
                            className={`absolute ${language === 'ar' ? 'left-4' : 'right-4'} top-1/2 -translate-y-1/2 transition-colors ${formData.confirmPassword.length > 0 && formData.confirmPassword === formData.password ? 'text-green-500/60 hover:text-green-500' : 'text-slate-400 hover:text-slate-600'}`}
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          >
                            {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                          </button>
                        </div>
                        {touched.confirmPassword && errors.confirmPassword && (
                          <p className="text-red-500 text-[10px] font-bold mt-1 ml-1">{t(errors.confirmPassword)}</p>
                        )}
                      </div>
                    )}
                </div>
              )}

              {step === 4 && (
                <div className={`flex items-start gap-2.5 px-1 py-1 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
                  <input
                    type="checkbox"
                    id="accept-cgu"
                    checked={cguAccepted}
                    onChange={(e) => setCguAccepted(e.target.checked)}
                    className="mt-0.5 rounded border-slate-300 text-[#ff5722] focus:ring-[#ff5722]/30 w-4 h-4 cursor-pointer"
                    required
                  />
                  <label htmlFor="accept-cgu" className="text-xs text-slate-500 font-medium cursor-pointer select-none leading-relaxed">
                    {language === 'ar' ? (
                      <>
                        أوافق على <Link to="/terms" target="_blank" className="text-[#ff5722] font-bold underline hover:text-[#e64a19] transition-colors">شروط الاستخدام العامة (CGU)</Link>
                      </>
                    ) : language === 'fr' ? (
                      <>
                        J'accepte les <Link to="/terms" target="_blank" className="text-[#ff5722] font-bold underline hover:text-[#e64a19] transition-colors">Conditions Générales d'Utilisation (CGU)</Link>
                      </>
                    ) : (
                      <>
                        I accept the <Link to="/terms" target="_blank" className="text-[#ff5722] font-bold underline hover:text-[#e64a19] transition-colors">General Conditions of Use (CGU)</Link>
                      </>
                    )}
                  </label>
                </div>
              )}
 
              {step === 4 && (
                <div className="mt-6 flex flex-col items-center gap-2">
                  {/* The widget has a fixed 300px width — scale it down on narrow phones
                      so it can never overflow the card. */}
                  <div className="origin-center scale-90 sm:scale-100">
                    <Turnstile
                      key={captchaKey}
                      ref={turnstileRef}
                      siteKey={TURNSTILE_SITE_KEY}
                      onSuccess={(token) => { setTurnstileToken(token); setCaptchaStatus('ready'); }}
                      onExpire={() => { setTurnstileToken(null); setCaptchaStatus('expired'); turnstileRef.current?.reset(); }}
                      onError={() => { setTurnstileToken(null); setCaptchaStatus('error'); }}
                      options={turnstileOptions}
                    />
                  </div>

                  {captchaStatus === 'error' && (
                    <div className="text-center">
                      <p className="text-xs font-bold text-red-500">
                        {language === 'ar'
                          ? 'فشل تحميل التحقق الأمني. تحقق من اتصالك بالإنترنت.'
                          : language === 'fr'
                          ? 'Échec du chargement de la vérification. Vérifiez votre connexion.'
                          : 'Security check failed to load. Please check your connection.'}
                      </p>
                      <button
                        type="button"
                        onClick={() => { setTurnstileToken(null); setCaptchaStatus('loading'); setCaptchaKey(k => k + 1); }}
                        className="mt-1 text-xs font-black text-[#ff5722] underline hover:text-[#e64a19]"
                      >
                        {language === 'ar' ? 'إعادة المحاولة' : language === 'fr' ? 'Réessayer' : 'Retry'}
                      </button>
                    </div>
                  )}

                  {captchaStatus === 'expired' && (
                    <p className="text-xs font-bold text-amber-600">
                      {language === 'ar'
                        ? 'انتهت صلاحية التحقق، جارٍ التحديث…'
                        : language === 'fr'
                        ? 'Vérification expirée, actualisation en cours…'
                        : 'Verification expired, refreshing…'}
                    </p>
                  )}
                </div>
              )}

              <div className="pt-3 flex gap-3">
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => {
                    if (step > 1) {
                      setStep(step - 1);
                    } else {
                      setSelectionConfirmed(false);
                    }
                  }}
                  className="w-[120px] bg-slate-100 text-slate-600 font-bold py-2.5 rounded-xl hover:bg-slate-200 transition-all text-sm disabled:opacity-50"
                >
                  {t('back_btn')}
                </button>
                
                {/* Distinct keys are REQUIRED here. Without them React reuses the same
                    <button> DOM node across the ternary and only flips its `type` from
                    "button" to "submit". The browser runs a click's default activation
                    AFTER the handler, so clicking "Suivant" on step 3 landed on a node
                    that had just become type="submit" and phantom-submitted the form. */}
                {step < 4 ? (
                  <button
                    key="wizard-next"
                    type="button"
                    onClick={handleNextStep}
                    className="flex-1 bg-[#ff5722] text-white font-bold py-2.5 rounded-xl hover:bg-[#e64a19] transition-all text-sm shadow-[0_4px_14px_0_rgba(255,87,34,0.39)]"
                  >
                    {t('next_btn')}
                  </button>
                ) : (
                  <button
                    key="wizard-submit"
                    type="submit"
                    data-submit-role="create-account"
                    aria-busy={isLoading}
                    className="flex-1 bg-[#ff5722] text-white font-bold py-2.5 rounded-xl hover:bg-[#e64a19] transition-all text-sm shadow-[0_4px_14px_0_rgba(255,87,34,0.39)] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    disabled={isLoading}
                  >
                    {isLoading && (
                      <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    )}
                    {isLoading ? t('creating_account') : (formData.role === 'VENDOR' ? t('create_vendor_btn') : t('create_influencer_btn'))}
                  </button>
                )}
              </div>

              {/* Tells the user exactly what is still blocking submission, instead of
                  letting them click a button that appears to do nothing. */}
              {step === 4 && !isLoading && (!turnstileToken || !cguAccepted) && (
                <p className="text-[11px] font-bold text-slate-400 text-center pt-1">
                  {!cguAccepted
                    ? (language === 'ar' ? 'يرجى قبول شروط الاستخدام للمتابعة'
                      : language === 'fr' ? "Acceptez les CGU pour continuer"
                      : 'Accept the Terms of Use to continue')
                    : (language === 'ar' ? 'يرجى إكمال التحقق الأمني أعلاه'
                      : language === 'fr' ? 'Complétez la vérification de sécurité ci-dessus'
                      : 'Complete the security check above')}
                </p>
              )}
            </form>
            )}
          </div>
        </div>
      </div>

      {/* Right Column: Visual Area */}
      <div className="hidden lg:flex lg:w-[50%] xl:w-[55%] relative overflow-hidden bg-white items-center justify-center">
        {/* Desktop Logo */}
        <div className="absolute top-10 right-12 z-20">
          <Link to="/" dir="ltr" className="flex items-center gap-2.5 group">
            <motion.img whileHover={{ rotateY: 15, scale: 1.05 }} src="/new logo/logo filess-25.svg" alt="SILACOD" className="w-10 h-10 origin-center object-contain" />
            <img src="/new logo/logo filess-24.svg" alt="SILACOD" className="h-7 object-contain" />
          </Link>
        </div>

        {/* Dynamic Image */}
        <div className="relative w-full h-full p-12 flex items-center justify-center">
            <div className="relative w-full max-w-[600px] flex items-center justify-center">
                <AnimatePresence mode="wait">
                    <motion.img
                        key={formData.role}
                        src={currentImage}
                        initial={{ opacity: 0, scale: 1.05, filter: 'blur(10px)' }}
                        animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                        exit={{ opacity: 0, scale: 0.95, filter: 'blur(10px)' }}
                        transition={{ duration: 0.5, ease: "easeInOut" }}
                        className="w-full h-auto max-h-[80vh] object-contain"
                        alt={formData.role === 'VENDOR' ? 'Seller Preview' : 'Influencer Preview'}
                    />
                </AnimatePresence>
                
                {/* Soft premium gradient fading shadow from bottom to top */}
                <div className="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-white via-white/40 to-transparent pointer-events-none z-10" />
            </div>

            {/* Decorative background circle */}
            <motion.div 
                className="absolute inset-0 z-[-1] flex items-center justify-center pointer-events-none"
                animate={{ scale: formData.role === 'INFLUENCER' ? 1.1 : 1 }}
                transition={{ duration: 0.8 }}
            >
                <div className={`w-[600px] h-[600px] rounded-full blur-[100px] transition-colors duration-1000 ${formData.role === 'INFLUENCER' ? 'bg-[#ff5722]/10' : 'bg-[#2e315e]/10'}`}></div>
            </motion.div>
        </div>

        <AnimatePresence>
          {showCguModal && (
            <CguModal
              isOpen={showCguModal}
              onClose={() => setShowCguModal(false)}
              language={language}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}


