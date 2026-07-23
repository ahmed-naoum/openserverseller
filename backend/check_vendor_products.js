const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    include: {
      profile: true
    }
  });
  console.log('--- USERS ---');
  users.forEach(u => {
    console.log(`ID: ${u.id}, Email: ${u.email}, Role: ${u.roleId}`);
  });

  const productsWithOwner = await prisma.product.findMany({
    where: {
      ownerId: { not: null }
    }
  });
  console.log('\n--- PRODUCTS WITH OWNER ---');
  productsWithOwner.forEach(p => {
    console.log(`ID: ${p.id}, SKU: ${p.sku}, OwnerId: ${p.ownerId}`);
  });

  const inventories = await prisma.productInventory.findMany({
    include: {
      product: true
    }
  });
  console.log('\n--- INVENTORIES ---');
  inventories.forEach(i => {
    console.log(`User: ${i.userId}, Product: ${i.productId} (${i.product?.sku}), Qty: ${i.quantity}`);
  });

  const claims = await prisma.affiliateClaim.findMany({
    include: {
      product: true
    }
  });
  console.log('\n--- CLAIMS ---');
  claims.forEach(c => {
    console.log(`User: ${c.userId}, Product: ${c.productId} (${c.product?.sku}), Status: ${c.status}`);
  });
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
