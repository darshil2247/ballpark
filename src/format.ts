/** Human-readable number: 41M, 8,849, 1.2k, 88. */
export function fmt(n: number): string {
  if (n >= 1e6) {
    const v = n / 1e6;
    return (v >= 10 ? Math.round(v) : Math.round(v * 10) / 10) + "M";
  }
  return Math.round(n).toLocaleString();
}
