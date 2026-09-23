import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { Reader, ReaderProvider, useReader } from '@epubjs-react-native/core'
import { useEpubFileSystem } from '@/lib/useEpubFileSystem'
import * as FileSystem from 'expo-file-system/legacy'
import { Asset } from 'expo-asset'
import { WebView } from 'react-native-webview'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { fixUrl } from '@/lib/url'
import { detectFormat } from '@/lib/format'
import { FONT_OPTIONS, useTypography } from '@/context/TypographyContext'
import { storage } from '@/services/storage'
import { buildFontFacesCss, buildRenditionFontHookScript } from '@/lib/readerUtils'
import { chunkRanges } from '@/lib/pdfStream'
import { useTheme } from '@/context/ThemeContext'

export { detectFormat }

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const READER_CUSTOM_FONT_ASSETS = [
  { id: 'Mon3Anonta1', module: require('../../assets/fonts/Mon3Anonta1.ttf') },
  { id: 'MUA_Office_adobe', module: require('../../assets/fonts/MUA_Office_adobe.ttf') },
  { id: 'Pyidaungsu', module: require('../../assets/fonts/Pyidaungsu-2.5.4_Regular.ttf') },
  { id: 'PyidaungsuNumbers', module: require('../../assets/fonts/PyidaungsuNumbers-Regular.ttf') },
  { id: 'Style1', module: require('../../assets/fonts/Style1.ttf') },
  { id: 'Style2', module: require('../../assets/fonts/Style2.ttf') },
  { id: 'Style3', module: require('../../assets/fonts/Style3.ttf') },
  { id: 'Style4', module: require('../../assets/fonts/Style4.ttf') },
  { id: 'Style5', module: require('../../assets/fonts/Style5.ttf') },
] as const

const READER_THEMES = {
  light: { label: 'Light', bg: '#ffffff', fg: '#111827' },
  sepia: { label: 'Sepia', bg: '#f8f0e3', fg: '#3d2b1f' },
  dark:  { label: 'Dark',  bg: '#1a1a2e', fg: '#d0d0e0' },
  black: { label: 'Black', bg: '#000000', fg: '#cccccc' },
} as const

type ThemeId = keyof typeof READER_THEMES

const FONT_SIZE_OPTIONS = [80, 90, 100, 110, 120, 140, 160]

const LINE_SPACING_OPTIONS = [
  { label: 'Compact',     value: 1.2 },
  { label: 'Normal',      value: 1.5 },
  { label: 'Comfortable', value: 1.8 },
  { label: 'Wide',        value: 2.1 },
]

const READER_SETTINGS_KEY = 'epub-reader-settings'
const TOOLBAR_H = 52
const PROGRESS_H = 3

interface ReaderSettings {
  fontId: string
  fontSize: number
  themeId: ThemeId
  lineSpacing: number
}

const DEFAULT_SETTINGS: ReaderSettings = {
  fontId: 'system',
  fontSize: 100,
  themeId: 'light',
  lineSpacing: 1.5,
}

// ---------------------------------------------------------------------------
// Theme helper
// ---------------------------------------------------------------------------

function buildEpubTheme(themeId: ThemeId) {
  const { bg, fg } = READER_THEMES[themeId]
  return {
    body:  { background: bg, color: `${fg} !important` },
    p:     { color: `${fg} !important` },
    li:    { color: `${fg} !important` },
    h1:    { color: `${fg} !important` },
    h2:    { color: `${fg} !important` },
    h3:    { color: `${fg} !important` },
    span:  { color: `${fg} !important` },
    a:     { color: `${fg} !important`, 'pointer-events': 'auto', cursor: 'pointer' },
    '::selection': { background: 'lightskyblue' },
  }
}

// ---------------------------------------------------------------------------
// Font application helper
// Bypasses the library's changeFontFamily() which adds an extra layer of
// CSS quoting that breaks generic keywords like "serif" and font stacks.
// ---------------------------------------------------------------------------

