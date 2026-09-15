import { Request, Response, NextFunction } from "express";
import { ZodSchema } from "zod";

// This is a generic function — it works with ANY Zod schema you pass in
export const validate = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: result.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      });
    }

    // Replace req.body with the parsed & validated data
    req.body = result.data;
    next();
  };
};