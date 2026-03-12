import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function main() {
  console.log('Loading dataspace.json...');
  const dataPath = path.resolve(__dirname, '../../../frontend/src/utils/dataspace.json');
  const rawData = fs.readFileSync(dataPath, 'utf-8');
  const jsonData = JSON.parse(rawData);
  const products = jsonData.props?.data?.data || jsonData.data?.data || [];

  // Find the SUPER_ADMIN to assign as owner
  let adminUser = await prisma.user.findFirst({
    where: { role: { name: 'SUPER_ADMIN' } },
  });

  if (!adminUser) {
    adminUser = await prisma.user.findFirst();
  }
  
  const adminId = adminUser?.id;
  console.log(`Using admin user ID: ${adminId} as the product owner.`);

  console.log(`Found ${products.length} products to import.`);

  for (const item of products) {
    console.log(`Processing: ${item.name} (${item.ref})`);

    // 1. Process Categories
    const categoryIds: number[] = [];
    if (item.categories && Array.isArray(item.categories)) {
      for (const cat of item.categories) {
        // Upsert category by slug
        const dbCategory = await prisma.category.upsert({
          where: { slug: cat.slug || cat.name.toLowerCase().replace(/ /g, '-') },
          update: {},
          create: {
            nameAr: cat.name, // Fallbacks
            nameFr: cat.name,
            nameEn: cat.name,
            slug: cat.slug || cat.name.toLowerCase().replace(/ /g, '-'),
          },
        });
        categoryIds.push(dbCategory.id);
      }
    } else if (item.category) {
       // Handle single category object if present
       const cat = item.category;
       const dbCategory = await prisma.category.upsert({
        where: { slug: cat.slug || cat.name.toLowerCase().replace(/ /g, '-') },
        update: {},
        create: {
          nameAr: cat.name,
          nameFr: cat.name,
          nameEn: cat.name,
          slug: cat.slug || cat.name.toLowerCase().replace(/ /g, '-'),
        },
      });
      categoryIds.push(dbCategory.id);
    }
    
    // Ensure at least one category to avoid errors if the schema requires it
    if (categoryIds.length === 0) {
      const defaultCategory = await prisma.category.upsert({
        where: { slug: 'uncategorized' },
        update: {},
        create: {
          nameAr: 'بدون تصنيف',
          nameFr: 'Non classé',
          slug: 'uncategorized'
        }
      });
      categoryIds.push(defaultCategory.id);
    }

    // 2. Prepare Images
    const imagesToCreate = [];
    if (item.media && Array.isArray(item.media) && item.media.length > 0) {
      imagesToCreate.push(...item.media.map((img: any, index: number) => ({
        imageUrl: img.original_url,
        isPrimary: index === 0,
        sortOrder: index,
      })));
    } else if (item.media_url) {
      imagesToCreate.push({
        imageUrl: item.media_url,
        isPrimary: true,
        sortOrder: 0,
      });
    }

    // 3. Prepare Wholesale Prices
    const wholesaleTiersToCreate = [];
    if (item.wholesale_prices && Array.isArray(item.wholesale_prices)) {
      wholesaleTiersToCreate.push(...item.wholesale_prices.map((tier: any, index: number) => ({
        minQuantity: tier.min_quantity,
        maxQuantity: tier.max_quantity,
        pricePerUnit: parseFloat(tier.price_per_unit),
        sortOrder: index,
      })));
    }

    // 4. Create Product
    try {
      await prisma.product.upsert({
        where: { sku: item.ref }, // Use ref as SKU since SKU must be unique
        update: {
          nameAr: item.name,
          nameFr: item.name,
          nameEn: item.name,
          description: item.description,
          longDescription: item.long_description,
          ref: item.ref,
          stockStatus: item.stock,
          stockQuantity: item.stock === 'available' ? 1000 : 0, // Mock stock quantity based on string
          ficheTechniqueUrl: item.fiche_technique_url,
          baseCostMad: parseFloat(item.price) || 0,
          retailPriceMad: parseFloat(item.price) * 1.5 || 0, // Mock retail price as 1.5x
          visibility: 'REGULAR',
          status: 'APPROVED',
          ownerId: adminId,
          categories: {
            set: categoryIds.map(id => ({ id })),
          },
          // Drop all existing images and tiers and recreate
          images: {
             deleteMany: {},
             create: imagesToCreate
          },
          wholesalePrices: {
            deleteMany: {},
            create: wholesaleTiersToCreate
          }
        },
        create: {
          sku: item.ref,
          ref: item.ref,
          nameAr: item.name,
          nameFr: item.name,
          nameEn: item.name,
          description: item.description,
          longDescription: item.long_description,
          stockStatus: item.stock,
          stockQuantity: item.stock === 'available' ? 1000 : 0,
          ficheTechniqueUrl: item.fiche_technique_url,
          baseCostMad: parseFloat(item.price) || 0,
          retailPriceMad: parseFloat(item.price) * 1.5 || 0,
          visibility: 'REGULAR',
          status: 'APPROVED',
          ownerId: adminId,
          categories: {
            connect: categoryIds.map(id => ({ id })),
          },
          images: {
            create: imagesToCreate,
          },
          wholesalePrices: {
            create: wholesaleTiersToCreate,
          }
        },
      });
      console.log(`Successfully imported: ${item.ref}`);
    } catch (error) {
      console.error(`Failed to import product ${item.ref}:`, error);
    }
  }

  console.log('Finished importing dataspace.json!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