function applyFont(
  injectJavascript: (code: string) => void,
  fontId: string,
) {
  let cssValue: string
  if (fontId === 'system') {
    cssValue = 'system-ui, -apple-system, sans-serif'
  } else if (fontId === 'serif') {
    cssValue = 'serif'
  } else {
    const opt = FONT_OPTIONS.find((f) => f.id === fontId)
    cssValue = opt?.family ?? 'system-ui, -apple-system, sans-serif'
  }
  const escaped = cssValue.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
  injectJavascript(
    `try{rendition.themes.override('font-family','${escaped}');` +
    `rendition.views().forEach(function(v){v.pane&&v.pane.render();});}catch(e){}true;`,
  )
}

// ---------------------------------------------------------------------------
// Download helper
// ---------------------------------------------------------------------------

class HttpStatusError extends Error {
  constructor(readonly status: number) {
    super(`EPUB download failed: HTTP ${status}`)
  }
}

/** Signed URLs expire: S3/MinIO answer 403 (or 400/401) once the signature is stale. */
function isExpiredStatus(status: number): boolean {
  return status === 400 || status === 401 || status === 403
}

/**
 * Download an EPUB into the cache. The cache file is keyed by book id + format
 * (never by the signed URL, whose query string changes on every request), and
 * is only committed after a successful download.
 */
async function downloadEpub(remoteUrl: string, cacheKey: string): Promise<string> {
  const safeKey = cacheKey.replace(/[^a-zA-Z0-9._-]/g, '_')
  const dir = (FileSystem.cacheDirectory ?? '') + 'epubs/'
  const localUri = `${dir}${safeKey}.epub`
  const partUri = `${localUri}.part`
  const dirInfo = await FileSystem.getInfoAsync(dir)
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true })
  }
  const fileInfo = await FileSystem.getInfoAsync(localUri)
  if (fileInfo.exists && (fileInfo.size ?? 0) > 0) return localUri
  try {
    const result = await FileSystem.downloadAsync(remoteUrl, partUri)
    if (result.status !== 200) throw new HttpStatusError(result.status)
    await FileSystem.moveAsync({ from: partUri, to: localUri })
    return localUri
  } finally {
    await FileSystem.deleteAsync(partUri, { idempotent: true }).catch(() => undefined)
  }
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

function useCustomFontUris(): { uris: Record<string, string>; loading: boolean } {
  const [uris, setUris] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const entries: Array<[string, string]> = []
      for (const font of READER_CUSTOM_FONT_ASSETS) {
        const asset = Asset.fromModule(font.module)
        await asset.downloadAsync()
        const uri = asset.localUri ?? asset.uri
        if (uri) entries.push([font.id, uri])
      }
      if (!cancelled) setUris(Object.fromEntries(entries))
    })()
      .catch((err: unknown) => {
        console.warn('[DocumentReader] font load error:', err)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  return { uris, loading }
}

function useEpubDownload(
  url: string,
  cacheKey: string,
  refreshUrl?: () => Promise<string | null>,
): {
  localUri: string | null
  downloading: boolean
  error: string | null
} {
  const [localUri, setLocalUri] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const refreshRef = useRef(refreshUrl)
  refreshRef.current = refreshUrl

  useEffect(() => {
    let cancelled = false
    setLocalUri(null)
    setError(null)
    setDownloading(true)
    ;(async () => {
      try {
        return await downloadEpub(url, cacheKey)
      } catch (err) {
        // The signed URL may have expired before the download started: fetch a fresh one once.
        if (err instanceof HttpStatusError && isExpiredStatus(err.status) && refreshRef.current) {
          const fresh = await refreshRef.current()
          if (fresh) return downloadEpub(fresh, cacheKey)
        }
        throw err
      }
    })()
      .then((uri) => { if (!cancelled) setLocalUri(uri) })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Download failed')
      })
      .finally(() => { if (!cancelled) setDownloading(false) })
    return () => { cancelled = true }
  }, [url, cacheKey])

  return { localUri, downloading, error }
}

