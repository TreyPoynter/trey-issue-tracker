import * as dotenv from "dotenv"
import debug from 'debug';
import { UserRouter } from "./routes/apis/user.js";
import { BugRouter } from "./routes/apis/bugs.js";
import { CommentRouter } from "./routes/apis/comments.js";
import { TestRouter } from "./routes/apis/test.js";
import express from 'express';
import cors from 'cors'
import cookieParser from "cookie-parser";
import { authMiddleware } from "@merlin4/express-auth";

dotenv.config();
const debugServer = debug('app:Server');
const app = express();
const port = process.env.PORT || 5001;
app.use(express.json())
app.use(cors({
    origin : "http://localhost:5173",
    credentials : true
}))
app.use(express.static('public'));
app.use(cookieParser());
app.use(authMiddleware(process.env.JWT_SECRET, 'authToken', {
    httpOnly: true,
    maxAge: 1000*60*60
}));

app.get('/', (req, res) => {
    debugServer('Home Route hit!');
    res.sendFile('/public/index.html');
});


app.use('/api/users', UserRouter);
app.use('/api/bugs', BugRouter);
app.use('/api/bugs', CommentRouter);
app.use('/api/bug', TestRouter);

app.use((err, req, res, next) => {
    res.status(err.status).json({error: err.message});
});

app.use((req, res) => {
    res.status(404).json({error:`Couldn't hit ${req.originalUrl}`});
});

app.listen(port, () => {
    debugServer(`Listening on port http://localhost:${port}`);
});
