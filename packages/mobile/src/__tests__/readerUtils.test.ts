/**
 * Unit tests for EPUB reader utility functions.
 * All imports are pure TypeScript — no native modules, no mocks needed.
 */
import {
  computeSwipeAction,
  buildReaderFontOptionsHtml,
  buildFontFacesCss,
  buildFontInjectionScript,
  buildRenditionFontHookScript,
  type FontOption,
} from '@/lib/readerUtils'

const FONT_OPTIONS: readonly FontOption[] = [
  { id: 'system', label: 'System Default' },
  { id: 'serif', label: 'Serif' },
  { id: 'Mon3Anonta1', label: 'Mon3 Anonta1', family: 'Mon3Anonta1' },
  { id: 'MUA_Office_adobe', label: 'MUA Office', family: 'MUA_Office_adobe' },
  { id: 'Pyidaungsu', label: 'Pyidaungsu', family: 'Pyidaungsu' },
  { id: 'Style1', label: 'Style 1', family: 'Style1' },
  { id: 'Style5', label: 'Style 5', family: 'Style5' },
]

// ---------------------------------------------------------------------------
// computeSwipeAction — swipe gestures
// ---------------------------------------------------------------------------
describe('computeSwipeAction — swipe gestures', () => {
  const vw = 400

  it('swipe left (finger moves right-to-left) returns "next"', () => {
    // startX=300, endX=100 → dx=200 (positive → next page)
    expect(computeSwipeAction(300, 200, 100, 200, vw)).toBe('next')
  })

  it('swipe right (finger moves left-to-right) returns "prev"', () => {
    // startX=100, endX=300 → dx=-200 (negative → prev page)
    expect(computeSwipeAction(100, 200, 300, 200, vw)).toBe('prev')
  })

  it('horizontal movement below threshold returns null', () => {
    // Only 20 px — under the default 40 px threshold
    expect(computeSwipeAction(200, 200, 180, 200, vw)).toBeNull()
  })

  it('exactly at threshold is accepted', () => {
    // dx = 40 → meets >= 40
    expect(computeSwipeAction(240, 200, 200, 200, vw)).toBe('next')
  })

  it('vertical scroll (dy dominates) returns null', () => {
    // 50 px horizontal but 200 px vertical → not a page swipe
    expect(computeSwipeAction(200, 50, 150, 250, vw)).toBeNull()
  })

  it('diagonal where horizontal dominates returns correct direction', () => {
    // dx=80, dy=30 → horizontal wins
    expect(computeSwipeAction(280, 130, 200, 100, vw)).toBe('next')
  })

  it('custom swipeThreshold is respected', () => {
    // 30 px swipe: default threshold 40 → null; lowered to 20 → 'next'
    expect(computeSwipeAction(230, 200, 200, 200, vw)).toBeNull()
    expect(computeSwipeAction(230, 200, 200, 200, vw, 20)).toBe('next')
  })
})

// ---------------------------------------------------------------------------
// computeSwipeAction — edge taps
// ---------------------------------------------------------------------------
describe('computeSwipeAction — edge taps', () => {
  const vw = 400 // left edge < 80 px (20 %), right edge > 320 px

  it('tap on left edge returns "prev"', () => {
    // endX=50 < 400 * 0.2 = 80
    expect(computeSwipeAction(50, 300, 50, 300, vw)).toBe('prev')
  })

  it('tap on right edge returns "next"', () => {
    // endX=370 > 400 * 0.8 = 320
    expect(computeSwipeAction(370, 300, 370, 300, vw)).toBe('next')
  })

  it('tap in the centre of the screen returns null', () => {
    expect(computeSwipeAction(200, 300, 200, 300, vw)).toBeNull()
  })

  it('tap exactly at left-edge boundary returns "prev"', () => {
    // endX=79 (< 80 → prev)
    expect(computeSwipeAction(79, 300, 79, 300, vw)).toBe('prev')
  })

  it('tap exactly at right-edge boundary returns "next"', () => {
    // endX=321 (> 320 → next)
    expect(computeSwipeAction(321, 300, 321, 300, vw)).toBe('next')
  })

  it('tap just inside the centre zone returns null', () => {
    expect(computeSwipeAction(200, 300, 200, 300, vw)).toBeNull()
  })

  it('tap with dx > 10 is NOT treated as a tap', () => {
    // dx=15 doesn't meet swipe threshold (40) AND doesn't qualify as a tap (dx<10)
    expect(computeSwipeAction(65, 300, 50, 300, vw)).toBeNull()
  })

  it('custom edgeFraction is respected', () => {
    // edgeFraction=0.1 → left edge < 40, right edge > 360
    // endX=50 is now in the centre zone (50 >= 40)
    expect(computeSwipeAction(50, 300, 50, 300, vw, 40, 0.1)).toBeNull()
    // endX=30 is < 40 → 'prev'
    expect(computeSwipeAction(30, 300, 30, 300, vw, 40, 0.1)).toBe('prev')
  })
})