function useReaderSettings(): {
  settings: ReaderSettings
  update: (patch: Partial<ReaderSettings>) => void
  loaded: boolean
} {
  const [settings, setSettings] = useState<ReaderSettings>(DEFAULT_SETTINGS)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    storage
      .get(READER_SETTINGS_KEY)
      .then((raw) => {
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as Partial<ReaderSettings>
            setSettings((prev) => ({ ...prev, ...parsed }))
          } catch { /* use defaults */ }
        }
        setLoaded(true)
      })
      .catch(() => setLoaded(true))
  }, [])

  const update = useCallback((patch: Partial<ReaderSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch }
      void storage.set(READER_SETTINGS_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  return { settings, update, loaded }
}

// ---------------------------------------------------------------------------
// ToC Modal
// ---------------------------------------------------------------------------

interface TocItem {
  href: string
  label: string
  subitems?: TocItem[]
}

interface FlatTocItem {
  href: string
  label: string
  depth: number
}

function flattenToc(items: TocItem[], depth = 0): FlatTocItem[] {
  const out: FlatTocItem[] = []
  for (const item of items) {
    out.push({ href: item.href, label: item.label.trim(), depth })
    if (item.subitems?.length) {
      out.push(...flattenToc(item.subitems, depth + 1))
    }
  }
  return out
}

function TocModal({
  visible,
  toc,
  onClose,
  onNavigate,
  themeId,
}: {
  visible: boolean
  toc: TocItem[]
  onClose: () => void
  onNavigate: (href: string) => void
  themeId: ThemeId
}) {
  const { bg, fg } = READER_THEMES[themeId]
  const { bodyTextStyle, headerTextStyle } = useTypography()
  const insets = useSafeAreaInsets()
  const items = useMemo(() => flattenToc(toc), [toc])
  const slideAnim = useRef(new Animated.Value(-300)).current

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: visible ? 0 : -300,
      duration: 220,
      useNativeDriver: true,
    }).start()
  }, [visible, slideAnim])

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <Pressable style={styles.tocBackdrop} onPress={onClose} />
      <Animated.View
        style={[
          styles.tocPanel,
          { backgroundColor: bg, transform: [{ translateX: slideAnim }] },
        ]}
      >
        {/* Spacer pushes panel content below the notch / Dynamic Island */}
        <View style={{ height: insets.top }} />
        <View style={[styles.tocHeader, { borderBottomColor: fg + '22' }]}>
          <Text style={[styles.tocTitle, headerTextStyle, { color: fg }]}>Contents</Text>
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <Text style={{ color: fg, fontSize: 18 }}>✕</Text>
          </TouchableOpacity>
        </View>
        {items.length === 0 ? (
          <Text style={[styles.tocEmpty, bodyTextStyle, { color: fg }]}>No chapters found</Text>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(item, i) => `${item.href}-${i}`}
            contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => { onNavigate(item.href); onClose() }}
                style={[styles.tocItem, { paddingLeft: 12 + item.depth * 16 }]}
              >
                <Text style={[styles.tocItemText, bodyTextStyle, { color: fg }, { paddingTop: 1 }]} numberOfLines={2}>
                  {item.label || item.href || 'Untitled'}
                </Text>
              </TouchableOpacity>
            )}
          />
        )}
      </Animated.View>
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// Settings Modal
// ---------------------------------------------------------------------------

