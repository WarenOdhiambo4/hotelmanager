// Zod schemas for every form. The database checks again; these give instant, friendly messages.
import { z } from 'zod'

export const kenyanPhone = z.string().trim()
  .transform((v) => v.replace(/[\s-]/g, ''))
  .refine((v) => /^(?:\+?254|0)?[17]\d{8}$/.test(v), 'Enter a Kenyan mobile number such as 0712 345 678')

const email = z.string().trim().toLowerCase().email('Enter a valid email address')
const password = z.string().min(6, 'At least 6 characters').max(72, 'At most 72 characters')

export const loginSchema = z.object({ email, password: z.string().min(1, 'Enter your password') })
export const emailOnlySchema = z.object({ email })
export const codeSchema = z.object({ code: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code from the email') })

export const signUpSchema = z.object({
  fullName: z.string().trim().min(2, 'Enter your name').max(120),
  email,
  phone: kenyanPhone,
  hostel: z.string().trim().max(160).optional().default(''),
  password,
  confirmPassword: z.string(),
}).refine((v) => v.password === v.confirmPassword, { path: ['confirmPassword'], message: 'The passwords do not match' })

export const newPasswordSchema = z.object({ password, confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, { path: ['confirmPassword'], message: 'The passwords do not match' })

export const checkoutSchema = z.object({
  deliveryZoneId: z.string().uuid('Choose where we should deliver'),
  deliveryLocation: z.string().trim().min(2, 'Add your block, room or apartment').max(160),
  deliveryInstructions: z.string().trim().max(300).optional().default(''),
  contactPhone: kenyanPhone,
})

export const feedbackSchema = z.object({
  displayName: z.string().trim().min(2, 'Enter your name').max(60),
  contactEmail: z.union([email, z.literal('')]).optional().default(''),
  rating: z.number().int().min(1, 'Choose a rating').max(5),
  comment: z.string().trim().min(3, 'Tell us a little more').max(600),
})

export const vendorSchema = z.object({
  name: z.string().trim().min(2, 'Enter the hotel name').max(80),
  location: z.string().trim().min(2, 'Where is the hotel?').max(160),
  phone: kenyanPhone,
  paymentType: z.enum(['paybill', 'till']),
  mpesaShortcode: z.string().trim().regex(/^\d{5,7}$/, 'Paybill or Till numbers have 5 to 7 digits'),
  headOfficeNumber: z.string().trim().optional().default(''),
  mpesaAccountName: z.string().trim().max(80).optional().default(''),
}).refine((v) => v.paymentType !== 'till' || /^\d{5,7}$/.test(v.headOfficeNumber), {
  path: ['headOfficeNumber'], message: 'Buy Goods Tills need the Head Office (store) number too',
})

/** Admin edits an existing hotel: phone and Paybill/Till may stay blank on a draft hotel; text details are optional. */
export const vendorEditSchema = z.object({
  name: z.string().trim().min(2, 'Enter the hotel name').max(80),
  location: z.string().trim().min(2, 'Where is the hotel?').max(160),
  phone: z.union([kenyanPhone, z.literal('')]),
  paymentType: z.enum(['paybill', 'till']),
  mpesaShortcode: z.union([z.string().trim().regex(/^\d{5,7}$/, 'Paybill or Till numbers have 5 to 7 digits'), z.literal('')]),
  headOfficeNumber: z.string().trim().optional().default(''),
  mpesaAccountName: z.string().trim().max(80).optional().default(''),
  description: z.string().trim().max(400).optional().default(''),
  openingHours: z.string().trim().max(120).optional().default(''),
  prepMinutes: z.coerce.number().int().min(5, 'At least 5 minutes').max(120, 'At most 120 minutes'),
}).refine((v) => v.paymentType !== 'till' || !v.mpesaShortcode || /^\d{5,7}$/.test(v.headOfficeNumber), {
  path: ['headOfficeNumber'], message: 'Buy Goods Tills need the Head Office (store) number too',
})

export const menuItemSchema = z.object({
  name: z.string().trim().min(2, 'Name the dish').max(80),
  description: z.string().trim().max(300).optional().default(''),
  price: z.coerce.number().positive('Enter a price').max(100000),
  categoryId: z.string().optional().default(''),
  badge: z.string().trim().max(24).optional().default(''),
  isSignature: z.boolean().default(false),
  isAvailable: z.boolean().default(true),
})

export type FieldErrors<T> = Partial<Record<keyof T & string, string>>

export function fieldErrors<T>(error: z.ZodError): FieldErrors<T> {
  const out: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? '')
    if (key && !out[key]) out[key] = issue.message
  }
  return out as FieldErrors<T>
}

// ---- Calls, payments and fees -------------------------------------------------------------------------------------
/** "Call me back" pop-up (visitors too). */
export const callbackSchema = z.object({
  phone: kenyanPhone,
  topic: z.string().trim().min(2, 'Say what you need help with').max(200, 'Keep it under 200 characters'),
})
/** Pay an order: the Safaricom number the M-PESA prompt goes to. */
export const payPhoneSchema = z.object({ phone: kenyanPhone })
/** Hotel pays Campus Food fees by M-PESA prompt. */
export const feePaySchema = z.object({
  phone: kenyanPhone,
  amount: z.coerce.number().int('Whole shillings only').min(1, 'At least KES 1').max(150000, 'At most KES 150,000 per payment'),
})
/** An M-PESA confirmation code, e.g. TKL4QX92ZB. */
export const mpesaCodeSchema = z.object({ code: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{10}$/, 'An M-PESA code has 10 letters and numbers') })
/** Admin: reverse a fee payment (reason is shown to finance and kept in the audit trail). */
export const reversalSchema = z.object({ reason: z.string().trim().min(5, 'Give a short reason').max(300) })
/** Admin: payout to a phone (B2C) or a business (B2B). */
export const payoutSchema = z.object({
  kind: z.enum(['b2c', 'b2b']),
  recipient: z.string().trim().min(5, 'Enter the recipient').max(20),
  amount: z.coerce.number().int('Whole shillings only').min(10, 'At least KES 10').max(250000, 'At most KES 250,000'),
  reason: z.string().trim().min(5, 'Give a short reason').max(100),
}).superRefine((v, ctx) => {
  if (v.kind === 'b2c' && !/^(?:\+?254|0)?[17]\d{8}$/.test(v.recipient.replace(/[\s-]/g, ''))) ctx.addIssue({ code: 'custom', path: ['recipient'], message: 'Enter a Kenyan mobile number' })
  if (v.kind === 'b2b' && !/^\d{5,7}$/.test(v.recipient)) ctx.addIssue({ code: 'custom', path: ['recipient'], message: 'Enter a Paybill or Till number (5 to 7 digits)' })
})
