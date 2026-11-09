// GET /api/photos/:photoId -> the image. Only its owner gets it; anyone else gets 404.
// Photos never change once saved (a new photo gets a new id), so the browser may keep its copy.
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
        "Cache-Control": "private, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
    });
    res.end(photo.data);
});

export default router;
