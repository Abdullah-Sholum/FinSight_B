"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/actions/result";

type Action = (formData: FormData) => Promise<ActionResult>;

async function runAction(action: Action, formData: FormData): Promise<ActionResult> {
  try {
    return await action(formData);
  } catch {
    // proxy mengalihkan ke login, jaringan putus, atau error server tak terduga
    return {
      ok: false,
      error:
        "Permintaan gagal. Kemungkinan sesi sudah berakhir: muat ulang halaman dan login lagi.",
    };
  }
}

export function useActionDialog(action: Action) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);

  async function submit(formData: FormData) {
    const r = await runAction(action, formData);
    if (r.ok) {
      setOpen(false);
      setResult(null);
    } else {
      setResult(r);
    }
  }
  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) setResult(null);
  }
  return { open, setOpen, result, submit, onOpenChange };
}

// untuk form di dalam halaman (bukan dialog)
export function useActionForm(action: Action, onSuccess?: () => void) {
  const [result, setResult] = useState<ActionResult | null>(null);

  async function submit(formData: FormData) {
    const r = await runAction(action, formData);
    setResult(r);
    if (r.ok) onSuccess?.();
  }
  return { result, submit };
}

export function SubmitButton({
  children,
  variant,
  size,
}: {
  children: React.ReactNode;
  variant?: "default" | "destructive" | "outline";
  size?: "default" | "sm";
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} size={size} disabled={pending}>
      {pending ? "Memproses..." : children}
    </Button>
  );
}

export function FormMessage({ result }: { result: ActionResult | null }) {
  if (!result) return null;
  if (result.ok) {
    return result.message ? (
      <p role="status" className="text-sm text-green-600 dark:text-green-500">
        {result.message}
      </p>
    ) : null;
  }
  return (
    <p role="alert" className="text-sm text-destructive">
      {result.error}
    </p>
  );
}

export function FieldError({ result, name }: { result: ActionResult | null; name: string }) {
  if (!result || result.ok) return null;
  const msg = result.fieldErrors?.[name]?.[0];
  return msg ? <p className="text-sm text-destructive">{msg}</p> : null;
}