/*
 * Loikmon in-app PDF viewer — the code that runs inside the WebView.
 *
 * `scripts/build-pdf-viewer.js` inlines this file, pdf.js and the pdf.js worker
 * into `assets/pdfjs/viewer.html`, so the viewer works fully offline and never
 * talks to a third party.
 *
 * Read-only by construction:
 *  - pages are painted to <canvas>; there is no text layer, so there is nothing
 *    to select and nothing to copy,
 *  - no toolbar, no download / print / share affordance, no link handling,
 *  - context menu, selection, copy/cut and drag are cancelled,
 *  - the document never exists as a URL inside the WebView — the bytes are
 *    streamed in from the native side, so "save as" has no target.
 */

const RN = window.ReactNativeWebView

function post(message) {
  try {
    if (RN) RN.postMessage(JSON.stringify(message))
  } catch {
    /* bridge gone — nothing useful to do */
  }
}

// --- lock the document down -------------------------------------------------

for (const type of ['contextmenu', 'selectstart', 'copy', 'cut', 'paste', 'dragstart']) {
  document.addEventListener(type, (e) => e.preventDefault(), { capture: true })
}

// --- byte stream from the native side ---------------------------------------

/**
 * Native slices the file on 3-byte boundaries so each base64 chunk is
 * self-contained; only the last one carries `=` padding.
 *
 * `__pdfBegin(size)` preallocates the final buffer and every chunk is decoded
 * straight into it, so the document is held once — not as a list of parts plus
 * a merged copy. Without `__pdfBegin` (older native code) chunks are collected
 * and merged at the end.
 */
let buffer = null
let parts = []
let received = 0
let startPage = 1

function resetStream() {
  buffer = null
  parts = []
  received = 0
}

window.__pdfBegin = (byteLength, page) => {
  resetStream()
  startPage = Number(page) > 1 ? Math.floor(Number(page)) : 1
  if (byteLength > 0) {
    try {
      buffer = new Uint8Array(byteLength)
    } catch {
      buffer = null // allocation failed: fall back to parts
    }
  }
}

window.__pdfChunk = (b64) => {
  const binary = atob(b64)
  const length = binary.length
  if (buffer && received + length <= buffer.length) {
    for (let i = 0; i < length; i++) buffer[received + i] = binary.charCodeAt(i)
  } else {
    const bytes = new Uint8Array(length)
    for (let i = 0; i < length; i++) bytes[i] = binary.charCodeAt(i)
    parts.push(bytes)
  }
  received += length
}

window.__pdfFail = (message) => showError(message)

window.__pdfDone = (byteLength) => {
  if (byteLength > 0 && byteLength !== received) {
    console.warn('[pdf] expected ' + byteLength + ' bytes, assembled ' + received)
  }
  let data
  if (buffer && !parts.length) {
    data = received === buffer.length ? buffer : buffer.subarray(0, received)
  } else {
    // Fallback path: merge, freeing each part as soon as it is copied.
    data = new Uint8Array(received)
    let offset = 0
    if (buffer) {
      data.set(buffer.subarray(0, Math.min(buffer.length, received)), 0)
      offset = Math.min(buffer.length, received)
    }
    for (let i = 0; i < parts.length; i++) {
      data.set(parts[i], offset)
      offset += parts[i].length
      parts[i] = null
    }
  }
  resetStream()
  openDocument(data)
}

/** Scroll so `page` is at the top. Exposed for native (restore / "go to page"). */
window.__pdfGoToPage = (page) => {
  if (!pdfDoc) {
    startPage = Number(page) > 1 ? Math.floor(Number(page)) : 1
    return
  }
  scrollToPage(page)
  updateHud()
}

// Messages posted from native via `webView.postMessage` also work.
function onNativeMessage(event) {
  let message = event && event.data
  if (typeof message === 'string') {
    try {
      message = JSON.parse(message)
    } catch {
      return
    }
  }
  if (message && message.type === 'goToPage') window.__pdfGoToPage(message.page)
}
window.addEventListener('message', onNativeMessage)
document.addEventListener('message', onNativeMessage)

// --- rendering ---------------------------------------------------------------

const pagesEl = document.getElementById('pages')
const statusEl = document.getElementById('status')
const hudEl = document.getElementById('hud')

const MAX_OUTPUT_SCALE = 3
const pdfjsLib = globalThis.pdfjsLib

let pdfDoc = null
let observer = null
let currentPage = 0
let hudTimer = 0

function showError(message) {
  statusEl.textContent = message
  statusEl.hidden = false
  pagesEl.hidden = true
  post({ type: 'error', message: String(message) })
}

function outputScale() {
  const zoom = (window.visualViewport && window.visualViewport.scale) || 1
  return Math.min((window.devicePixelRatio || 1) * zoom, MAX_OUTPUT_SCALE)
}