function SettingsModal({
  visible,
  settings,
  onUpdate,
  onClose,
  customFontUris,
}: {
  visible: boolean
  settings: ReaderSettings
  onUpdate: (patch: Partial<ReaderSettings>) => void
  onClose: () => void
  customFontUris: Record<string, string>
}) {
  const { bg, fg } = READER_THEMES[settings.themeId]
  const insets = useSafeAreaInsets()

  const availableFonts = useMemo(
    () =>
      FONT_OPTIONS.filter((opt) => {
        if (opt.id === 'system' || opt.id === 'serif') return true
        return Boolean(customFontUris[opt.id])
      }),
    [customFontUris],
  )

  const currentSizeIndex = FONT_SIZE_OPTIONS.indexOf(settings.fontSize)

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.settingsBackdrop} onPress={onClose} />
      <View style={[styles.settingsSheet, { backgroundColor: bg, paddingBottom: Math.max(32, insets.bottom + 16) }]}>
        {/* Header */}
        <View style={[styles.settingsHeader, { borderBottomColor: fg + '22' }]}>
          <Text style={[styles.settingsTitle, { color: fg }]}>Reader Settings</Text>
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <Text style={{ color: fg, fontSize: 18 }}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Theme */}
        <View style={styles.settingsRow}>
          <Text style={[styles.settingsLabel, { color: fg }]}>Theme</Text>
          <View style={styles.themeRow}>
            {(Object.entries(READER_THEMES) as Array<[ThemeId, typeof READER_THEMES[ThemeId]]>).map(
              ([id, theme]) => (
                <TouchableOpacity
                  key={id}
                  onPress={() => onUpdate({ themeId: id })}
                  style={[
                    styles.themeCircle,
                    { backgroundColor: theme.bg, borderColor: settings.themeId === id ? '#4f46e5' : theme.fg + '44' },
                    settings.themeId === id && styles.themeCircleActive,
                  ]}
                >
                  <Text style={{ color: theme.fg, fontSize: 9, fontWeight: '600' }}>
                    {theme.label}
                  </Text>
                </TouchableOpacity>
              ),
            )}
          </View>
        </View>

        {/* Font */}
        <View style={styles.settingsRow}>
          <Text style={[styles.settingsLabel, { color: fg }]}>Font</Text>
          <FlatList
            horizontal
            data={availableFonts}
            keyExtractor={(item) => item.id}
            showsHorizontalScrollIndicator={false}
            style={styles.fontList}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => onUpdate({ fontId: item.id })}
                style={[
                  styles.fontChip,
                  {
                    backgroundColor: settings.fontId === item.id ? '#4f46e5' : fg + '11',
                    borderColor: settings.fontId === item.id ? '#4f46e5' : fg + '33',
                  },
                ]}
              >
                <Text
                  style={{
                    color: settings.fontId === item.id ? '#fff' : fg,
                    fontSize: 12,
                    fontFamily: item.family,
                  }}
                  numberOfLines={1}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            )}
          />
        </View>

        {/* Font size */}
        <View style={styles.settingsRow}>
          <Text style={[styles.settingsLabel, { color: fg }]}>Font Size</Text>
          <View style={styles.sizeRow}>
            <TouchableOpacity
              onPress={() => {
                const idx = Math.max(0, (currentSizeIndex < 0 ? 2 : currentSizeIndex) - 1)
                onUpdate({ fontSize: FONT_SIZE_OPTIONS[idx] })
              }}
              style={[styles.sizeBtn, { borderColor: fg + '44' }]}
            >
              <Text style={{ color: fg, fontSize: 18 }}>−</Text>
            </TouchableOpacity>
            <Text style={[styles.sizeLbl, { color: fg }]}>{settings.fontSize}%</Text>
            <TouchableOpacity
              onPress={() => {
                const idx = Math.min(
                  FONT_SIZE_OPTIONS.length - 1,
                  (currentSizeIndex < 0 ? 2 : currentSizeIndex) + 1,
                )
                onUpdate({ fontSize: FONT_SIZE_OPTIONS[idx] })
              }}
              style={[styles.sizeBtn, { borderColor: fg + '44' }]}
            >
              <Text style={{ color: fg, fontSize: 18 }}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Line spacing */}
        <View style={[styles.settingsRow, { marginBottom: 0 }]}>
          <Text style={[styles.settingsLabel, { color: fg }]}>Line Spacing</Text>
          <View style={styles.spacingRow}>
            {LINE_SPACING_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                onPress={() => onUpdate({ lineSpacing: opt.value })}
                style={[
                  styles.spacingChip,
                  {
                    backgroundColor: settings.lineSpacing === opt.value ? '#4f46e5' : fg + '11',
                    borderColor: settings.lineSpacing === opt.value ? '#4f46e5' : fg + '33',
                  },
                ]}
              >
                <Text style={{ color: settings.lineSpacing === opt.value ? '#fff' : fg, fontSize: 11 }}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// Inner EPUB reader view — must be inside ReaderProvider to use useReader
// ---------------------------------------------------------------------------

function EpubReaderView({
  localUri,
  fontHookScript,
  customFontUris,
  initialFontId,
  settings,
  onSettingsUpdate,
}: {
  localUri: string
  fontHookScript: string
  customFontUris: Record<string, string>
  initialFontId: string
  settings: ReaderSettings
  onSettingsUpdate: (patch: Partial<ReaderSettings>) => void
}) {
  const {
    goToLocation,
    toc,
    section,
    progress,
    isLoading,
    changeFontSize,
    changeTheme,
    injectJavascript,
  } = useReader()

  const [showToC, setShowToC] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const settingsRef = useRef(settings)
  settingsRef.current = settings

  // Use onLayout to get the exact available dimensions for the Reader container.
  // Dimensions.get('window') does NOT subtract the navigation header height,
  // so using it directly causes epub.js to format pages that overflow the visible
  // area — leaving content cut off at the bottom of every page.
  const [readerLayout, setReaderLayout] = useState({ width: 0, height: 0 })

  // Stable initial theme — captured ONCE at mount so Reader's useEffect dep never
  // changes between renders, preventing the "Maximum update depth exceeded" loop.
  // Settings are guaranteed loaded by the parent before this component mounts.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const initialEpubTheme = useMemo(() => buildEpubTheme(settings.themeId), [])

  // Apply all reader settings after the book is ready
  const handleReady = useCallback(() => {
    const s = settingsRef.current
    changeTheme(buildEpubTheme(s.themeId))
    changeFontSize(`${s.fontSize}%`)
    applyFont(injectJavascript, s.fontId !== 'system' ? s.fontId : initialFontId)
    const lsEscaped = String(s.lineSpacing).replace(/'/g, "\\'")
    injectJavascript(
      `try{rendition.themes.override('line-height','${lsEscaped}');}catch(e){}true;`,
    )
  }, [changeTheme, changeFontSize, injectJavascript, initialFontId])

  // Sync settings changes to epub.js live (only when values actually change)
  const prevSettings = useRef(settings)
  useEffect(() => {
    const prev = prevSettings.current
    prevSettings.current = settings

    if (settings.themeId !== prev.themeId) {
      changeTheme(buildEpubTheme(settings.themeId))
    }
    if (settings.fontSize !== prev.fontSize) {
      changeFontSize(`${settings.fontSize}%`)
    }
    if (settings.fontId !== prev.fontId) {
      applyFont(injectJavascript, settings.fontId)
    }
    if (settings.lineSpacing !== prev.lineSpacing) {
      const ls = String(settings.lineSpacing).replace(/'/g, "\\'")
      injectJavascript(
        `try{rendition.themes.override('line-height','${ls}');}catch(e){}true;`,
      )
    }
  }, [settings, changeTheme, changeFontSize, injectJavascript])

  const { bg, fg } = READER_THEMES[settings.themeId]

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      {/* Toolbar */}
      <View style={[styles.toolbar, { backgroundColor: bg, borderBottomColor: fg + '22' }]}>
        <TouchableOpacity onPress={() => setShowToC(true)} hitSlop={8} style={styles.toolbarBtn}>
          <Text style={[styles.toolbarIcon, { color: fg }]}>☰</Text>
        </TouchableOpacity>
        <Text style={[styles.chapterTitle, { color: fg }]} numberOfLines={1}>
          {section?.label ?? ''}
        </Text>
        <TouchableOpacity onPress={() => setShowSettings(true)} hitSlop={8} style={styles.toolbarBtn}>
          <Text style={[styles.toolbarIcon, { color: fg }]}>⚙</Text>
        </TouchableOpacity>
      </View>

      {/* Progress bar */}
      <View style={[styles.progressBar, { backgroundColor: fg + '22' }]}>
        <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
      </View>

      {/* Reader — onLayout provides the exact available dimensions */}
      <View
        style={{ flex: 1 }}
        onLayout={(e) => {
          const { width: w, height: h } = e.nativeEvent.layout
          if (w > 0 && h > 0) setReaderLayout({ width: w, height: h })
        }}
      >
        {readerLayout.height > 0 && (
          <Reader
            src={localUri}
            width={readerLayout.width}
            height={readerLayout.height}
            fileSystem={useEpubFileSystem}
            defaultTheme={initialEpubTheme}
            enableSwipe
            injectedJavascript={fontHookScript}
            onReady={handleReady}
          />
        )}

        {/* Loading overlay — shown while epub.js initialises or container isn't measured yet */}
        {(isLoading || readerLayout.height === 0) && (
          <View style={[StyleSheet.absoluteFill, styles.loadingOverlay]}>
            <ActivityIndicator size="large" color="#4f46e5" />
          </View>
        )}
      </View>

      {/* ToC */}
      <TocModal
        visible={showToC}
        toc={toc as TocItem[]}
        onClose={() => setShowToC(false)}
        onNavigate={(href) => goToLocation(href)}
        themeId={settings.themeId}
      />

      {/* Settings */}
      <SettingsModal
        visible={showSettings}
        settings={settings}
        onUpdate={onSettingsUpdate}
        onClose={() => setShowSettings(false)}
        customFontUris={customFontUris}
      />
    </View>
  )
}

// ---------------------------------------------------------------------------
// Outer EPUB component — provides fonts + download, then renders ReaderProvider
// ---------------------------------------------------------------------------

function EpubDocumentReader({
  url,
  cacheKey,
  refreshUrl,
}: {
  url: string
  cacheKey: string
  refreshUrl?: () => Promise<string | null>
}) {
  const { bodyFontFamily } = useTypography()
  const { uris: customFontUris, loading: fontLoading } = useCustomFontUris()
  const { localUri, downloading, error } = useEpubDownload(url, cacheKey, refreshUrl)
  // Settings are owned here so they're loaded before EpubReaderView mounts.
  // This ensures the initial theme passed to <Reader defaultTheme={}> is correct
  // and prevents the render-loop caused by a stale default vs loaded settings.
  const { settings, update, loaded: settingsLoaded } = useReaderSettings()

  const fontFacesCss = useMemo(() => buildFontFacesCss(customFontUris), [customFontUris])
  const fontHookScript = useMemo(
    () => buildRenditionFontHookScript(fontFacesCss),
    [fontFacesCss],
  )

  // Derive the initial font ID from the app's body font setting
  const initialFontId = useMemo(() => {
    if (!bodyFontFamily) return 'system'
    const opt = FONT_OPTIONS.find((f) => f.family === bodyFontFamily)
    return opt?.id ?? 'system'
  }, [bodyFontFamily])

  const renderLoading = () => (
    <View style={styles.centered}>
      <ActivityIndicator size="large" color="#4f46e5" />
    </View>
  )

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    )
  }

  if (downloading || fontLoading || !localUri || !settingsLoaded) {
    return renderLoading()
  }

  return (
    <ReaderProvider>
      <EpubReaderView
        localUri={localUri}
        fontHookScript={fontHookScript}
        customFontUris={customFontUris}
        initialFontId={initialFontId}
        settings={settings}
        onSettingsUpdate={update}
      />
    </ReaderProvider>
  )
}

