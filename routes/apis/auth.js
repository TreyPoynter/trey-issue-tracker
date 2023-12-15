import express from 'express';
import passport from 'passport';
import debug from 'debug';


const router = express.Router();
const debugAuth = debug('app:Auth');

router.get('/github',
    passport.authenticate('github', {scope:['profile']},
    function (req, res) {
        debugAuth(res)
    })
);
router.get('/github/callback',
    passport.authenticate('github', {
        failureRedirect : '/login'
    },
    function (req, res) {
        res.redirect('/');
        debugAuth(req)
        debugAuth(res)
    })
);



export { router as GithubRouter }