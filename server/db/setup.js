// Shared by scripts/db-setup.mjs and tests/db/integration.test.js, so the test database is prepared exactly like
// the real one: validators applied, indexes built, reference data loaded.
import mongoose from "mongoose";
import { COLLECTIONS } from "../models/index.js";
import { readSheetFiles, loadReferenceData } from "./referenceData.js";

export const REPLICA_SET_HELP = `HIIPS360 needs transactions, which need MongoDB running as a replica set.
Turn your local server into a single-node replica set (one time):
  1. In mongod.cfg (Windows: C:\\Program Files\\MongoDB\\Server\\8.0\\bin\\mongod.cfg) add:
       replication:
         replSetName: rs0
  2. Restart the service (admin PowerShell): Restart-Service MongoDB
  3. Run: mongosh --eval "rs.initiate()"
Then run npm run db:setup again.`;

// Call before mongoose.connect when running setup or tests. Otherwise Mongoose creates every collection (without its
// validator) and builds indexes in the background as soon as it connects, racing applySchema.
export function manualSchemaControl() {
    mongoose.set("autoCreate", false);
    mongoose.set("autoIndex", false);
}

const NAMESPACE_EXISTS = 48;

export async function isReplicaSet(db = mongoose.connection.db) {
    const hello = await db.admin().command({ hello: 1 });
    return Boolean(hello.setName);
}

// Creates each collection with its validator (or updates the validator), then builds the model's indexes.
// Returns one line per collection for logging.
export async function applySchema(db = mongoose.connection.db) {
    const existing = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name));
    const report = [];
    for (const { model, validator } of COLLECTIONS) {
        const name = model.collection.collectionName;
        // users predates the validators, so it only checks documents that are inserted or changed
        const options = { validator, validationLevel: name === "users" ? "moderate" : "strict", validationAction: "error" };
        if (!existing.has(name)) {
            try {
                await db.createCollection(name, options);
                existing.add(name);
            } catch (err) {
                // created meanwhile (for example by a running API server): update it instead
                if (err.code !== NAMESPACE_EXISTS) throw err;
                existing.add(name);
            }
        }
        await db.command({ collMod: name, ...options });
        await model.syncIndexes();
        report.push(`${name.padEnd(26)} validator + ${Object.keys(await model.collection.indexInformation()).length} indexes`);
    }
    return report;
}

export async function loadSheets(dir = "src/data/sheets") {
    return loadReferenceData(await readSheetFiles(dir));
}
