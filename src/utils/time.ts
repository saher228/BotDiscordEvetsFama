export function normalizeTime(s: string): string {
  const trimmed = (s || '').trim();
  const parts = trimmed.split(/[:\s]+/);
  const h = Math.max(0, Math.min(23, parseInt(parts[0], 10) || 0));
  const m = Math.max(0, Math.min(59, parseInt(parts[1], 10) || 0));
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function formatTimeDisplay(normalizedTime: string): string {
  const parts = (normalizedTime || '0:0').split(':');
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  return `${h}:${String(m).padStart(2, '0')}`;
}
