import passport from "passport";
import { GitHubStrategy } from 'passport-github'

passport.use(
    new GitHubStrategy(
        {
            clientID: process.env.CLIENT_ID,
            clientSecret: process.env.CLIENT_SECRET,
            callbackURL: 'http://localhost:3001/auth/github/callback',
        },
        (accessToken, refreshToken, profile, done) => {
            // Save user data in the database or perform other necessary actions
            return done(null, profile);
        }
    )
);