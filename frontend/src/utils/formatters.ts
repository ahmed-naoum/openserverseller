export function formatCurrency(amount: number | string, currency = 'MAD'): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('fr-MA', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(num);
}

export function formatDate(date: string | Date, locale = 'fr-FR'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(d);
}

export function formatDateTime(date: string | Date, locale = 'fr-FR'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export function formatPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('212')) {
    return `+212 ${cleaned.slice(3, 4)} ${cleaned.slice(4, 6)} ${cleaned.slice(6, 8)} ${cleaned.slice(8, 10)} ${cleaned.slice(10)}`;
  }
  return phone;
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + '...';
}

export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    // Lead statuses
    NEW: 'primary',
    ASSIGNED: 'purple',
    CONTACTED: 'warning',
    INTERESTED: 'success',
    NOT_INTERESTED: 'danger',
    CALLBACK_REQUESTED: 'orange',
    ORDERED: 'success',
    UNREACHABLE: 'gray',
    INVALID: 'danger',
    // Order statuses
    PENDING: 'warning',
    CONFIRMED: 'primary',
    IN_PRODUCTION: 'purple',
    READY_FOR_SHIPPING: 'indigo',
    SHIPPED: 'cyan',
    DELIVERED: 'success',
    CANCELLED: 'danger',
    RETURNED: 'orange',
    REFUNDED: 'gray',
    // Payout statuses
    APPROVED: 'primary',
    PROCESSING: 'purple',
    COMPLETED: 'success',
    REJECTED: 'danger',
    // KYC statuses
    UNDER_REVIEW: 'purple',
    // Brand statuses
    DRAFT: 'gray',
    SUSPENDED: 'danger',
  };
  return colors[status] || 'gray';
}

export function generateOrderNumber(): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `OS-${dateStr}-${random}`;
}

export function calculateVendorEarning(totalAmount: number, commissionPercentage: number = 15): number {
  return totalAmount * (1 - commissionPercentage / 100);
}

export function calculatePlatformFee(totalAmount: number, commissionPercentage: number = 15): number {
  return totalAmount * (commissionPercentage / 100);
}
