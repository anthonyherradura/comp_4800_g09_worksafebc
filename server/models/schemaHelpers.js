// Shared building blocks for the collection definitions in this folder.
//
// Every collection file exports two things that must agree:
//   - the Mongoose model the API code uses, and
//   - `validator`, a MongoDB $jsonSchema (plus $expr rules) that the database itself enforces,
//     so a bug or a script that bypasses Mongoose still can't write a bad document.
// tests/db-models.test.js checks that the two list the same fields.
//
// Naming (see docs/database/HIIPS360_Database_ERD.pdf, section 12): collections are camelCase plurals,
// fields are camelCase, every primary key is _id, and a reference is the referenced collection in the
// singular plus "Id" (hazardRecordId, jobSiteId, userId).

export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
export const MAX_AI_INPUT_CHARS = 500;
export const MAX_COMMENT_CHARS = 2000;

// Options shared by every new schema: no __v field, unknown fields rejected
export const schemaOptions = (collection, extra = {}) => ({
    collection,
    versionKey: false,
    strict: "throw",
    ...extra,
});

// $jsonSchema helpers
export const objectId = { bsonType: "objectId" };
export const date = { bsonType: "date" };
export const nullableDate = { bsonType: ["date", "null"] };
export const bool = { bsonType: "bool" };
export const int = (min, max) => ({ bsonType: "int", ...(min !== undefined && { minimum: min }), ...(max !== undefined && { maximum: max }) });
export const text = (minLength = 1, maxLength) => ({ bsonType: "string", minLength, ...(maxLength && { maxLength }) });
export const nullable = (schema) => ({ ...schema, bsonType: [schema.bsonType, "null"].flat() });
export const oneOf = (...values) => ({ enum: values });

// A collection validator: every listed field must be present (nullable ones may be null) and nothing else is allowed.
export function jsonSchema(properties, { optional = [] } = {}) {
    return {
        bsonType: "object",
        required: Object.keys(properties).filter((k) => k !== "_id" && !optional.includes(k)),
        additionalProperties: false,
        properties: { _id: properties._id ?? objectId, ...properties },
    };
}

// Trims and collapses inner whitespace, so "  Oak St.   tower " and "Oak St. tower" are the same job site
export const normaliseLabel = (value) => (typeof value === "string" ? value.trim().replace(/\s+/g, " ") : value);

// Case-insensitive comparison for unique indexes (strength 2 ignores case, not accents)
export const caseInsensitive = { locale: "en", strength: 2 };
