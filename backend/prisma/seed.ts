import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Seed Roles
  console.log('📋 Creating roles...');
  const roles = await Promise.all([
    prisma.role.upsert({
      where: { name: 'SUPER_ADMIN' },
      update: {},
      create: { name: 'SUPER_ADMIN', guardName: 'web' },
    }),
    prisma.role.upsert({
      where: { name: 'FINANCE_ADMIN' },
      update: {},
      create: { name: 'FINANCE_ADMIN', guardName: 'web' },
    }),
    prisma.role.upsert({
      where: { name: 'VENDOR' },
      update: {},
      create: { name: 'VENDOR', guardName: 'web' },
    }),
    prisma.role.upsert({
      where: { name: 'CALL_CENTER_AGENT' },
      update: {},
      create: { name: 'CALL_CENTER_AGENT', guardName: 'web' },
    }),
    prisma.role.upsert({
      where: { name: 'FULFILLMENT_OPERATOR' },
      update: {},
      create: { name: 'FULFILLMENT_OPERATOR', guardName: 'web' },
    }),
    prisma.role.upsert({
      where: { name: 'GROSSELLER' },
      update: {},
      create: { name: 'GROSSELLER', guardName: 'web' },
    }),
    prisma.role.upsert({
      where: { name: 'INFLUENCER' },
      update: {},
      create: { name: 'INFLUENCER', guardName: 'web' },
    }),
    prisma.role.upsert({
      where: { name: 'CONFIRMATION_AGENT' },
      update: {},
      create: { name: 'CONFIRMATION_AGENT', guardName: 'web' },
    }),
  ]);

  const roleMap = Object.fromEntries(roles.map((r) => [r.name, r.id]));
  console.log(`✅ Created ${roles.length} roles`);

  // Seed Moroccan Cities
  console.log('🏙️ Creating Moroccan cities...');
  const cities = [
    { nameAr: 'الدار البيضاء', nameFr: 'Casablanca', nameEn: 'Casablanca', region: 'Casablanca-Settat', isMajor: true },
    { nameAr: 'الرباط', nameFr: 'Rabat', nameEn: 'Rabat', region: 'Rabat-Salé-Kénitra', isMajor: true },
    { nameAr: 'مراكش', nameFr: 'Marrakech', nameEn: 'Marrakech', region: 'Marrakech-Safi', isMajor: true },
    { nameAr: 'فاس', nameFr: 'Fès', nameEn: 'Fes', region: 'Fès-Meknès', isMajor: true },
    { nameAr: 'طنجة', nameFr: 'Tanger', nameEn: 'Tangier', region: 'Tanger-Tétouan-Al Hoceïma', isMajor: true },
    { nameAr: 'أغادير', nameFr: 'Agadir', nameEn: 'Agadir', region: 'Souss-Massa', isMajor: true },
    { nameAr: 'مكناس', nameFr: 'Meknès', nameEn: 'Meknes', region: 'Fès-Meknès', isMajor: false },
    { nameAr: 'وجدة', nameFr: 'Oujda', nameEn: 'Oujda', region: 'Oriental', isMajor: false },
  ];

  for (const city of cities) {
    await prisma.moroccanCity.upsert({
      where: { nameFr: city.nameFr },
      update: {},
      create: city,
    });
  }
  console.log(`✅ Created ${cities.length} cities`);

  // Seed Categories
  console.log('📁 Creating categories...');
  const categoriesData = [
    { nameAr: 'مستحضرات التجميل', nameFr: 'Cosmétiques', nameEn: 'Cosmetics', slug: 'cosmetics' },
    { nameAr: 'العناية بالبشرة', nameFr: 'Soins du visage', nameEn: 'Skincare', slug: 'skincare' },
    { nameAr: 'المكملات الغذائية', nameFr: 'Compléments alimentaires', nameEn: 'Supplements', slug: 'supplements' },
    { nameAr: 'الزيوت الطبيعية', nameFr: 'Huiles naturelles', nameEn: 'Natural Oils', slug: 'natural-oils' },
  ];

  const categories = await Promise.all(
    categoriesData.map((cat) =>
      prisma.category.upsert({
        where: { slug: cat.slug },
        update: {},
        create: cat,
      })
    )
  );
  console.log(`✅ Created ${categories.length} categories`);

  const categoryMap = Object.fromEntries(categories.map((c) => [c.slug, c.id]));

  // Seed Products
  console.log('📦 Creating products...');
  const productsData = [
    { sku: 'COS-001', nameAr: 'كريم ترطيب الوجه', nameFr: 'Crème Hydratante Visage', categoryId: categoryMap['skincare'], baseCostMad: 45, retailPriceMad: 120 },
    { sku: 'COS-002', nameAr: 'سيروم فيتامين سي', nameFr: 'Sérum Vitamine C', categoryId: categoryMap['skincare'], baseCostMad: 65, retailPriceMad: 180 },
    { sku: 'OIL-001', nameAr: 'زيت الأركان الأصلي', nameFr: 'Huile d\'Argan Pure', categoryId: categoryMap['natural-oils'], baseCostMad: 80, retailPriceMad: 220 },
    { sku: 'SUP-001', nameAr: 'كبسولات الكولاجين', nameFr: 'Gélules Collagène', categoryId: categoryMap['supplements'], baseCostMad: 90, retailPriceMad: 250 },
    { sku: 'SUP-002', nameAr: 'زيت السمك أوميغا 3', nameFr: 'Omega 3 Poisson', categoryId: categoryMap['supplements'], baseCostMad: 70, retailPriceMad: 190 },
  ];

  for (const product of productsData) {
    await prisma.product.upsert({
      where: { sku: product.sku },
      update: {},
      create: {
        ...product,
        description: `Description de ${product.nameFr}`,
        isCustomizable: true,
        minProductionDays: 3,
        isActive: true,
      },
    });
  }
  console.log(`✅ Created ${productsData.length} products`);

  // Seed Demo Users
  console.log('👥 Creating demo users...');
  const hashedPassword = await bcrypt.hash('password123', 12);

  const superAdmin = await prisma.user.upsert({
    where: { email: 'admin@openseller.ma' },
    update: {},
    create: {
      email: 'admin@openseller.ma',
      phone: '+212600000001',
      password: hashedPassword,
      roleId: roleMap['SUPER_ADMIN'],
      isActive: true,
      kycStatus: 'APPROVED',
      emailVerifiedAt: new Date(),
      profile: {
        create: {
          fullName: 'Super Admin',
          city: 'Casablanca',
          language: 'fr',
        },
      },
    },
    include: { profile: true },
  });

  const vendor = await prisma.user.upsert({
    where: { email: 'vendor@openseller.ma' },
    update: {},
    create: {
      email: 'vendor@openseller.ma',
      phone: '+212600000002',
      password: hashedPassword,
      roleId: roleMap['VENDOR'],
      isActive: true,
      kycStatus: 'APPROVED',
      emailVerifiedAt: new Date(),
      profile: {
        create: {
          fullName: 'Ahmed Benali',
          city: 'Rabat',
          address: '123 Avenue Mohammed V',
          language: 'fr',
        },
      },
      wallet: {
        create: {
          balanceMad: 5000,
          totalEarnedMad: 15000,
          totalWithdrawnMad: 10000,
        },
      },
    },
    include: { profile: true, wallet: true },
  });

  const agent = await prisma.user.upsert({
    where: { email: 'agent@openseller.ma' },
    update: {},
    create: {
      email: 'agent@openseller.ma',
      phone: '+212600000003',
      password: hashedPassword,
      roleId: roleMap['CALL_CENTER_AGENT'],
      isActive: true,
      kycStatus: 'APPROVED',
      emailVerifiedAt: new Date(),
      profile: {
        create: {
          fullName: 'Fatima Zahra',
          city: 'Casablanca',
          language: 'fr',
        },
      },
    },
    include: { profile: true },
  });

  console.log(`✅ Created 3 demo users`);

  // Seed Demo Brand
  console.log('🏷️ Creating demo brand...');
  const brand = await prisma.brand.create({
    data: {
      vendorId: vendor.id,
      name: 'BeautyCare Ma',
      slug: 'beautycare-ma',
      slogan: 'Votre beauté, notre priorité',
      description: 'Marque marocaine de cosmétiques naturels',
      primaryColor: '#22c55e',
      secondaryColor: '#16a34a',
      logoUrl: 'https://via.placeholder.com/200x200/22c55e/ffffff?text=BC',
      status: 'APPROVED',
      isApproved: true,
      approvedAt: new Date(),
      bankAccounts: {
        create: {
          bankName: 'CIH Bank',
          ribAccount: '011780000012345678901234',
          iceNumber: '001234567',
          isPrimary: true,
        },
      },
    },
  });
  console.log(`✅ Created demo brand: ${brand.name}`);

  console.log(`
  ═════════════════════════════════════════════════
  🎉 Database seeding completed successfully!
  ═════════════════════════════════════════════════
  
  Demo Accounts (password: password123):
  ─────────────────────────────────────────────────
  Super Admin : admin@openseller.ma
  Vendor      : vendor@openseller.ma
  Agent       : agent@openseller.ma
  ─────────────────────────────────────────────────
  `);
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
