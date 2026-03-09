import instaloader
import sys

def get_followers(username, dummy_user, dummy_pass):
    L = instaloader.Instaloader()
    try:
        L.login(dummy_user, dummy_pass)
        profile = instaloader.Profile.from_username(L.context, username)
        print(f"FOLLOWERS:{profile.followers}")
        print(f"PIC:{profile.profile_pic_url}")
        print(f"NAME:{profile.full_name}")
    except Exception as e:
        print(f"ERROR:{e}")

if __name__ == "__main__":
    if len(sys.argv) < 4:
        print("Usage: python ig_scraper.py <target_username> <dummy_username> <dummy_password>")
        sys.exit(1)
        
    target = sys.argv[1]
    d_user = sys.argv[2]
    d_pass = sys.argv[3]
    get_followers(target, d_user, d_pass)
