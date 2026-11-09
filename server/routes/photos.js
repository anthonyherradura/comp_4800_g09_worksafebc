// GET /api/photos/:photoId -> the image. Only its owner gets it; anyone else gets 404.
// The browser may keep a copy, but must ask here every time (no-cache), so a shared device can't show one
// officer's photo to another, or a deleted photo. A photo never changes, so its id is its ETag and a repeat
// view by its owner answers 304 without sending the image again.
import { Router } from "express";
import requireAuth from "../middleware/requireAuth.js";
import Photo from "../models/Photo.js";
import { checkIds, notFound } from "./ids.js";

const router = Router();
router.use(requireAuth);
checkIds(router, ["photoId"]);

router.get("/:photoId", async (req, res) => {
    const photo = await Photo.findOne({ _id: req.params.photoId, userId: req.userId });
    if (!photo) return notFound(res, "Photo");
    res.set({
        "Content-Type": photo.contentType,
        "Content-Length": photo.data.length,
        "Cache-Control": "private, no-cache",
        ETag: `"${photo.id}"`,
        "X-Content-Type-Options": "nosniff",
    });
    if (req.fresh) return res.status(304).end();
    res.end(photo.data);
});

export default router;
