import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL wajib diisi"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET minimal 32 karakter"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Environment tidak valid:", z.prettifyError(parsed.error));
  throw new Error("Konfigurasi environment tidak valid");
}

export const env = parsed.data;