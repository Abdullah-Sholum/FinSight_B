"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/admin", label: "Ringkasan", exact: true },
  { href: "/admin/entri", label: "Entri harian", exact: false },
  { href: "/admin/kategori", label: "Kategori", exact: false },
  { href: "/admin/aturan", label: "Aturan", exact: false },
  { href: "/admin/kualitas", label: "Kualitas data", exact: false },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1">
      {LINKS.map((l) => {
        const active = l.exact ? pathname === l.href : pathname.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm transition-colors hover:bg-muted",
              active ? "bg-muted font-medium" : "text-muted-foreground",
            )}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}