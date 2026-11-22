import { describe, expect, it } from 'vitest'
import { kes, progressIndex, shortKes } from './format'

describe('money formatting', () => {
  it('shows Kenya shillings with grouping', () => {
    expect(kes(1100)).toBe('KES 1,100')
    expect(kes('450.50')).toBe('KES 450.5')
    expect(kes(null)).toBe('KES 0')
  })
  it('rounds short amounts', () => {
    expect(shortKes(19.6)).toBe('20')
  })
})

describe('order progress', () => {
  it('orders the delivery steps', () => {
    expect(progressIndex('paid')).toBeLessThan(progressIndex('preparing'))
    expect(progressIndex('preparing')).toBeLessThan(progressIndex('delivered'))
  })
})
