import { prisma } from '../lib/prisma.js';
import passport from 'passport';
import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { getSecret } from '../lib/secretStore.js';


export const setupPassport = () => {
  passport.use(
    new JwtStrategy(
      {
        jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
        secretOrKey: process.env.JWT_SECRET!,
      },
      async (payload, done) => {
        try {
          const user = await prisma.user.findUnique({
            where: { uuid: payload.userId },
            include: { role: true },
          });

          if (!user || !user.isActive) {
            return done(null, false);
          }

          return done(null, {
            id: user.id,
            uuid: user.uuid,
            email: user.email,
            phone: user.phone,
            roleId: user.roleId,
            roleName: user.role.name,
          });
        } catch (error) {
          return done(error, false);
        }
      }
    )
  );

  // Read through the store so credentials set in the admin dashboard are used.
  // setupPassport() runs after loadSecrets() (see index.ts), so values are ready.
  const googleClientId = getSecret('GOOGLE_CLIENT_ID');
  const googleClientSecret = getSecret('GOOGLE_CLIENT_SECRET');

  if (googleClientId && googleClientSecret) {
    passport.use(
      new GoogleStrategy(
        {
          clientID: googleClientId,
          clientSecret: googleClientSecret,
          callbackURL: getSecret('GOOGLE_CALLBACK_URL')!,
        },
        async (accessToken, refreshToken, profile, done) => {
          try {
            const email = profile.emails?.[0]?.value;

            if (!email) {
              return done(null, false, { message: 'Email not provided by Google' });
            }

            let user = await prisma.user.findUnique({
              where: { email },
              include: { role: true, profile: true },
            });

            if (!user) {
              const vendorRole = await prisma.role.findUnique({
                where: { name: 'VENDOR' },
              });

              if (!vendorRole) {
                return done(null, false, { message: 'Default role not found' });
              }

              user = await prisma.user.create({
                data: {
                  email,
                  password: '',
                  roleId: vendorRole.id,
                  emailVerifiedAt: new Date(),
                  isActive: true,
                  profile: {
                    create: {
                      fullName: profile.displayName,
                      avatarUrl: profile.photos?.[0]?.value,
                      language: 'fr',
                    },
                  },
                },
                include: { role: true, profile: true },
              });
            }

            return done(null, {
              id: user.id,
              uuid: user.uuid,
              email: user.email,
              phone: user.phone,
              roleId: user.roleId,
              roleName: user.role.name,
            });
          } catch (error) {
            return done(error, false);
          }
        }
      )
    );
  }

  passport.serializeUser((user: any, done) => {
    done(null, user.uuid);
  });

  passport.deserializeUser(async (uuid: string, done) => {
    try {
      const user = await prisma.user.findUnique({
        where: { uuid },
        include: { role: true },
      });
      done(null, user);
    } catch (error) {
      done(error, null);
    }
  });
};
