import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Animated,
  AppState,
  Dimensions,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { useReducedMotion } from 'react-native-reanimated'
import { Reader, ReaderProvider, useReader } from '@epubjs-react-native/core'
import { useEpubFileSystem } from '@/lib/useEpubFileSystem'
import * as FileSystem from 'expo-file-system/legacy'
import { Asset } from 'expo-asset'
import { WebView } from 'react-native-webview'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { fixUrl } from '@/lib/url'
import { detectFormat } from '@/lib/format'
import { FONT_OPTIONS, useTypography } from '@/context/TypographyContext'
import { useI18n } from '@/context/I18nContext'
import { useAuth } from '@/context/AuthContext'
import { storage } from '@/services/storage'
import { buildFontFacesCss, buildRenditionFontHookScript } from '@/lib/readerUtils'
import { streamToViewer } from '@/lib/pdfStream'
import {
  DownloadCancelledError,
  HttpStatusError,
  documentCacheKey,
  removeCachedDocument,
  resolveDocument,
  type DocumentExt,
} from '@/lib/documentCache'
import {
  createReadingProgressReporter,
  epubCfiFrom,
  loadReadingPosition,
  pdfPageFrom,
  pdfPosition,
  type ReadingFormat,
  type ReadingPosition,
  type ReadingProgressReporter,
} from '@/lib/readingProgress'
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
  { key: 'compact', label: 'Compact', value: 1.2 },
  { key: 'normal', label: 'Normal', value: 1.5 },
  { key: 'comfortable', label: 'Comfortable', value: 1.8 },
  { key: 'wide', label: 'Wide', value: 2.1 },
]

const READER_SETTINGS_KEY = 'epub-reader-settings'
const TOOLBAR_H = 52
const PROGRESS_H = 3
/** Minimum touch target (Apple HIG / Material: 44pt / 48dp). */
const TOUCH = 44
/** A saved position must never hold the book back for longer than this. */
const RESTORE_TIMEOUT_MS = 2500
/** WebView content-process restarts tolerated before giving up with an error. */
const MAX_VIEWER_RESTARTS = 3

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
// i18n — `reader.*` keys, with English fallbacks until the locale files have them
// ---------------------------------------------------------------------------

type Translate = (key: string, fallback: string, params?: Record<string, string | number>) => string

function useReaderText(): Translate {
  const { t } = useI18n()
  return useCallback<Translate>(
    (key, fallback, params) => {
      const full = `reader.${key}`
      const value = t(full, params)
      if (value !== full) return value
      if (!params) return fallback
      return fallback.replace(/\{(\w+)\}/g, (_, name: string) => (name in params ? String(params[name]) : `{${name}}`))
    },
    [t],
  )
}

