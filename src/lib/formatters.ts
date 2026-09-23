// Indonesian currency and number formatters

export function formatRupiah(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return 'Rp 0';
  }
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatNumber(num: number | null | undefined): string {
  if (num === null || num === undefined || isNaN(num)) {
    return '0';
  }
  return new Intl.NumberFormat('id-ID').format(num);
}

export function formatPercent(rate: number | null | undefined): string {
  if (rate === null || rate === undefined || isNaN(rate)) {
    return '0%';
  }
  // Indonesian format with comma: e.g. 3,7%
  return `${rate.toString().replace('.', ',')}%`;
}

export function formatDateIndo(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  try {
    const date = new Date(dateStr + 'T00:00:00');
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(date);
  } catch {
    return dateStr;
  }
}

export function formatDateShort(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  try {
    const date = new Date(dateStr + 'T00:00:00');
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'short',
    }).format(date);
  } catch {
    return dateStr;
  }
}

export function formatDuration(duration: string | null | undefined): string {
  if (!duration) return '00:00:00';
  return duration;
}