// ---------------------------------------------------------------------------
// PDF reader — bundled pdf.js in a locked-down WebView
// ---------------------------------------------------------------------------

/*
 * Android's WebView cannot render a PDF on its own, and the Google Docs viewer
 * this used to go through fails for our files: `docs.google.com/gview` has to
 * fetch the document itself, which it cannot do for a short-lived signed URL
 * on a private/dev host (10.0.2.2 in the emulator), and it would hand a
 * paywalled book to a third party regardless.
 *
 * Instead we bundle pdf.js (see `scripts/build-pdf-viewer.js`) and stream the
 * bytes into it over the RN bridge. The document is only ever pixels on a
 * canvas inside the app: no text layer to select or copy, no toolbar, no URL
 * to download or share, and no temporary file left behind.
 */

const PDF_VIEWER_ASSET = require('../../assets/pdfjs/viewer.html')

/** Applies the reader's colour scheme and re-asserts the no-selection rules. */
function pdfViewerBootstrap(isDark: boolean): string {
  return `
    document.documentElement.classList.${isDark ? 'add' : 'remove'}('dark');
    true;
  `
}

/** Copies the bundled viewer out of the app bundle and returns its file:// URI. */
function usePdfViewerAsset(): { uri: string | null; error: string | null } {
  const [uri, setUri] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const asset = Asset.fromModule(PDF_VIEWER_ASSET)
    asset
      .downloadAsync()
      .then(() => {
        if (!cancelled) setUri(asset.localUri ?? asset.uri)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Viewer unavailable')
      })
    return () => {
      cancelled = true
    }
  }, [])

  return { uri, error }
}

