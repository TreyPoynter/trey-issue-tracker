import * as dotenv from "dotenv"
import debug from 'debug';
import { UserRouter } from "./routes/apis/user.js";
import { BugRouter } from "./routes/apis/bugs.js";
import { CommentRouter } from "./routes/apis/comments.js";
import { TestRouter } from "./routes/apis/test.js";
import { addNewUser, getUserByGithubId } from "./database.js";
import express from 'express';
import cors from 'cors'
import cookieParser from "cookie-parser";
import { authMiddleware } from "@merlin4/express-auth";
import passport from 'passport';
import session from 'express-session';
import { createProxyMiddleware } from 'http-proxy-middleware'
import { Strategy as GitHubStrategy } from 'passport-github2';
import './routes/apis/auth.js';


dotenv.config();
const CLIENT_URL = 'http://localhost:5173'
const app = express();
app.use(cookieParser());
app.use(express.static('public'));
app.use(session({ secret: process.env.JWT_SECRET, resave: true, saveUninitialized: true }));
app.use(passport.initialize());
app.use(passport.session());
const debugServer = debug('app:Server');
app.use(express.json())
app.use(cors({
    origin: ["http://localhost:5173", 'https://trey-bugtracker-frontend.uc.r.appspot.com'],
    credentials: true
}));
const port = process.env.PORT || 5001;

//? START OF GITHUB OAUTH

passport.use(new GitHubStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: `/auth/github/callback`,
    state: true
},
    function (accessToken, refreshToken, profile, done) {
        debugServer(profile)
        return done(null, profile);
    }
));

app.get('/auth/github',
    passport.authenticate('github', { scope: ['user:email'] }));

app.get('/auth/github/callback',
    passport.authenticate('github', { failureRedirect: '/login' }),
    function (req, res) {
        // Successful authentication, redirect home.
        res.redirect('/');
    });
passport.serializeUser(function (user, done) {
    done(null, user.id);
});
passport.deserializeUser(function (user, done) {
    return done(null, user);
});
//? END OF GITHUB OAUTH

app.use(authMiddleware(process.env.JWT_SECRET, 'authToken', {
    httpOnly: true,
    maxAge: 1000 * 60 * 60
}));

app.get('/', (req, res) => {
    debugServer('Home Route hit!');
    res.sendFile('/public/index.html');
});

app.use(express.urlencoded({ extended: true }));
app.use('/api/users', UserRouter);
app.use('/api/bugs', BugRouter);
app.use('/api/bugs', CommentRouter);
app.use('/api/bug', TestRouter);

app.use((err, req, res, next) => {
    res.status(err.status).json({ error: err.message });
});

app.use((req, res) => {
    res.status(404).json({ error: `Couldn't hit ${req.originalUrl}` });
});

app.listen(port, () => {
    debugServer(`Listening on port http://localhost:${port}`);
});
