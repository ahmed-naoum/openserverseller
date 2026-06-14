import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const API_URL = 'http://localhost:3001/api/v1';

async function run() {
  console.log('Creating temporary helper user...');
  const role = await prisma.role.findFirst({ where: { name: 'SUPER_ADMIN' } });
  if (!role) {
    console.error('SUPER_ADMIN role not found');
    process.exit(1);
  }

  const email = 'test_helper@silacod.ma';
  const password = 'testpassword';
  const hashedPassword = await bcrypt.hash(password, 12);

  await prisma.user.deleteMany({ where: { email } });

  const tempUser = await prisma.user.create({
    data: {
      email,
      phone: '+212600000999',
      password: hashedPassword,
      roleId: role.id,
      isActive: true,
      kycStatus: 'APPROVED',
      emailVerifiedAt: new Date(),
      profile: {
        create: {
          fullName: 'Test Helper',
          city: 'Casablanca',
          language: 'fr',
        },
      },
    }
  });

  let token = '';
  try {
    const loginRes = await axios.post(`${API_URL}/auth/login`, {
      email,
      password
    });
    token = loginRes.data.data.tokens.accessToken;
  } catch (err: any) {
    console.error('Failed to log in:', err.response?.data || err.message);
    await prisma.user.delete({ where: { id: tempUser.id } });
    process.exit(1);
  }

  try {
    const ref = 'BRM-010626-6802-11-784';
    console.log(`\nTesting GET /orders/pickup-note/detail/${ref}...`);
    const res = await axios.get(
      `${API_URL}/orders/pickup-note/detail/${ref}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    console.log('Success:', res.data);
  } catch (err: any) {
    console.log('HTTP status:', err.response?.status);
    console.log('Response Message:', err.response?.data?.message || err.message);
  } finally {
    await prisma.user.delete({ where: { id: tempUser.id } });
  }

  await prisma.$disconnect();
}

run().catch(console.error);
