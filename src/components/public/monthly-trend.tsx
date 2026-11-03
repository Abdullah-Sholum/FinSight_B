"use client";

import { useState } from "react";
import { MonthlyChart } from "@/components/charts/monthly-chart";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { rupiah } from "@/lib/format";

export type TrendMonth = { label: string; total: number; avg: number; days: number };

export function MonthlyTrend({ months }: { months: TrendMonth[] }) {
  const [mode, setMode] = useState<"total" | "avg">("total");
  if (months.length === 0) return null;

  const data = months.map((m) => ({
    month: m.label,
    total: mode === "total" ? m.total : m.avg,
  }));
  const first = months[0];
  const last = months[months.length - 1];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Jenis nilai grafik">
        <Button
          size="sm"
          variant={mode === "total" ? "default" : "outline"}
          aria-pressed={mode === "total"}
          onClick={() => setMode("total")}
        >
          Total
        </Button>
        <Button
          size="sm"
          variant={mode === "avg" ? "default" : "outline"}
          aria-pressed={mode === "avg"}
          onClick={() => setMode("avg")}
        >
          Rata-rata harian
        </Button>
      </div>

      <MonthlyChart data={data} label={mode === "total" ? "Total" : "Rata-rata harian"} />

      <p className="text-xs text-muted-foreground">
        Bulan pertama ({first.label}, {first.days} hari) dan terakhir ({last.label}, {last.days}{" "}
        hari) bisa belum penuh. Rata-rata harian lebih adil untuk membandingkan antarbulan.
      </p>

      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground">Lihat sebagai tabel</summary>
        <div className="mt-2 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Bulan</TableHead>
                <TableHead className="text-right">Hari tercatat</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Rata-rata per hari</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {months.map((m) => (
                <TableRow key={m.label}>
                  <TableCell>{m.label}</TableCell>
                  <TableCell className="text-right">{m.days}</TableCell>
                  <TableCell className="text-right">{rupiah(m.total)}</TableCell>
                  <TableCell className="text-right">{rupiah(m.avg)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </details>
    </div>
  );
}