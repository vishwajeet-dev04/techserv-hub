const STATUS_LABELS: Record<string, string> = {
  DUE: 'Due',
  OVERDUE: 'Overdue',
  RECEIVED: 'Received',
  PAID: 'Paid',
}

export function statusLabel(status: string): string {
  return STATUS_LABELS[status.toUpperCase()] ?? status
}
