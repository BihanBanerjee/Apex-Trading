import { PrismaClient } from "./generated/prisma";

declare global {
    var __prisma: PrismaClient | undefined;
}

// Singleton pattern for development HMR
const prisma = globalThis.__prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
    globalThis.__prisma = prisma;
}

export default prisma;

export * from './generated/prisma';