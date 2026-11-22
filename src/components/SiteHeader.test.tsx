// @vitest-environment happy-dom
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

const auth = vi.hoisted(() => ({ value: {} as Record<string, unknown> }))
vi.mock('../auth/AuthProvider', () => ({ useAuth: () => auth.value }))
// The bar needs none of the data layer; keep the Supabase client from starting in the test.
vi.mock('../lib/supabase', () => ({ supabase: null, mediaUrl: () => null, friendly: String }))

import { AccountBar } from './SiteHeader'

const render = () => renderToStaticMarkup(<MemoryRouter initialEntries={['/orders']}><AccountBar /></MemoryRouter>)

describe('AccountBar (the small navbar under the header)', () => {
  it('is not shown to visitors who are not signed in', () => {
    auth.value = { session: null, profile: null, memberships: [] }
    expect(render()).toBe('')
  })

  it('gives a signed-in student their pages as plain links, never buttons', () => {
    auth.value = { session: { user: {} }, profile: { role: 'student' }, memberships: [] }
    const html = render()
    expect(html).toContain('My orders')
    expect(html).toContain('Account and phone')
    expect(html).not.toContain('Hotel dashboard')
    expect(html).not.toContain('My deliveries')
    expect(html).not.toContain('<button')
    expect(html).toMatch(/href="\/orders"[^>]*aria-current="page"|aria-current="page"[^>]*href="\/orders"/)
  })

  it('adds the hotel dashboard for hotel staff and deliveries for riders', () => {
    auth.value = { session: { user: {} }, profile: { role: 'rider' }, memberships: [{ vendorId: 'v1' }] }
    const html = render()
    expect(html).toContain('Hotel dashboard')
    expect(html).toContain('My deliveries')
  })
})
