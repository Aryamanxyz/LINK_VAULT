import { z } from "zod";

export const shortenUrlSchema = z.object({
  originalUrl: z
    .string()
    .url({ message: "Please provide a valid URL" }),

  customAlias: z
    .string()
    .min(3, { message: "Alias must be at least 3 characters" })
    .max(20, { message: "Alias must be under 20 characters" })
    .regex(/^[a-zA-Z0-9_-]+$/, {
      message: "Alias can only contain letters, numbers, hyphens, and underscores",
    })
    .optional(),

  expiresInDays: z
    .number()
    .int()
    .positive()
    .optional(),
});

// This infers a TypeScript type directly from the Zod schema above
export type ShortenUrlInput = z.infer<typeof shortenUrlSchema>;