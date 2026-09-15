import { PrismaClient } from "@prisma/client";

// Creating a single, reusable instance of PrismaClient
// (avoids opening too many database connections)
export const prisma = new PrismaClient();