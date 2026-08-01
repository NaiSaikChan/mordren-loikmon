/**
 * Pure utility functions for the EPUB reader.
 * No React Native imports — fully testable in Jest without native mocks.
 */

const SYSTEM_FONT_STACK = 'system-ui, -apple-system, sans-serif'

export interface FontOption {
  id: string
  label: string
  family?: string
}

export function toCssFontFamilyValue(fontFamily: string): string {
  if (fontFamily.includes(',') || fontFamily === 'serif') return fontFamily
  return `'${fontFamily}'`
}

export function escapeHtmlAttr(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

export function escapeHtmlText(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

export function escapeCssSingleQuotedUrl(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll("'", "\\'")
}

/**
 * Builds the `<option>` HTML for the in-reader font selector.
 * Built-in fonts (system, serif) are always included.
 * Custom asset fonts are included only when their local URI is available.
 */
export function buildReaderFontOptionsHtml(
  fontOptions: readonly FontOption[],
  customFontUris: Record<string, string>,
): string {
  const options = ['<option value="">Default (App Typography)</option>']
  for (const option of fontOptions) {
    const isBuiltIn = option.id === 'system' || option.id === 'serif'
    if (!isBuiltIn && !customFontUris[option.id]) continue
    let value = ''
    if (option.id === 'system') value = SYSTEM_FONT_STACK
    else if (option.id === 'serif') value = 'serif'
    else if (option.family) value = toCssFontFamilyValue(option.family)
    if (!value) continue
    options.push(
      `<option value="${escapeHtmlAttr(value)}">${escapeHtmlText(option.label)}</option>`,
    )
  }
  return options.join('\n')
}

/**
 * Generates CSS `@font-face` declarations for each resolved custom font URI.
 * Injected into the parent HTML `<style>` tag AND into each epub.js chapter
 * iframe via a `rendition.hooks.content` handler, since the parent `<style>`
 * tag is not accessible from inside the iframe's document.
 */
export function buildFontFacesCss(customFontUris: Record<string, string>): string {
  return Object.entries(customFontUris)
    .map(([fontId, localUri]) => {
      const safeUri = escapeCssSingleQuotedUrl(localUri)
      return `@font-face { font-family: '${fontId}'; src: url('${safeUri}') format('truetype'); font-display: swap; }`
    })
    .join('\n')
}

/**
 * Builds a self-executing JavaScript snippet that injects the provided CSS
 * string into the `document.head` of the epub.js iframe.
 * Safe to call as `injectedJavascript` on a WebView or via `rendition.hooks.content`.
 */
export function buildFontInjectionScript(fontFacesCss: string): string {
  if (!fontFacesCss) return ''
  // Escape < > / so the string is safe to embed inside an HTML <script> tag.
  const safeJson = JSON.stringify(fontFacesCss)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/\//g, '\\u002f')
  return `(function(){var s=document.createElement('style');s.textContent=${safeJson};document.head.appendChild(s);})();`
}

/**
 * Builds a self-executing JavaScript snippet to pass as `injectedJavascript` on
 * the @epubjs-react-native/core `Reader` component.  It runs inside the WebView
 * after the book is ready (when `rendition` is available) and:
 *
 * 1. Registers a `rendition.hooks.content` handler that fires for every chapter:
 *    - Injects `@font-face` CSS so custom TTF files are available inside each iframe.
 *    - Attaches touchstart/touchend listeners for edge-tap navigation (left 20% →
 *      prev, right 20% → next).  Swipe navigation is left to the library's built-in
 *      RNGH Fling handler (`enableSwipe={true}`).
 *
 * 2. Immediately injects the CSS into any iframes that are already rendered inside
 *    `#viewer` when the script runs.
 *
 * Returns an empty string when there are no fonts to inject (hook is still useful
 * for edge taps; callers should always append the edge-tap-only fallback script if
 * needed, but for simplicity we include edge-tap logic unconditionally here).
 */
export function buildRenditionFontHookScript(fontFacesCss: string): string {
  const safeJson = fontFacesCss
    ? JSON.stringify(fontFacesCss)
        .replace(/</g, '\\u003c')
        .replace(/>/g, '\\u003e')
        .replace(/\//g, '\\u002f')
    : '""'

  return `(function(){
var css=${safeJson};
function injectCss(c){if(!c||!c.document)return;try{var s=c.document.createElement('style');s.textContent=css;c.document.head.appendChild(s);}catch(e){}}
function injectEdgeTap(c){
  if(!c||!c.document)return;
  var doc=c.document;
  var t=null;
  doc.addEventListener('touchstart',function(e){if(!e.changedTouches||!e.changedTouches.length)return;t={x:e.changedTouches[0].clientX,y:e.changedTouches[0].clientY};},{passive:true});
  doc.addEventListener('touchcancel',function(){t=null;},{passive:true});
  doc.addEventListener('touchend',function(e){
    if(!t||!e.changedTouches||!e.changedTouches.length)return;
    var ex=e.changedTouches[0].clientX,ey=e.changedTouches[0].clientY;
    var dx=t.x-ex,dy=t.y-ey;
    t=null;
    if(Math.abs(dx)<10&&Math.abs(dy)<10){
      var vw=doc.documentElement.clientWidth||360;
      if(ex<vw*0.2)rendition.prev();
      else if(ex>vw*0.8)rendition.next();
    }
  },{passive:true});
}
rendition.hooks.content.register(function(c){injectCss(c);injectEdgeTap(c);});
try{document.querySelectorAll('#viewer iframe').forEach(function(f){if(f.contentDocument)injectCss({document:f.contentDocument});});}catch(e){}
})();true;`
}

/**
 * Maps a touch gesture to a page navigation action.
 * Exported for unit testing; the same logic is inlined verbatim in the
 * embedded WebView HTML for the legacy fallback path.
 *
 * @param startX         - touchstart clientX
 * @param startY         - touchstart clientY
 * @param endX           - touchend clientX
 * @param endY           - touchend clientY
 * @param viewportWidth  - document.documentElement.clientWidth inside the iframe
 * @param swipeThreshold - minimum horizontal pixels that constitute a swipe (default 40)
 * @param edgeFraction   - fraction of viewport width treated as an edge-tap zone (default 0.2)
 */
export function computeSwipeAction(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  viewportWidth: number,
  swipeThreshold = 40,
  edgeFraction = 0.2,
): 'next' | 'prev' | null {
  const dx = startX - endX // positive = swiped left → go forward
  const dy = startY - endY
  // Swipe: horizontal movement dominates and exceeds threshold
  if (Math.abs(dx) >= swipeThreshold && Math.abs(dx) >= Math.abs(dy)) {
    return dx > 0 ? 'next' : 'prev'
  }
  // Tap: near-zero movement near a screen edge
  if (Math.abs(dx) < 10 && Math.abs(dy) < 10) {
    if (endX < viewportWidth * edgeFraction) return 'prev'
    if (endX > viewportWidth * (1 - edgeFraction)) return 'next'
  }
  return null
}
