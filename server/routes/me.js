// The signed-in officer's own settings.
//   GET  /api/me/recent-sheets              -> { recentSheetIds }  newest first
//   POST /api/me/recent-sheets { sheetId }  -> { recentSheetIds }  moves it to the front, keeps LIMITS.recentSheets
import { Router } from "express";
import mongoose from "mongoose";
import requireAuth from "../middleware/requireAuth.js";
import User from "../models/User.js";
import { LIMITS } from "../db/limits.js";
import { sheetExists } from "../services/sheetCatalog.js";

const router = Router();
router.use(requireAuth);

router.get("/recent-sheets", async (req, res) => {
    const user = await User.findById(req.userId).select("recentSheetIds").lean();
    if (!user) return res.status(401).json({ error: "Not signed in." });
    res.json({ recentSheetIds: user.recentSheetIds ?? [] });
});

router.post("/recent-sheets", async (req, res) => {
    const sheetId = req.body?.sheetId;
    if (typeof sheetId !== "string" || !sheetExists(sheetId)) return res.status(400).json({ error: "That protocol sheet doesn't exist." });

    // One update: put it first, drop any older copy of it, keep the newest few
    const id = { $literal: sheetId };
    const user = await User.collection.findOneAndUpdate(
        { _id: new mongoose.Types.ObjectId(String(req.userId)) },
        [{
            $set: {
                recentSheetIds: {
                    $slice: [
                        { $concatArrays: [[id], { $filter: { input: { $ifNull: ["$recentSheetIds", []] }, cond: { $ne: ["$$this", id] } } }] },
                        LIMITS.recentSheets,
                    ],
                },
            },
        }],
        { returnDocument: "after", projection: { recentSheetIds: 1 } },
    );
    if (!user) return res.status(401).json({ error: "Not signed in." });
    res.json({ recentSheetIds: user.recentSheetIds });
});

export default router;
