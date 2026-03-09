import axios from 'axios';
import * as cheerio from 'cheerio';

async function test() {
    console.log("Fetching followers for 'cristiano' via SocialBlade...");
    try {
        const username = 'cristiano';
        const url = `https://socialblade.com/instagram/user/${username}`;

        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
            },
            timeout: 10000,
        });

        const html = response.data;
        console.log("Successfully fetched HTML page. Length:", html.length);

        const $ = cheerio.load(html);
        let followersText = '';

        $('div.YouTubeUserTopInfo').each((i, el) => {
            const text = $(el).text();
            if (text.toLowerCase().includes('followers')) {
                followersText = $(el).find('span[style*="font-weight: bold"]').text().trim();
                if (!followersText) {
                    const parts = text.split('Followers');
                    if (parts.length > 1) {
                        followersText = parts[1].trim();
                    }
                }
            }
        });

        if (!followersText) {
            followersText = $('#youtube-stats-header-subs').text().trim();
        }

        console.log("Found Followers Text:", followersText);
    } catch (error: any) {
        console.log("Error:", error.message);
        if (error.response) {
            console.log("Status:", error.response.status);
            // console.log(error.response.data);
        }
    }
}

test();
