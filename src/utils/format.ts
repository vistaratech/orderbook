export function formatCurrency(amount: number): string {
  const value = Number.isFinite(amount) ? amount : 0;
  return `₹${value.toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

export function formatDate(dateVal?: string): string {
  if (!dateVal) return '—';
  const trimmed = dateVal.trim();
  if (!trimmed) return '—';

  // If already in format like "25 Aug 2026", "25/08/2026", return it directly
  if (/^\d{1,2}\s+[A-Za-z]{3}\s+\d{4}$/.test(trimmed)) {
    return trimmed;
  }

  const d = new Date(trimmed);
  if (!Number.isNaN(d.getTime())) {
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  return trimmed || '—';
}

export function formatDateTime(dateVal?: string): string {
  if (!dateVal) return '—';
  const trimmed = dateVal.trim();
  if (!trimmed) return '—';

  const d = new Date(trimmed);
  if (!Number.isNaN(d.getTime())) {
    const dateStr = d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
    const hasTime = trimmed.includes('T') || trimmed.includes(':') || d.getHours() !== 0 || d.getMinutes() !== 0;
    if (hasTime) {
      const timeStr = d.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
      return `${dateStr}, ${timeStr}`;
    }
    return dateStr;
  }

  return trimmed || '—';
}

export function todayIso(): string {
  return new Date().toISOString();
}

