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
function epubHtml(url: string, fontFamily: string | undefined): string {
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
    #viewer { position: fixed; top: 48px; left: 0; right: 0; bottom: 0; }
    #toolbar { position: fixed; top: 0; left: 0; right: 0; height: 48px; display: flex; align-items: center; justify-content: space-between; padding: 0 12px; background: #ffffff; border-bottom: 1px solid #e5e7eb; box-sizing: border-box; }
    #toolbar button { border: 0; background: none; color: #374151; font-size: 20px; padding: 6px 10px; }
    #toolbar select, #toolbar input[type=range] { margin-left: 6px; }
    #msg { position: fixed; top: 52px; left: 12px; right: 12px; padding: 10px; background: #fee2e2; color: #991b1b; border-radius: 8px; font-size: 13px; display: none; z-index: 100; }
    #progress { position: fixed; top: 48px; left: 0; right: 0; height: 3px; background: #e5e7eb; z-index: 50; }
    #progress > div { height: 100%; background: #4f46e5; width: 0%; transition: width 0.3s; }
  </style>
  <script src="https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js" crossorigin="anonymous"></script>
  <script src="https://cdn.jsdelivr.net/npm/epubjs@0.3.93/dist/epub.min.js" crossorigin="anonymous"></script>
</head>
<body>
  <div id="toolbar">
    <button id="btn-toc" title="Contents">☰</button>
    <span id="chapter" style="font-size:13px; color:#6b7280; max-width:40%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;"></span>
    <div>
      <select id="theme">
        <option value="light">Light</option>
        <option value="sepia">Sepia</option>
        <option value="dark">Dark</option>
        <option value="black">Black</option>
      </select>
      <select id="font">
        <option value="">Default</option>
        <option value="Georgia, serif">Georgia</option>
        <option value="Arial, sans-serif">Arial</option>
        <option value="system-ui, -apple-system, sans-serif">System</option>
      </select>
      <input id="size" type="range" min="60" max="200" value="100" />
      <button id="btn-prev" title="Previous">‹</button>
      <button id="btn-next" title="Next">›</button>
    </div>
  </div>
  <div id="progress"><div></div></div>
  <div id="msg"></div>
  <div id="viewer"></div>
  <script>
    var bookUrl = ${JSON.stringify(url)};
    var selectedFontFamily = ${JSON.stringify(cssFontFamily)};
    var book, rendition;
    var themes = {
      light: { bg: '#ffffff', fg: '#111827' },
      sepia: { bg: '#f8f0e3', fg: '#3d2b1f' },
      gray:  { bg: '#e8e8e8', fg: '#1a1a1a' },
      dark:  { bg: '#1a1a2e', fg: '#d0d0e0' },
      black: { bg: '#000000', fg: '#cccccc' },
    };

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
      var toolbar = document.getElementById('toolbar');
      toolbar.style.background = t.bg;
      toolbar.style.borderBottomColor = t.fg + '22';
      toolbar.style.color = t.fg;
      if (!rendition || !rendition.themes) return;
      rendition.themes.register('reader-theme', {
        'html': { 'background': t.bg + ' !important', 'background-color': t.bg + ' !important' },
        'body': { 'background': t.bg + ' !important', 'background-color': t.bg + ' !important', 'color': t.fg + ' !important' }
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

    function loadBook() {
      if (!bookUrl) { showError('No EPUB URL provided'); return; }
      if (!bookUrl.startsWith('http') && !bookUrl.startsWith('file://')) {
        showError('Invalid EPUB URL: ' + bookUrl);
        return;
      }
      try {
        post({ type: 'debug', step: 'opening', url: bookUrl });
        book = ePub(bookUrl);
        rendition = book.renderTo('viewer', {
          width: '100%',
          height: '100%',
          flow: 'paginated',
          allowScriptedContent: false,
          spread: 'none'
        });

        var saved = localStorage.getItem('epub-cfi-' + bookUrl);
        rendition.display(saved).catch(function(err) {
          post({ type: 'debug', step: 'display-saved-failed', error: err?.message });
          return rendition.display();
        });

        applyTheme(document.getElementById('theme').value);
        applyFont('');
        applySize(document.getElementById('size').value);

        rendition.on('relocated', function(loc) {
          updateProgress(loc);
          post({ type: 'progress', value: Math.round((loc.percentage || 0) * 100) });
        });

        rendition.on('rendered', function(section) {
          document.getElementById('chapter').textContent = (section && section.label) || '';
        });

        var viewer = document.getElementById('viewer');
        var startX = null;
        viewer.addEventListener('touchstart', function(e) { startX = e.changedTouches[0].clientX; });
        viewer.addEventListener('touchend', function(e) {
          if (startX == null) return;
          var dx = startX - e.changedTouches[0].clientX;
          if (Math.abs(dx) > 40) dx > 0 ? rendition.next() : rendition.prev();
          startX = null;
        });

        book.ready.then(function() {
          post({ type: 'debug', step: 'ready' });
          return book.locations.generate(1024);
        }).catch(function(err) {
          post({ type: 'debug', step: 'locations-error', error: err?.message });
        });

        post({ type: 'loaded' });
      } catch (err) {
        showError('Failed to open EPUB: ' + (err && err.message ? err.message : String(err)));
      }
    }

    document.getElementById('btn-prev').addEventListener('click', function() { rendition && rendition.prev(); });
    document.getElementById('btn-next').addEventListener('click', function() { rendition && rendition.next(); });
    document.getElementById('theme').addEventListener('change', function(e) { applyTheme(e.target.value); });
    document.getElementById('font').addEventListener('change', function(e) { applyFont(e.target.value); });
    document.getElementById('size').addEventListener('input', function(e) { applySize(e.target.value); });

    window.addEventListener('keydown', function(e) {
      if (!rendition) return;
      if (e.key === 'ArrowRight' || e.key === ' ') rendition.next();
      if (e.key === 'ArrowLeft') rendition.prev();
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
  const [localEpub, setLocalEpub] = useState<string | null>(null)
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
    setDownloading(true)
    downloadEpub(url)
      .then((localUri) => {
        if (!cancelled) setLocalEpub(localUri)
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
    if (downloading || !localEpub) {
      return renderLoading()
    }
    return (
      <WebView
        ref={webViewRef}
        key={`epub-${bodyFontFamily ?? 'system'}-${localEpub}`}
        originWhitelist={['*']}
        source={{ html: epubHtml(localEpub, bodyFontFamily) }}
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
