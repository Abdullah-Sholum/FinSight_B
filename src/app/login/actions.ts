"use server";

import { headers } from "next/headers";
import { AuthError } from "next-auth";
import { signIn } from "@/auth";
import { isBlocked, recordFailure } from "@/lib/rate-limit";
import { loginSchema } from "@/lib/validation/auth";

export type LoginState = { error?: string };

const GENERIC_ERROR = "Email atau password salah.";
const MAX_FAILURES = 5;
const WINDOW_MS = 15 * 60 * 1000;

// hanya alamat internal yang boleh jadi tujuan setelah login
function safeRedirect(value: FormDataEntryValue | null) {
  const t = typeof value === "string" ? value : "";
  const ok = t.startsWith("/") && !t.startsWith("//") && !t.startsWith("/\\");
  return ok ? t : "/admin";
}

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: GENERIC_ERROR };

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const keys = [`ip:${ip}`, `email:${parsed.data.email}`];

  if (keys.some((k) => isBlocked(k, MAX_FAILURES))) {
    return { error: "Terlalu banyak percobaan. Coba lagi dalam beberapa menit." };
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: safeRedirect(formData.get("callbackUrl")),
    });
  } catch (e) {
    if (e instanceof AuthError) {
      keys.forEach((k) => recordFailure(k, WINDOW_MS));
      return { error: GENERIC_ERROR };
    }
    throw e; // pengalihan sukses juga berupa "error" internal, harus dilempar ulang
  }
  return {};
}