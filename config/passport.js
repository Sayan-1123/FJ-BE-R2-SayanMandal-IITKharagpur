/**
 * Passport.js Configuration
 * Handles JWT and Google OAuth strategies
 */
const passport = require('passport');
const { Strategy: JwtStrategy, ExtractJwt } = require('passport-jwt');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

module.exports = (User) => {
  // JWT Strategy
  const jwtOpts = {
    jwtFromRequest: ExtractJwt.fromExtractors([
      ExtractJwt.fromAuthHeaderAsBearerToken(),
      (req) => req?.cookies?.token || null,
    ]),
    secretOrKey: process.env.JWT_SECRET,
  };

  passport.use(
    new JwtStrategy(jwtOpts, async (payload, done) => {
      try {
        const user = await User.findByPk(payload.id);
        if (!user) return done(null, false);
        return done(null, user);
      } catch (err) {
        return done(err, false);
      }
    })
  );

  // Google OAuth Strategy (only if credentials configured)
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_ID !== 'your-google-client-id') {
    passport.use(
      new GoogleStrategy(
        {
          clientID: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          callbackURL: process.env.GOOGLE_CALLBACK_URL,
        },
        async (accessToken, refreshToken, profile, done) => {
          try {
            // Check if user exists with this Google ID
            let user = await User.findOne({ where: { google_id: profile.id } });
            if (user) return done(null, user);

            // Check if user exists with same email
            const email = profile.emails?.[0]?.value;
            if (email) {
              user = await User.findOne({ where: { email } });
              if (user) {
                // Link Google account
                user.google_id = profile.id;
                if (!user.name) user.name = profile.displayName;
                await user.save();
                return done(null, user);
              }
            }

            // Create new user
            user = await User.create({
              name: profile.displayName,
              email,
              google_id: profile.id,
              password_hash: null,
            });
            return done(null, user);
          } catch (err) {
            return done(err, null);
          }
        }
      )
    );
  }

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id, done) => {
    try {
      const user = await User.findByPk(id);
      done(null, user);
    } catch (err) {
      done(err, null);
    }
  });

  return passport;
};
