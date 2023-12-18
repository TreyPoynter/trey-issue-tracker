import passport from 'passport';
import GitHubStrategy from 'passport-github2';
import session from 'express-session';
import debug from 'debug';

const debugAuth = debug('app:Auth');

passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((obj, done) => {
  done(null, obj);
});

passport.use(
  new GitHubStrategy(
    {
      clientID: process.env.CLIENT_ID,
      clientSecret: process.env.CLIENT_SECRET,
      callbackURL: `http://localhost:${process.env.PORT}/auth/github/callback`,
    },
    (accessToken, refreshToken, profile, done) => {
      debugAuth(profile);
      return done(null, profile);
    }
  )
);

export default passport;