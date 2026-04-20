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
    prisma.role.upsert({
      where: { name: 'SYSTEM_SUPPORT' },
      update: {},
      create: { name: 'SYSTEM_SUPPORT', guardName: 'web' },
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

  // Seed Demo Users
  console.log('👥 Creating demo users...');
  const hashedPassword = await bcrypt.hash('password123', 12);

  const superAdmin = await prisma.user.upsert({
    where: { email: 'admin@silacod.ma' },
    update: {},
    create: {
      email: 'admin@silacod.ma',
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
    where: { email: 'vendor@silacod.ma' },
    update: {},
    create: {
      email: 'vendor@silacod.ma',
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

  await Promise.all([
    prisma.user.upsert({
      where: { email: 'agent@silacod.ma' },
      update: {},
      create: {
        email: 'agent@silacod.ma',
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
    }),
    prisma.user.upsert({
      where: { email: 'confirmation@silacod.ma' },
      update: {},
      create: {
        email: 'confirmation@silacod.ma',
        phone: '+212600000004',
        password: hashedPassword,
        roleId: roleMap['CONFIRMATION_AGENT'],
        isActive: true,
        kycStatus: 'APPROVED',
        emailVerifiedAt: new Date(),
        profile: {
          create: {
            fullName: 'Ahmed Naoum',
            city: 'Casablanca',
            language: 'fr',
          },
        },
      },
    }),
    prisma.user.upsert({
      where: { email: 'influencer@silacod.ma' },
      update: {},
      create: {
        email: 'influencer@silacod.ma',
        phone: '+212600000005',
        password: hashedPassword,
        roleId: roleMap['INFLUENCER'],
        isActive: true,
        kycStatus: 'APPROVED',
        isInfluencer: true,
        emailVerifiedAt: new Date(),
        profile: {
          create: {
            fullName: 'Ali Influencer',
            city: 'Marrakech',
            language: 'fr',
            instagramUsername: 'ali_influencer',
            instagramFollowers: 15000,
          },
        },
      },
    }),
    prisma.user.upsert({
      where: { email: 'support@silacod.ma' },
      update: {},
      create: {
        email: 'support@silacod.ma',
        phone: '+212600000006',
        password: hashedPassword,
        roleId: roleMap['SYSTEM_SUPPORT'],
        isActive: true,
        kycStatus: 'APPROVED',
        emailVerifiedAt: new Date(),
        profile: {
          create: {
            fullName: 'Support Team',
            city: 'Casablanca',
            language: 'fr',
          },
        },
      },
    }),
  ]);

  console.log(`✅ Created 6 demo users`);

  // Seed Demo Bank Account for Vendor
  console.log('🏷️ Creating demo bank account...');
  await prisma.userBankAccount.create({
    data: {
      userId: vendor.id,
      bankName: 'CIH Bank',
      ribAccount: '011780000012345678901234',
      iceNumber: '001234567',
      isDefault: true,
    },
  });
  console.log(`✅ Created demo bank account for vendor`);

  console.log(`
  ═════════════════════════════════════════════════
  🎉 Database seeding completed successfully!
  ═════════════════════════════════════════════════
  
  Demo Accounts (password: password123):
  ─────────────────────────────────────────────────
  Super Admin : admin@silacod.ma
  Support     : support@silacod.ma
  Vendor      : vendor@silacod.ma
  Agent       : agent@silacod.ma
  Conf. Agent : confirmation@silacod.ma
  Influencer  : influencer@silacod.ma
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
