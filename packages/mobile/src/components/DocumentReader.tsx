import { useMemo, useRef, useState, useCallback, useEffect } from 'react'
import { Platform, View, ActivityIndicator, Text } from 'react-native'
import { WebView, type WebViewMessageEvent } from 'react-native-webview'
import * as FileSystem from 'expo-file-system/legacy'
import { fixUrl } from '@/lib/url'
import { detectFormat } from '@/lib/format'
import { useTypography } from '@/context/TypographyContext'

export { detectFormat }

/**
 * More complete epub.js reader page rendered inside a WebView.
 *
 * Mirrors the web EpubReader.vue features:
 *  - paginated flow
 *  - theme / font / font-size / line-spacing controls
 *  - table of contents
 *  - progress
 *  - swipe/keyboard navigation
 *
 * Security note: jszip and epub.js are loaded from jsDelivr at **pinned exact
 * versions** (immutable URLs). `crossorigin="anonymous"` is set so the browser
 * treats them as CORS resources. For a hardened offline build, bundle these
 * libraries as local assets.
 */
function epubHtml(epub: { uri: string; base64: string }, fontFamily: string | undefined): string {
  const selectedFontFamily = fontFamily ?? 'system-ui, -apple-system, sans-serif'
  const cssFontFamily =
    selectedFontFamily.includes(',') || selectedFontFamily === 'serif'
      ? selectedFontFamily
      : `\'${selectedFontFamily}\'`

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <style>
    html, body { margin: 0; padding: 0; height: 100%; background: #ffffff; overflow: hidden; }
    #viewer { position: fixed; top: 52px; left: 0; right: 0; bottom: 0; }
    #toolbar {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      height: 52px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 0 10px;
      background: #ffffff;
      border-bottom: 1px solid #e5e7eb;
      box-sizing: border-box;
      z-index: 60;
    }
    #toolbar button { border: 0; background: none; color: #374151; font-size: 20px; padding: 6px 8px; }
    #toolbar select, #toolbar input[type=range] { margin-left: 6px; }
    #toolbar .muted { font-size: 12px; color: #6b7280; max-width: 36%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    #msg {
      position: fixed;
      top: 58px;
      left: 12px;
      right: 12px;
      padding: 10px;
      background: #fee2e2;
      color: #991b1b;
      border-radius: 8px;
      font-size: 13px;
      display: none;
      z-index: 100;
    }
    #progress { position: fixed; top: 52px; left: 0; right: 0; height: 3px; background: #e5e7eb; z-index: 70; }
    #progress > div { height: 100%; background: #4f46e5; width: 0%; transition: width 0.3s; }
    #toc-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,.25);
      display: none;
      z-index: 79;
    }
    #toc-panel {
      position: fixed;
      left: 0;
      top: 0;
      bottom: 0;
      width: min(320px, 86vw);
      background: #ffffff;
      border-right: 1px solid #e5e7eb;
      transform: translateX(-100%);
      transition: transform .22s ease;
      z-index: 80;
      display: flex;
      flex-direction: column;
    }
    #toc-panel.open { transform: translateX(0); }
    #toc-head {
      height: 52px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 12px;
      border-bottom: 1px solid #e5e7eb;
      font: 600 14px/1.2 system-ui, -apple-system, Segoe UI, sans-serif;
    }
    #toc-list {
      margin: 0;
      padding: 6px 0;
      list-style: none;
      overflow: auto;
      flex: 1;
    }
    #toc-list button {
      width: 100%;
      border: 0;
      background: none;
      text-align: left;
      padding: 10px 12px;
      font: 400 13px/1.35 system-ui, -apple-system, Segoe UI, sans-serif;
      color: #374151;
    }
    #toc-list button.active {
      color: #4338ca;
      font-weight: 600;
      background: rgba(79,70,229,.08);
    }
    #settings-menu {
      display: none;
      position: fixed;
      right: 8px;
      top: 56px;
      width: min(300px, 88vw);
      background: #fff;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      box-shadow: 0 8px 30px rgba(0,0,0,.15);
      z-index: 90;
      padding: 10px;
      box-sizing: border-box;
      font: 12px/1.2 system-ui, -apple-system, Segoe UI, sans-serif;
      color: #111827;
    }
    #settings-menu .row { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 8px; }
    #settings-menu .row:last-child { margin-bottom: 0; }
    #settings-menu select, #settings-menu input[type=range] { width: 62%; }
    #btn-settings { font-size: 18px; }
  </style>
  <script src="https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js" crossorigin="anonymous"></script>
  <script src="https://cdn.jsdelivr.net/npm/epubjs@0.3.93/dist/epub.min.js" crossorigin="anonymous"></script>