/**
 * Downloads the PDF to the app's private cache, pushes it into the WebView in
 * aligned slices, and deletes the file again — it exists on disk only for the
 * few hundred milliseconds it takes to stream.
 */
async function streamPdf(
  remoteUrl: string,
  inject: (code: string) => void,
  refreshUrl?: () => Promise<string | null>,
): Promise<void> {
  const dir = (FileSystem.cacheDirectory ?? '') + 'pdf-view/'
  const localUri = `${dir}doc-${Date.now()}.pdf`
  const dirInfo = await FileSystem.getInfoAsync(dir)
  if (!dirInfo.exists) await FileSystem.makeDirectoryAsync(dir, { intermediates: true })

  try {
    let result = await FileSystem.downloadAsync(remoteUrl, localUri)
    // The signed URL may have expired between issuing and use: retry once.
    if (isExpiredStatus(result.status) && refreshUrl) {
      const fresh = await refreshUrl()
      if (fresh) result = await FileSystem.downloadAsync(fresh, localUri)
    }
    if (result.status !== 200) throw new HttpStatusError(result.status)

    const info = await FileSystem.getInfoAsync(localUri)
    const size = info.exists ? (info.size ?? 0) : 0
    if (!size) throw new Error('The file is empty')

    for (const range of chunkRanges(size)) {
      const base64 = await FileSystem.readAsStringAsync(localUri, {
        encoding: FileSystem.EncodingType.Base64,
        position: range.position,
        length: range.length,
      })
      inject(`window.__pdfChunk(${JSON.stringify(base64)});true;`)
    }
    inject(`window.__pdfDone(${size});true;`)
  } finally {
    await FileSystem.deleteAsync(localUri, { idempotent: true }).catch(() => undefined)
  }
}

