import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const API_URL = 'http://localhost:3001/api/v1';

async function run() {
  console.log('Creating temporary admin user...');
  const role = await prisma.role.findFirst({ where: { name: 'SUPER_ADMIN' } });
  if (!role) {
    console.error('SUPER_ADMIN role not found');
    process.exit(1);
  }

  const email = 'test_admin@silacod.ma';
  const password = 'testpassword';
  const hashedPassword = await bcrypt.hash(password, 12);

  // Clean up any existing temp user first
  await prisma.user.deleteMany({ where: { email } });

  const tempUser = await prisma.user.create({
    data: {
      email,
      phone: '+212600000888',
      password: hashedPassword,
      roleId: role.id,
      isActive: true,
      kycStatus: 'APPROVED',
      emailVerifiedAt: new Date(),
      profile: {
        create: {
          fullName: 'Test Admin',
          city: 'Casablanca',
          language: 'fr',
        },
      },
    }
  });

  console.log('Logging in as Temp Admin...');
  let token = '';
  try {
    const loginRes = await axios.post(`${API_URL}/auth/login`, {
      email,
      password
    });
    token = loginRes.data.data.tokens.accessToken;
    console.log('Logged in successfully!');
  } catch (err: any) {
    console.error('Failed to log in:', err.response?.data || err.message);
    await prisma.user.delete({ where: { id: tempUser.id } });
    process.exit(1);
  }

  try {
    console.log(`\nTesting GET /leads/livraison?limit=100...`);
    const res = await axios.get(
      `${API_URL}/leads/livraison?limit=100`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    console.log('Success status:', res.data.status);
    console.log('Leads count returned:', res.data.data?.leads?.length);
  } catch (err: any) {
    console.log('HTTP status:', err.response?.status);
    console.log('Response Message:', err.response?.data?.message);
  } finally {
    console.log('\nCleaning up temporary admin user...');
    await prisma.user.delete({ where: { id: tempUser.id } });
    console.log('Cleanup done.');
  }

  await prisma.$disconnect();
}

run().catch(console.error);
