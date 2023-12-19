import express from "express";
import passport from '../../oauth.js'
import { connect, loginUserGitHub, getUserByGithubId } from '../../database.js'
import debug from "debug";
import { userGithubRegister } from "../../database.js";

const router = express.Router();
const debugAuthRoute = debug('app:AuthRouets');
let githubIdAfterAuthentication;
let fullNameAfterAuthentication;

router.get('/github',
    (req, res) => {
        passport.authenticate('github', { scope: ['user:email'] })(req, res);
    }
);

router.get(
    '/github/callback',
    passport.authenticate('github', {
        failureRedirect: `${process.env.FRONTEND_URL}/login`,
    }),
    async (req, res) => {
        try {
            const { user, isNewUser, githubId } = req.user;
            githubIdAfterAuthentication = githubId;
            fullNameAfterAuthentication = user.fullName;
            if (isNewUser) {
                // Redirect to the route for collecting additional information for new users
                res.redirect(`${process.env.FRONTEND_URL}/${user._id}/almost-there`);
            } else {
                // Send user information to the frontend for storage
                res.status(200).json({ user:user, message : 'Successfully logged in with Github' });
            }
        } catch (error) {
            console.error('Error handling GitHub callback:', error);
            res.redirect(`${process.env.FRONTEND_URL}/login`);
        }
    }
);

// Route to handle the submission of additional information
router.post('/submitAdditionalInfo', async (req, res) => {
    debugAuthRoute('ADDITIONAL INFO HIT')
    try {
        const user = {
            fullName: fullNameAfterAuthentication,
            githubId: githubIdAfterAuthentication,
            givenName: req.body.givenName,
            familyName: req.body.familyName,
            email: req.body.email,
            role: [req.body.role],
            creationDate: new Date()
        };

        await userGithubRegister(githubIdAfterAuthentication, user);

        // Respond with a success message or any relevant data
        res.status(200).json({ message: 'Additional information submitted successfully', user: user });
    } catch (error) {
        console.error('Error submitting additional information:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

router.get('/user', (req, res) => {
    // Check if the user is authenticated
    if (req.isAuthenticated()) {
        // Send user information to the client
        res.json({ user: req.user });
    } else {
        // If not authenticated, send an appropriate response (e.g., 401 Unauthorized)
        res.status(401).json({ message: 'User not authenticated' });
    }
});

router.get('/logout', (req, res) => {
    req.logout();
    res.redirect(process.env.FRONTEND_URL);
});

export { router as AuthRoute }