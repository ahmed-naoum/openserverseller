const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const storeId = 1;

  const pagesToCreate = [
    {
      title: 'Conditions Générales de Vente (CGV)',
      slug: 'terms',
      isPublished: true,
      contentHtml: `
        <h2>1. Présentation et Champ d'Application</h2>
        <p>Les présentes Conditions Générales de Vente (CGV) régissent l'ensemble des commandes passées sur la boutique en ligne officielle <strong>jilaliy</strong>. En confirmant une commande, le client accepte sans réserve l'intégralité des présentes conditions.</p>

        <h2>2. Commandes et Confirmation</h2>
        <p>Pour passer commande, le client sélectionne les produits désirés, renseigne son nom, son numéro de téléphone, sa ville et son adresse de livraison. Toute commande passée fait l'objet d'un appel téléphonique ou d'un message WhatsApp de confirmation par notre service client avant toute expédition.</p>

        <h2>3. Prix et Modalités de Paiement</h2>
        <p>Les prix affichés sur la boutique sont exprimés en Dirhams Marocains (MAD) toutes taxes comprises. Le règlement s'effectue exclusivement en <strong>espèces lors de la livraison (Cash on Delivery / Paiement à la livraison)</strong> directement auprès du livreur au moment de la remise de votre colis.</p>

        <h2>4. Expédition et Livraison</h2>
        <p>Les livraisons sont assurées sur l'ensemble du territoire marocain par des transporteurs professionnels agréés. Les délais de livraison moyens sont de <strong>24 à 48 heures</strong> ouvrées à compter de la confirmation téléphonique de votre commande.</p>

        <h2>5. Droit de Rétractation et Échanges</h2>
        <p>Conformément aux usages du commerce et à la législation en vigueur au Maroc, le client dispose d'un délai de <strong>7 jours</strong> à compter de la date de réception pour demander un échange ou un retour en cas de produit non conforme ou présentant un défaut de fabrication.</p>

        <h2>6. Service Client</h2>
        <p>Notre service client est à votre disposition 7 jours sur 7 par téléphone ou via WhatsApp au <strong>+212 667 619 265</strong> pour toute réclamation ou question relative à vos achats.</p>
      `,
    },
    {
      title: 'Contactez-Nous & Support',
      slug: 'contact',
      isPublished: true,
      contentHtml: `
        <h2>Nous sommes à votre écoute</h2>
        <p>Une question sur un produit ? Besoin d'aide pour passer commande ou suivre votre colis ? Notre équipe de support client est disponible pour vous accompagner 7 jours sur 7.</p>

        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 16px; padding: 24px; margin: 24px 0;">
          <h3 style="margin-top: 0; color: #0f172a;">Coordonnées Officielles</h3>
          <ul style="list-style: none; padding-left: 0; margin-bottom: 0;">
            <li style="margin-bottom: 12px;"><strong>📱 Téléphone / WhatsApp :</strong> <a href="https://wa.me/212667619265" target="_blank" style="color: #ea580c; text-decoration: underline;">+212 667 619 265</a></li>
            <li style="margin-bottom: 12px;"><strong>✉️ Email :</strong> 123yassine.chaib@gmail.comaad</li>
            <li style="margin-bottom: 12px;"><strong>📍 Siège & Expédition :</strong> Agadir, Maroc</li>
            <li style="margin-bottom: 0;"><strong>⏰ Horaires d'ouverture :</strong> Du Lundi au Dimanche, de 09h00 à 20h00</li>
          </ul>
        </div>

        <h3>Assistance Rapide via WhatsApp</h3>
        <p>Pour une prise en charge immédiate de votre demande, nous vous recommandons de contacter notre service WhatsApp en précisant votre nom et votre numéro de commande si applicable.</p>
      `,
    },
    {
      title: 'Politique de Confidentialité',
      slug: 'privacy',
      isPublished: true,
      contentHtml: `
        <h2>Protection de vos Données Personnelles</h2>
        <p>La protection de votre vie privée est une priorité absolue pour <strong>jilaliy</strong>. Cette politique détaille les informations que nous collectons, comment nous les utilisons et les mesures prises pour assurer leur sécurité.</p>

        <h2>1. Données Collectées</h2>
        <p>Lorsque vous effectuez un achat sur notre boutique, nous collectons exclusivement les informations strictement nécessaires au traitement et à l'acheminement de votre commande : nom complet, numéro de téléphone, ville et adresse de livraison.</p>

        <h2>2. Utilisation des Données</h2>
        <p>Vos coordonnées sont utilisées uniquement pour :</p>
        <ul>
          <li>Vous contacter afin de confirmer les détails de livraison de votre colis ;</li>
          <li>Transmettre les coordonnées de livraison au transporteur en charge de l'expédition ;</li>
          <li>Améliorer l'expérience utilisateur et assurer le suivi après-vente.</li>
        </ul>

        <h2>3. Confidentialité et Non-Partage</h2>
        <p>Nous ne vendons, ne louons et ne cédons aucune de vos données personnelles à des tiers à des fins commerciales. Seules les sociétés de livraison partenaires reçoivent les informations indispensables à la livraison de vos colis.</p>

        <h2>4. Pixels et Cookies de Navigation</h2>
        <p>Notre boutique utilise des cookies et balises publicitaires anonymes (Meta Pixel, Google, TikTok) afin de mesurer l'audience et adapter nos communications publicitaires. Vous pouvez configurer votre navigateur pour refuser ces cookies à tout moment.</p>

        <h2>5. Vos Droits</h2>
        <p>Vous disposez d'un droit permanent d'accès, de rectification et de suppression de vos données personnelles en contactant simplement notre service client.</p>
      `,
    },
    {
      title: 'Politique de Livraison & Expédition',
      slug: 'livraison',
      isPublished: true,
      contentHtml: `
        <h2>Expédition Rapide Partout au Maroc</h2>
        <p>Chez <strong>jilaliy</strong>, nous collaborons avec les meilleurs transporteurs nationaux pour garantir une livraison express et soignée directement à votre domicile ou sur votre lieu de travail.</p>

        <h2>1. Villes Desservies</h2>
        <p>Nous livrons dans <strong>toutes les villes et régions du Maroc</strong> sans exception : Casablanca, Rabat, Marrakech, Agadir, Tanger, Fès, Meknès, Oujda, Kénitra, Tétouan, Laâyoune, etc.</p>

        <h2>2. Délais de Livraison</h2>
        <ul>
          <li><strong>Grandes villes :</strong> 24h à 48h ouvrées.</li>
          <li><strong>Autres villes et régions :</strong> 48h à 72h ouvrées.</li>
        </ul>

        <h2>3. Déroulement de la Livraison</h2>
        <ol>
          <li>Dès validation de votre commande sur le site, notre équipe vous contacte par téléphone pour valider l'adresse et le créneau.</li>
          <li>Le colis est préparé, soigneusement emballé et remis au livreur.</li>
          <li>Le jour de la livraison, le coursier vous appelle par téléphone pour convenir de l'heure exacte de passage.</li>
          <li>Vous réceptionnez votre colis et réglez le montant en espèces au livreur.</li>
        </ol>

        <h2>4. Frais de Port</h2>
        <p>Les frais de livraison sont calculés et affichés lors de votre commande. Profitez régulièrement de la <strong>livraison gratuite</strong> lors de nos offres spéciales et packs promotionnels !</p>
      `,
    },
    {
      title: "Politique d'Échange et de Retours",
      slug: 'retours',
      isPublished: true,
      contentHtml: `
        <h2>Garantie Satisfaction & Retours Faciles</h2>
        <p>Votre satisfaction est notre priorité. Si un article ne correspond pas à vos attentes ou présente un défaut, nous vous proposons un processus d'échange simple et rapide.</p>

        <h2>1. Délai de Retour</h2>
        <p>Vous disposez de <strong>7 jours</strong> à compter de la date de réception de votre commande pour demander un échange ou un retour de produit.</p>

        <h2>2. Conditions d'Éligibilité</h2>
        <p>Pour être accepté en retour, l'article doit être dans son état d'origine, non utilisé, non endommagé et dans son emballage d'origine complet.</p>

        <h2>3. Produit Défectueux ou Erreur d'Expédition</h2>
        <p>Si vous recevez un produit défectueux ou un article différent de celui commandé, nous prenons en charge l'intégralité des frais d'échange et vous expédions un nouveau produit sans aucun surcoût.</p>

        <h2>4. Comment Déclencher un Retour ?</h2>
        <p>Contactez simplement notre support client sur WhatsApp au <strong>+212 667 619 265</strong> en fournissant :</p>
        <ul>
          <li>Votre nom et votre numéro de téléphone de commande ;</li>
          <li>Une photo ou vidéo montrant le problème constaté ;</li>
          <li>Notre équipe organisera le passage d'un livreur pour récupérer le produit et vous remettre le nouveau.</li>
        </ul>
      `,
    },
    {
      title: 'Foire Aux Questions (FAQ)',
      slug: 'faq',
      isPublished: true,
      contentHtml: `
        <h2>Questions Fréquentes</h2>
        <p>Retrouvez ici toutes les réponses aux questions les plus courantes sur nos produits et nos services de livraison.</p>

        <h3>1. Comment puis-je payer ma commande ?</h3>
        <p>Le paiement s'effectue exclusivement en <strong>espèces lors de la livraison (Cash on Delivery)</strong>. Vous ne payez rien en ligne ; vous réglez directement le livreur à la réception de votre colis.</p>

        <h3>2. Quand ma commande sera-t-elle livrée ?</h3>
        <p>Après validation téléphonique, votre colis est livré sous 24 à 48 heures dans la majorité des villes marocaines.</p>

        <h3>3. Puis-je vérifier mon colis avant de payer ?</h3>
        <p>Absolument ! Nous vous invitons à vous assurer que l'emballage et l'article reçu correspondent bien à votre commande.</p>

        <h3>4. Comment modifier ou annuler ma commande ?</h3>
        <p>Si vous souhaitez annuler ou modifier un article, contactez-nous immédiatement via WhatsApp au <strong>+212 667 619 265</strong> avant la remise du colis au transporteur.</p>

        <h3>5. Que faire si le produit est endommagé ou défectueux ?</h3>
        <p>Contactez notre service après-vente sous 48 heures avec une photo du produit. Nous programmerons un échange immédiat à nos frais.</p>
      `,
    },
    {
      title: 'À Propos de Nous',
      slug: 'about',
      isPublished: true,
      contentHtml: `
        <h2>Notre Histoire & Notre Vision</h2>
        <p>Bienvenue sur <strong>jilaliy</strong>, votre boutique en ligne de référence au Maroc. Notre mission est de vous offrir des produits innovants, fiables et de haute qualité, sélectionnés avec le plus grand soin auprès de fabricants réputés.</p>

        <h2>Pourquoi Choisir jilaliy ?</h2>
        <ul>
          <li><strong>Qualité Garantie :</strong> Chaque produit est testé et vérifié avant expédition pour assurer votre entière satisfaction.</li>
          <li><strong>Paiement 100% Sécurisé :</strong> Vous ne prenez aucun risque grâce au paiement à la livraison partout au Maroc.</li>
          <li><strong>Service Client Dédié :</strong> Une équipe basée au Maroc, disponible 7j/7 pour répondre à toutes vos questions en français et en darija.</li>
          <li><strong>Livraison Express :</strong> Un réseau logistique rapide couvrant l'ensemble du territoire national.</li>
        </ul>

        <h2>Notre Engagement</h2>
        <p>Nous nous engageons à placer la satisfaction de nos clients au cœur de nos priorités. Merci pour votre fidélité et votre confiance !</p>
      `,
    },
    {
      title: "Blog & Conseils d'Experts",
      slug: 'blog',
      isPublished: true,
      contentHtml: `
        <h2>Bienvenue sur le Blog jilaliy</h2>
        <p>Découvrez nos guides, astuces d'experts et conseils pratiques pour tirer le meilleur parti de vos produits au quotidien.</p>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; margin-top: 24px;">
          <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.04);">
            <h3 style="margin-top: 0; color: #ea580c;">Guide d'Achat : Comment Bien Choisir ?</h3>
            <p style="font-size: 0.9em; color: #64748b;">Découvrez les critères essentiels à prendre en compte avant d'acheter votre produit pour faire le choix parfait selon vos besoins.</p>
            <a href="/products" style="color: #0f172a; font-weight: bold; text-decoration: underline;">Voir la sélection &rarr;</a>
          </div>

          <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.04);">
            <h3 style="margin-top: 0; color: #ea580c;">Astuces d'Entretien et d'Utilisation</h3>
            <p style="font-size: 0.9em; color: #64748b;">Prolongez la durée de vie de vos articles grâce à nos conseils simples d'entretien et d'utilisation recommandés par nos experts.</p>
            <a href="/pages/contact" style="color: #0f172a; font-weight: bold; text-decoration: underline;">Poser une question &rarr;</a>
          </div>
        </div>
      `,
    },
  ];

  for (const page of pagesToCreate) {
    await prisma.storePage.upsert({
      where: {
        storeId_slug: {
          storeId,
          slug: page.slug,
        },
      },
      update: {
        title: page.title,
        contentHtml: page.contentHtml.trim(),
        isPublished: true,
      },
      create: {
        storeId,
        title: page.title,
        slug: page.slug,
        contentHtml: page.contentHtml.trim(),
        isPublished: true,
      },
    });
    console.log('Upserted page:', page.slug);
  }

  // Update store footerMenu and globalSections footer so all links work
  const footerMenu = [
    { label: 'Tous les produits', url: '/products' },
    { label: 'Politique de Livraison', url: '/pages/livraison' },
    { label: 'Retours & Échanges', url: '/pages/retours' },
    { label: 'Conditions Générales (CGV)', url: '/pages/terms' },
    { label: 'Politique de Confidentialité', url: '/pages/privacy' },
    { label: 'Questions Fréquentes (FAQ)', url: '/pages/faq' },
    { label: 'À Propos de Nous', url: '/pages/about' },
    { label: 'Blog & Conseils', url: '/pages/blog' },
    { label: 'Contactez-Nous', url: '/pages/contact' },
  ];

  await prisma.store.update({
    where: { id: storeId },
    data: { footerMenu },
  });
  console.log('Updated store footerMenu!');

  // Update __footer page if exists so the Studio footer links also point to valid pages
  const footerPage = await prisma.storePage.findFirst({
    where: { storeId, slug: '__footer' },
  });

  if (footerPage && footerPage.customStructure) {
    const cs = footerPage.customStructure;
    try {
      if (cs.root && cs.root[0] && cs.root[0].children && cs.root[0].children[0]) {
        const props = cs.root[0].children[0].props;
        if (props && Array.isArray(props.columns)) {
          props.columns = [
            {
              title: 'Boutique',
              links: [
                { url: '/products', label: 'Tous les produits' },
                { url: '/cart', label: 'Mon panier' },
                { url: '/pages/blog', label: 'Blog & Conseils' },
              ],
            },
            {
              title: 'Informations & Confiance',
              links: [
                { url: '/pages/livraison', label: 'Livraison express' },
                { url: '/pages/retours', label: 'Retours & Échanges' },
                { url: '/pages/faq', label: 'Questions fréquentes (FAQ)' },
                { url: '/pages/about', label: 'À propos de nous' },
              ],
            },
            {
              title: 'Légal & Support',
              links: [
                { url: '/pages/terms', label: 'Conditions Générales (CGV)' },
                { url: '/pages/privacy', label: 'Politique de Confidentialité' },
                { url: '/pages/contact', label: 'Nous contacter' },
              ],
            },
          ];
          await prisma.storePage.update({
            where: { id: footerPage.id },
            data: { customStructure: cs },
          });
          console.log('Updated __footer customStructure!');
        }
      }
    } catch (err) {
      console.error('Failed to update __footer customStructure:', err);
    }
  }

  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
