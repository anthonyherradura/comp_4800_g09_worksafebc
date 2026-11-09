// Prepares MongoDB for HIIPS360: applies the jobs and photos validators and builds every index.
// Safe to run again at any time, and needed again after changing server/db/limits.js.
//   npm run db:setup
import mongoose from "mongoose";
import { applySchema, oldCollectionsPresent } from "../server/db/setup.js";

const uri = process.env.MONGODB_URI;
if (!uri) {
    console.error("MONGODB_URI is not set. Copy .env.example to .env and fill it in.");
    process.exit(1);
}

try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
} catch (err) {
    console.error(`Could not connect to MongoDB at ${uri}. Is the MongoDB service running?\n${err.message}`);
    process.exit(1);
}

for (const line of await applySchema()) console.log(`  ${line}`);

const old = await oldCollectionsPresent();
if (old.length) {
    console.log(`\nThese collections are from the old database design and nothing uses them now:\n  ${old.join(", ")}`);
    console.log(`To remove them (users and sessions are kept):\n  npx mongosh "${uri}" --quiet --eval "${old.map((n) => `db.${n}.drop()`).join("; ")}"`);
}

await mongoose.disconnect();
console.log("MongoDB is ready.");
