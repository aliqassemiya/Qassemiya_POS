export function money(n: number): string {
  return (Number.isFinite(n) ? n : 0).toFixed(2);
}

export function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}
