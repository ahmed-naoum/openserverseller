import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const email = 'naoum_ahmed@hotmail.fr';
    const user = await prisma.user.findUnique({
        where: { email },
        include: { referralLinks: true }
    });

    if (!user) {
        console.log(`User with email ${email} not found.`);
        return;
    }

    if (user.referralLinks.length === 0) {
        console.log('No referral links found for this user.');
        return;
    }

    const link = user.referralLinks[0];
    const brand = await prisma.brand.findFirst();

    if (!brand) {
        console.log('No brand found in database.');
        return;
    }

    console.log(`Found Brand: ${brand.name} (ID: ${brand.id})`);
    console.log(`Using Referral Link: ${link.code} (ID: ${link.id})`);

    // Create a dummy lead first
    const lead = await prisma.lead.create({
        data: {
            fullName: 'John Doe',
            phone: '0612345678',
            city: 'Casablanca',
            address: 'Test Address',
            status: 'ORDERED'
        }
    });

    // Create a dummy order
    const order = await prisma.order.create({
        data: {
            orderNumber: 'OS-' + Math.random().toString(36).substr(2, 9).toUpperCase(),
            customerName: 'John Doe',
            customerPhone: '0612345678',
            customerCity: 'Casablanca',
            totalAmountMad: 250,
            vendorEarningMad: 200,
            platformFeeMad: 50,
            status: 'CONFIRMED',
            paymentMethod: 'COD',
            brandId: brand.id,
            leadId: lead.id
        }
    });

    // Create a dummy commission
    const commission = await prisma.influencerCommission.create({
        data: {
            influencerId: user.id,
            referralLinkId: link.id,
            orderId: order.id,
            amount: 25,
            status: 'PENDING'
        }
    });

    console.log('Created dummy commission:', commission.id);
    console.log('Success!');
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
