import axios from 'axios';

async function scrapePublicIg(username: string) {
    try {
        const url = `https://i.instagram.com/api/v1/users/web_profile_info/?username=${username}`;
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'X-IG-App-ID': '936619743392459', // Required ID for web profile info
            }
        });

        const userData = response.data.data.user;
        console.log(`Followers for @${username}: ${userData.edge_followed_by.count}`);
        return userData;
    } catch (error: any) {
        console.error('Failed to scrape public IG:', error.response?.status || error.message);
    }
}

scrapePublicIg('cristiano');
