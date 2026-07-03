import { prisma } from './lib/prisma.js';

async function main() {
  const products = await prisma.product.findMany();
  console.log(`Total Products: ${products.length}`);
  for (const p of products) {
    console.log(`Product ID: ${p.id}, Name: ${p.nameFr}, SKU: ${p.sku}, Stock: ${p.stockQuantity}, OwnerId: ${p.ownerId}`);
  }
}

main().catch(console.error);
