import { IgApiClient } from 'instagram-private-api';
import dotenv from 'dotenv';
dotenv.config();

export class InstagramService {
    private ig: IgApiClient;
    private isLogged: boolean = false;

    constructor() {
        this.ig = new IgApiClient();
        this.ig.state.generateDevice(process.env.IG_USERNAME || 'zackmurambinda');
    }

    private async login() {
        if (this.isLogged) return;

        try {
            const username = process.env.IG_USERNAME || 'zackmurambinda';
            const password = process.env.IG_PASSWORD || 'Prince007.@@';

            console.log(`[IG] Logging into Instagram as ${username}...`);

            // Execute all requests prior to authorization in the real Android application
            await this.ig.simulate.preLoginFlow();

            const loggedInUser = await this.ig.account.login(username, password);

            console.log(`[IG] Successfully logged in as ${loggedInUser.username}`);

            this.isLogged = true;

            // Optional: simulate post-login flow
            process.nextTick(async () => await this.ig.simulate.postLoginFlow());
        } catch (error) {
            console.error('[IG] Failed to login to Instagram:', error);
            throw new Error('Instagram authentication failed. Please check the credentials.');
        }
    }

    public async getUserInfo(username: string) {
        try {
            if (!this.isLogged) {
                await this.login();
            }

            console.log(`[IG] Fetching info for user @${username}...`);
            const user = await this.ig.user.searchExact(username);

            const userInfo = await this.ig.user.info(user.pk);

            return {
                pk: userInfo.pk,
                username: userInfo.username,
                fullName: userInfo.full_name,
                followerCount: userInfo.follower_count,
                followingCount: userInfo.following_count,
                mediaCount: userInfo.media_count,
                profilePicUrl: userInfo.hd_profile_pic_url_info?.url || userInfo.profile_pic_url,
                biography: userInfo.biography,
                externalUrl: userInfo.external_url,
                isPrivate: userInfo.is_private,
                isVerified: userInfo.is_verified,
            };
        } catch (error: any) {
            console.error(`[IG] Error fetching user @${username}:`, error.message);
            if (error.name === 'IgExactUserNotFoundError') {
                return null;
            }
            throw error;
        }
    }
}

export const instagramService = new InstagramService();
