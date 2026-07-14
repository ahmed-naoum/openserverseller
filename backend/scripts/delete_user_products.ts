import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const email = '123yassine.chaib@gmail.comaad';
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    console.error(`User with email ${email} not found`);
    return;
  }

  console.log(`Found user ${user.id} (${user.email})`);

  // Find all links created by this user
  const links = await prisma.referralLink.findMany({
    where: { influencerId: user.id }
  });

  console.log(`Found ${links.length} links for this user.`);

  for (const link of links) {
    // Delete link clicks
    await prisma.referralLinkClick.deleteMany({ where: { referralLinkId: link.id } });
    // Delete leads
    await prisma.lead.deleteMany({ where: { referralLinkId: link.id } });
    // Delete link itself
    await prisma.referralLink.delete({ where: { id: link.id } });
    console.log(`Deleted link ${link.code}`);
  }

  // Find all products owned by this user
  const products = await prisma.product.findMany({
    where: { ownerId: user.id }
  });

  console.log(`Found ${products.length} products owned by this user.`);

  for (const product of products) {
    // Delete related records
    await prisma.productImage.deleteMany({ where: { productId: product.id } });
    await prisma.affiliateClaim.deleteMany({ where: { productId: product.id } });
    
    // Links for this product
    const productLinks = await prisma.referralLink.findMany({ where: { productId: product.id } });
    for (const pl of productLinks) {
      await prisma.referralLinkClick.deleteMany({ where: { referralLinkId: pl.id } });
      await prisma.lead.deleteMany({ where: { referralLinkId: pl.id } });
      await prisma.referralLink.delete({ where: { id: pl.id } });
    }

    await prisma.productInventory.deleteMany({ where: { productId: product.id } });
    await prisma.inventory.deleteMany({ where: { productId: product.id } });
    await prisma.favorite.deleteMany({ where: { productId: product.id } });
    await prisma.supportRequest.deleteMany({ where: { productId: product.id } });
    await prisma.wholesalePriceTier.deleteMany({ where: { productId: product.id } });
    await prisma.orderItem.deleteMany({ where: { productId: product.id } });
    
    await prisma.product.delete({ where: { id: product.id } });
    console.log(`Deleted product ${product.id} (${product.nameFr})`);
  }

  // Find and delete all affiliate claims made by this user
  const claims = await prisma.affiliateClaim.findMany({
    where: { userId: user.id }
  });
  console.log(`Found ${claims.length} claims for this user.`);
  for (const claim of claims) {
    await prisma.affiliateClaim.delete({ where: { id: claim.id } });
    console.log(`Deleted claim ${claim.id} for product ${claim.productId}`);
  }

  console.log('Done!');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
