import axios from 'axios';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const BASE_URL = 'http://localhost:3001/api/v1';
const JWT_SECRET = 'dev_secret_key_change_in_production_64_chars_long_string_1234567890';
const bypassToken = jwt.sign({ maintenanceBypass: true }, JWT_SECRET);

async function createTestLead(agentId: number) {
  // Get any vendor
  let vendorRole = await prisma.role.findUnique({ where: { name: 'VENDOR' } });
  let vendor = await prisma.user.findFirst({ where: { roleId: vendorRole.id } });
  
  if (!vendor) {
     throw new Error("No vendor found to create a lead.");
  }

  // Get any brand 
  let brand = await prisma.brand.findFirst();
  if (!brand) {
    brand = await prisma.brand.create({
      data: {
        name: 'Test Brand',
        slug: 'test-brand-1234',
        vendorId: vendor.id,
      }
    });
  }

  // Ensure there's a product
  let product = await prisma.product.findFirst({ where: { ownerId: vendor.id } });
  if (!product) {
    product = await prisma.product.create({
      data: {
        sku: 'TEST-PROD-01',
        nameAr: 'Test',
        nameFr: 'Test Product',
        baseCostMad: 50,
        retailPriceMad: 150,
        ownerId: vendor.id,
        isActive: true,
      }
    });
  }

  // Create lead
  const lead = await prisma.lead.create({
    data: {
      vendorId: vendor.id,
      brandId: brand.id,
      fullName: 'Test Client Coliaty',
      phone: '+212612345678',
      city: 'Casablanca',
      address: '123 Rue Test, Casa',
      status: 'ORDERED',
      assignedAgentId: agentId
    }
  });

  return lead;
}

async function runTest() {
  try {
    console.log('1. Logging in as agent...');
    const loginRes = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'agent@silacod.ma',
      password: 'password123',
    }, {
      headers: { 'x-maintenance-bypass': bypassToken }
    });
    
    const token = loginRes.data.data.tokens.accessToken;
    const agentId = loginRes.data.data.user.id;
    const axiosAgent = axios.create({
      baseURL: BASE_URL,
      headers: { 
        Authorization: `Bearer ${token}`,
        'x-maintenance-bypass': bypassToken
      }
    });
    console.log('✅ Logged in successfully');

    console.log('2. Generating a test lead...');
    const targetLead = await createTestLead(agentId);
    console.log(`✅ Created test Lead #${targetLead.id} (${targetLead.fullName})`);

    console.log(`3. Executing push-to-delivery...`);
    try {
      const pushRes = await axiosAgent.post(`/leads/${targetLead.id}/push-to-delivery`, {
        quantity: 1,
        paymentMethod: 'COD'
      });
      
      console.log('✅ SUCCESS! Push-to-delivery response:');
      console.log(JSON.stringify(pushRes.data, null, 2));
    } catch (e: any) {
      console.error('❌ Failed push-to-delivery!');
      console.error(e.response?.data || e.message);
    }
  } catch (err: any) {
    console.error('Test script error:', err.response?.data || err.message);
  } finally {
    await prisma.$disconnect();
  }
}

runTest();
