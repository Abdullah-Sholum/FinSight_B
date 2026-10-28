"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

const chartConfig = {
  total: { label: "Total", color: "var(--chart-1)" },
} satisfies ChartConfig;

export function MonthlyChart({
  data,
}: {
  data: { month: string; total: number }[];
}) {
  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-72 w-full">
      <BarChart data={data}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={52}
          tickFormatter={(v: number) => `${(v / 1_000_000).toFixed(1)}jt`}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value) => `Rp${Number(value).toLocaleString("id-ID")}`}
            />
          }
        />
        <Bar dataKey="total" fill="var(--color-total)" radius={4} />
      </BarChart>
    </ChartContainer>
  );
}