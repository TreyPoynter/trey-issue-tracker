import * as dotenv from "dotenv";
import debug from "debug";
import { UserRouter } from "./routes/apis/user.js";
import { BugRouter } from "./routes/apis/bugs.js";
import { CommentRouter } from "./routes/apis/comments.js";
import { TestRouter } from "./routes/apis/test.js";
import { AuthRoute } from "./routes/apis/authRoutes.js";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { authMiddleware } from "@merlin4/express-auth";
import session from "express-session";
import passport from "./oauth.js";
import { MongoClient } from 'mongodb';

dotenv.config();
const CLIENT_URL = "http://localhost:5173";
const app = express();
app.use(cookieParser());
app.use(express.static("public"));
app.use(session({ secret: process.env.JWT_SECRET, resave: true, saveUninitialized: true }));
const debugServer = debug("app:Server");
app.use(express.json());
app.use(
    cors({
        origin: ["http://localhost:5173", "https://trey-bugtracker-frontend.uc.r.appspot.com"],
        credentials: true,
    })
);
app.use(passport.initialize());
app.use(passport.session());
const port = process.env.PORT || 5001;

app.use(
    authMiddleware(process.env.JWT_SECRET, "authToken", {
        httpOnly: true,
        maxAge: 1000 * 60 * 60,
    })
);

app.get("/", (req, res) => {
    debugServer("Home Route hit!");
    res.sendFile("/public/index.html");
});

app.use(express.urlencoded({ extended: true }));
app.use("/api/users", UserRouter);
app.use("/api/bugs", BugRouter);
app.use("/api/bugs", CommentRouter);
app.use("/api/bug", TestRouter);
app.use("/auth", AuthRoute);

app.use((err, req, res, next) => {
    res.status(err.status).json({ error: err.message });
});

app.use((req, res) => {
    res.status(404).json({ error: `Couldn't hit ${req.originalUrl}` });
});

app.listen(port, () => {
    debugServer(`Listening on port http://localhost:${port}`);
});
