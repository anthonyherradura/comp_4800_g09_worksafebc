// Prepares MongoDB for HIIPS360: checks it can run transactions, applies every collection's validator,
// builds the indexes, and loads the protocol sheets and checklist steps. Safe to run again at any time.
//   npm run db:setup
import mongoose from "mongoose";
import { isReplicaSet, applySchema, loadSheets, manualSchemaControl, REPLICA_SET_HELP } from "../server/db/setup.js";

const uri = process.env.MONGODB_URI;
if (!uri) {
    console.error("MONGODB_URI is not set. Copy .env.example to .env and fill it in.");
    process.exit(1);
}

manualSchemaControl();
try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
} catch (err) {
    console.error(`Could not connect to MongoDB at ${uri}. Is the MongoDB service running?\n${err.message}`);
    process.exit(1);
}

if (!(await isReplicaSet())) {
    console.error(`MongoDB at ${uri} is a standalone server.\n${REPLICA_SET_HELP}`);
    await mongoose.disconnect();
    process.exit(1);
}

for (const line of await applySchema()) console.log(`  ${line}`);
console.log("Reference data:", await loadSheets());
await mongoose.disconnect();
console.log("MongoDB is ready.");
