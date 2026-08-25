/** Short display label for booking IDs (full id kept in DB). */
export function formatBookingIdDisplay(id: string): string {
  if (!id) return '—';
  const trimmed = id.trim();

  // CY-20260617-099860 or CS-20260617-099860 → CY-099860 / CS-099860
  const longCourtyardId = /^(CY|CS)-(\d{8})-(\d{4,6})$/i.exec(trimmed);
  if (longCourtyardId) {
    return `${longCourtyardId[1].toUpperCase()}-${longCourtyardId[3]}`;
  }

  if (/^(CY|CS)-\d{4,8}$/i.test(trimmed)) {
    return trimmed.toUpperCase();
  }

  // UUID or other long ids → last 8 chars
  if (/^[0-9a-f-]{32,36}$/i.test(trimmed)) {
    return `#${trimmed.replace(/-/g, '').slice(-8).toUpperCase()}`;
  }

  if (trimmed.length > 12) {
    return `#${trimmed.slice(-8).toUpperCase()}`;
  }

  return trimmed;
}

export function getSubscriptionPaymentLabel(sub: {
  status: string;
  paymentId?: string;
  paymentStatus?: string;
}): string {
  if (sub.status === 'expired') return 'Paid';
  if (sub.status === 'cancelled') return 'Cancelled';
  if (sub.paymentStatus === 'paid') return 'Paid';
  if (String(sub.paymentId || '').toUpperCase().startsWith('ONSITE')) return 'Pending';
  if (sub.status === 'active' || sub.status === 'paused') return 'Pending';
  return 'Pending';
}

export function getBookingPaymentState(booking: {
  paymentStatus?: string;
  paymentId?: string;
}): 'paid' | 'pending' {
  if (booking.paymentStatus === 'paid') return 'paid';
  if (booking.paymentStatus === 'pending') return 'pending';
  if (String(booking.paymentId || '').toUpperCase().startsWith('ONSITE')) return 'pending';
  return 'paid';
}

export function getSubscriptionPaymentState(sub: {
  status: string;
  paymentStatus?: string;
  paymentId?: string;
}): 'paid' | 'pending' {
  if (sub.paymentStatus === 'paid') return 'paid';
  if (sub.paymentStatus === 'pending') return 'pending';
  if (String(sub.paymentId || '').toUpperCase().startsWith('ONSITE')) return 'pending';
  if (sub.status === 'expired') return 'paid';
  return 'pending';
}
