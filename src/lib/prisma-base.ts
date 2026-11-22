import { PrismaClient } from "@prisma/client";

/** The plain database client. Only the encryption layer and scripts use it directly. Everything else uses `prisma` from ./prisma. */
const g = globalThis as unknown as { __basePrisma?: PrismaClient };
export const basePrisma = g.__basePrisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") g.__basePrisma = basePrisma;