function PdfDocumentReader({ url, refreshUrl }: { url: string; refreshUrl?: () => Promise<string | null> }) {
  const { isDark } = useTheme()
  const { uri: viewerUri, error: viewerError } = usePdfViewerAsset()
  const webRef = useRef<WebView>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const streaming = useRef(false)
  const refreshRef = useRef(refreshUrl)
  refreshRef.current = refreshUrl

  // A new signed URL means a new document.
  useEffect(() => {
    setError(null)
    setLoading(true)
  }, [url])

  const onMessage = useCallback(
    (event: { nativeEvent: { data: string } }) => {
      let message: { type?: string; message?: string }
      try {
        message = JSON.parse(event.nativeEvent.data)
      } catch {
        return
      }

      if (message.type === 'ready') {
        // The page says it is empty and waiting — which is also true after the
        // system reloads a backgrounded WebView, so stream again every time.
        if (streaming.current) return
        streaming.current = true
        streamPdf(url, (code) => webRef.current?.injectJavaScript(code), refreshRef.current)
          .catch((err: unknown) => {
            const reason =
              err instanceof HttpStatusError
                ? `Could not open this book (HTTP ${err.status})`
                : err instanceof Error
                  ? err.message
                  : 'Could not open this book'
            setError(reason)
            setLoading(false)
          })
          .finally(() => {
            streaming.current = false
          })
      } else if (message.type === 'loaded') {
        setLoading(false)
      } else if (message.type === 'error') {
        setError(message.message ?? 'This file could not be opened')
        setLoading(false)
      }
    },
    [url],
  )

  const failure = error ?? viewerError
  if (failure) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{failure}</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {viewerUri ? (
        <WebView
          ref={webRef}
          source={{ uri: viewerUri }}
          originWhitelist={['file://*']}
          // The bundled viewer is the only thing this WebView may ever show:
          // no link, redirect or embedded resource can take it elsewhere.
          onShouldStartLoadWithRequest={(request) =>
            request.url.startsWith('file://') || request.url.startsWith('about:')
          }
          onMessage={onMessage}
          injectedJavaScript={pdfViewerBootstrap(isDark)}
          onError={(e) => setError(e.nativeEvent.description)}
          // Reading only: no downloads, no share sheet, no selection callout.
          allowFileAccess
          allowFileAccessFromFileURLs={false}
          allowUniversalAccessFromFileURLs={false}
          allowsLinkPreview={false}
          javaScriptCanOpenWindowsAutomatically={false}
          setSupportMultipleWindows={false}
          // Must be an array: Fabric parses this iOS prop on Android too, and a
          // bare string aborts the process in RawValue::castValue.
          dataDetectorTypes={['none']}
          menuItems={[]}
          cacheEnabled={false}
          overScrollMode="never"
          androidLayerType="hardware"
          style={{ flex: 1, backgroundColor: isDark ? '#0f172a' : '#f1f5f9' }}
        />
      ) : null}
      {loading ? (
        <View style={[styles.centered, StyleSheet.absoluteFill]} pointerEvents="none">
          <ActivityIndicator size="large" color="#4f46e5" />
        </View>
      ) : null}
    </View>
  )
}