function openErrorMessage(err: unknown, tr: Translate): string {
  if (err instanceof HttpStatusError) {
    return tr('openFailedStatus', 'Could not open this book (HTTP {status})', { status: err.status })
  }
  if (err instanceof Error && err.message === 'Offline and not downloaded') {
    return tr('offlineUnavailable', 'You are offline and this book has not been downloaded yet.')
  }
  return err instanceof Error && err.message ? err.message : tr('openFailed', 'Could not open this book')
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
// Fonts — resolved in parallel once per app session and shared by every mount
// ---------------------------------------------------------------------------

let fontUrisCache: Record<string, string> | null = null
let fontUrisPromise: Promise<Record<string, string>> | null = null

function loadCustomFontUris(): Promise<Record<string, string>> {
  if (!fontUrisPromise) {
    fontUrisPromise = Promise.all(
      READER_CUSTOM_FONT_ASSETS.map(async (font): Promise<[string, string] | null> => {
        try {
          const asset = Asset.fromModule(font.module)
          await asset.downloadAsync()
          const uri = asset.localUri ?? asset.uri
          return uri ? [font.id, uri] : null
        } catch (err) {
          console.warn('[DocumentReader] font load error:', font.id, err)
          return null
        }
      }),
    ).then((entries) => {
      const found = entries.filter((e): e is [string, string] => e !== null)
      const map = Object.fromEntries(found)
      // Only memoise a complete set, so a transient failure is retried next time.
      if (found.length === READER_CUSTOM_FONT_ASSETS.length) fontUrisCache = map
      else fontUrisPromise = null
      return map
    })
  }
  return fontUrisPromise
}

function useCustomFontUris(): { uris: Record<string, string>; loading: boolean } {
  const [uris, setUris] = useState<Record<string, string> | null>(fontUrisCache)

  useEffect(() => {
    if (uris) return
    let cancelled = false
    void loadCustomFontUris().then((map) => {
      if (!cancelled) setUris(map)
    })
    return () => {
      cancelled = true
    }
  }, [uris])

  return { uris: uris ?? EMPTY_URIS, loading: uris === null }
}

const EMPTY_URIS: Record<string, string> = {}

// ---------------------------------------------------------------------------
// Document file — cached per book/format/version, downloaded with progress
// ---------------------------------------------------------------------------

interface FileState {
  request: string
  uri: string | null
  fromCache: boolean
  error: string | null
  /** 0-1 while downloading; null when unknown or not downloading. */
  progress: number | null
}

function useLatest<T>(value: T) {
  const ref = useRef(value)
  useEffect(() => {
    ref.current = value
  }, [value])
  return ref
}

function useDocumentFile({
  url,
  cacheKey,
  ext,
  version,
  refreshUrl,
}: {
  url: string | null
  cacheKey: string
  ext: DocumentExt
  version?: string | null
  refreshUrl?: () => Promise<string | null>
}): FileState & { retry: () => void } {
  const tr = useReaderText()
  const [attempt, setAttempt] = useState(0)
  const request = `${cacheKey}|${version ?? ''}|${attempt}`
  const [state, setState] = useState<FileState>({ request: '', uri: null, fromCache: false, error: null, progress: null })
  // The signed URL rotates on every access re-check; a new URL for the same
  // book must not restart the download, so it is read at start time only.
  const urlRef = useLatest(url)
  const refreshRef = useLatest(refreshUrl)
  const trRef = useLatest(tr)

  useEffect(() => {
    const controller = new AbortController()
    let lastPercent = -1
    resolveDocument({
      key: cacheKey,
      ext,
      url: urlRef.current,
      version: version ?? null,
      refreshUrl: () => refreshRef.current?.() ?? Promise.resolve(null),
      signal: controller.signal,
      onProgress: ({ written, total }) => {
        if (controller.signal.aborted || total <= 0) return
        const percent = Math.floor((written / total) * 100)
        if (percent === lastPercent) return
        lastPercent = percent
        setState({ request, uri: null, fromCache: false, error: null, progress: percent / 100 })
      },
    })
      .then((doc) => {
        if (!controller.signal.aborted) {
          setState({ request, uri: doc.uri, fromCache: doc.fromCache, error: null, progress: null })
        }
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted || err instanceof DownloadCancelledError) return
        setState({ request, uri: null, fromCache: false, error: openErrorMessage(err, trRef.current), progress: null })
      })
    return () => controller.abort()
  }, [request, cacheKey, ext, version, urlRef, refreshRef, trRef])

  const current: FileState =
    state.request === request ? state : { request, uri: null, fromCache: false, error: null, progress: null }
  const retry = useCallback(() => setAttempt((n) => n + 1), [])
  return { ...current, retry }
}

// ---------------------------------------------------------------------------
// Reading position — restore on open, throttled save while reading
// ---------------------------------------------------------------------------

function useSavedPosition(
  bookId: string | undefined,
  format: ReadingFormat,
): { ready: boolean; position: ReadingPosition | null } {
  const { isLoggedIn } = useAuth()
  // Read once at open: signing in mid-read must not jump the page.
  const loggedInRef = useLatest(isLoggedIn)
  const id = bookId ? `${bookId}:${format}` : ''
  const [state, setState] = useState<{ id: string; position: ReadingPosition | null } | null>(null)

  useEffect(() => {
    if (!bookId) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const timeout = new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), RESTORE_TIMEOUT_MS)
    })
    void Promise.race([loadReadingPosition(bookId, format, loggedInRef.current).catch(() => null), timeout]).then(
      (position) => {
        if (!cancelled) setState({ id, position })
      },
    )
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [bookId, format, id, loggedInRef])

  if (!bookId) return { ready: true, position: null }
  return state?.id === id ? { ready: true, position: state.position } : { ready: false, position: null }
}

function useProgressReporter(
  bookId: string | undefined,
  format: ReadingFormat,
): (location: string, progress: number) => void {
  const { isLoggedIn } = useAuth()
  const loggedInRef = useLatest(isLoggedIn)
  const reporterRef = useRef<ReadingProgressReporter | null>(null)

  useEffect(() => {
    if (!bookId) return
    const reporter = createReadingProgressReporter({ bookId, format, isLoggedIn: () => loggedInRef.current })
    reporterRef.current = reporter
    const subscription = AppState.addEventListener('change', (next) => {
      if (next !== 'active') void reporter.flush()
    })
    return () => {
      subscription.remove()
      void reporter.flush()
      reporter.dispose()
      if (reporterRef.current === reporter) reporterRef.current = null
    }
  }, [bookId, format, loggedInRef])

  return useCallback((location: string, progress: number) => {
    reporterRef.current?.report(location, progress)
  }, [])
}

