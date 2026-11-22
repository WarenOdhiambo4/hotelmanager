import { describe, expect, it } from 'vitest'
import { callbackSchema, checkoutSchema, feePaySchema, kenyanPhone, mpesaCodeSchema, payoutSchema, payPhoneSchema, reversalSchema } from './validation'

describe('kenyanPhone', () => {
  it.each(['0712345678', '0112345678', '712345678', '254712345678', '+254712345678', '0712 345 678', '0712-345-678'])('accepts %s', (v) => {
    expect(kenyanPhone.safeParse(v).success).toBe(true)
  })
  it.each(['', '12345', '0812345678', '+255712345678', '07123456789', 'abc0712345678', '+1 415 555 0100'])('rejects %s', (v) => {
    expect(kenyanPhone.safeParse(v).success).toBe(false)
  })
  it('strips spaces and dashes', () => {
    expect(kenyanPhone.parse(' 0712 345-678 ')).toBe('0712345678')
  })
})

describe('callbackSchema', () => {
  it('needs a topic of at least two characters', () => {
    expect(callbackSchema.safeParse({ phone: '0712345678', topic: 'x' }).success).toBe(false)
    expect(callbackSchema.safeParse({ phone: '0712345678', topic: 'Late order' }).success).toBe(true)
  })
  it('caps the topic at 200 characters', () => {
    expect(callbackSchema.safeParse({ phone: '0712345678', topic: 'a'.repeat(201) }).success).toBe(false)
  })
})

describe('payPhoneSchema', () => {
  it('rejects a non-Kenyan number before any M-PESA prompt is sent', () => {
    expect(payPhoneSchema.safeParse({ phone: '+15555550100' }).success).toBe(false)
  })
})

describe('feePaySchema', () => {
  it('coerces the amount and requires whole shillings within limits', () => {
    expect(feePaySchema.parse({ phone: '0712345678', amount: '350' }).amount).toBe(350)
    expect(feePaySchema.safeParse({ phone: '0712345678', amount: '0' }).success).toBe(false)
    expect(feePaySchema.safeParse({ phone: '0712345678', amount: '12.5' }).success).toBe(false)
    expect(feePaySchema.safeParse({ phone: '0712345678', amount: '150001' }).success).toBe(false)
  })
})

describe('mpesaCodeSchema', () => {
  it('upper-cases and requires exactly 10 letters and numbers', () => {
    expect(mpesaCodeSchema.parse({ code: 'tkl4qx92zb' }).code).toBe('TKL4QX92ZB')
    expect(mpesaCodeSchema.safeParse({ code: 'TKL4QX92Z' }).success).toBe(false)
    expect(mpesaCodeSchema.safeParse({ code: "TKL4QX92Z'" }).success).toBe(false)
  })
})

describe('payoutSchema', () => {
  it('needs a Kenyan phone for B2C and a 5 to 7 digit number for B2B', () => {
    expect(payoutSchema.safeParse({ kind: 'b2c', recipient: '0712345678', amount: '500', reason: 'Refund double payment' }).success).toBe(true)
    expect(payoutSchema.safeParse({ kind: 'b2c', recipient: '600999', amount: '500', reason: 'Refund double payment' }).success).toBe(false)
    expect(payoutSchema.safeParse({ kind: 'b2b', recipient: '600999', amount: '500', reason: 'Supplier payment' }).success).toBe(true)
    expect(payoutSchema.safeParse({ kind: 'b2b', recipient: '0712345678', amount: '500', reason: 'Supplier payment' }).success).toBe(false)
  })
  it('limits the amount', () => {
    expect(payoutSchema.safeParse({ kind: 'b2c', recipient: '0712345678', amount: '5', reason: 'Too small' }).success).toBe(false)
  })
})

describe('reversalSchema', () => {
  it('requires a short reason', () => {
    expect(reversalSchema.safeParse({ reason: 'oops' }).success).toBe(false)
    expect(reversalSchema.safeParse({ reason: 'Paid twice by mistake' }).success).toBe(true)
  })
})

describe('checkoutSchema', () => {
  it('rejects an empty delivery form', () => {
    expect(checkoutSchema.safeParse({ deliveryZoneId: '', deliveryLocation: '', deliveryInstructions: '', contactPhone: '' }).success).toBe(false)
  })
})
