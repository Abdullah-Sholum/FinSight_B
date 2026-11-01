export const rupiah = (n: number) => `Rp${Math.round(n).toLocaleString("id-ID")}`;

export const percent = (x: number, digits = 1) => `${(x * 100).toFixed(digits)}%`;

// tanggal kita selalu YYYY-MM-DD; zona UTC mencegah pergeseran sehari
export function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatMonth(ym: string) {
  return new Date(`${ym}-01T00:00:00Z`).toLocaleDateString("id-ID", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatWeekday(iso: string) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("id-ID", {
    weekday: "long",
    timeZone: "UTC",
  });
}

export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}