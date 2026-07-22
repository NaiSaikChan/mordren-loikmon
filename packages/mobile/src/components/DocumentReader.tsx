import { useMemo } from 'react'
import { Platform, View, ActivityIndicator } from 'react-native'
import { WebView } from 'react-native-webview'
import { fixUrl } from '@/lib/url'
import { detectFormat } from '@/lib/format'

export { detectFormat }

/**
 * Minimal epub.js reader page rendered inside a WebView.
 *
 * Security note: jszip and epub.js are loaded from jsDelivr at **pinned exact
 * versions** (immutable URLs). `crossorigin="anonymous"` is set so the browser
 * treats them as CORS resources. For a hardened build, bundle these libraries
 * as local assets (or add Subresource Integrity hashes) to remove the runtime
 * CDN dependency entirely.
 */
function epubHtml(url: string): string {
  return `<!doctype html><html><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<style>html,body{margin:0;height:100%;background:#fff}#viewer{height:100vh}
#bar{position:fixed;bottom:0;left:0;right:0;display:flex;justify-content:space-between;padding:10px;background:rgba(0,0,0,.05)}
button{border:0;background:#2563eb;color:#fff;padding:8px 16px;border-radius:8px;font-size:16px}</style>
<script src="https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js" crossorigin="anonymous"></script>
<script src="https://cdn.jsdelivr.net/npm/epubjs@0.3.93/dist/epub.min.js" crossorigin="anonymous"></script>
</head><body>
<div id="viewer"></div>
<div id="bar"><button onclick="rendition.prev()">‹</button><button onclick="rendition.next()">›</button></div>
<script>
  var book = ePub("${url}");
  var rendition = book.renderTo("viewer", { width: "100%", height: "100%", flow: "paginated" });
  rendition.display();
</script>
</body></html>`
}

/**
 * Cross-platform document reader for Loikmon eBooks.
 *  - PDF: rendered natively by the platform WebView (iOS) / Google Docs viewer
 *    fallback (Android, which cannot render PDFs inline).
 *  - EPUB: rendered with epub.js inside the WebView.
 */
export function DocumentReader({ source }: { source: string }) {
  const url = fixUrl(source)
  const format = detectFormat(url)

  const uri = useMemo(() => {
    if (format === 'pdf' && Platform.OS === 'android') {
      return `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(url)}`
    }
    return url
  }, [url, format])

  const renderLoading = () => (
    <View className="flex-1 items-center justify-center bg-white">
      <ActivityIndicator size="large" color="#2563eb" />
    </View>
  )

  if (format === 'epub') {
    return (
      <WebView
        originWhitelist={['*']}
        source={{ html: epubHtml(url) }}
        startInLoadingState
        renderLoading={renderLoading}
        style={{ flex: 1 }}
      />
    )
  }

  return (
    <WebView
      source={{ uri }}
      startInLoadingState
      renderLoading={renderLoading}
      allowFileAccess
      style={{ flex: 1 }}
    />
  )
}
