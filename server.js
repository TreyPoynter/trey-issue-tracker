import * as dotenv from 'dotenv';
import debug from 'debug';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { authMiddleware } from '@merlin4/express-auth';
import { UserRouter } from './routes/apis/user.js';
import { BugRouter } from './routes/apis/bugs.js';
import { CommentRouter } from './routes/apis/comments.js';
import { TestRouter } from './routes/apis/test.js';

dotenv.config();
const app = express();
app.use(cookieParser());
app.use(express.static('public'));
const debugServer = debug('app:Server');
app.use(express.json());
app.use(cors({
    origin: ["http://localhost:5173", 'https://trey-bugtracker-frontend.uc.r.appspot.com'],
    credentials: true,
}));
const port = process.env.PORT || 5001;

// Custom middleware to move the cookie value to req.auth
app.use((req, res, next) => {
    // Access the 'auth' cookie
    const authToken = req.cookies.auth;

    // Move the cookie value to req.auth
    req.auth = authToken;

    // Continue processing the request
    next();
});

// Use authMiddleware with req.auth
app.use(authMiddleware(process.env.JWT_SECRET, 'auth', {
    httpOnly: true,
    maxAge: 1000 * 60 * 60,
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
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.status(err.status).json({ error: err.message });
});

app.use((req, res) => {
    res.status(404).json({ error: `Couldn't hit ${req.originalUrl}` });
});

app.listen(port, () => {
    debugServer(`Listening on port http://localhost:${port}`);
});
