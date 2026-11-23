import type { OrderStatus, PaymentStatus } from './types'

export const kes = (n: number | string | null | undefined) =>
  `KES ${Number(n ?? 0).toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`

export const shortKes = (n: number | string | null | undefined) => Number(n ?? 0).toLocaleString('en-KE', { maximumFractionDigits: 0 })

const tz = 'Africa/Nairobi'
export const dateTime = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString('en-KE', { timeZone: tz, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''
export const timeOnly = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleTimeString('en-KE', { timeZone: tz, hour: '2-digit', minute: '2-digit' }) : ''
export const dayMonth = (iso: string) => {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`)
  return { day: d.getDate(), month: d.toLocaleString('en-KE', { month: 'long' }) }
}
export const todayIso = () => new Date().toLocaleDateString('en-CA', { timeZone: tz })
export const daysAgoIso = (n: number) => new Date(Date.now() - n * 86400000).toLocaleDateString('en-CA', { timeZone: tz })

export const minutesUntil = (iso?: string | null) => (iso ? Math.round((new Date(iso).getTime() - Date.now()) / 60000) : null)

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  draft: 'Not paid yet',
  awaitingPayment: 'Waiting for payment',
  paymentPending: 'Check your phone',
  paid: 'Paid, waiting for the hotel',
  accepted: 'Accepted',
  rejected: 'Rejected by the hotel',
  preparing: 'Being prepared',
  readyForPickup: 'Ready for pickup',
  assignedForDelivery: 'Rider assigned',
  outForDelivery: 'On the way',
  delivered: 'Delivered',
  cancellationRequested: 'Refund requested',
  cancelled: 'Cancelled',
  refundPending: 'Refund approved',
  partiallyRefunded: 'Partly refunded',
  refunded: 'Refunded',
  paymentFailed: 'Payment did not go through',
}

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  initiated: 'Starting',
  pending: 'Waiting for PIN',
  paid: 'Paid',
  failed: 'Failed',
  cancelled: 'Cancelled on phone',
  expired: 'Timed out',
}

/** Where an order sits on the student's progress line. */
export const PROGRESS: OrderStatus[] = ['paid', 'accepted', 'preparing', 'readyForPickup', 'outForDelivery', 'delivered']

export function progressIndex(status: OrderStatus): number {
  if (status === 'assignedForDelivery') return PROGRESS.indexOf('readyForPickup')
  return PROGRESS.indexOf(status)
}

export const statusTone = (s: OrderStatus) =>
  ['rejected', 'cancelled', 'paymentFailed'].includes(s) ? 'text-danger'
    : ['delivered', 'refunded'].includes(s) ? 'text-ok'
      : ['paid', 'cancellationRequested'].includes(s) ? 'text-brand' : 'text-ink'
