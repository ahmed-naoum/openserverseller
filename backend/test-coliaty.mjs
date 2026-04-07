import axios from 'axios';

const PUBLIC_KEY = '06501423ff39fbf9671bc48ee7247ef2f3d6ee0fb0bd4af2bf6c3696bc6bcc31';
const SECRET_KEY = '7521aeed2cc5bfdc0257ab84703dca59c68f463aac21c8f5c1e958e7a7a29eec';
const BASE_URL = 'https://customer-api-v1.coliaty.com';

const payload = {
  package_reciever: 'Test Client Silacod',
  package_phone: '0612345678',
  package_price: 150,
  package_addresse: '123 Rue Test, Casablanca',
  package_city: 'Casablanca',
  package_content: 'Test Produit',
  package_no_open: false,
  package_replacement: false,
  package_old_tracking: '',
};

console.log('🚀 Testing Coliaty API...');
console.log('URL:', `${BASE_URL}/parcel/normal`);
console.log('Auth:', `Bearer ${PUBLIC_KEY}:${SECRET_KEY}`);
console.log('Payload:', JSON.stringify(payload, null, 2));
console.log('---');

try {
  const res = await axios.post(
    `${BASE_URL}/parcel/normal`,
    payload,
    {
      headers: {
        Authorization: `Bearer ${PUBLIC_KEY}:${SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    }
  );
  console.log('✅ SUCCESS! Status:', res.status);
  console.log('Response:', JSON.stringify(res.data, null, 2));
} catch (err) {
  if (err.code === 'ECONNABORTED') {
    console.error('⏱️ TIMEOUT - Request timed out after 15s');
  } else if (err.response) {
    console.error('❌ HTTP Error:', err.response.status);
    console.error('Response body:', JSON.stringify(err.response.data, null, 2));
  } else {
    console.error('❌ Network Error:', err.message);
    console.error('Code:', err.code);
  }
}