// ---------------------------------------------------------------------------
// buildReaderFontOptionsHtml
// ---------------------------------------------------------------------------
describe('buildReaderFontOptionsHtml', () => {
  it('always includes the default (empty-value) option', () => {
    const html = buildReaderFontOptionsHtml(FONT_OPTIONS, {})
    expect(html).toContain('<option value="">Default (App Typography)</option>')
  })

  it('always includes the system font option regardless of URIs', () => {
    const html = buildReaderFontOptionsHtml(FONT_OPTIONS, {})
    expect(html).toContain('System Default')
  })

  it('always includes the serif option regardless of URIs', () => {
    const html = buildReaderFontOptionsHtml(FONT_OPTIONS, {})
    expect(html).toContain('Serif')
    expect(html).toContain('value="serif"')
  })

  it('does NOT include custom fonts when no URIs are provided', () => {
    const html = buildReaderFontOptionsHtml(FONT_OPTIONS, {})
    expect(html).not.toContain('Mon3 Anonta1')
    expect(html).not.toContain('Style 1')
  })

  it('includes a custom font only when its URI is present', () => {
    const html = buildReaderFontOptionsHtml(FONT_OPTIONS, {
      Mon3Anonta1: 'file:///path/Mon3Anonta1.ttf',
    })
    expect(html).toContain('Mon3 Anonta1')
    expect(html).toContain("'Mon3Anonta1'")
  })

  it('does not include other custom fonts when only one URI is supplied', () => {
    const html = buildReaderFontOptionsHtml(FONT_OPTIONS, {
      Mon3Anonta1: 'file:///path/Mon3Anonta1.ttf',
    })
    expect(html).not.toContain('Style 1')
    expect(html).not.toContain('MUA Office')
  })

  it('includes all custom fonts when all URIs are provided', () => {
    const uris = {
      Mon3Anonta1: 'file:///a.ttf',
      MUA_Office_adobe: 'file:///b.ttf',
      Pyidaungsu: 'file:///c.ttf',
      Style1: 'file:///d.ttf',
      Style5: 'file:///e.ttf',
    }
    const html = buildReaderFontOptionsHtml(FONT_OPTIONS, uris)
    expect(html).toContain('Mon3 Anonta1')
    expect(html).toContain('MUA Office')
    expect(html).toContain('Style 1')
    expect(html).toContain('Style 5')
  })
})

