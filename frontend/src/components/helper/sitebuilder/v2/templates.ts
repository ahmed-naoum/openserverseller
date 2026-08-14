import { BuilderTemplate, EditorBlock, PageSettings } from './types';

export const DEMO_SHOWCASE_TEMPLATE: BuilderTemplate = {
  id: 'demo-full-showcase',
  name: '⚡ DÉMO COMPLÈTE (Studio V2 & WhatsApp)',
  description: 'Démonstration complète en direct : Bannière officielle, Avis Vocaux WhatsApp animés, Carrousel d\'avantages et Checkout COD.',
  category: 'E-commerce',
  badge: 'DÉMO V2',
  icon: '🏆',
  previewGradient: 'from-emerald-500 via-teal-600 to-orange-500',
  settings: {
    backgroundColor: '#f8fafc',
    whatsappWidget: {
      enabled: true,
      phoneNumber: '+212600000000',
      headline: 'Support Client VIP 🇲🇦',
      welcomeMessage: 'Bonjour ! Comment pouvons-nous vous aider aujourd\'hui ? 😊',
      headerBg: '#25D366',
      iconStyle: 'bubble',
      iconType: 'whatsapp',
      position: 'bottom-right'
    }
  },
  blocks: [
    {
      id: crypto.randomUUID(),
      type: 'header',
      content: {
        text: '🇲🇦 LIVRAISON GRATUITE & PAIEMENT À LA LIVRAISON (COD)',
        bgColor: '#0f172a',
        color: '#ffffff',
        paddingTop: 12,
        paddingBottom: 12,
        marginTop: 0,
        marginBottom: 0
      }
    },
    {
      id: crypto.randomUUID(),
      type: 'countdown',
      content: {
        text: '🔥 Offre Spéciale Déstockage : -50% se termine dans 00:19:45 !',
        paddingTop: 14,
        paddingBottom: 14,
        marginTop: 0,
        marginBottom: 8
      }
    },
    {
      id: crypto.randomUUID(),
      type: 'hero',
      content: {
        title: 'Le Produit Préféré des Marocains en 2026',
        subtitle: 'Rejoignez plus de 14 500 clients conquis. Qualité supérieure garantie et livraison express 24-48h à domicile.',
        bgColor: '#ffffff',
        titleColor: '#0f172a',
        subtitleColor: '#475569',
        paddingTop: 32,
        paddingBottom: 24,
        marginTop: 0,
        marginBottom: 12
      }
    },
    {
      id: crypto.randomUUID(),
      type: 'audio',
      content: {
        themeStyle: 'whatsapp',
        audios: [
          {
            id: '1',
            title: 'Avis Client Fatima',
            senderName: 'Fatima Zahra (Casablanca) 🇲🇦',
            time: '11:42',
            url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
            avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80'
          },
          {
            id: '2',
            title: 'Avis Client Youssef',
            senderName: 'Youssef Bennani (Marrakech) 🇲🇦',
            time: '14:15',
            url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
            avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80'
          }
        ],
        bubbleColor: '#ffffff',
        playBtnColor: '#25D366',
        activeWaveColor: '#34B7F1',
        showCheckmarks: true,
        showSpeedToggle: true,
        paddingTop: 16,
        paddingBottom: 16,
        marginTop: 0,
        marginBottom: 12
      }
    },
    {
      id: crypto.randomUUID(),
      type: 'slider',
      content: {
        slides: [
          {
            title: '⭐ 100% Satisfait ou Remboursé',
            description: 'Testez notre produit sans aucun risque pendant 14 jours.',
            mediaUrl: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=600&auto=format&fit=crop&q=80'
          },
          {
            title: '⚡ Livraison Express 24h/48h',
            description: 'Livré directement à votre porte partout au Maroc avec suivi.',
            mediaUrl: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=600&auto=format&fit=crop&q=80'
          },
          {
            title: '🛡️ Paiement à la Réception (COD)',
            description: 'Ne payez rien à l\'avance : payez le livreur uniquement après vérification.',
            mediaUrl: 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=600&auto=format&fit=crop&q=80'
          }
        ],
        cardsPerView: 1,
        cardGap: 16,
        autoPlay: true,
        autoPlaySpeed: 4500,
        showArrows: true,
        showDots: true,
        mediaHeight: 260,
        titleColor: '#0f172a',
        descColor: '#475569',
        cardBg: '#ffffff',
        cardRadius: 20,
        cardBorderWidth: 1,
        cardBorderColor: '#e2e8f0',
        cardShadow: 'md',
        textAlign: 'center',
        dotColor: '#ea580c',
        paddingTop: 20,
        paddingBottom: 20,
        marginTop: 0,
        marginBottom: 16
      }
    },
    {
      id: crypto.randomUUID(),
      type: 'button',
      content: {
        text: '🛒 PROFITER DE L\'OFFRE FLASH (PAIEMENT À LA LIVRAISON)',
        bgColor: '#ea580c',
        textColor: '#ffffff',
        textSize: 16,
        buttonBorderRadius: 16,
        buttonPaddingY: 18,
        buttonPaddingX: 24,
        behavior: 'checkout',
        stickyMobile: true,
        stickyDesktop: false,
        animationLayout: 'bounceVertical',
        paddingTop: 16,
        paddingBottom: 16,
        marginTop: 0,
        marginBottom: 16
      }
    },
    {
      id: crypto.randomUUID(),
      type: 'express_checkout',
      content: {
        title: 'اطلب الآن (الدفع عند الاستلام)',
        subtitle: 'املأ النموذج أدناه لتأكيد طلبك. التوصيل مجاني لجميع مدن المغرب.',
        buttonText: 'تأكيد طلبي الآن 🚚',
        themeColor: '#ea580c',
        formBgColor: '#ffffff',
        containerBgColor: '#ffffff',
        nameLabel: 'الاسم الكامل *',
        namePlaceholder: 'مثال: يوسف بن جلون',
        phoneLabel: 'رقم الهاتف *',
        phonePlaceholder: '06 XX XX XX XX',
        cityLabel: 'المدينة *',
        cityPlaceholder: 'مثال: الدار البيضاء',
        addressLabel: 'العنوان بالتفصيل',
        addressPlaceholder: 'عنوان التوصيل الكامل...',
        borderRadiusTL: 20,
        borderRadiusTR: 20,
        borderRadiusBL: 20,
        borderRadiusBR: 20,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        priceColor: '#ea580c',
        priceSize: 32,
        showPrice: true,
        options: [
          { name: '1 Pièce (Offre Standard)', price: 249, oldPrice: 499, color: '#64748b' },
          { name: '2 Pièces + 1 Gratuite (Pack Best-Seller)', price: 399, oldPrice: 798, color: '#ea580c' },
          { name: '3 Pièces + 2 Gratuites (Pack Famille)', price: 549, oldPrice: 1245, color: '#10b981' }
        ],
        packColor: '#ea580c',
        packBorderWidth: 2,
        packBorderRadius: 16,
        paddingTop: 32,
        paddingBottom: 32,
        paddingLeft: 16,
        paddingRight: 16,
        marginTop: 0,
        marginBottom: 0
      }
    }
  ]
};

