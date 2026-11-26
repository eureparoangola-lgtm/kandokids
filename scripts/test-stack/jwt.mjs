// Signs a Supabase-style API key (HS256). Usage: node jwt.mjs <role> <secret>
import crypto from "node:crypto";
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const h = b64({ alg: "HS256", typ: "JWT" }), p = b64({ role: process.argv[2], iss: "supabase-demo", exp: 1983812996 });
console.log(`${h}.${p}.${crypto.createHmac("sha256", process.argv[3]).update(`${h}.${p}`).digest("base64url")}`);
