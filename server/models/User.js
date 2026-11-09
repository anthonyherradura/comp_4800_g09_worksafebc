import mongoose from "mongoose";
import { LIMITS } from "../db/limits.js";

const userSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true },
        email: { type: String, required: true, unique: true, lowercase: true, trim: true },
        passwordHash: { type: String, required: true },
        // Home's "Recently viewed" sheets, newest first (routes/me.js). Auth never reads it.
        recentSheetIds: {
            type: [String],
            default: [],
            validate: { validator: (list) => list.length <= LIMITS.recentSheets, message: "Too many recent sheets." },
        },
    },
    { timestamps: true },
);

// The only shape that ever leaves the API. Matches the { user } contract in src/auth/authService.js
userSchema.methods.toPublic = function toPublic() {
    return { name: this.name, email: this.email };
};

export default mongoose.model("User", userSchema);
