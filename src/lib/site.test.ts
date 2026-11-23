// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_DESCRIPTION, HOME_TITLE, setTitle, youtubeId } from './site'

const robots = () => document.head.querySelector<HTMLMetaElement>('meta[name="robots"]')?.content
const description = () => document.head.querySelector<HTMLMetaElement>('meta[name="description"]')?.content
const canonical = () => document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href

describe('setTitle (search metadata)', () => {
  beforeEach(() => { document.head.innerHTML = '' })

  it('gives the home page its full title, the default description and index', () => {
    window.history.replaceState(null, '', '/')
    setTitle()
    expect(document.title).toBe(HOME_TITLE)
    expect(description()).toBe(DEFAULT_DESCRIPTION)
    expect(robots()).toContain('index, follow')
    expect(canonical()).toMatch(/\/$/)
  })

  it('indexes public pages with their own description', () => {
    window.history.replaceState(null, '', '/menu')
    setTitle('Today’s Menu', 'Menu description')
    expect(document.title).toBe('Today’s Menu · Campus Food')
    expect(description()).toBe('Menu description')
    expect(robots()).toContain('index')
    expect(canonical()).toMatch(/\/menu$/)
  })

  it.each(['/r/abc123secret', '/cart', '/account', '/orders/1', '/login', '/hotel', '/rider'])('never indexes private page %s', (path) => {
    window.history.replaceState(null, '', path)
    setTitle('Private')
    expect(robots()).toBe('noindex, nofollow')
  })

  it('does not duplicate tags when called again', () => {
    window.history.replaceState(null, '', '/about')
    setTitle('About Us')
    setTitle('About Us')
    expect(document.head.querySelectorAll('meta[name="description"]').length).toBe(1)
    expect(document.head.querySelectorAll('link[rel="canonical"]').length).toBe(1)
  })
})

describe('youtubeId', () => {
  it.each([
    ['https://youtube.com/shorts/rPvPW6r66_8?si=hNvH', 'rPvPW6r66_8'],
    ['https://youtu.be/KuhbduOl0uY?si=sZ0A', 'KuhbduOl0uY'],
    ['https://www.youtube.com/watch?v=KuhbduOl0uY', 'KuhbduOl0uY'],
  ])('reads %s', (url, id) => { expect(youtubeId(url)).toBe(id) })
  it('rejects other sites', () => { expect(youtubeId('https://evil.example/watch?v=KuhbduOl0uY')).toBeNull() })
})
