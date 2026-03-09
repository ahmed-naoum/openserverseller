import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    console.log('Starting cleanup of duplicate support requests...');

    const requests = await prisma.supportRequest.findMany({
        where: {
            status: 'OPEN',
            productId: { not: null }
        },
        orderBy: { createdAt: 'desc' }
    });

    const seen = new Set();
    let deletedCount = 0;

    for (const req of requests) {
        const key = `${req.userId}-${req.productId}`;
        if (seen.has(key)) {
            console.log(`Deleting duplicate request ID: ${req.id} for Product ID: ${req.productId}`);
            await prisma.supportRequest.delete({
                where: { id: req.id }
            });
            deletedCount++;
        } else {
            seen.add(key);
        }
    }

    console.log(`Cleanup finished. Deleted ${deletedCount} duplicates.`);
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
