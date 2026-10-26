import { z } from "zod";

const email = z.string().trim().toLowerCase().pipe(z.email());

export const loginSchema = z.object({
  email,
  password: z.string().min(1).max(200),
});

export const createAdminSchema = z.object({
  email,
  // bcrypt hanya membaca 72 byte pertama, jadi lebih panjang dari itu sia-sia
  password: z.string().min(12, "Password minimal 12 karakter").max(72),
});