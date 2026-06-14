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

  // Clean up any existing temp user first
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

  console.log('Logging in as Temp Helper...');
  let token = '';
  try {
    const loginRes = await axios.post(`${API_URL}/auth/login`, {
      email,
      password
    });
    token = loginRes.data.data.tokens.accessToken;
    console.log('Logged in successfully! Token:', token ? 'Exists' : 'Missing');
  } catch (err: any) {
    console.error('Failed to log in:', err.response?.data || err.message);
    // Cleanup
    await prisma.user.delete({ where: { id: tempUser.id } });
    process.exit(1);
  }

  try {
    // 1. Test RETURNED & FACTURED order (with trailing space)
    const order1 = 'OS - 20260430 -AEHOVP ';
    console.log(`\nTesting verify-return with already returned & factured order: "${order1}"`);
    try {
      const res = await axios.post(
        `${API_URL}/leads/verify-return`,
        { code: order1 },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      console.log('Unexpected Success:', res.data);
    } catch (err: any) {
      console.log('Expected Failure (HTTP status):', err.response?.status);
      console.log('Response Message:', err.response?.data?.message);
    }

    // 2. Test non-RETURNED order (DELIVERED, with trailing space)
    const order2 = 'OS - 20260428 -D6SWW5 ';
    console.log(`\nTesting verify-return with non-returned order: "${order2}"`);
    try {
      const res = await axios.post(
        `${API_URL}/leads/verify-return`,
        { code: order2 },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      console.log('Unexpected Success:', res.data);
    } catch (err: any) {
      console.log('Expected Failure (HTTP status):', err.response?.status);
      console.log('Response Message:', err.response?.data?.message);
    }
  } finally {
    console.log('\nCleaning up temporary helper user...');
    await prisma.user.delete({ where: { id: tempUser.id } });
    console.log('Cleanup done.');
  }

  await prisma.$disconnect();
}

run().catch(console.error);
