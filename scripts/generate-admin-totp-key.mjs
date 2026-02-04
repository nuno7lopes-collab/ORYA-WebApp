import crypto from "node:crypto";

// 32 bytes (AES-256 key), hex encoded (64 chars)
process.stdout.write(`${crypto.randomBytes(32).toString("hex")}\n`);

