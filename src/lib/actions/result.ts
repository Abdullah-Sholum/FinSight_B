import { z } from "zod";

export type ActionResult<T = undefined> =
  | { ok: true; message?: string; data?: T }
  | {
      ok: false;
      error: string;
      fieldErrors?: Record<string, string[] | undefined>;
    };

export function fail(error: z.ZodError): ActionResult<never> {
  return {
    ok: false,
    error: "Periksa isian formulir.",
    fieldErrors: z.flattenError(error).fieldErrors,
  };
}