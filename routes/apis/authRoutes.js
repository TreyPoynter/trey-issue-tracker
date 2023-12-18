import express from "express";
import passport from '../../oauth.js'

const router = express.Router();

router.get('/github',
    passport.authenticate('github', { scope: ['user:email'] })
);

router.get('/github/callback',
    passport.authenticate('github', { failureRedirect: '/' }),
    (req, res) => {
        // Successful authentication, redirect to the frontend or do whatever you need
        res.redirect('/');
    }
);

router.get('/logout', (req, res) => {
    req.logout();
    res.redirect('/');
});

export {router as AuthRoute}