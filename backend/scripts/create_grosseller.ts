import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    console.log('Creating GROSSELLER account...');

    const role = await prisma.role.findUnique({
        where: { name: 'GROSSELLER' }
    });

    if (!role) {
        console.error('Role GROSSELLER not found!');
        process.exit(1);
    }

    const hashedPassword = await bcrypt.hash('password123', 12);

    const grosseller = await prisma.user.upsert({
        where: { email: 'grosseller@openseller.ma' },
        update: {},
        create: {
            email: 'grosseller@openseller.ma',
            phone: '+212600000004',
            password: hashedPassword,
            roleId: role.id,
            isActive: true,
            kycStatus: 'APPROVED',
            emailVerifiedAt: new Date(),
            profile: {
                create: {
                    fullName: 'Demo Grosseller',
                    city: 'Casablanca',
                    language: 'fr',
                },
            },
            wallet: {
                create: {
                    balanceMad: 100000,
                    totalEarnedMad: 250000,
                    totalWithdrawnMad: 150000,
                },
            },
        },
        include: { profile: true, wallet: true },
    });

    console.log('✅ Grosseller account created successfully!');
    console.log('Email:', grosseller.email);
    console.log('Password: password123');
}

main()
    .catch((e) => {
        console.error('❌ Error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
