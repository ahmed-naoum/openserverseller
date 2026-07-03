import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const COLIATY_PUBLIC_KEY = process.env.COLIATY_PUBLIC_KEY;
const COLIATY_SECRET_KEY = process.env.COLIATY_SECRET_KEY;
const COLIATY_BASE_URL = process.env.COLIATY_BASE_URL || 'https://customer-api-v1.coliaty.com';

async function main() {
  console.log('Testing Coliaty API...');
  console.log('URL:', COLIATY_BASE_URL);
  console.log('Public Key starts with:', COLIATY_PUBLIC_KEY?.substring(0, 10));
  console.log('Secret Key starts with:', COLIATY_SECRET_KEY?.substring(0, 10));

  try {
    const response = await axios.post(`${COLIATY_BASE_URL}/cities/getCities`, {}, {
      headers: {
        Authorization: `Bearer ${COLIATY_PUBLIC_KEY}:${COLIATY_SECRET_KEY}`,
        'Content-Type': 'application/json',
        'X-HTTP-Method-Override': 'GET',
      },
      timeout: 10000,
    });
    console.log('Get Cities Success:', response.data.success);
    console.log('Cities count:', response.data.data?.length);
  } catch (err: any) {
    console.error('Get Cities Error:', err.response?.data || err.message);
  }

  try {
    const response = await axios.post(`${COLIATY_BASE_URL}/parcel/normal`, {
      package_reciever: 'Test Recipient',
      package_phone: '0612345678',
      package_price: 250,
      package_addresse: 'Test Address 1234567890',
      package_city: 'Casablanca',
      package_content: 'Test content of parcel',
      package_no_open: false,
      package_replacement: false,
      package_old_tracking: '',
    }, {
      headers: {
        Authorization: `Bearer ${COLIATY_PUBLIC_KEY}:${COLIATY_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });
    console.log('Create Parcel Success:', response.data);
  } catch (err: any) {
    console.error('Create Parcel Error:', err.response?.data || err.message);
  }
}

main();
