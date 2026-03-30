const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
    console.log("Cleaning up duplicate Affiliate Claims...");

    // 1. Delete all RESOLVED Affiliate Claims (since these were the old claims that got cloned, they are redundant)
    const deletedResolved = await prisma.affiliateClaim.deleteMany({
        where: {
            status: 'RESOLVED'
        }
    });
    console.log(`Deleted ${deletedResolved.count} logically superseded RESOLVED claims.`);

    // 2. Update all ACTIVE Affiliate Claims back to APPROVED (since ACTIVE was an incorrect status not supported by the UI)
    const updatedActive = await prisma.affiliateClaim.updateMany({
        where: {
            status: 'ACTIVE'
        },
        data: {
            status: 'APPROVED'
        }
    });
    console.log(`Updated ${updatedActive.count} ACTIVE claims to APPROVED.`);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
