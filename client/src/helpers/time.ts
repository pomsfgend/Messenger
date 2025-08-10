// helpers/time.ts
export function formatTime(dateString: string | Date) {
  const d = (dateString instanceof Date) ? dateString : new Date(dateString);
  const h = d.getHours(); // без padStart — чтобы не получить 017
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}
