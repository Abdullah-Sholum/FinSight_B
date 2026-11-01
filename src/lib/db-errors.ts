export function isUniqueViolation(e: unknown) {
  const err = e as { code?: string; message?: string };
  return (
    err?.code === "P2002" ||
    /duplicate key|unique constraint/i.test(err?.message ?? "")
  );
}