// ---------------------------------------------------------------------------
// Public DocumentReader — dispatches by format
// ---------------------------------------------------------------------------

export function DocumentReader({
  source,
  format,
  cacheKey,
  refreshUrl,
}: {
  /** Signed, short-lived file URL from `books.getFileUrl`. */
  source: string
  format?: 'pdf' | 'epub'
  /** Stable cache identity, e.g. `book-12-epub`. */
  cacheKey?: string
  /** Fetches a fresh signed URL when the current one has expired. */
  refreshUrl?: () => Promise<string | null>
}) {
  const url = fixUrl(source)
  const kind = format ?? detectFormat(url)

  if (kind === 'epub') {
    return <EpubDocumentReader url={url} cacheKey={cacheKey ?? `epub-${url.split('?')[0]}`} refreshUrl={refreshUrl} />
  }
  return <PdfDocumentReader url={url} refreshUrl={refreshUrl} />
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  errorText: {
    color: '#ef4444',
    textAlign: 'center',
  },
  // Toolbar
  toolbar: {
    height: TOOLBAR_H,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  toolbarBtn: {
    padding: 6,
  },
  toolbarIcon: {
    fontSize: 22,
  },
  chapterTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 13,
    marginHorizontal: 8,
  },
  // Progress
  progressBar: {
    height: PROGRESS_H,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4f46e5',
  },
  // Loading overlay
  loadingOverlay: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  // ToC
  tocBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  tocPanel: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: Math.min(300, Dimensions.get('window').width * 0.82),
  },
  tocHeader: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tocTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  tocEmpty: {
    padding: 16,
    fontSize: 13,
    opacity: 0.6,
  },
  tocItem: {
    paddingVertical: 12,
    paddingRight: 12,
  },
  tocItemText: {
    fontSize: 13,
    lineHeight: 18,
  },
  // Settings
  settingsBackdrop: {
    flex: 1,
  },
  settingsSheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 10,
  },
  settingsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: 12,
  },
  settingsTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  settingsRow: {
    marginBottom: 16,
  },
  settingsLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    opacity: 0.7,
  },
  // Theme circles
  themeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  themeCircle: {
    width: 54,
    height: 40,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeCircleActive: {
    borderWidth: 2.5,
  },
  // Font chips
  fontList: {
    flexGrow: 0,
  },
  fontChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
    alignSelf: 'flex-start',
  },
  // Font size
  sizeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  sizeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sizeLbl: {
    fontSize: 15,
    fontWeight: '600',
    minWidth: 48,
    textAlign: 'center',
  },
  // Line spacing
  spacingRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  spacingChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
})
