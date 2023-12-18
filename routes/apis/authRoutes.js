import express from "express";
import passport from '../../oauth.js'

const router = express.Router();

router.get('/github',
    passport.authenticate('github', { scope: ['user:email'] })
);

router.get('/github/callback',
    passport.authenticate('github', { failureRedirect: '/' }),
    (req, res) => {
        const frontendRedirectURL = 'http://localhost:5173';
        res.redirect(frontendRedirectURL);
    }
);

router.get('/logout', (req, res) => {
    req.logout();
    res.redirect('/');
});

export {router as AuthRoute}