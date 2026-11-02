// Test-only: evaluates the subset of MongoDB's $jsonSchema and $expr that server/models uses, so the validators'
// rules can be checked without a running server. It follows MongoDB's documented behaviour for these operators;
// tests/db/integration.test.js checks the same documents against a real server.
import mongoose from "mongoose";

export function bsonType(value) {
    if (value === null) return "null";
    if (value instanceof Date) return "date";
    if (value instanceof mongoose.Types.ObjectId) return "objectId";
    if (Buffer.isBuffer(value)) return "binData";
    if (typeof value === "boolean") return "bool";
    if (typeof value === "string") return "string";
    if (typeof value === "number") return Number.isInteger(value) && Math.abs(value) < 2 ** 31 ? "int" : "double";
    if (Array.isArray(value)) return "array";
    if (typeof value === "object") return "object";
    return typeof value;
}

// Returns a list of problems (empty = valid)
export function checkJsonSchema(schema, value, at = "$") {
    const problems = [];
    const types = schema.bsonType ? [schema.bsonType].flat() : null;
    if (types && !types.includes(bsonType(value))) return [`${at}: expected ${types.join("|")}, got ${bsonType(value)}`];
    if (schema.enum && !schema.enum.includes(value)) problems.push(`${at}: ${JSON.stringify(value)} not in enum`);
    if (typeof value === "string") {
        if (schema.minLength !== undefined && [...value].length < schema.minLength) problems.push(`${at}: shorter than ${schema.minLength}`);
        if (schema.maxLength !== undefined && [...value].length > schema.maxLength) problems.push(`${at}: longer than ${schema.maxLength}`);
        if (schema.pattern && !new RegExp(schema.pattern, "u").test(value)) problems.push(`${at}: doesn't match ${schema.pattern}`);
    }
    if (typeof value === "number") {
        if (schema.minimum !== undefined && value < schema.minimum) problems.push(`${at}: below ${schema.minimum}`);
        if (schema.maximum !== undefined && value > schema.maximum) problems.push(`${at}: above ${schema.maximum}`);
    }
    if (schema.not && checkJsonSchema(schema.not, value, at).length === 0) problems.push(`${at}: matches a forbidden pattern`);
    if (bsonType(value) === "object" && !(value instanceof Date)) {
        for (const key of schema.required ?? []) if (!(key in value)) problems.push(`${at}.${key}: required`);
        for (const [key, v] of Object.entries(value)) {
            if (schema.properties?.[key]) problems.push(...checkJsonSchema(schema.properties[key], v, `${at}.${key}`));
            else if (schema.additionalProperties === false) problems.push(`${at}.${key}: not allowed`);
        }
    }
    return problems;
}

// Aggregation-expression evaluator for the operators the validators use
export function evalExpr(expr, doc) {
    if (typeof expr === "string" && expr.startsWith("$")) {
        const v = doc[expr.slice(1)];
        return v === undefined ? null : v;
    }
    if (expr === null || typeof expr !== "object" || expr instanceof Date || Array.isArray(expr)) return expr;
    const [op, args] = Object.entries(expr)[0];
    const ev = (a) => evalExpr(a, doc);
    const cmp = (a, b) => {
        const [x, y] = [ev(a), ev(b)];
        if (x instanceof Date && y instanceof Date) return x - y;
        if (x === null && y === null) return 0;
        if (x === null) return -1; // null sorts before everything
        if (y === null) return 1;
        return x < y ? -1 : x > y ? 1 : 0;
    };
    switch (op) {
        case "$eq": return cmp(args[0], args[1]) === 0;
        case "$ne": return cmp(args[0], args[1]) !== 0;
        case "$gte": return cmp(args[0], args[1]) >= 0;
        case "$and": return args.every((a) => Boolean(ev(a)));
        case "$or": return args.some((a) => Boolean(ev(a)));
        case "$concat": return args.map(ev).some((v) => v === null) ? null : args.map(ev).join("");
        case "$toString": return String(ev(args));
        case "$strLenCP": return [...ev(args)].length;
        case "$subtract": return ev(args[0]) - ev(args[1]);
        case "$substrCP": return [...ev(args[0])].slice(ev(args[1]), ev(args[1]) + ev(args[2])).join("");
        case "$binarySize": return ev(args)?.length ?? null;
        default: throw new Error(`evalExpr: ${op} not supported`);
    }
}

// Full collection validator: $jsonSchema problems, plus "$expr" if that rule fails
export function checkValidator(validator, doc) {
    const problems = checkJsonSchema(validator.$jsonSchema, doc);
    if (problems.length === 0 && validator.$expr && !evalExpr(validator.$expr, doc)) problems.push("$expr rule failed");
    return problems;
}

// What Mongoose would send to MongoDB for a document (defaults applied, setters run)
export function toStored(Model, fields) {
    const doc = new Model(fields);
    const obj = doc.toObject({ depopulate: true, virtuals: false, getters: false });
    for (const [k, v] of Object.entries(obj)) if (v?._bsontype === "Binary") obj[k] = Buffer.from(v.buffer);
    return obj;
}
