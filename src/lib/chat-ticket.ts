import { createHash, randomBytes } from "node:crypto";

/** A chat ticket is opened by a visitor. The browser keeps the ticket id and a secret token; only a hash of the token is stored. */
export const newChatToken = () => randomBytes(24).toString("base64url");
export const hashChatToken = (t: string) => createHash("sha256").update(t).digest("hex");
