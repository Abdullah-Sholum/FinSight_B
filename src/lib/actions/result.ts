import { z } from "zod";

export type ActionResult =
  | { ok: true; message?: string }
  | {
      ok: false;
      error: string;
      fieldErrors?: Record<string, string[] | undefined>;
    };

export function fail(error: z.ZodError): ActionResult {
  return {
    ok: false,
    error: "Periksa isian formulir.",
    fieldErrors: z.flattenError(error).fieldErrors,
  };
}