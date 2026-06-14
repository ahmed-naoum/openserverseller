import axios from 'axios';

const PUBLIC_KEY = '06501423ff39fbf9671bc48ee7247ef2f3d6ee0fb0bd4af2bf6c3696bc6bcc31';
const SECRET_KEY = '7521aeed2cc5bfdc0257ab84703dca59c68f463aac21c8f5c1e958e7a7a29eec';

const BASE_URL = 'https://customer-api-v1.coliaty.com';
const ref = 'BRM-010626-6802-11-784';

async function test(url: string) {
  console.log(`\nTesting GET ${url}`);
  try {
    const res = await axios.get(
      url,
      {
        headers: {
          Authorization: `Bearer ${PUBLIC_KEY}:${SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );
    console.log('✅ SUCCESS! Status:', res.status);
    console.log('Response:', JSON.stringify(res.data, null, 2));
  } catch (err: any) {
    console.error('❌ HTTP Error:', err.response?.status);
    console.error('Response body:', typeof err.response?.data === 'string' ? err.response?.data.substring(0, 100) : JSON.stringify(err.response?.data, null, 2));
  }
}

async function run() {
  await test(`${BASE_URL}//api/client/auth/test`);
  await test(`${BASE_URL}/api/client/auth/test`);
  await test(`${BASE_URL}//api/client/pickup-note/detail/${ref}`);
  await test(`${BASE_URL}/api/client/pickup-note/detail/${ref}`);
  await test(`${BASE_URL}/pickup-note/detail/${ref}`);
}

run();
