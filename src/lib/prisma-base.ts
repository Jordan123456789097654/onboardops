import { PrismaClient } from "@prisma/client";
import { hardenDatabaseUrl } from "./db-url";

/**
 * The plain database client. Only the encryption layer and scripts use it directly. Everything else uses `prisma` from ./prisma.
 * Only errors are logged, never queries, so personal data and parameters never end up in server logs.
 */
const g = globalThis as unknown as { __basePrisma?: PrismaClient };
const url = hardenDatabaseUrl(process.env.DATABASE_URL);
export const basePrisma = g.__basePrisma ?? new PrismaClient({ log: ["error"], ...(url ? { datasourceUrl: url } : {}) });
if (process.env.NODE_ENV !== "production") g.__basePrisma = basePrisma;
