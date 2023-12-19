import passport from 'passport';
import GitHubStrategy from 'passport-github2';
import debug from 'debug';
import {connect} from './database.js'

const debugAuth = debug('app:Auth');

passport.serializeUser(async (user, done) => {
    debugAuth('BAD')
    done(null, user);
});

passport.deserializeUser(async (id, done) => {
    debugAuth('ASS')
    const user = await db.collection('User').findOne({ _id: ObjectId(id) });
    done(null, existingUser);
});

passport.use(
    new GitHubStrategy(
        {
            clientID: process.env.CLIENT_ID,
            clientSecret: process.env.CLIENT_SECRET,
            callbackURL: `http://localhost:${process.env.PORT}/auth/github/callback`,
        },
        async (accessToken, refreshToken, profile, done) => {
            let db = null;

            try {
                db = await connect();
                // Check if the user already exists by githubId
                const existingUser = await db.collection('User').findOne({ githubId: profile.id });

                if (existingUser) {
                    // User already exists, log them in
                    debugAuth('USER EXISTS')
                    return done(null, { user: existingUser, isNewUser: false, githubId: profile.id  });
                }

                // User doesn't exist, create a new user
                const newUser = {
                    githubId: profile.id,
                    fullName: profile.displayName || profile.username,
                    role: ['developer'],
                };

                await db.collection('User').insertOne(newUser);

                // Return the newly created user or any relevant information
                return done(null, {user:newUser, isNewUser:true, githubId: profile.id });

            } catch (err) {
                return done(err);
            }
        }
    )
);

export default passport;