async function openDocument(data) {
  if (observer) observer.disconnect()
  if (pdfDoc) {
    const previous = pdfDoc
    pdfDoc = null
    previous.destroy().catch(() => undefined)
  }
  try {
    pdfDoc = await pdfjsLib.getDocument({
      data,
      isEvalSupported: false,
      useSystemFonts: true,
      disableAutoFetch: true,
      enableXfa: false,
    }).promise
  } catch (err) {
    showError((err && err.message) || 'This file could not be opened')
    return
  }

  const first = await pdfDoc.getPage(1)
  const unit = first.getViewport({ scale: 1 })

  statusEl.hidden = true
  pagesEl.hidden = false
  pagesEl.textContent = ''

  observer = new IntersectionObserver(onVisibility, { rootMargin: '150% 0px', threshold: 0.01 })

  for (let n = 1; n <= pdfDoc.numPages; n++) {
    const holder = document.createElement('div')
    holder.className = 'page'
    holder.dataset.page = String(n)
    holder.style.aspectRatio = unit.width + ' / ' + unit.height
    pagesEl.appendChild(holder)
    observer.observe(holder)
  }

  // Restore the reading position before the first page report, so the
  // stored position is never overwritten with page 1.
  if (startPage > 1) scrollToPage(startPage)
  updateHud()
  post({ type: 'loaded', pages: pdfDoc.numPages })
}

let userTouched = false
window.addEventListener('touchstart', () => { userTouched = true }, { passive: true, capture: true })

function scrollToPage(page) {
  if (!pdfDoc) return
  const n = Math.min(Math.max(1, Math.floor(Number(page)) || 1), pdfDoc.numPages)
  const holder = pagesEl.children[n - 1]
  if (!holder) return
  const jump = () => window.scrollTo(0, Math.max(0, holder.offsetTop - 8))
  jump()
  // Pages above may resize once rendered (mixed page sizes): re-align once,
  // unless the reader has started scrolling in the meantime.
  userTouched = false
  setTimeout(() => {
    if (!userTouched) {
      jump()
      updateHud()
    }
  }, 450)
}

function onVisibility(entries) {
  for (const entry of entries) {
    if (entry.isIntersecting) void renderPage(entry.target)
    else releasePage(entry.target)
  }
}

/**
 * Drop a far-away page's pixels and pdf.js's per-page resources (operator
 * lists, decoded images) so long books stay within the WebView's memory.
 */
function releasePage(holder) {
  const task = holder._renderTask
  if (task) {
    holder._renderTask = null
    try {
      task.cancel()
    } catch {
      /* already finished */
    }
  }
  const canvas = holder.querySelector('canvas')
  if (canvas) {
    canvas.width = 0
    canvas.height = 0
    canvas.remove()
  }
  holder.dataset.rendered = ''
  if (pdfDoc) {
    const doc = pdfDoc
    doc
      .getPage(Number(holder.dataset.page))
      .then((page) => {
        if (doc === pdfDoc && !holder._renderTask) page.cleanup()
      })
      .catch(() => undefined)
  }
}

async function renderPage(holder) {
  const scale = outputScale()
  if (holder.dataset.rendered === String(scale) || holder.dataset.busy === '1') return
  holder.dataset.busy = '1'
  try {
    const page = await pdfDoc.getPage(Number(holder.dataset.page))
    const unit = page.getViewport({ scale: 1 })
    const cssWidth = holder.clientWidth || pagesEl.clientWidth || window.innerWidth
    const viewport = page.getViewport({ scale: (cssWidth / unit.width) * scale })

    holder.style.aspectRatio = unit.width + ' / ' + unit.height

    const canvas = holder.querySelector('canvas') || document.createElement('canvas')
    canvas.width = Math.floor(viewport.width)
    canvas.height = Math.floor(viewport.height)
    canvas.style.width = '100%'
    if (!canvas.isConnected) holder.appendChild(canvas)

    const task = page.render({ canvasContext: canvas.getContext('2d', { alpha: false }), viewport })
    holder._renderTask = task
    await task.promise
    holder.dataset.rendered = String(scale)
  } catch (err) {
    if (!err || err.name !== 'RenderingCancelledException') {
      console.warn('[pdf] page render failed', err)
    }
  } finally {
    holder._renderTask = null
    holder.dataset.busy = ''
  }
}

function renderVisible() {
  if (!pdfDoc) return
  for (const holder of pagesEl.children) {
    const box = holder.getBoundingClientRect()
    if (box.bottom > -window.innerHeight && box.top < window.innerHeight * 2) void renderPage(holder)
  }
}

// --- page indicator ----------------------------------------------------------

function updateHud() {
  if (!pdfDoc) return
  const middle = window.scrollY + window.innerHeight / 2
  let page = 1
  for (const holder of pagesEl.children) {
    if (holder.offsetTop <= middle) page = Number(holder.dataset.page)
    else break
  }
  if (page === currentPage) return
  currentPage = page
  hudEl.textContent = page + ' / ' + pdfDoc.numPages
  hudEl.classList.add('visible')
  clearTimeout(hudTimer)
  hudTimer = setTimeout(() => hudEl.classList.remove('visible'), 1400)
  post({ type: 'page', page, pages: pdfDoc.numPages })
}

let scrollTick = 0
window.addEventListener(
  'scroll',
  () => {
    if (scrollTick) return
    scrollTick = requestAnimationFrame(() => {
      scrollTick = 0
      updateHud()
    })
  },
  { passive: true },
)

// Re-render crisply once a pinch-zoom settles.
let zoomTimer = 0
let lastScale = 1
function onViewportChange() {
  const scale = (window.visualViewport && window.visualViewport.scale) || 1
  if (Math.abs(scale - lastScale) < 0.05) return
  lastScale = scale
  clearTimeout(zoomTimer)
  zoomTimer = setTimeout(renderVisible, 220)
}
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', onViewportChange)
  window.visualViewport.addEventListener('scroll', onViewportChange)
}

window.addEventListener('resize', () => {
  for (const holder of pagesEl.children) holder.dataset.rendered = ''
  renderVisible()
})

post({ type: 'ready' })
