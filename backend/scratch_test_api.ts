import 'dotenv/config';
import axios from 'axios';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET is not set (add it to backend/.env)');
const userUuid = 'ef39f3b9-ee1c-464b-a8ec-863909fd947d'; // 123yassine.chaib@gmail.com

const token = jwt.sign({ userId: userUuid }, JWT_SECRET, { expiresIn: '7d' });

async function test() {
  const headers = {
    Authorization: `Bearer ${token}`
  };

  try {
    console.log('Testing public products endpoint with auth...');
    const productsRes = await axios.get('http://localhost:3001/api/v1/public/marketplace/products', {
      params: { view: 'INFLUENCER' },
      headers
    });
    console.log('Products Response Status:', productsRes.status);
    console.log('Products Success:', productsRes.data.status);
    console.log('Products Total:', productsRes.data.data?.total);
    console.log('Products Count:', productsRes.data.data?.products?.length);

    console.log('\nTesting influencer claims endpoint...');
    const claimsRes = await axios.get('http://localhost:3001/api/v1/influencer/claims', { headers });
    console.log('Claims Response Status:', claimsRes.status);
    console.log('Claims Data Length:', Array.isArray(claimsRes.data) ? claimsRes.data.length : claimsRes.data?.data?.length || 'unknown');
  } catch (error: any) {
    console.error('API Request Failed:', error.response?.status, error.response?.data || error.message);
  }
}

test();
