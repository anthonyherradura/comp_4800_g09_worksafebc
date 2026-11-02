// AI API. Needs a signed-in officer.
//   POST /api/ai/suggest-hazard  (multipart: text?, photo?)  -> 200 { suggestion }
// Errors are { error } with a message that is safe to show to the officer.

import { Router } from "express";
import multer from "multer";
import { rateLimit } from "express-rate-limit";
import requireAuth from "../middleware/requireAuth.js";
import { suggestHazard } from "../services/gemini.js";

const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
const MAX_TEXT_CHARS = 500;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

// Protects your Gemini quota
const aiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "Too many suggestions. Wait a few minutes and try again." },
});

const upload = multer({
    storage: multer.memoryStorage(), // the photo only needs to live long enough to reach Gemini
    limits: { fileSize: MAX_PHOTO_BYTES, files: 1 },
    fileFilter: (req, file, cb) =>
        ALLOWED_TYPES.includes(file.mimetype)
            ? cb(null, true)
            : cb(Object.assign(new Error("Unsupported photo type."), { code: "BAD_PHOTO_TYPE" })),
});

const uploadPhoto = (req, res, next) =>
    upload.single("photo")(req, res, (err) => {
        if (!err) return next();
        if (err.code === "LIMIT_FILE_SIZE") return res.status(400).json({ error: "The photo must be under 10 MB." });
        if (err.code === "BAD_PHOTO_TYPE") return res.status(400).json({ error: "Photos must be JPEG, PNG or WebP." });
        // LIMIT_FILE_COUNT: two files in the photo field; LIMIT_UNEXPECTED_FILE: a file in another field
        if (err.code === "LIMIT_FILE_COUNT" || err.code === "LIMIT_UNEXPECTED_FILE") {
            return res.status(400).json({ error: "Send one photo at a time." });
        }
        next(err);
    });

const asString = (value) => (typeof value === "string" ? value : "");

const router = Router();

router.post("/suggest-hazard", requireAuth, aiLimiter, uploadPhoto, async (req, res) => {
    const text = asString(req.body?.text).trim();
    const photo = req.file;

    if (!text && !photo) return res.status(400).json({ error: "Add a photo or describe the hazard first." });
    if (text.length > MAX_TEXT_CHARS) {
        return res.status(400).json({ error: `Keep the description under ${MAX_TEXT_CHARS} characters.` });
    }

    try {
        const suggestion = await suggestHazard({ text, photo });
        res.json({ suggestion });
    } catch (err) {
        if (err.code === "BAD_PHOTO") {
            return res.status(400).json({ error: "We couldn't read that photo. Try another one." });
        }
        console.error("Gemini request failed:", err);
        const detail = process.env.NODE_ENV === "production" ? "" : ` (${err.message})`;
        res.status(502).json({
            error: `The AI suggestion service isn't available right now. Try again in a moment.${detail}`,
        });
    }
});

export default router;