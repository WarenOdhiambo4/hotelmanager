// The cart lives in the browser until checkout; prices shown here are for display only.
// The database recalculates every price when the order is placed.
// Single-vendor rule: one cart holds food from one hotel, because each M-Pesa prompt goes to
// one hotel's Paybill or Till. Adding from another hotel asks the student what to do.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { MenuItem } from './types'

export type CartLine = { menuItemId: string; name: string; price: number; imagePath: string | null; quantity: number }
export type Cart = { vendorId: string | null; vendorName: string | null; lines: CartLine[] }
type Conflict = { item: MenuItem; vendorName: string } | null

type CartState = {
  cart: Cart
  count: number
  subtotal: number
  conflict: Conflict
  add: (item: MenuItem, vendorName: string, quantity?: number) => void
  setQuantity: (menuItemId: string, quantity: number) => void
  clear: () => void
  resolveConflict: (choice: 'replace' | 'keep') => void
}

const KEY = 'campusFoodCart'
const empty: Cart = { vendorId: null, vendorName: null, lines: [] }
const CartContext = createContext<CartState | null>(null)

function load(): Cart {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    if (raw && Array.isArray(raw.lines)) return raw as Cart
  } catch { /* ignore a damaged cart */ }
  return empty
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<Cart>(load)
  const [conflict, setConflict] = useState<Conflict>(null)

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(cart)) } catch { /* storage full or blocked */ }
  }, [cart])

  const put = useCallback((c: Cart, item: MenuItem, vendorName: string, quantity: number): Cart => {
    const base = c.vendorId === item.vendorId ? c : { vendorId: item.vendorId, vendorName, lines: [] }
    const existing = base.lines.find((l) => l.menuItemId === item.id)
    const lines = existing
      ? base.lines.map((l) => (l.menuItemId === item.id ? { ...l, quantity: Math.min(50, l.quantity + quantity), price: Number(item.price) } : l))
      : [...base.lines, { menuItemId: item.id, name: item.name, price: Number(item.price), imagePath: item.imagePath, quantity }]
    return { vendorId: item.vendorId, vendorName, lines }
  }, [])

  const add = useCallback((item: MenuItem, vendorName: string, quantity = 1) => {
    setCart((c) => {
      if (c.vendorId && c.vendorId !== item.vendorId && c.lines.length > 0) {
        setConflict({ item, vendorName })
        return c
      }
      return put(c, item, vendorName, quantity)
    })
  }, [put])

  const value = useMemo<CartState>(() => ({
    cart,
    conflict,
    count: cart.lines.reduce((n, l) => n + l.quantity, 0),
    subtotal: cart.lines.reduce((n, l) => n + l.quantity * l.price, 0),
    add,
    setQuantity: (id, q) => setCart((c) => {
      const lines = q <= 0 ? c.lines.filter((l) => l.menuItemId !== id) : c.lines.map((l) => (l.menuItemId === id ? { ...l, quantity: Math.min(50, q) } : l))
      return lines.length ? { ...c, lines } : empty
    }),
    clear: () => setCart(empty),
    resolveConflict: (choice) => {
      if (choice === 'replace' && conflict) setCart(put(empty, conflict.item, conflict.vendorName, 1))
      setConflict(null)
    },
  }), [cart, conflict, add, put])

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart(): CartState {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used inside <CartProvider>')
  return ctx
}
