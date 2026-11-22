import type { PrismaClient } from "@prisma/client";
import { basePrisma } from "./prisma-base";
import { encryptionExtension } from "./crypto/extension";

/**
 * The client the whole app uses. Sensitive columns are encrypted on the way in and decrypted on the way out
 * (see ./crypto/extension.ts), so the rest of the code reads and writes plain values.
 * It is typed as a plain PrismaClient because the extension does not change any model types.
 */
const g = globalThis as unknown as { __encPrisma?: PrismaClient };
export const prisma: PrismaClient = g.__encPrisma ?? (basePrisma.$extends(encryptionExtension) as unknown as PrismaClient);
if (process.env.NODE_ENV !== "production") g.__encPrisma = prisma;