export const STARTER_TEMPLATES: BuilderTemplate[] = [
  DEMO_SHOWCASE_TEMPLATE,
  {
    id: 'flash-sale-cod',
    name: 'Offre Flash COD (Haute Conversion)',
    description: 'Structure optimisée pour le Cash On Delivery avec urgence, vidéo de démonstration et checkout express multi-packs.',
    category: 'E-commerce',
    badge: 'Populaire',
    icon: '⚡',
    previewGradient: 'from-amber-500 to-orange-600',
    settings: {
      backgroundColor: '#f8fafc',
      whatsappWidget: {
        enabled: true,
        phoneNumber: '',
        headline: "Service Client Direct",
        welcomeMessage: "Bonjour ! Avez-vous une question avant de commander ?",
        headerBg: '#25D366',
        iconStyle: 'bubble',
        iconType: 'whatsapp',
        position: 'bottom-right'
      }
    },
    blocks: [
      {
        id: crypto.randomUUID(),
        type: 'header',
        content: {
          text: 'BOUTIQUE OFFICIELLE',
          bgColor: '#0f172a',
          color: '#ffffff',
          paddingTop: 14,
          paddingBottom: 14,
          marginTop: 0,
          marginBottom: 0
        }
      },
      {
        id: crypto.randomUUID(),
        type: 'countdown',
        content: {
          text: "🔥 Offre Spéciale : -50% se termine dans 00:14:59",
          paddingTop: 16,
          paddingBottom: 16,
          marginTop: 0,
          marginBottom: 8
        }
      },
      {
        id: crypto.randomUUID(),
        type: 'hero',
        content: {
          title: "Découvrez La Solution N°1 Pour Votre Quotidien",
          subtitle: "Commandez aujourd'hui et bénéficiez de la livraison gratuite + paiement à la livraison partout au Maroc !",
          bgColor: '#ffffff',
          titleColor: '#0f172a',
          subtitleColor: '#475569',
          paddingTop: 36,
          paddingBottom: 28,
          marginTop: 0,
          marginBottom: 16
        }
      },
      {
        id: crypto.randomUUID(),
        type: 'video',
        content: {
          url: '',
          width: 100,
          autoplay: true,
          muted: true,
          loop: true,
          controls: true,
          unmuteText: '🔊 Cliquez ici pour activer le son',
          unmuteTextColor: '#ffffff',
          unmuteBtnColor: '#ea580c',
          unmuteTextSize: 18,
          restartOnUnmute: true,
          paddingTop: 12,
          paddingBottom: 12,
          marginTop: 0,
          marginBottom: 16
        }
      },
      {
        id: crypto.randomUUID(),
        type: 'button',
        content: {
          text: '👉 COMMANDER MAINTENANT (Paiement à la livraison)',
          bgColor: '#ea580c',
          textColor: '#ffffff',
          textSize: 18,
          buttonBorderRadius: 16,
          buttonPaddingY: 18,
          buttonPaddingX: 32,
          behavior: 'checkout',
          stickyMobile: true,
          stickyDesktop: false,
          animationLayout: 'bounceVertical',
          animationTiming: 'ease-in-out',
          paddingTop: 16,
          paddingBottom: 16,
          marginTop: 0,
          marginBottom: 16
        }
      },
      {
        id: crypto.randomUUID(),
        type: 'slider',
        content: {
          slides: [
            {
              title: "⭐️⭐️⭐️⭐️⭐️ Karim B. (Casablanca)",
              description: "Livraison reçue en 24h chrono. Produit d'une qualité impressionnante, je recommande à 100% !",
              mediaUrl: ''
            },
            {
              title: "⭐️⭐️⭐️⭐️⭐️ Sarah M. (Rabat)",
              description: "Très satisfaite de mon achat. Le service client m'a contactée par WhatsApp pour confirmer très rapidement.",
              mediaUrl: ''
            },
            {
              title: "⭐️⭐️⭐️⭐️⭐️ Yassine T. (Marrakech)",
              description: "Paiement à la livraison très sécurisé et emballage soigné. Merci pour le professionnalisme.",
              mediaUrl: ''
            }
          ],
          cardsPerView: 1,
          cardGap: 16,
          autoPlay: true,
          autoPlaySpeed: 4000,
          showArrows: true,
          showDots: true,
          mediaHeight: 200,
          titleColor: '#0f172a',
          descColor: '#475569',
          cardBg: '#ffffff',
          cardRadius: 20,
          cardBorderWidth: 1,
          cardBorderColor: '#e2e8f0',
          cardShadow: 'md',
          textAlign: 'center',
          dotColor: '#ea580c',
          paddingTop: 24,
          paddingBottom: 24,
          marginTop: 0,
          marginBottom: 16
        }
      },
      {
        id: crypto.randomUUID(),
        type: 'express_checkout',
        content: {
          title: 'املأ معلوماتك للتوصيل السريع',
          subtitle: 'الدفع نقداً عند استلام طلبيتك. التوصيل مجاني لجميع مدن المغرب.',
          buttonText: 'تأكيد الطلب الآن 🛍️',
          themeColor: '#ea580c',
          formBgColor: '#ffffff',
          containerBgColor: '#ffffff',
          nameLabel: 'الاسم الكامل *',
          namePlaceholder: 'مثال: يوسف بن جلون',
          phoneLabel: 'رقم الهاتف *',
          phonePlaceholder: '06 XX XX XX XX',
          cityLabel: 'المدينة *',
          cityPlaceholder: 'مثال: الدار البيضاء / الرباط / فاس...',
          addressLabel: 'العنوان للتوصيل (اختياري)',
          addressPlaceholder: 'الحي، رقم المنزل أو الشارع...',
          borderRadiusTL: 24,
          borderRadiusTR: 24,
          borderRadiusBL: 24,
          borderRadiusBR: 24,
          borderWidth: 1,
          borderColor: '#e2e8f0',
          priceColor: '#ea580c',
          priceSize: 32,
          showPrice: true,
          showOldPrice: true,
          oldPriceValue: 399,
          options: [
            { id: '1', name: '1 حبة (العرض العادي)', price: 199, oldPrice: 399, color: '#ea580c' },
            { id: '2', name: '2 حبات + 1 مجاناً (الأكثر طلباً 🔥)', price: 349, oldPrice: 599, color: '#ea580c' }
          ],
          packColor: '#ea580c',
          packBorderWidth: 2,
          packBorderRadius: 16,
          paddingTop: 32,
          paddingBottom: 32,
          paddingLeft: 16,
          paddingRight: 16,
          marginTop: 0,
          marginBottom: 0
        }
      }
    ]
  },
  {
    id: 'cosmetics-luxury',
    name: 'Cosmétique & Soin de Beauté (Luxe)',
    description: 'Design épuré et élégant pensé pour les produits de beauté, skincare, parfums et soins premium.',
    category: 'Beauté',
    badge: 'Élégant',
    icon: '✨',
    previewGradient: 'from-rose-500 to-pink-600',
    settings: {
      backgroundColor: '#fffafb',
      whatsappWidget: {
        enabled: true,
        phoneNumber: '',
        headline: "Conseillère Beauté",
        welcomeMessage: "Besoin d'un conseil personnalisé pour votre peau ? 🌸",
        headerBg: '#db2777',
        iconStyle: 'bubble',
        iconType: 'headset',
        position: 'bottom-right'
      }
    },
    blocks: [
      {
        id: crypto.randomUUID(),
        type: 'header',
        content: {
          text: 'MAISON DE BEAUTÉ PARIS',
          bgColor: '#ffffff',
          color: '#1e293b',
          paddingTop: 16,
          paddingBottom: 16,
          marginTop: 0,
          marginBottom: 0
        }
      },
      {
        id: crypto.randomUUID(),
        type: 'hero',
        content: {
          title: "Sublimez Votre Éclat Naturel",
          subtitle: "Formule dermatologique exclusive à base d'actifs 100% naturels pour une peau régénérée dès la 1ère semaine.",
          bgColor: '#fff1f2',
          titleColor: '#881337',
          subtitleColor: '#9f1239',
          paddingTop: 48,
          paddingBottom: 40,
          marginTop: 0,
          marginBottom: 16
        }
      },
      {
        id: crypto.randomUUID(),
        type: 'image',
        content: {
          url: '',
          width: 100,
          maxHeight: 550,
          paddingTop: 12,
          paddingBottom: 12,
          marginTop: 0,
          marginBottom: 16
        }
      },
      {
        id: crypto.randomUUID(),
        type: 'slider',
        content: {
          slides: [
            {
              title: "Avant / Après 14 Jours",
              description: "98% des utilisatrices constatent une réduction visible des imperfections et un teint lumineux.",
              mediaUrl: ''
            },
            {
              title: "Texture Soyeuse Non Grasse",
              description: "Absorption instantanée sans laisser de film gras, parfum subtil et délicat.",
              mediaUrl: ''
            }
          ],
          cardsPerView: 1,
          cardGap: 16,
          autoPlay: true,
          autoPlaySpeed: 5000,
          showArrows: true,
          showDots: true,
          mediaHeight: 300,
          titleColor: '#881337',
          descColor: '#4c0519',
          cardBg: '#ffffff',
          cardRadius: 24,
          cardBorderWidth: 1,
          cardBorderColor: '#ffe4e6',
          cardShadow: 'lg',
          textAlign: 'center',
          dotColor: '#db2777',
          paddingTop: 24,
          paddingBottom: 24,
          marginTop: 0,
          marginBottom: 16
        }
      },
      {
        id: crypto.randomUUID(),
        type: 'audio',
        content: {
          themeStyle: 'whatsapp',
          audios: [
            {
              id: '1',
              title: 'Avis Vocal Client',
              senderName: 'Fatima Z. (Casablanca)',
              time: '14:23',
              url: '',
              avatarUrl: ''
            },
            {
              id: '2',
              title: 'Avis Vocal Client',
              senderName: 'Sara M. (Rabat)',
              time: '16:05',
              url: '',
              avatarUrl: ''
            }
          ],
          bubbleColor: '#ffffff',
          playBtnColor: '#25D366',
          activeWaveColor: '#34B7F1',
          showCheckmarks: true,
          showSpeedToggle: true,
          paddingTop: 16,
          paddingBottom: 16,
          marginTop: 0,
          marginBottom: 16
        }
      },
      {
        id: crypto.randomUUID(),
        type: 'express_checkout',
        content: {
          title: 'احصلي على إطلالتك المميزة اليوم',
          subtitle: 'الدفع عند الاستلام مع ضمان الرضا 100%. التوصيل حتى باب منزلك.',
          buttonText: 'تأكيد الطلب 🌸',
          themeColor: '#db2777',
          formBgColor: '#ffffff',
          containerBgColor: '#ffffff',
          nameLabel: 'الاسم الكامل *',
          namePlaceholder: 'مثال: فاطمة الزهراء',
          phoneLabel: 'رقم الهاتف *',
          phonePlaceholder: '06 XX XX XX XX',
          cityLabel: 'المدينة *',
          cityPlaceholder: 'الدار البيضاء، الرباط، طنجة...',
          addressLabel: 'العنوان (اختياري)',
          addressPlaceholder: 'عنوان التوصيل...',
          borderRadiusTL: 24,
          borderRadiusTR: 24,
          borderRadiusBL: 24,
          borderRadiusBR: 24,
          borderWidth: 1,
          borderColor: '#fce7f3',
          priceColor: '#db2777',
          priceSize: 32,
          showPrice: true,
          showOldPrice: true,
          oldPriceValue: 450,
          options: [
            { id: '1', name: '1 عبوة للعلاج المكثف', price: 249, oldPrice: 450, color: '#db2777' },
            { id: '2', name: '2 عبوات + هدية مجانية 🎁', price: 399, oldPrice: 750, color: '#db2777' }
          ],
          packColor: '#db2777',
          packBorderWidth: 2,
          packBorderRadius: 18,
          paddingTop: 32,
          paddingBottom: 32,
          paddingLeft: 16,
          paddingRight: 16,
          marginTop: 0,
          marginBottom: 0
        }
      }
    ]
  },
  {
    id: 'tech-gadget',
    name: 'High-Tech & Gadgets Innovants',
    description: 'Format percutant pour les accessoires, montres connectées, gadgets auto et domotique.',
    category: 'High-Tech',
    badge: 'Moderne',
    icon: '🚀',
    previewGradient: 'from-blue-600 to-indigo-700',
    settings: {
      backgroundColor: '#f1f5f9',
      whatsappWidget: {
        enabled: true,
        phoneNumber: '',
        headline: "Support Technique",
        welcomeMessage: "Bonjour ! Avez-vous besoin d'informations techniques ?",
        headerBg: '#2563eb',
        iconStyle: 'bubble',
        iconType: 'bot',
        position: 'bottom-right'
      }
    },
    blocks: [
      {
        id: crypto.randomUUID(),
        type: 'header',
        content: {
          text: 'INNOVATION STORE',
          bgColor: '#0f172a',
          color: '#ffffff',
          paddingTop: 16,
          paddingBottom: 16,
          marginTop: 0,
          marginBottom: 0
        }
      },
      {
        id: crypto.randomUUID(),
        type: 'hero',
        content: {
          title: "Technologie De Pointe à Portée De Main",
          subtitle: "Performance ultime, autonomie record et garantie 1 an avec échange à neuf.",
          bgColor: '#ffffff',
          titleColor: '#0f172a',
          subtitleColor: '#475569',
          paddingTop: 40,
          paddingBottom: 32,
          marginTop: 0,
          marginBottom: 16
        }
      },
      {
        id: crypto.randomUUID(),
        type: 'video',
        content: {
          url: '',
          width: 100,
          autoplay: true,
          muted: true,
          loop: true,
          controls: true,
          unmuteText: 'Écouter la démo',
          unmuteTextColor: '#ffffff',
          unmuteBtnColor: '#2563eb',
          unmuteTextSize: 16,
          paddingTop: 12,
          paddingBottom: 12,
          marginTop: 0,
          marginBottom: 16
        }
      },
      {
        id: crypto.randomUUID(),
        type: 'audio',
        content: {
          audios: [
            { id: '1', title: 'Avis Vocal Client vérifié', url: '' }
          ],
          controls: true,
          autoplay: false,
          loop: false,
          bgColor: '#ffffff',
          borderColor: '#e2e8f0',
          paddingTop: 16,
          paddingBottom: 16,
          marginTop: 0,
          marginBottom: 16
        }
      },
      {
        id: crypto.randomUUID(),
        type: 'express_checkout',
        content: {
          title: 'اطلب الآن مع ضمان سنة كاملة',
          subtitle: 'الدفع عند المعاينة والاستلام. التوصيل السريع متوفر لجميع المدن.',
          buttonText: 'تأكيد الطلب والاستفادة من العرض ⚡',
          themeColor: '#2563eb',
          formBgColor: '#ffffff',
          containerBgColor: '#ffffff',
          nameLabel: 'الاسم الكامل *',
          namePlaceholder: 'مثال: حمزة الناصري',
          phoneLabel: 'رقم الهاتف *',
          phonePlaceholder: '06 XX XX XX XX',
          cityLabel: 'المدينة *',
          cityPlaceholder: 'الدار البيضاء، مراكش، طنجة...',
          addressLabel: 'العنوان (اختياري)',
          addressPlaceholder: 'العنوان...',
          borderRadiusTL: 20,
          borderRadiusTR: 20,
          borderRadiusBL: 20,
          borderRadiusBR: 20,
          borderWidth: 1,
          borderColor: '#cbd5e1',
          priceColor: '#2563eb',
          priceSize: 32,
          showPrice: true,
          showOldPrice: true,
          oldPriceValue: 499,
          options: [
            { id: '1', name: '1 جهاز + كابل شحن سريع', price: 299, oldPrice: 499, color: '#2563eb' },
            { id: '2', name: '2 أجهزة (توفير 100 درهم إضافي)', price: 499, oldPrice: 899, color: '#2563eb' }
          ],
          packColor: '#2563eb',
          packBorderWidth: 2,
          packBorderRadius: 16,
          paddingTop: 32,
          paddingBottom: 32,
          paddingLeft: 16,
          paddingRight: 16,
          marginTop: 0,
          marginBottom: 0
        }
      }
    ]
  },
  {
    id: 'minimal-fast-checkout',
    name: 'Tunnel Ultra-Rapide (1-Screen COD)',
    description: 'Une page minimaliste, directe et sans distraction conçue pour maximiser le taux de conversion des publicités TikTok/Facebook.',
    category: 'Ultra-Rapide',
    badge: 'Direct',
    icon: '⚡',
    previewGradient: 'from-emerald-500 to-teal-700',
    settings: {
      backgroundColor: '#ffffff'
    },
    blocks: [
      {
        id: crypto.randomUUID(),
        type: 'header',
        content: {
          text: 'COMMANDER MAINTENANT',
          bgColor: '#0f172a',
          color: '#ffffff',
          paddingTop: 12,
          paddingBottom: 12,
          marginTop: 0,
          marginBottom: 0
        }
      },
      {
        id: crypto.randomUUID(),
        type: 'hero',
        content: {
          title: "Offre Exclusive Limitée",
          subtitle: "Remplissez le formulaire ci-dessous pour réserver votre commande avec livraison rapide.",
          bgColor: '#ffffff',
          titleColor: '#0f172a',
          subtitleColor: '#64748b',
          paddingTop: 24,
          paddingBottom: 16,
          marginTop: 0,
          marginBottom: 8
        }
      },
      {
        id: crypto.randomUUID(),
        type: 'video',
        content: {
          url: '',
          width: 100,
          autoplay: true,
          muted: true,
          loop: true,
          controls: true,
          paddingTop: 8,
          paddingBottom: 8,
          marginTop: 0,
          marginBottom: 12
        }
      },
      {
        id: crypto.randomUUID(),
        type: 'express_checkout',
        content: {
          title: 'معلومات التوصيل',
          subtitle: 'الدفع عند الاستلام',
          buttonText: 'تأكيد طلبي الآن',
          themeColor: '#059669',
          formBgColor: '#f8fafc',
          containerBgColor: '#ffffff',
          nameLabel: 'الاسم الكامل *',
          namePlaceholder: 'الاسم الكامل',
          phoneLabel: 'رقم الهاتف *',
          phonePlaceholder: '06 XX XX XX XX',
          cityLabel: 'المدينة *',
          cityPlaceholder: 'المدينة',
          addressLabel: 'العنوان',
          addressPlaceholder: 'العنوان...',
          borderRadiusTL: 16,
          borderRadiusTR: 16,
          borderRadiusBL: 16,
          borderRadiusBR: 16,
          borderWidth: 1,
          borderColor: '#e2e8f0',
          priceColor: '#059669',
          priceSize: 30,
          showPrice: true,
          options: [],
          paddingTop: 24,
          paddingBottom: 24,
          paddingLeft: 16,
          paddingRight: 16,
          marginTop: 0,
          marginBottom: 0
        }
      }
    ]
  }
];
