import { prisma } from '../lib/prisma';

async function main() {
  console.log('Querying referral link: salam...');
  const refLink = await prisma.referralLink.findUnique({
    where: { code: 'salam' },
    include: { landingPage: true }
  });

  if (!refLink) {
    console.error('Referral link "salam" not found!');
    process.exit(1);
  }

  if (!refLink.landingPage) {
    console.error('Landing page for "salam" not found!');
    process.exit(1);
  }

  const landingPage = refLink.landingPage;
  let customStructure = landingPage.customStructure as any;
  if (!customStructure) {
    customStructure = { blocks: [], settings: {} };
  }

  // Populate blocks with a demo slider block showing the full images
  customStructure.blocks = [
    {
      id: "d3b50dcc-79f1-4f11-84ae-ed6cf01d08c0",
      type: "slider",
      content: {
        cardBg: "#ffffff",
        slides: [
          {
            title: "Carte 1",
            mediaUrl: "/uploads/c7278645-67b6-4c1c-836f-84f72b77bc50.webp",
            description: "Description de la première carte."
          },
          {
            title: "Carte 2",
            mediaUrl: "/uploads/604353bc-4475-4ddd-9be1-a14d9bb19f64.webp",
            description: "Description de la deuxième carte."
          },
          {
            title: "Carte 3",
            mediaUrl: "/uploads/ba01e117-85e2-4257-b99c-cc9f83e41ebb.webp",
            description: "Description de la troisième carte."
          },
          {
            title: "Carte 4",
            mediaUrl: "/uploads/fbacab8d-6e6c-48f3-adac-099d84f436c0.webp",
            description: "Description de la quatrième carte."
          },
          {
            title: "Carte 5",
            mediaUrl: "/uploads/90fbdf9d-c276-4d97-950b-8f1105c45601.webp",
            description: "Description de la cinquième carte."
          }
        ],
        cardGap: 20,
        autoPlay: true,
        autoPlaySpeed: 3000,
        showDots: true,
        showArrows: true,
        textAlign: "center",
        cardRadius: 20,
        cardShadow: "lg",
        mediaHeight: 400,
        cardsPerView: 3,
        autoplayMode: "slide",
        transitionEffect: "zoom", // Zoom transition
        hoverEffect: "lift", // Lift hover effect
        entranceAnimation: "fade-up", // Entrance animation
        mediaHeight100: false, // Standard height
        mediaFit: "contain", // Show the full image (no crop!)
        paddingTop: 40,
        paddingBottom: 40,
        marginTop: 0,
        marginBottom: 0,
        titleColor: "#111827",
        descColor: "#6b7280",
        dotColor: "#f97316"
      }
    }
  ];

  await prisma.referralLinkLandingPage.update({
    where: { id: landingPage.id },
    data: { customStructure }
  });
  console.log('Successfully recreated and updated landing page with full-fit image slider in DB!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
