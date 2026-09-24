import { useState } from 'react'
import { ScrollView, View, Text, Pressable, type StyleProp, type TextStyle } from 'react-native'
import { Stack, router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { Screen } from '@/components/Screen'
import { useTheme, type ThemePref } from '@/context/ThemeContext'
import { useI18n } from '@/context/I18nContext'
import { useAuth } from '@/context/AuthContext'
import { AccountSettings } from '@/components/AccountSettings'
import {
  FONT_OPTIONS,
  MON_SAFE_FONT_IDS,
  getFontFamily,
  resolveFontIdForLocale,
  useTypography,
} from '@/context/TypographyContext'
import type { Locale } from '@/i18n'
import { useThemeColors } from '@/theme/colors'

function Row({
  label,
  options,
  value,
  onChange,
  labelStyle,
  textStyle,
  compact = false,
  previewFonts = false,
}: {
  label: string
  options: { id: string; label: string }[]
  value: string
  onChange: (id: string) => void
  labelStyle?: StyleProp<TextStyle>
  textStyle?: StyleProp<TextStyle>
  compact?: boolean
  previewFonts?: boolean
}) {
  return (
    <View className="mb-5">
      <Text
        className="mb-2 px-1 text-xs uppercase tracking-wider text-surface-500 dark:text-surface-400"
        style={labelStyle}
      >
        {label}
      </Text>

      <View
        accessibilityRole={compact ? 'radiogroup' : 'tablist'}
        accessibilityLabel={label}
        className={
          compact
            ? 'flex-row flex-wrap gap-2'
            : 'flex-row rounded-2xl border border-surface-200 bg-surface-100 p-1.5 dark:border-surface-700 dark:bg-surface-800'
        }
      >
        {options.map((opt) => (
          <Pressable
            key={opt.id}
            onPress={() => onChange(opt.id)}
            accessibilityRole={compact ? 'radio' : 'tab'}
            accessibilityLabel={opt.label}
            accessibilityState={compact ? { checked: value === opt.id } : { selected: value === opt.id }}
            className={
              compact
                ? `min-h-touch justify-center rounded-control border px-3 ${
                    value === opt.id
                      ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/30'
                      : 'border-surface-300 bg-surface-100 dark:border-surface-700 dark:bg-surface-800'
                  }`
                : `min-h-touch flex-1 flex-row items-center justify-center rounded-control px-1 ${
                    value === opt.id ? 'bg-white dark:bg-surface-700' : ''
                  }`
            }
          >
            <Text
              style={previewFonts ? [textStyle, { fontFamily: getFontFamily(opt.id) }] : textStyle}
              className={`text-center text-sm font-semibold ${
                value === opt.id
                  ? 'text-surface-900 dark:text-surface-50'
                  : 'text-surface-500 dark:text-surface-400'
              }`}
            >
              {opt.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  )
}

function SectionCard({
  icon,
  title,
  titleStyle,
  children,
}: {
  icon: keyof typeof Ionicons.glyphMap
  title: string
  titleStyle?: StyleProp<TextStyle>
  children: React.ReactNode
}) {
  const colors = useThemeColors()
  return (
    <View className="mb-4 rounded-3xl border border-surface-200 bg-white p-4 dark:border-surface-700 dark:bg-surface-800">
      <View className="mb-3 flex-row items-center gap-3">
        <View className="h-9 w-9 items-center justify-center rounded-xl bg-brand-50 dark:bg-brand-900/30">
          <Ionicons name={icon} size={18} color={colors.brand} />
        </View>
        <Text className="text-base text-surface-900 dark:text-surface-50" style={titleStyle} accessibilityRole="header">
          {title}
        </Text>
      </View>
      {children}
    </View>
  )
}

export default function SettingsScreen() {
  const { pref, setPref } = useTheme()
  const { t, locale, setLocale, locales } = useI18n()
  const { isLoggedIn } = useAuth()
  const { bodyFont, headerFont, bodyTextStyle, headerTextStyle, setBodyFont, setHeaderFont } = useTypography()
  const colors = useThemeColors()

  const typographyFonts =
    locale === 'mon' ? FONT_OPTIONS.filter((font) => MON_SAFE_FONT_IDS.has(font.id)) : FONT_OPTIONS

  const displayedBodyFont = resolveFontIdForLocale(bodyFont, locale)
  const displayedHeaderFont = resolveFontIdForLocale(headerFont, locale)
  const [isBodyFontOpen, setIsBodyFontOpen] = useState(false)
  const [isHeadingFontOpen, setIsHeadingFontOpen] = useState(false)

  // Settings chrome uses the body font; the preview shows the heading font.
  const titleStyle = bodyTextStyle
  const bodyStyle = bodyTextStyle
  const headerPreviewStyle = headerTextStyle

  const localeLabel = locales.find((l) => l.id === locale)?.label ?? locale
  const themeLabel =
    pref === 'light' ? t('settings.light') : pref === 'dark' ? t('settings.dark') : t('settings.system')
  const selectedBodyFontLabel = typographyFonts.find((font) => font.id === displayedBodyFont)?.label ?? displayedBodyFont
  const selectedHeadingFontLabel = typographyFonts.find((font) => font.id === displayedHeaderFont)?.label ?? displayedHeaderFont

  return (
    <Screen edges={[]}>
      <Stack.Screen options={{ title: t('nav.settings') }} />

      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 32 }}
      >
        <View className="mb-4 rounded-3xl bg-brand-600 px-5 py-5">
          <View className="flex-row items-start justify-between">
            <View className="flex-1 pr-4">
              <Text className="text-lg text-white" style={titleStyle} accessibilityRole="header">
                {t('nav.settings')}
              </Text>
              <Text className="mt-1 text-xs text-brand-100" style={bodyStyle}>
                {t('settings.appearance')} · {t('settings.typography')}
              </Text>
            </View>
            <View className="h-11 w-11 items-center justify-center rounded-2xl bg-white/20" importantForAccessibility="no-hide-descendants">
              <Ionicons name="sparkles-outline" size={20} color={colors.onBrand} />
            </View>
          </View>

          <View className="mt-4 flex-row gap-2">
            <View className="flex-1 rounded-control bg-white/15 px-3 py-2">
              <Text className="text-2xs text-white/80" style={bodyStyle}>{t('settings.theme')}</Text>
              <Text className="mt-0.5 text-sm font-semibold text-white" style={bodyStyle}>{themeLabel}</Text>
            </View>
            <View className="flex-1 rounded-control bg-white/15 px-3 py-2">
              <Text className="text-2xs text-white/80" style={bodyStyle}>{t('settings.language')}</Text>
              <Text className="mt-0.5 text-sm font-semibold text-white" style={bodyStyle}>{localeLabel}</Text>
            </View>
          </View>
        </View>

        <SectionCard icon="color-palette-outline" title={t('settings.appearance')} titleStyle={titleStyle}>
          <Row
            label={t('settings.theme')}
            labelStyle={bodyStyle}
            textStyle={bodyStyle}
            value={pref}
            onChange={(id) => setPref(id as ThemePref)}
            options={[
              { id: 'light', label: t('settings.light') },
              { id: 'dark', label: t('settings.dark') },
              { id: 'system', label: t('settings.system') },
            ]}
          />

          <Row
            label={t('settings.language')}
            labelStyle={bodyStyle}
            textStyle={bodyStyle}
            value={locale}
            onChange={(id) => setLocale(id as Locale)}
            options={locales.map((l) => ({ id: l.id, label: l.label }))}
          />
        </SectionCard>

        <SectionCard icon="text-outline" title={t('settings.typography')} titleStyle={titleStyle}>

          <View className="mb-5">
            <Text
              className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-surface-500 dark:text-surface-400"
              style={bodyStyle}
            >
              {t('settings.headingFont')}
            </Text>
            <Pressable
              onPress={() => {
                setIsHeadingFontOpen((prev) => !prev)
                if (!isHeadingFontOpen) setIsBodyFontOpen(false)
              }}
              accessibilityRole="button"
              accessibilityLabel={`${t('settings.headingFont')}: ${selectedHeadingFontLabel}`}
              accessibilityState={{ expanded: isHeadingFontOpen }}
              className="min-h-touch flex-row items-center justify-between rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3 dark:border-surface-700 dark:bg-surface-900/40"
            >
              <Text style={[bodyStyle, { fontFamily: getFontFamily(displayedHeaderFont) }]} className="text-sm text-surface-900 dark:text-surface-50">
                {selectedHeadingFontLabel}
              </Text>
              <Ionicons name={isHeadingFontOpen ? 'chevron-up' : 'chevron-down'} size={16} color={colors.mutedText} />
            </Pressable>

            {isHeadingFontOpen ? (
              <View className="mt-2 overflow-hidden rounded-2xl border border-surface-200 bg-white dark:border-surface-700 dark:bg-surface-800">
                {typographyFonts.map((font, index) => (
                  <Pressable
                    key={font.id}
                    onPress={() => {
                      setHeaderFont(font.id)
                      setIsHeadingFontOpen(false)
                    }}
                    accessibilityRole="radio"
                    accessibilityLabel={font.label}
                    accessibilityState={{ checked: displayedHeaderFont === font.id }}
                    className={`min-h-touch flex-row items-center justify-between px-4 py-3 ${index > 0 ? 'border-t border-surface-100 dark:border-surface-700' : ''}`}
                  >
                    <Text style={[bodyStyle, { fontFamily: getFontFamily(font.id) }]} className="text-sm text-surface-900 dark:text-surface-50">
                      {font.label}
                    </Text>
                    {displayedHeaderFont === font.id ? <Ionicons name="checkmark" size={16} color={colors.brand} /> : null}
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>
          
          <View className="mb-5">
            <Text
              className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-surface-500 dark:text-surface-400"
              style={bodyStyle}
            >
              {t('settings.bodyFont')}
            </Text>
            <Pressable
              onPress={() => {
                setIsBodyFontOpen((prev) => !prev)
                if (!isBodyFontOpen) setIsHeadingFontOpen(false)
              }}
              accessibilityRole="button"
              accessibilityLabel={`${t('settings.bodyFont')}: ${selectedBodyFontLabel}`}
              accessibilityState={{ expanded: isBodyFontOpen }}
              className="min-h-touch flex-row items-center justify-between rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3 dark:border-surface-700 dark:bg-surface-900/40"
            >
              <Text style={[bodyStyle, { fontFamily: getFontFamily(displayedBodyFont) }]} className="text-sm text-surface-900 dark:text-surface-50">
                {selectedBodyFontLabel}
              </Text>
              <Ionicons name={isBodyFontOpen ? 'chevron-up' : 'chevron-down'} size={16} color={colors.mutedText} />
            </Pressable>

            {isBodyFontOpen ? (
              <View className="mt-2 overflow-hidden rounded-2xl border border-surface-200 bg-white dark:border-surface-700 dark:bg-surface-800">
                {typographyFonts.map((font, index) => (
                  <Pressable
                    key={font.id}
                    onPress={() => {
                      setBodyFont(font.id)
                      setIsBodyFontOpen(false)
                    }}
                    accessibilityRole="radio"
                    accessibilityLabel={font.label}
                    accessibilityState={{ checked: displayedBodyFont === font.id }}
                    className={`min-h-touch flex-row items-center justify-between px-4 py-3 ${index > 0 ? 'border-t border-surface-100 dark:border-surface-700' : ''}`}
                  >
                    <Text style={[bodyStyle, { fontFamily: getFontFamily(font.id) }]} className="text-sm text-surface-900 dark:text-surface-50">
                      {font.label}
                    </Text>
                    {displayedBodyFont === font.id ? <Ionicons name="checkmark" size={16} color={colors.brand} /> : null}
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>

          <View className="rounded-2xl border border-surface-200 bg-surface-50 p-4 dark:border-surface-700 dark:bg-surface-900/40">
            <View className="mb-2 flex-row items-center gap-2">
              <Ionicons name="eye-outline" size={14} color={colors.mutedText} />
              <Text
                className="text-xs uppercase tracking-wider text-surface-500 dark:text-surface-400"
                style={bodyStyle}
              >
                {t('settings.preview')}
              </Text>
            </View>
            <Text className="text-lg text-surface-900 dark:text-surface-50" style={headerPreviewStyle}>
              ဒုၚ်တၠုၚ်မုက်လိက် — Loikmon
            </Text>
            <Text className="mt-1 text-sm text-surface-600 dark:text-surface-300" style={bodyStyle}>
              လိက်ပတ်မန် ညံၚ်ဟွံဂွံကၠေံ၊ ညံၚ်ဂွံမံက်ဂတဝ် အကြာညးလောကမန်။
            </Text>
          </View>
        </SectionCard>

        <SectionCard icon="person-circle-outline" title={t('settings.account')} titleStyle={titleStyle}>
          {isLoggedIn ? (
            <AccountSettings textStyle={bodyStyle} />
          ) : (
            <Pressable
              onPress={() => router.push('/(auth)/login')}
              accessibilityRole="button"
              accessibilityLabel={t('auth.signIn')}
              className="flex-row items-center justify-between rounded-2xl border border-surface-200 bg-surface-50 p-4 dark:border-surface-700 dark:bg-surface-900/40"
            >
              <View className="flex-row items-center gap-3">
                <View className="h-9 w-9 items-center justify-center rounded-xl bg-brand-50 dark:bg-brand-900/30">
                  <Ionicons name="log-in-outline" size={16} color={colors.brand} />
                </View>
                <Text className="text-base font-semibold text-surface-900 dark:text-surface-50" style={bodyStyle}>
                  {t('auth.signIn')}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.mutedText} />
            </Pressable>
          )}
        </SectionCard>
      </ScrollView>
    </Screen>
  )
}
