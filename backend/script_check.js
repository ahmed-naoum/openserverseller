const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const products = await prisma.product.findMany();
    console.log("All products:");
    console.log(products.map(p => ({ id: p.id, name: p.nameFr, status: p.status, stock: p.stockQuantity })));

    const inventory = await prisma.productInventory.findMany();
    console.log("\nAll inventory:");
    console.log(inventory.map(i => ({ id: i.id, productId: i.productId, qty: i.quantity })));
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
