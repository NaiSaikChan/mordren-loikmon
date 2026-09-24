#!/usr/bin/env node
/*
 * Generates `assets/pdfjs/viewer.html` — a single, self-contained page that
 * bundles pdf.js, the pdf.js worker and `scripts/pdf-viewer-app.js`.
 *
 * Why one file: the WebView loads the viewer from `file://` (expo-asset copies
 * it out of the bundle), and Chrome refuses cross-file ES module imports and
 * blob workers from an opaque `file://` origin. Inlining sidesteps both — and
 * `pdf.worker.min.mjs` registers `globalThis.pdfjsWorker`, which makes pdf.js
 * run its message handler on the main thread instead of spawning a Worker.
 *
 * The generated file is committed, so a normal `npm install` + build needs
 * nothing extra. To regenerate after a pdf.js bump:
 *
 *   npm i -D pdfjs-dist@<version> --legacy-peer-deps
 *   node scripts/build-pdf-viewer.js
 *
 * (`--legacy-peer-deps` is unrelated to pdf.js: this workspace has a
 * pre-existing @react-native/jest-preset peer conflict.)
 */

/* global __dirname */
const fs = require('fs')
const path = require('path')

const OUT = path.join(__dirname, '..', 'assets', 'pdfjs', 'viewer.html')

function resolvePdfjs(file) {
  try {
    return require.resolve(`pdfjs-dist/legacy/build/${file}`)
  } catch {
    console.error(
      `Cannot find pdfjs-dist. Install it first:\n` +
        `  npm i -D pdfjs-dist@5.4.530 --legacy-peer-deps`,
    )
    process.exit(1)
  }
}

const read = (file) => fs.readFileSync(resolvePdfjs(file), 'utf8')

/**
 * Turn the module's trailing `export{a as B,C};` into a global assignment, so
 * the inline module script exposes the API without a real import.
 */
function exposeAsGlobal(source, globalName) {
  const match = source.match(/export\s*\{([^}]*)\};?\s*$/)
  if (!match) throw new Error(`No trailing export clause found for ${globalName}`)
  const entries = match[1]
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [local, exported] = part.split(/\s+as\s+/).map((s) => s.trim())
      return `${JSON.stringify(exported ?? local)}:${local}`
    })
  return source.slice(0, match.index) + `globalThis.${globalName}={${entries.join(',')}};`
}

// Neither file contains "</script" today; guard so a future bump cannot break
// the page silently.
function assertInlineSafe(source, name) {
  if (/<\/script/i.test(source)) throw new Error(`${name} contains "</script" and cannot be inlined`)
}

const worker = read('pdf.worker.min.mjs')
const lib = exposeAsGlobal(read('pdf.min.mjs'), 'pdfjsLib')
const app = fs.readFileSync(path.join(__dirname, 'pdf-viewer-app.js'), 'utf8')

assertInlineSafe(worker, 'pdf.worker.min.mjs')
assertInlineSafe(lib, 'pdf.min.mjs')
assertInlineSafe(app, 'pdf-viewer-app.js')

const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,minimum-scale=1,maximum-scale=5,user-scalable=yes,viewport-fit=cover">
<title>Reader</title>
<style>
  :root { color-scheme: light dark; --bg: #f1f5f9; --fg: #475569; --page: #ffffff; }
  [hidden] { display: none !important; }
  html.dark { --bg: #0f172a; --fg: #94a3b8; --page: #1e293b; }
  html, body {
    margin: 0;
    padding: 0;
    background: var(--bg);
    -webkit-user-select: none;
    user-select: none;
    -webkit-touch-callout: none;
    -webkit-tap-highlight-color: transparent;
    overscroll-behavior: none;
  }
  #pages { padding: 8px 0 24px; }
  .page {
    position: relative;
    display: block;
    width: 100%;
    margin: 0 auto 8px;
    background: var(--page);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.18);
  }
  .page canvas { display: block; width: 100%; height: auto; pointer-events: none; }
  #status {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    text-align: center;
    font: 15px/1.5 system-ui, -apple-system, sans-serif;
    color: var(--fg);
  }
  #hud {
    position: fixed;
    left: 50%;
    bottom: 18px;
    transform: translateX(-50%);
    padding: 5px 13px;
    border-radius: 999px;
    background: rgba(15, 23, 42, 0.78);
    color: #fff;
    font: 13px/1 system-ui, -apple-system, sans-serif;
    opacity: 0;
    transition: opacity 0.25s;
    pointer-events: none;
  }
  #hud.visible { opacity: 1; }
</style>
</head>
<body>
<div id="pages" hidden></div>
<div id="status">Loading…</div>
<div id="hud"></div>
<script type="module">${worker}</script>
<script type="module">${lib}</script>
<script type="module">${app}</script>
</body>
</html>
`

fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(OUT, html)
console.log(`Wrote ${path.relative(process.cwd(), OUT)} (${(html.length / 1024).toFixed(0)} KB)`)
