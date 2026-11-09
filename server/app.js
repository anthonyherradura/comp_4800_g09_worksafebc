import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import session from "express-session";
import { MongoStore } from "connect-mongo";
import mongoose from "mongoose";
import config from "./config.js";
import authRoutes from "./routes/auth.js";
import aiRoutes from "./routes/ai.js";
import jobRoutes from "./routes/jobs.js";
import photoRoutes from "./routes/photos.js";
import meRoutes from "./routes/me.js";


const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days: officers are often offline at sites
const DIST_DIR = fileURLToPath(new URL("../dist", import.meta.url));

export function createApp() {
    const app = express();

    // Behind a proxy/host in production, so secure cookies and rate limiting see the real client
    if (config.isProduction) app.set("trust proxy", 1);

    // In production this service also serves the built front end. It sits before the session
    // so requests for static files don't read and touch the session in MongoDB.
    if (config.isProduction) app.use(express.static(DIST_DIR));

    app.use(express.json());
    app.use(
        session({
            name: "hiips360.sid",
            secret: config.sessionSecret,
            resave: false,
            saveUninitialized: false,
            store: MongoStore.create({
                client: mongoose.connection.getClient(),
                collectionName: "sessions",
                ttl: SESSION_MAX_AGE_MS / 1000,
            }),
            cookie: {
                httpOnly: true,
                sameSite: "lax",
                secure: config.isProduction,
                maxAge: SESSION_MAX_AGE_MS,
            },
        }),
    );

    app.get("/api/health", (req, res) => {
        res.json({ ok: true, db: mongoose.connection.readyState === 1 ? "connected" : "disconnected" });
    });
    app.use("/api/auth", authRoutes);
    app.use("/api/ai", aiRoutes);
    app.use("/api/jobs", jobRoutes);
    app.use("/api/photos", photoRoutes);
    app.use("/api/me", meRoutes);

    app.use("/api", (req, res) => {
        res.status(404).json({ error: "Not found." });
    });

    // React Router pages like /home have no file, so they get index.html. A missing file
    // (a path with an extension) stays a 404 rather than returning HTML in place of a script.
    if (config.isProduction) {
        app.get("/{*page}", (req, res, next) => {
            if (path.extname(req.path)) return next();
            res.sendFile("index.html", { root: DIST_DIR });
        });
    }

    // Express 5 forwards rejected promises from async handlers here
    // eslint-disable-next-line no-unused-vars
    app.use((err, req, res, next) => {
        // express.json() rejects malformed bodies with a 400 and a safe message
        if (err.type === "entity.parse.failed") {
            return res.status(400).json({ error: "The request body isn't valid JSON." });
        }
        // A rule in the Mongoose models or MongoDB's validator (server/db/validators.js) refused the write
        if (err.name === "ValidationError" || err.code === 121) {
            return res.status(400).json({ error: "That doesn't fit the data rules. Check the values and try again." });
        }
        if (err.code === 11000) return res.status(409).json({ error: "That already exists." });
        console.error(err);
        res.status(500).json({ error: "Something went wrong on our side. Try again." });
    });

    return app;
}
