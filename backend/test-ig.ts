import { instagramService } from './src/services/instagram.service.js';

async function testIG() {
    try {
        console.log('Testing IG login and fetching for "cristiano"...');
        const info = await instagramService.getUserInfo('cristiano');
        console.log('Success! Found User:', info);
    } catch (error: any) {
        console.error('Test Failed:', error.message);
    }
}

testIG();
