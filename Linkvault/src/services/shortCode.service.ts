import { customAlphabet } from "nanoid";
import { prisma } from "../config/Prisma";

// Alphabet excludes visually confusing characters (0, O, I, l) for readability
const alphabet =
  "23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

const generateRandomCode = customAlphabet(alphabet, 7);

/**
 * Generates a unique short code by checking the database.
 * Retries if a collision happens (extremely rare with 7 chars, but good practice).
 */
export const generateUniqueShortCode = async (): Promise<string> => {
  let code: string;
  let exists = true;

  do {
    code = generateRandomCode();
    const existingLink = await prisma.link.findUnique({
      where: { shortCode: code },
    });
    exists = existingLink !== null;
  } while (exists);

  return code;
};