</head>
<body>
  <div id="toolbar">
    <button id="btn-toc" title="Contents">☰</button>
    <span id="chapter" class="muted"></span>
    <div>
      <button id="btn-prev" title="Previous">‹</button>
      <button id="btn-next" title="Next">›</button>
      <button id="btn-settings" title="Reader settings">⚙</button>
    </div>
  </div>
  <div id="progress"><div></div></div>
  <div id="msg"></div>
  <div id="toc-backdrop"></div>
  <aside id="toc-panel" aria-label="Table of contents">
    <div id="toc-head">
      <span>Contents</span>
      <button id="btn-close-toc" title="Close">✕</button>
    </div>
    <ul id="toc-list"></ul>
  </aside>
  <div id="settings-menu" aria-label="Reader settings">
    <div class="row">
      <label for="theme">Theme</label>
      <select id="theme">
        <option value="light">Light</option>
        <option value="sepia">Sepia</option>
        <option value="gray">Gray</option>
        <option value="dark">Dark</option>
        <option value="black">Black</option>
      </select>
    </div>
    <div class="row">
      <label for="font">Font</label>
      <select id="font">
        <option value="">Default</option>
        <option value="Georgia, serif">Georgia</option>
        <option value="Arial, sans-serif">Arial</option>
        <option value="Verdana, Geneva, sans-serif">Verdana</option>
        <option value="system-ui, -apple-system, sans-serif">System</option>
      </select>
    </div>
    <div class="row">
      <label for="size">Font size</label>
      <input id="size" type="range" min="60" max="200" value="100" />
    </div>
    <div class="row">
      <label for="spacing">Line spacing</label>
      <select id="spacing">
        <option value="1.2">Compact</option>
        <option value="1.5">Normal</option>
        <option value="1.8">Comfortable</option>
        <option value="2.1">Wide</option>
      </select>
    </div>
  </div>
  <div id="viewer"></div>
  <script>
    var epubPayload = ${JSON.stringify(epub)};
    var bookUrl = epubPayload && epubPayload.uri ? String(epubPayload.uri) : '';
    var selectedFontFamily = ${JSON.stringify(cssFontFamily)};
    var book, rendition;
    var renderedOnce = false;
    var tocItems = [];
    var currentHref = '';
    var cfiKey = 'epub-cfi-' + bookUrl;
    var settingsKey = 'epub-reader-settings';
    var themes = {
      light: { bg: '#ffffff', fg: '#111827' },
      sepia: { bg: '#f8f0e3', fg: '#3d2b1f' },
      gray:  { bg: '#e8e8e8', fg: '#1a1a1a' },
      dark:  { bg: '#1a1a2e', fg: '#d0d0e0' },
      black: { bg: '#000000', fg: '#cccccc' },
    };

    var defaultSettings = {
      theme: 'light',
      font: '',
      size: 100,
      spacing: '1.5',
    };
    var memoryStore = {};

    function getEl(id) { return document.getElementById(id); }

    function safeGetStorage(key) {
      try {
        return localStorage.getItem(key);
      } catch (_) {
        return Object.prototype.hasOwnProperty.call(memoryStore, key) ? memoryStore[key] : null;
      }
    }

    function safeSetStorage(key, value) {
      try {
        localStorage.setItem(key, value);
        return;
      } catch (_) {
        memoryStore[key] = value;
      }
    }

    function loadSettings() {
      try {
        var raw = safeGetStorage(settingsKey);
        if (!raw) return Object.assign({}, defaultSettings);
        var parsed = JSON.parse(raw);
        return Object.assign({}, defaultSettings, parsed || {});
      } catch (_) {
        return Object.assign({}, defaultSettings);
      }
    }

    function saveSettings(next) {
      try { safeSetStorage(settingsKey, JSON.stringify(next)); } catch (_) {}
    }

    var settings = loadSettings();

    function post(msg) {
      if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(msg));
    }

    function showError(text) {
      var el = document.getElementById('msg');
      el.textContent = text;
      el.style.display = 'block';
      post({ type: 'error', message: text });
    }

    function applyTheme(themeId) {
      var t = themes[themeId] || themes.light;
      document.body.style.background = t.bg;
      var toolbar = getEl('toolbar');
      toolbar.style.background = t.bg;
      toolbar.style.borderBottomColor = t.fg + '22';
      toolbar.style.color = t.fg;
      var toc = getEl('toc-panel');
      toc.style.background = t.bg;
      toc.style.borderRightColor = t.fg + '22';
      var head = getEl('toc-head');
      head.style.borderBottomColor = t.fg + '22';
      var settingsMenu = getEl('settings-menu');
      settingsMenu.style.background = t.bg;
      settingsMenu.style.borderColor = t.fg + '22';
      settingsMenu.style.color = t.fg;

      if (!rendition || !rendition.themes) return;
      rendition.themes.register('reader-theme', {
        'html': { 'background': t.bg + ' !important', 'background-color': t.bg + ' !important' },
        'body': {
          'background': t.bg + ' !important',
          'background-color': t.bg + ' !important',
          'color': t.fg + ' !important'
        }
      });
      rendition.themes.select('reader-theme');
    }

    function applyFont(font) {
      if (!rendition || !rendition.themes) return;
      rendition.themes.register('reader-font', { 'body': { 'font-family': (font || selectedFontFamily) + ' !important' } });
      rendition.themes.select('reader-font');
    }

    function applySize(size) {
      if (!rendition || !rendition.themes) return;
      rendition.themes.fontSize(size + '%');
    }

    function applySpacing(value) {
      if (!rendition || !rendition.themes) return;
      rendition.themes.register('reader-spacing', {
        'body': { 'line-height': String(value) + ' !important' },
        'p': { 'line-height': String(value) + ' !important' },
        'li': { 'line-height': String(value) + ' !important' },
        'div': { 'line-height': String(value) + ' !important' }
      });
      rendition.themes.select('reader-spacing');
    }

    function toggleSettings(open) {
      var menu = getEl('settings-menu');
      var next = typeof open === 'boolean' ? open : menu.style.display !== 'block';
      menu.style.display = next ? 'block' : 'none';
    }

    function closeToc() {
      getEl('toc-panel').classList.remove('open');
      getEl('toc-backdrop').style.display = 'none';
    }

    function openToc() {
      getEl('toc-panel').classList.add('open');
      getEl('toc-backdrop').style.display = 'block';
      toggleSettings(false);
    }

    function flattenToc(items, depth) {
      depth = depth || 0;
      var out = [];
      if (!Array.isArray(items)) return out;
      for (var i = 0; i < items.length; i++) {
        var item = items[i] || {};
        out.push({
          href: item.href || '',
          label: (item.label || '').trim(),
          depth: depth,
        });
        if (Array.isArray(item.subitems) && item.subitems.length) {
          out = out.concat(flattenToc(item.subitems, depth + 1));
        }
      }
      return out;
    }

    function renderToc() {
      var list = getEl('toc-list');
      list.innerHTML = '';
      if (!tocItems.length) {
        var empty = document.createElement('li');
        empty.style.padding = '14px 12px';
        empty.style.fontSize = '12px';
        empty.style.opacity = '.6';
        empty.textContent = 'No chapters found';
        list.appendChild(empty);
        return;
      }
      tocItems.forEach(function(item) {
        var li = document.createElement('li');
        var btn = document.createElement('button');
        btn.textContent = item.label || item.href || 'Untitled';
        btn.style.paddingLeft = (12 + item.depth * 12) + 'px';
        btn.className = currentHref && item.href && currentHref.indexOf(item.href.split('#')[0]) >= 0 ? 'active' : '';
        btn.addEventListener('click', function() {
          if (rendition && item.href) {
            rendition.display(item.href).catch(function(){});
          }
          closeToc();
        });
        li.appendChild(btn);
        list.appendChild(li);
      });
    }

    function updateProgress(loc) {
      if (!loc || !loc.start) return;
      try {
        var pct = loc.percentage;
        if (pct == null && book && book.locations && book.locations.percentageFromCfi) {
          pct = book.locations.percentageFromCfi(loc.start.cfi);
        }
        if (pct != null) document.querySelector('#progress > div').style.width = Math.round(pct * 100) + '%';
      } catch(e) {}
    }

    function base64ToArrayBuffer(base64) {
      var binary = atob(base64 || '');
      var len = binary.length;
      var bytes = new Uint8Array(len);
      for (var i = 0; i < len; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return bytes.buffer;
    }

    function loadBook() {
      if (!epubPayload || (!epubPayload.base64 && !bookUrl)) {
        showError('No EPUB source provided');
        return;
      }
      try {
        var input = epubPayload.base64 ? base64ToArrayBuffer(epubPayload.base64) : bookUrl;
        post({ type: 'debug', step: 'opening', url: bookUrl, mode: epubPayload.base64 ? 'buffer' : 'url' });
        book = ePub(input);
        rendition = book.renderTo('viewer', {
          width: '100%',
          height: '100%',
          flow: 'paginated',
          allowScriptedContent: false,
          spread: 'none'
        });

        var saved = null;
        try { saved = safeGetStorage(cfiKey); } catch (_) { saved = null; }
        var first = saved ? rendition.display(saved) : rendition.display();
        if (first && typeof first.catch === 'function') {
          first.catch(function(err) {
            post({ type: 'debug', step: 'display-saved-failed', error: err && err.message ? err.message : String(err) });
            return rendition.display();
          }).catch(function(){});
        }

        applyTheme(settings.theme);
        applyFont(settings.font);
        applySize(settings.size);
        applySpacing(settings.spacing);

        rendition.on('relocated', function(loc) {
          try {
            if (loc && loc.start && loc.start.cfi) {
              safeSetStorage(cfiKey, loc.start.cfi);
            }
            currentHref = (loc && loc.start && loc.start.href) || '';
            renderToc();
          } catch(_) {}
          updateProgress(loc);
          post({ type: 'progress', value: Math.round((loc && loc.percentage ? loc.percentage : 0) * 100) });
        });

        rendition.on('rendered', function(section) {
          renderedOnce = true;
          getEl('chapter').textContent = (section && section.label) || '';
        });

        var viewer = getEl('viewer');
        var startX = null;
        viewer.addEventListener('touchstart', function(e) { startX = e.changedTouches[0].clientX; });
        viewer.addEventListener('touchend', function(e) {
          if (startX == null) return;
          var dx = startX - e.changedTouches[0].clientX;
          if (Math.abs(dx) > 40) dx > 0 ? rendition.next() : rendition.prev();
          startX = null;
        });

        Promise.resolve(book.loaded && book.loaded.navigation)
          .then(function(nav) {
            tocItems = flattenToc(nav && nav.toc ? nav.toc : [], 0);
            renderToc();
          })
          .catch(function() {
            tocItems = [];
            renderToc();
          });

        book.ready.then(function() {
          post({ type: 'debug', step: 'ready' });
          return book.locations.generate(1024);
        }).catch(function(err) {
          post({ type: 'debug', step: 'locations-error', error: err && err.message ? err.message : String(err) });
        });

        window.setTimeout(function() {
          if (renderedOnce || !rendition) return;
          post({ type: 'debug', step: 'render-timeout-retry' });
          try {
            var retry = rendition.display();
            if (retry && typeof retry.catch === 'function') {
              retry.catch(function(){});
            }
          } catch (_) {}

          window.setTimeout(function() {
            if (!renderedOnce) {
              showError('EPUB loaded but no content could be rendered. Please try reopening the book.');
            }
          }, 3000);
        }, 7000);

        post({ type: 'loaded' });
      } catch (err) {
        showError('Failed to open EPUB: ' + (err && err.message ? err.message : String(err)));
      }
    }

    getEl('btn-prev').addEventListener('click', function() { rendition && rendition.prev(); });
    getEl('btn-next').addEventListener('click', function() { rendition && rendition.next(); });
    getEl('btn-toc').addEventListener('click', function() { openToc(); });
    getEl('btn-close-toc').addEventListener('click', function() { closeToc(); });
    getEl('toc-backdrop').addEventListener('click', function() { closeToc(); });
    getEl('btn-settings').addEventListener('click', function() { toggleSettings(); });

    getEl('theme').value = settings.theme;
    getEl('font').value = settings.font;
    getEl('size').value = String(settings.size);
    getEl('spacing').value = settings.spacing;

    getEl('theme').addEventListener('change', function(e) {
      settings.theme = e.target.value;
      saveSettings(settings);
      applyTheme(settings.theme);
    });
    getEl('font').addEventListener('change', function(e) {
      settings.font = e.target.value;
      saveSettings(settings);
      applyFont(settings.font);
    });
    getEl('size').addEventListener('input', function(e) {
      settings.size = Number(e.target.value || 100);
      saveSettings(settings);
      applySize(settings.size);
    });
    getEl('spacing').addEventListener('change', function(e) {
      settings.spacing = e.target.value;
      saveSettings(settings);
      applySpacing(settings.spacing);
    });

    window.addEventListener('keydown', function(e) {
      if (!rendition) return;
      if (e.key === 'ArrowRight' || e.key === ' ') rendition.next();
      if (e.key === 'ArrowLeft') rendition.prev();
      if (e.key === 'Escape') {
        toggleSettings(false);
        closeToc();
      }
    });

    loadBook();
  </script>
</body>
</html>`
}

async function downloadEpub(remoteUrl: string): Promise<string> {
  const filename = remoteUrl.split('/').pop()?.split('?')[0] || 'book.epub'
  const dir = FileSystem.cacheDirectory + 'epubs/'
  const localUri = dir + filename
  const dirInfo = await FileSystem.getInfoAsync(dir)
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true })
  }
  const fileInfo = await FileSystem.getInfoAsync(localUri)
  if (fileInfo.exists) {
    return localUri
  }
  const download = await FileSystem.downloadAsync(remoteUrl, localUri)
  if (download.status !== 200) {
    throw new Error(`EPUB download failed: ${download.status} ${download.uri}`)
  }
  return download.uri
}

/**
 * Cross-platform document reader for Loikmon eBooks.
 *  - PDF: rendered natively by the platform WebView (iOS) / Google Docs viewer
 *    fallback (Android).
 *  - EPUB: downloaded locally and rendered with epub.js inside the WebView.
 */
export function DocumentReader({ source }: { source: string }) {
  const url = fixUrl(source)
  const format = detectFormat(url)
  const { bodyFontFamily } = useTypography()
  const [error, setError] = useState<string | null>(null)
  const [epubPayload, setEpubPayload] = useState<{ uri: string; base64: string } | null>(null)
  const [downloading, setDownloading] = useState(false)
  const webViewRef = useRef<WebView>(null)

  const uri = useMemo(() => {
    if (format === 'pdf' && Platform.OS === 'android') {
      return `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(url)}`
    }
    return url
  }, [url, format])

  useEffect(() => {
    if (format !== 'epub' || !url) return
    let cancelled = false
    setError(null)
    setEpubPayload(null)
    setDownloading(true)
    downloadEpub(url)
      .then(async (localUri) => {
        const base64 = await FileSystem.readAsStringAsync(localUri, {
          encoding: FileSystem.EncodingType.Base64,
        })
        if (!cancelled) setEpubPayload({ uri: localUri, base64 })
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Download failed')
      })
      .finally(() => {
        if (!cancelled) setDownloading(false)
      })
    return () => { cancelled = true }
  }, [url, format])

  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data)
      if (data.type === 'error') setError(data.message)
      // eslint-disable-next-line no-console
      if (data.type === 'debug') console.log('[EpubReader]', data)
    } catch {
      // ignore non-JSON messages
    }
  }, [])

  const renderLoading = () => (
    <View className="flex-1 items-center justify-center bg-white dark:bg-surface-900">
      <ActivityIndicator size="large" color="#2563eb" />
    </View>
  )

  if (error) {
    return (
      <View className="flex-1 items-center justify-center bg-white dark:bg-surface-900 p-6">
        <Text className="text-center text-red-500">{error}</Text>
        <Text className="mt-2 text-center text-surface-500 text-sm" selectable>{url}</Text>
      </View>
    )
  }

  if (format === 'epub') {
    if (downloading || !epubPayload) {
      return renderLoading()
    }
    return (
      <WebView
        ref={webViewRef}
        key={`epub-${bodyFontFamily ?? 'system'}-${epubPayload.uri}`}
        originWhitelist={['*']}
        source={{ html: epubHtml(epubPayload, bodyFontFamily) }}
        startInLoadingState
        renderLoading={renderLoading}
        onMessage={handleMessage}
        onHttpError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent
          setError(`HTTP ${nativeEvent.statusCode}: ${nativeEvent.url}`)
        }}
        onError={(syntheticEvent) => {
          setError(syntheticEvent.nativeEvent.description)
        }}
        allowFileAccess
        allowUniversalAccessFromFileURLs
        mixedContentMode="always"
        mediaPlaybackRequiresUserAction={false}
        style={{ flex: 1 }}
      />
    )
  }

  return (
    <WebView
      ref={webViewRef}
      source={{ uri }}
      startInLoadingState
      renderLoading={renderLoading}
      onError={(syntheticEvent) => setError(syntheticEvent.nativeEvent.description)}
      allowFileAccess
      allowUniversalAccessFromFileURLs
      mixedContentMode="always"
      style={{ flex: 1 }}
    />
  )
}
