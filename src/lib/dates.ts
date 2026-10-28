export const APP_TIME_ZONE = "Asia/Jakarta";

// "hari ini" menurut WIB, bukan zona server (server produksi biasanya UTC)
export function todayInJakarta(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function addDays(iso: string, delta: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

export const isMonthKey = (s: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(s);

export function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 7);
}