// ---------------------------------------------------------------------------
// Settings persistence
// ---------------------------------------------------------------------------

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
// Shared loading / download progress / error views
// ---------------------------------------------------------------------------

function DownloadProgressView({ progress, tr }: { progress: number | null; tr: Translate }) {
  const percent = progress == null ? null : Math.max(0, Math.min(100, Math.round(progress * 100)))
  const label =
    percent == null
      ? tr('preparing', 'Opening book…')
      : tr('downloading', 'Downloading… {percent}%', { percent })
  return (
    <View
      style={styles.centered}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={percent == null ? undefined : { min: 0, max: 100, now: percent }}
      accessibilityLiveRegion="polite"
    >
      <ActivityIndicator size="large" color="#4f46e5" />
      <Text style={styles.progressLabel}>{label}</Text>
      {percent != null ? (
        <View style={styles.downloadTrack}>
          <View style={[styles.downloadFill, { width: `${percent}%` }]} />
        </View>
      ) : null}
    </View>
  )
}

function ErrorView({ message, onRetry, tr }: { message: string; onRetry?: () => void; tr: Translate }) {
  return (
    <View style={styles.centered}>
      <Text style={styles.errorText} accessibilityRole="alert">
        {message}
      </Text>
      {onRetry ? (
        <TouchableOpacity
          onPress={onRetry}
          style={styles.retryBtn}
          accessibilityRole="button"
          accessibilityLabel={tr('retry', 'Try again')}
        >
          <Text style={styles.retryText}>{tr('retry', 'Try again')}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  )
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
  currentHref,
}: {
  visible: boolean
  toc: TocItem[]
  onClose: () => void
  onNavigate: (href: string) => void
  themeId: ThemeId
  currentHref?: string
}) {
  const { bg, fg } = READER_THEMES[themeId]
  const { bodyTextStyle, headerTextStyle } = useTypography()
  const tr = useReaderText()
  const insets = useSafeAreaInsets()
  const reduceMotion = useReducedMotion()
  const items = useMemo(() => flattenToc(toc), [toc])
  const [slideAnim] = useState(() => new Animated.Value(-300))

  useEffect(() => {
    const toValue = visible ? 0 : -300
    if (reduceMotion) {
      slideAnim.setValue(toValue)
      return
    }
    Animated.timing(slideAnim, {
      toValue,
      duration: 220,
      useNativeDriver: true,
    }).start()
  }, [visible, slideAnim, reduceMotion])

  const closeLabel = tr('closeContents', 'Close contents')

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <Pressable
        style={styles.tocBackdrop}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={closeLabel}
      />
      <Animated.View
        accessibilityViewIsModal
        style={[
          styles.tocPanel,
          { backgroundColor: bg, transform: [{ translateX: slideAnim }] },
        ]}
      >
        {/* Spacer pushes panel content below the notch / Dynamic Island */}
        <View style={{ height: insets.top }} />
        <View style={[styles.tocHeader, { borderBottomColor: fg + '22' }]}>
          <Text style={[styles.tocTitle, headerTextStyle, { color: fg }]} accessibilityRole="header">
            {tr('contents', 'Contents')}
          </Text>
          <TouchableOpacity
            onPress={onClose}
            style={styles.iconBtn}
            accessibilityRole="button"
            accessibilityLabel={closeLabel}
          >
            <Text style={{ color: fg, fontSize: 18 }} importantForAccessibility="no">✕</Text>
          </TouchableOpacity>
        </View>
        {items.length === 0 ? (
          <Text style={[styles.tocEmpty, bodyTextStyle, { color: fg }]}>
            {tr('noChapters', 'No chapters found')}
          </Text>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(item, i) => `${item.href}-${i}`}
            contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
            renderItem={({ item }) => {
              const label = item.label || item.href || tr('untitled', 'Untitled')
              const selected = Boolean(currentHref) && item.href.split('#')[0] === currentHref
              return (
                <TouchableOpacity
                  onPress={() => { onNavigate(item.href); onClose() }}
                  style={[styles.tocItem, { paddingLeft: 12 + item.depth * 16 }]}
                  accessibilityRole="button"
                  accessibilityLabel={label}
                  accessibilityState={{ selected }}
                >
                  <Text
                    style={[
                      styles.tocItemText,
                      bodyTextStyle,
                      { color: fg, paddingTop: 1 },
                      selected && styles.tocItemTextActive,
                    ]}
                    numberOfLines={2}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              )
            }}
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
  const tr = useReaderText()
  const reduceMotion = useReducedMotion()

  const availableFonts = useMemo(
    () =>
      FONT_OPTIONS.filter((opt) => {
        if (opt.id === 'system' || opt.id === 'serif') return true
        return Boolean(customFontUris[opt.id])
      }),
    [customFontUris],
  )

  const currentSizeIndex = FONT_SIZE_OPTIONS.indexOf(settings.fontSize)
  const baseSizeIndex = currentSizeIndex < 0 ? 2 : currentSizeIndex
  const canShrink = baseSizeIndex > 0
  const canGrow = baseSizeIndex < FONT_SIZE_OPTIONS.length - 1
  const closeLabel = tr('closeSettings', 'Close reader settings')

  return (
    <Modal
      visible={visible}
      transparent
      animationType={reduceMotion ? 'none' : 'slide'}
      onRequestClose={onClose}
    >
      <Pressable
        style={styles.settingsBackdrop}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={closeLabel}
      />
      <View
        accessibilityViewIsModal
        style={[styles.settingsSheet, { backgroundColor: bg, paddingBottom: Math.max(32, insets.bottom + 16) }]}
      >
        {/* Header */}
        <View style={[styles.settingsHeader, { borderBottomColor: fg + '22' }]}>
          <Text style={[styles.settingsTitle, { color: fg }]} accessibilityRole="header">
            {tr('settingsTitle', 'Reader Settings')}
          </Text>
          <TouchableOpacity
            onPress={onClose}
            style={styles.iconBtn}
            accessibilityRole="button"
            accessibilityLabel={closeLabel}
          >
            <Text style={{ color: fg, fontSize: 18 }} importantForAccessibility="no">✕</Text>
          </TouchableOpacity>
        </View>

        {/* Theme */}
        <View style={styles.settingsRow}>
          <Text style={[styles.settingsLabel, { color: fg }]}>{tr('theme', 'Theme')}</Text>
          <View style={styles.themeRow} accessibilityRole="radiogroup">
            {(Object.entries(READER_THEMES) as [ThemeId, (typeof READER_THEMES)[ThemeId]][]).map(
              ([id, theme]) => {
                const selected = settings.themeId === id
                const label = tr(`themes.${id}`, theme.label)
                return (
                  <TouchableOpacity
                    key={id}
                    onPress={() => onUpdate({ themeId: id })}
                    accessibilityRole="radio"
                    accessibilityLabel={label}
                    accessibilityState={{ selected, checked: selected }}
                    style={[
                      styles.themeCircle,
                      { backgroundColor: theme.bg, borderColor: selected ? '#4f46e5' : theme.fg + '44' },
                      selected && styles.themeCircleActive,
                    ]}
                  >
                    <Text style={{ color: theme.fg, fontSize: 10, fontWeight: '600' }}>{label}</Text>
                  </TouchableOpacity>
                )
              },
            )}
          </View>
        </View>

        {/* Font */}
        <View style={styles.settingsRow}>
          <Text style={[styles.settingsLabel, { color: fg }]}>{tr('font', 'Font')}</Text>
          <FlatList
            horizontal
            data={availableFonts}
            keyExtractor={(item) => item.id}
            showsHorizontalScrollIndicator={false}
            style={styles.fontList}
            accessibilityRole="radiogroup"
            renderItem={({ item }) => {
              const selected = settings.fontId === item.id
              return (
                <TouchableOpacity
                  onPress={() => onUpdate({ fontId: item.id })}
                  accessibilityRole="radio"
                  accessibilityLabel={item.label}
                  accessibilityState={{ selected, checked: selected }}
                  style={[
                    styles.fontChip,
                    {
                      backgroundColor: selected ? '#4f46e5' : fg + '11',
                      borderColor: selected ? '#4f46e5' : fg + '33',
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: selected ? '#fff' : fg,
                      fontSize: 12,
                      fontFamily: item.family,
                    }}
                    numberOfLines={1}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              )
            }}
          />
        </View>

        {/* Font size */}
        <View style={styles.settingsRow}>
          <Text style={[styles.settingsLabel, { color: fg }]}>{tr('fontSize', 'Font Size')}</Text>
          <View style={styles.sizeRow}>
            <TouchableOpacity
              onPress={() => onUpdate({ fontSize: FONT_SIZE_OPTIONS[Math.max(0, baseSizeIndex - 1)] })}
              disabled={!canShrink}
              accessibilityRole="button"
              accessibilityLabel={tr('decreaseFontSize', 'Decrease font size')}
              accessibilityState={{ disabled: !canShrink }}
              style={[styles.sizeBtn, { borderColor: fg + '44', opacity: canShrink ? 1 : 0.4 }]}
            >
              <Text style={{ color: fg, fontSize: 18 }} importantForAccessibility="no">−</Text>
            </TouchableOpacity>
            <Text
              style={[styles.sizeLbl, { color: fg }]}
              accessibilityLabel={tr('fontSizeValue', 'Font size {size} percent', { size: settings.fontSize })}
            >
              {settings.fontSize}%
            </Text>
            <TouchableOpacity
              onPress={() =>
                onUpdate({ fontSize: FONT_SIZE_OPTIONS[Math.min(FONT_SIZE_OPTIONS.length - 1, baseSizeIndex + 1)] })
              }
              disabled={!canGrow}
              accessibilityRole="button"
              accessibilityLabel={tr('increaseFontSize', 'Increase font size')}
              accessibilityState={{ disabled: !canGrow }}
              style={[styles.sizeBtn, { borderColor: fg + '44', opacity: canGrow ? 1 : 0.4 }]}
            >
              <Text style={{ color: fg, fontSize: 18 }} importantForAccessibility="no">+</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Line spacing */}
        <View style={[styles.settingsRow, { marginBottom: 0 }]}>
          <Text style={[styles.settingsLabel, { color: fg }]}>{tr('lineSpacing', 'Line Spacing')}</Text>
          <View style={styles.spacingRow} accessibilityRole="radiogroup">
            {LINE_SPACING_OPTIONS.map((opt) => {
              const selected = settings.lineSpacing === opt.value
              const label = tr(`spacing.${opt.key}`, opt.label)
              return (
                <TouchableOpacity
                  key={opt.value}
                  onPress={() => onUpdate({ lineSpacing: opt.value })}
                  accessibilityRole="radio"
                  accessibilityLabel={label}
                  accessibilityState={{ selected, checked: selected }}
                  style={[
                    styles.spacingChip,
                    {
                      backgroundColor: selected ? '#4f46e5' : fg + '11',
                      borderColor: selected ? '#4f46e5' : fg + '33',
                    },
                  ]}
                >
                  <Text style={{ color: selected ? '#fff' : fg, fontSize: 12 }}>{label}</Text>
                </TouchableOpacity>
              )
            })}
          </View>
        </View>
      </View>
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// Inner EPUB reader view — must be inside ReaderProvider to use useReader
// ---------------------------------------------------------------------------

/** The subset of epub.js's `Location` this view reads. */
interface EpubLocation {
  start?: { cfi?: string; href?: string }
}

function EpubReaderView({
  localUri,
  fontHookScript,
  customFontUris,
  initialFontId,
  initialLocation,
  initialPercent,
  settings,
  onSettingsUpdate,
  onPosition,
}: {
  localUri: string
  fontHookScript: string
  customFontUris: Record<string, string>
  initialFontId: string
  initialLocation?: string
  initialPercent?: number
  settings: ReaderSettings
  onSettingsUpdate: (patch: Partial<ReaderSettings>) => void
  onPosition: (cfi: string, percent: number) => void
}) {
  const {
    goToLocation,
    toc,
    section,
    isLoading,
    changeFontSize,
    changeTheme,
    injectJavascript,
  } = useReader()
  const tr = useReaderText()

  const [showToC, setShowToC] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  /** 0-100, from the reader's own location events (the context value mixes 0-1 and 0-100 scales). */
  const [percent, setPercent] = useState(initialPercent ?? 0)
  const lastPercentRef = useRef(initialPercent ?? 0)
  const locationsReadyRef = useRef(false)
  const [currentHref, setCurrentHref] = useState<string | undefined>(undefined)
  const settingsRef = useLatest(settings)
  /** Location events before `onReady` are the pre-restore first page: never saved. */
  const readyRef = useRef(false)

  // Use onLayout to get the exact available dimensions for the Reader container.
  // Dimensions.get('window') does NOT subtract the navigation header height,
  // so using it directly causes epub.js to format pages that overflow the visible
  // area — leaving content cut off at the bottom of every page.
  const [readerLayout, setReaderLayout] = useState({ width: 0, height: 0 })

  // Stable initial theme — captured ONCE at mount so Reader's useEffect dep never
  // changes between renders, preventing the "Maximum update depth exceeded" loop.
  // Settings are guaranteed loaded by the parent before this component mounts.
  const [initialEpubTheme] = useState(() => buildEpubTheme(settings.themeId))

  // Apply all reader settings after the book is ready
  const handleReady = useCallback(() => {
    readyRef.current = true
    const s = settingsRef.current
    changeTheme(buildEpubTheme(s.themeId))
    changeFontSize(`${s.fontSize}%`)
    applyFont(injectJavascript, s.fontId !== 'system' ? s.fontId : initialFontId)
    const lsEscaped = String(s.lineSpacing).replace(/'/g, "\\'")
    injectJavascript(
      `try{rendition.themes.override('line-height','${lsEscaped}');}catch(e){}true;`,
    )
  }, [changeTheme, changeFontSize, injectJavascript, initialFontId, settingsRef])

  const handleLocationChange = useCallback(
    (_total: number, location: EpubLocation, progress: number) => {
      const href = location?.start?.href
      if (href) setCurrentHref(href.split('#')[0])
      let pct = Number.isFinite(progress) ? Math.max(0, Math.min(100, progress)) : 0
      if (!locationsReadyRef.current && pct === 0) pct = lastPercentRef.current
      lastPercentRef.current = pct
      setPercent(pct)
      if (!readyRef.current) return
      const cfi = location?.start?.cfi
      if (cfi) onPosition(cfi, pct)
    },
    [onPosition],
  )

  // epub.js generates "locations" in the background after opening; until then
  // every position reports 0%. Keep the last known percentage meanwhile rather
  // than overwrite the stored one with 0.
  const handleLocationsReady = useCallback(() => {
    locationsReadyRef.current = true
  }, [])

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
  const roundedPercent = Math.round(percent)

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      {/* Toolbar */}
      <View style={[styles.toolbar, { backgroundColor: bg, borderBottomColor: fg + '22' }]}>
        <TouchableOpacity
          onPress={() => setShowToC(true)}
          style={styles.iconBtn}
          accessibilityRole="button"
          accessibilityLabel={tr('openContents', 'Table of contents')}
        >
          <Text style={[styles.toolbarIcon, { color: fg }]} importantForAccessibility="no">☰</Text>
        </TouchableOpacity>
        <Text style={[styles.chapterTitle, { color: fg }]} numberOfLines={1} accessibilityRole="header">
          {section?.label ?? ''}
        </Text>
        <TouchableOpacity
          onPress={() => setShowSettings(true)}
          style={styles.iconBtn}
          accessibilityRole="button"
          accessibilityLabel={tr('openSettings', 'Reader settings')}
        >
          <Text style={[styles.toolbarIcon, { color: fg }]} importantForAccessibility="no">⚙</Text>
        </TouchableOpacity>
      </View>

      {/* Progress bar */}
      <View
        style={[styles.progressBar, { backgroundColor: fg + '22' }]}
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={tr('bookProgress', '{percent}% read', { percent: roundedPercent })}
        accessibilityValue={{ min: 0, max: 100, now: roundedPercent }}
      >
        <View style={[styles.progressFill, { width: `${percent}%` }]} />
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
            initialLocation={initialLocation}
            onReady={handleReady}
            onLocationChange={handleLocationChange}
            onLocationsReady={handleLocationsReady}
          />
        )}

        {/* Loading overlay — shown while epub.js initialises or container isn't measured yet */}
        {(isLoading || readerLayout.height === 0) && (
          <View
            style={[StyleSheet.absoluteFill, styles.loadingOverlay]}
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel={tr('preparing', 'Opening book…')}
          >
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
        currentHref={currentHref}
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

interface DocumentProps {
  url: string | null
  cacheKey: string
  bookId?: string
  version?: string | null
  refreshUrl?: () => Promise<string | null>
}

function EpubDocumentReader({ url, cacheKey, bookId, version, refreshUrl }: DocumentProps) {
  const { bodyFontFamily } = useTypography()
  const tr = useReaderText()
  const { uris: customFontUris, loading: fontLoading } = useCustomFontUris()
  const file = useDocumentFile({ url, cacheKey, ext: 'epub', version, refreshUrl })
  const saved = useSavedPosition(bookId, 'epub')
  const report = useProgressReporter(bookId, 'epub')
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

  const initialCfi = epubCfiFrom(saved.position) ?? undefined

  if (file.error) {
    return <ErrorView message={file.error} onRetry={file.retry} tr={tr} />
  }

  if (!file.uri) {
    return <DownloadProgressView progress={file.progress} tr={tr} />
  }

  if (fontLoading || !settingsLoaded || !saved.ready) {
    return <DownloadProgressView progress={null} tr={tr} />
  }

  return (
    <ReaderProvider>
      <EpubReaderView
        localUri={file.uri}
        fontHookScript={fontHookScript}
        customFontUris={customFontUris}
        initialFontId={initialFontId}
        initialLocation={initialCfi}
        initialPercent={initialCfi ? saved.position?.progress : undefined}
        settings={settings}
        onSettingsUpdate={update}
        onPosition={report}
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
 * canvas inside the app: no text layer to select or copy, no toolbar, and no
 * URL to download or share. The file itself stays in the app-private document
 * cache (`documentCache.ts`) so reopening the book — or a WebView reload after
 * the system reclaimed its memory — does not download it again.
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

/** Streams a local PDF into the viewer in aligned base64 slices. */
async function streamPdfFile(
  localUri: string,
  inject: (code: string) => void,
  signal: AbortSignal,
  startPage: number,
): Promise<boolean> {
  const info = await FileSystem.getInfoAsync(localUri)
  const size = info.exists ? (info.size ?? 0) : 0
  return streamToViewer({
    size,
    startPage,
    inject,
    signal,
    readSlice: (position, length) =>
      FileSystem.readAsStringAsync(localUri, {
        encoding: FileSystem.EncodingType.Base64,
        position,
        length,
      }),
  })
}

interface ViewerStatus {
  /** `${localUri}#${webKey}` the status belongs to. */
  doc: string
  loaded: boolean
  error: string | null
}

function PdfDocumentReader({ url, cacheKey, bookId, version, refreshUrl }: DocumentProps) {
  const { isDark } = useTheme()
  const tr = useReaderText()
  const { uri: viewerUri, error: viewerError } = usePdfViewerAsset()
  const file = useDocumentFile({ url, cacheKey, ext: 'pdf', version, refreshUrl })
  const saved = useSavedPosition(bookId, 'pdf')
  const report = useProgressReporter(bookId, 'pdf')
  const webRef = useRef<WebView>(null)
  /** Remount counter: bumped when the WebView's content process dies. */
  const [webKey, setWebKey] = useState(0)
  /** Bumped on every `ready` from the page (first load, reload), per WebView instance. */
  const [ready, setReady] = useState({ webKey: -1, count: 0 })
  const [status, setStatus] = useState<ViewerStatus>({ doc: '', loaded: false, error: null })
  const restartsRef = useRef(0)
  /** Last page the reader was on; a restarted viewer reopens there. */
  const pageRef = useRef<number | null>(null)

  const localUri = file.uri
  const docId = `${localUri ?? ''}#${webKey}`
  const current = status.doc === docId ? status : null
  const savedPage = pdfPageFrom(saved.position)
  const fromCacheRef = useLatest(file.fromCache)
  const trRef = useLatest(tr)
  const readyCount = ready.webKey === webKey ? ready.count : 0

  // Push the file into the viewer once all three are in place: this WebView
  // has said it is ready, the file is on disk, and the saved position is known.
  // Streaming reads from disk, so a reload never downloads the book again.
  useEffect(() => {
    if (!readyCount || !localUri || !saved.ready) return
    const controller = new AbortController()
    const startPage = pageRef.current ?? savedPage ?? 1
    const doc = `${localUri}#${webKey}`
    streamPdfFile(localUri, (code) => webRef.current?.injectJavaScript(code), controller.signal, startPage).catch(
      (err: unknown) => {
        if (controller.signal.aborted) return
        setStatus({ doc, loaded: false, error: openErrorMessage(err, trRef.current) })
      },
    )
    return () => controller.abort()
  }, [readyCount, localUri, saved.ready, savedPage, webKey, trRef])

  const onMessage = useCallback(
    (event: { nativeEvent: { data: string } }) => {
      let message: { type?: string; message?: string; page?: number; pages?: number }
      try {
        message = JSON.parse(event.nativeEvent.data)
      } catch {
        return
      }

      if (message.type === 'ready') {
        // The page is empty and waiting — also true after the system reloads a
        // backgrounded WebView — so stream (from disk) again every time.
        setReady((r) => ({ webKey, count: r.webKey === webKey ? r.count + 1 : 1 }))
      } else if (message.type === 'loaded') {
        restartsRef.current = 0
        setStatus({ doc: docId, loaded: true, error: null })
      } else if (message.type === 'page') {
        const page = Number(message.page)
        const position = pdfPosition(page, Number(message.pages))
        if (!position) return
        pageRef.current = page
        report(position.location, position.progress)
      } else if (message.type === 'error') {
        // A corrupt cached copy must not keep failing: drop it so a retry downloads afresh.
        if (fromCacheRef.current) void removeCachedDocument(cacheKey)
        setStatus({ doc: docId, loaded: false, error: message.message ?? tr('fileUnreadable', 'This file could not be opened') })
      }
    },
    [docId, webKey, report, cacheKey, fromCacheRef, tr],
  )

  // The WebView's content process was killed (usually memory pressure with a
  // large PDF): without this the screen stays blank. Remount and reopen at the
  // same page; give up after a few attempts rather than loop.
  const onProcessGone = useCallback(() => {
    restartsRef.current += 1
    if (restartsRef.current > MAX_VIEWER_RESTARTS) {
      setStatus({ doc: docId, loaded: false, error: tr('viewerCrashed', 'This book is too large to display on this device.') })
      return
    }
    setWebKey((k) => k + 1)
  }, [docId, tr])

  const retryViewer = () => {
    restartsRef.current = 0
    file.retry()
    setWebKey((k) => k + 1)
  }

  const failure = file.error ?? current?.error ?? viewerError
  if (failure) {
    return <ErrorView message={failure} onRetry={viewerError ? undefined : retryViewer} tr={tr} />
  }

  const loaded = Boolean(localUri && current?.loaded)

  return (
    <View style={styles.container}>
      {viewerUri ? (
        <WebView
          key={webKey}
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
          onError={(e) => setStatus({ doc: docId, loaded: false, error: e.nativeEvent.description })}
          onRenderProcessGone={onProcessGone}
          onContentProcessDidTerminate={onProcessGone}
          accessibilityLabel={tr('pdfDocument', 'Book pages')}
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
      {!loaded ? (
        <View
          style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? '#0f172a' : '#f1f5f9' }]}
          pointerEvents="none"
        >
          <DownloadProgressView progress={localUri ? null : file.progress} tr={tr} />
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
  bookId,
  version,
  refreshUrl,
}: {
  /**
   * Signed, short-lived file URL from `books.getFileUrl`, or null to open the
   * copy already on the device (offline).
   */
  source: string | null
  format?: 'pdf' | 'epub'
  /** Stable cache identity, e.g. `book-12-epub`. */
  cacheKey?: string
  /** Enables saving / restoring the reading position. */
  bookId?: string
  /** The book's `updated_at` (or similar): a change invalidates the cached file. */
  version?: string | null
  /** Fetches a fresh signed URL when the current one has expired. */
  refreshUrl?: () => Promise<string | null>
}) {
  const url = source ? fixUrl(source) : null
  const kind: DocumentExt = format ?? (url ? (detectFormat(url) === 'epub' ? 'epub' : 'pdf') : 'pdf')
  const key =
    cacheKey ?? (bookId ? documentCacheKey(bookId, kind) : `${kind}-${(url ?? '').split('?')[0]}`)

  if (kind === 'epub') {
    return <EpubDocumentReader url={url} cacheKey={key} bookId={bookId} version={version} refreshUrl={refreshUrl} />
  }
  return <PdfDocumentReader url={url} cacheKey={key} bookId={bookId} version={version} refreshUrl={refreshUrl} />
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
  retryBtn: {
    marginTop: 16,
    minHeight: TOUCH,
    minWidth: TOUCH * 2,
    paddingHorizontal: 20,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#4f46e5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryText: {
    color: '#4f46e5',
    fontWeight: '600',
  },
  progressLabel: {
    marginTop: 12,
    color: '#64748b',
    fontSize: 13,
    textAlign: 'center',
  },
  downloadTrack: {
    marginTop: 10,
    width: 180,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#4f46e522',
    overflow: 'hidden',
  },
  downloadFill: {
    height: '100%',
    backgroundColor: '#4f46e5',
  },
  // Toolbar
  toolbar: {
    height: TOOLBAR_H,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconBtn: {
    minWidth: TOUCH,
    minHeight: TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
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
    paddingLeft: 14,
    paddingRight: 4,
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
    minHeight: TOUCH,
    justifyContent: 'center',
    paddingVertical: 12,
    paddingRight: 12,
  },
  tocItemText: {
    fontSize: 13,
    lineHeight: 18,
  },
  tocItemTextActive: {
    fontWeight: '700',
    color: '#4f46e5',
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
    paddingVertical: 4,
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
    width: 58,
    height: TOUCH,
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
    minHeight: TOUCH,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: 22,
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
    width: TOUCH,
    height: TOUCH,
    borderRadius: TOUCH / 2,
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
    minHeight: TOUCH,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: 22,
    borderWidth: 1,
  },
})
