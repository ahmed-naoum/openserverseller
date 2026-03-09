import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const email = 'naoum_ahmed@hotmail.fr';
    const user = await prisma.user.findUnique({
        where: { email },
        include: {
            referralLinks: true,
            commissions: {
                include: {
                    order: true,
                    referralLink: true
                }
            }
        }
    });

    if (!user) {
        console.log(`User with email ${email} not found`);
        return;
    }

    console.log(`User ID: ${user.id}, UUID: ${user.uuid}`);
    console.log(`Referral Links: ${user.referralLinks.length}`);
    console.log(`Commissions: ${user.commissions.length}`);

    if (user.commissions.length > 0) {
        console.log('Sample Commission:', JSON.stringify(user.commissions[0], null, 2));
    } else {
        console.log('No commissions found for this user.');
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
