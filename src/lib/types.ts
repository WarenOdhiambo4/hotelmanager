// Row shapes returned by Supabase (camelCase, exactly as the tables are named).

export type AppRole = 'student' | 'vendorStaff' | 'rider' | 'admin' | 'finance' | 'support'

export type OrderStatus =
  | 'draft' | 'awaitingPayment' | 'paymentPending' | 'paid' | 'accepted' | 'rejected' | 'preparing'
  | 'readyForPickup' | 'assignedForDelivery' | 'outForDelivery' | 'delivered' | 'cancellationRequested'
  | 'cancelled' | 'refundPending' | 'partiallyRefunded' | 'refunded' | 'paymentFailed'

export type PaymentStatus = 'initiated' | 'pending' | 'paid' | 'failed' | 'cancelled' | 'expired'

export type Profile = {
  id: string
  fullName: string
  email: string | null
  phone: string | null
  phoneVerified: boolean
  role: AppRole
  hostel: string | null
  appearance: { theme?: string }
  smsOptIn: boolean
  whatsappOptIn: boolean
  avatarPath?: string | null
}

export type Vendor = {
  id: string
  name: string
  /** Platform fee per order for this seller; null = the standard fee. Admin only. */
  platformFee?: number | string | null
  /** A student or small seller (not a hotel). */
  isStudentSeller?: boolean
  slug: string
  description: string | null
  location: string | null
  phone?: string | null
  logoPath: string | null
  coverPath: string | null
  openingHours: string | null
  prepMinutes: number
  isOpen: boolean
  isActive: boolean
  paymentType?: 'paybill' | 'till' | null
  mpesaShortcode?: string | null
  headOfficeNumber?: string | null
  mpesaAccountName?: string | null
  mpesaVerified?: boolean
  verifiedAt?: string | null
  feeCode?: string | null
  createdAt?: string
}

export type MenuCategory = { id: string; vendorId: string; name: string; sortOrder: number; imagePath?: string | null }

export type MenuItem = {
  id: string
  vendorId: string
  categoryId: string | null
  name: string
  description: string | null
  price: number
  previousPrice: number | null
  imagePath: string | null
  badge: string | null
  isSignature: boolean
  isAvailable: boolean
  sortOrder: number
  updatedAt?: string
}

export type DeliveryZone = { id: string; name: string; fee: number; travelMinutes: number; isActive: boolean; sortOrder: number; imagePath?: string | null }

export type PlatformSettings = {
  platformName: string
  platformFee: number
  refundWindowMinutes: number
  draftLifetimeMinutes: number
  serviceHours: string
  supportPhone: string | null
  supportEmail: string | null
  whatsappNumber: string | null
  heroTagline: string
  feePaybill?: string | null
  feeAccountName?: string | null
}

export type OrderItem = { id: string; orderId: string; menuItemId: string | null; itemName: string; unitPrice: number; quantity: number; lineTotal: number }

export type Order = {
  id: string
  reference: string
  studentId: string
  vendorId: string
  status: OrderStatus
  deliveryZoneId: string | null
  deliveryLocation: string
  deliveryInstructions: string | null
  contactPhone: string
  customerName: string
  foodSubtotal: number
  deliveryFee: number
  platformFee: number
  totalAmount: number
  refundedAmount: number
  receiptToken: string
  channel: 'web' | 'whatsapp'
  prepMinutes: number | null
  travelMinutes: number | null
  estimatedReadyAt: string | null
  estimatedDeliveryAt: string | null
  rejectionReason: string | null
  riderId: string | null
  paidAt: string | null
  acceptedAt: string | null
  deliveredAt: string | null
  createdAt: string
  updatedAt: string
  orderItems?: OrderItem[]
  vendors?: Pick<Vendor, 'name' | 'location' | 'phone'> | null
}

export type Payment = {
  id: string
  orderId: string
  vendorId: string
  amount: number
  phone: string
  status: PaymentStatus
  transactionType: string | null
  checkoutRequestId: string | null
  mpesaReceiptNumber: string | null
  resultCode: number | null
  resultDesc: string | null
  source: string | null
  initiatedAt: string
  completedAt: string | null
}

export type Refund = {
  id: string
  orderId: string
  amount: number
  reason: string
  status: 'requested' | 'approved' | 'rejected' | 'completed'
  decisionNote: string | null
  mpesaReference: string | null
  createdAt: string
  decidedAt: string | null
  completedAt: string | null
  orders?: Pick<Order, 'reference' | 'customerName' | 'contactPhone' | 'totalAmount' | 'vendorId' | 'status'> & { vendors?: { name: string } | null }
}

export type SiteVideo = { id: string; title: string; topic: string; youtubeUrl: string; sortOrder: number; isPublished: boolean }

export type Offer = { id: string; vendorId: string | null; title: string; body: string | null; eventDate: string; imagePath: string | null; menuItemId: string | null; isPublished: boolean }

export type Testimonial = { id: string; displayName: string; rating: number; comment: string; vendorName: string | null; createdAt: string }

export type Receipt = {
  reference: string
  status: OrderStatus
  customerName: string
  createdAt: string
  paidAt: string
  vendorName: string
  vendorLocation: string | null
  vendorLogoPath?: string | null
  deliveryLocation: string
  foodSubtotal: number
  deliveryFee: number
  platformFee: number
  totalAmount: number
  refundedAmount: number
  mpesaReceipt: string | null
  items: { name: string; quantity: number; unitPrice: number; lineTotal: number; imagePath?: string | null }[]
}

export type DailySummaryRow = {
  day: string
  vendorId: string
  vendorName: string
  ordersPlaced: number
  ordersPaid: number
  ordersDelivered: number
  ordersCancelled: number
  foodSales: number
  deliveryCollections: number
  platformFees: number
  refunds: number
  vendorPayable: number
  platformRevenue: number
}
