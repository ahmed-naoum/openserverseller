import axios from 'axios';

const BASE_URL = 'http://localhost:3001/api/v1';

async function runTest() {
  try {
    console.log('1. Logging in as agent...');
    const loginRes = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'agent@silacod.ma',
      password: 'password123',
    });
    
    const token = loginRes.data.data.token;
    const axiosAgent = axios.create({
      baseURL: BASE_URL,
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('✅ Logged in successfully');

    console.log('2. Fetching my leads...');
    const leadsRes = await axiosAgent.get('/leads?viewMode=MY_LEADS&limit=100');
    let leads = leadsRes.data.data.leads;
    let targetLead = leads.find(l => l.status === 'ORDERED' || l.status === 'ASSIGNED' || l.status === 'INTERESTED');

    if (!targetLead && leads.length > 0) {
      targetLead = leads[0];
    }

    if (!targetLead) {
      console.log('❌ No leads available for this agent to test with. Trying to claim a lead...');
      const availableRes = await axiosAgent.get('/leads/available');
      if (availableRes.data.data.leads && availableRes.data.data.leads.length > 0) {
        const leadToClaim = availableRes.data.data.leads[0];
        await axiosAgent.post(`/leads/${leadToClaim.id}/claim`);
        console.log(`✅ Claimed lead ${leadToClaim.id}`);
        targetLead = leadToClaim;
      } else {
         console.log('❌ No available leads to claim either. Test aborted.');
         return;
      }
    }

    console.log(`3. Using Lead #${targetLead.id} (${targetLead.fullName})`);

    if (targetLead.status !== 'ORDERED') {
      console.log(`   Updating status to ORDERED...`);
      await axiosAgent.patch(`/leads/${targetLead.id}/status`, { status: 'ORDERED' });
    }

    console.log(`4. Executing push-to-delivery...`);
    try {
      const pushRes = await axiosAgent.post(`/leads/${targetLead.id}/push-to-delivery`, {
        quantity: 1,
        paymentMethod: 'COD'
      });
      
      console.log('✅ SUCCESS! Push-to-delivery response:');
      console.log(JSON.stringify(pushRes.data, null, 2));
    } catch (e) {
      console.error('❌ Failed push-to-delivery!');
      console.error(e.response?.data || e.message);
    }
  } catch (err) {
    console.error('Test script error:', err.response?.data || err.message);
  }
}

runTest();