// ---------------------------------------------------------------------------
// buildFontFacesCss
// ---------------------------------------------------------------------------
describe('buildFontFacesCss', () => {
  it('returns an empty string when there are no fonts', () => {
    expect(buildFontFacesCss({})).toBe('')
  })

  it('generates a @font-face rule for each font', () => {
    const css = buildFontFacesCss({
      Mon3Anonta1: 'file:///fonts/Mon3Anonta1.ttf',
      Style1: 'file:///fonts/Style1.ttf',
    })
    expect(css).toContain("@font-face { font-family: 'Mon3Anonta1'")
    expect(css).toContain("@font-face { font-family: 'Style1'")
  })

  it('embeds the local URI in the src url()', () => {
    const css = buildFontFacesCss({ Pyidaungsu: 'file:///path/Pyidaungsu.ttf' })
    expect(css).toContain("url('file:///path/Pyidaungsu.ttf')")
  })

  it('uses the truetype format hint', () => {
    const css = buildFontFacesCss({ Style1: 'file:///a.ttf' })
    expect(css).toContain("format('truetype')")
  })

  it('includes font-display: swap for better perceived loading', () => {
    const css = buildFontFacesCss({ Style1: 'file:///a.ttf' })
    expect(css).toContain('font-display: swap')
  })

  it("escapes single-quotes inside the font URI", () => {
    const css = buildFontFacesCss({ Style1: "file:///path/it's a font.ttf" })
    expect(css).toContain("\\'")
    expect(css).not.toContain("url('file:///path/it's")
  })

  it('generates one rule per font when multiple fonts are supplied', () => {
    const css = buildFontFacesCss({ A: 'file:///a.ttf', B: 'file:///b.ttf', C: 'file:///c.ttf' })
    expect((css.match(/@font-face/g) ?? []).length).toBe(3)
  })
})

// ---------------------------------------------------------------------------
// buildFontInjectionScript
// ---------------------------------------------------------------------------
describe('buildFontInjectionScript', () => {
  it('returns empty string for empty CSS', () => {
    expect(buildFontInjectionScript('')).toBe('')
  })

  it('wraps CSS in an IIFE that appends a <style> element', () => {
    const script = buildFontInjectionScript('@font-face { font-family: X; }')
    expect(script).toContain('document.createElement(')
    expect(script).toContain('document.head.appendChild')
    expect(script).toContain('@font-face')
  })

  it('safely JSON-encodes CSS content (no raw injection)', () => {
    const nasty = `</style><script>alert(1)</script>`
    const script = buildFontInjectionScript(nasty)
    // The raw string should NOT appear verbatim — it must be JSON-encoded
    expect(script).not.toContain(nasty)
    expect(script).toContain('\\u003c') // < is escaped in JSON
  })
})

// ---------------------------------------------------------------------------
// buildRenditionFontHookScript
// ---------------------------------------------------------------------------
describe('buildRenditionFontHookScript', () => {
  it('returns a non-empty string even with empty CSS (edge-tap only)', () => {
    const script = buildRenditionFontHookScript('')
    expect(script.length).toBeGreaterThan(0)
    expect(script).toContain('rendition.hooks.content.register')
  })

  it('includes the @font-face CSS when provided', () => {
    const css = "@font-face { font-family: 'Mon3Anonta1'; src: url('file:///a.ttf') format('truetype'); }"
    const script = buildRenditionFontHookScript(css)
    expect(script).toContain('@font-face')
    expect(script).toContain('Mon3Anonta1')
  })

  it('registers the rendition content hook', () => {
    const script = buildRenditionFontHookScript('@font-face {}')
    expect(script).toContain('rendition.hooks.content.register')
  })

  it('injects into already-rendered #viewer iframes', () => {
    const script = buildRenditionFontHookScript('@font-face {}')
    expect(script).toContain('#viewer iframe')
  })

  it('includes edge-tap navigation logic', () => {
    const script = buildRenditionFontHookScript('')
    expect(script).toContain('touchstart')
    expect(script).toContain('touchend')
    expect(script).toContain('rendition.prev()')
    expect(script).toContain('rendition.next()')
  })

  it('HTML-encodes < and > to prevent script injection', () => {
    const nasty = "</style><script>alert(1)</script>"
    const script = buildRenditionFontHookScript(nasty)
    expect(script).not.toContain(nasty)
    expect(script).toContain('\\u003c')
  })

  it('ends with true; so injectJavaScript returns a truthy value', () => {
    const script = buildRenditionFontHookScript('')
    expect(script.trimEnd().endsWith('true;')).toBe(true)
  })
})
