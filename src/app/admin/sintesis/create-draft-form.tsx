"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createDraftAction } from "@/lib/actions/synthetic";

const selectClass = "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm";

export function CreateDraftForm({ today }: { today: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[] | undefined>>({});

  async function submit(formData: FormData) {
    setBusy(true);
    setError(null);
    setFieldErrors({});
    try {
      const r = await createDraftAction(formData);
      if (r.ok && r.data) {
        router.push(`/admin/sintesis/${r.data.id}`);
        return;
      }
      if (!r.ok) {
        setError(r.error);
        setFieldErrors(r.fieldErrors ?? {});
      }
    } catch {
      setError("Permintaan gagal. Kemungkinan sesi sudah berakhir: muat ulang halaman dan login lagi.");
    } finally {
      setBusy(false);
    }
  }

  const fe = (name: string) =>
    fieldErrors[name]?.[0] ? (
      <p className="text-sm text-destructive">{fieldErrors[name]?.[0]}</p>
    ) : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Buat draf baru</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="seed">Seed (opsional)</Label>
              <Input id="seed" name="seed" inputMode="numeric" placeholder="kosong = acak" />
              {fe("seed")}
            </div>
            <div className="space-y-2">
              <Label htmlFor="privacy">Tingkat privasi</Label>
              <select id="privacy" name="privacy" defaultValue="BALANCED" className={selectClass}>
                <option value="LOW">Rendah (noise kecil)</option>
                <option value="BALANCED">Seimbang</option>
                <option value="HIGH">Tinggi (noise besar)</option>
              </select>
              {fe("privacy")}
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">Tanggal akhir (opsional)</Label>
              <Input id="endDate" name="endDate" type="date" max={today} />
              {fe("endDate")}
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Draf tidak terlihat publik. Seed yang sama dengan profil yang sama menghasilkan data
            yang sama persis. Tanggal akhir kosong berarti hari ini (WIB).
          </p>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" disabled={busy}>
            {busy ? "Membuat dan memeriksa..." : "Buat draf"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}