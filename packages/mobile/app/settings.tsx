import { ScrollView, View, Text, Pressable } from 'react-native'
import { Stack, router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { Screen } from '@/components/Screen'
import { useTheme, type ThemePref } from '@/context/ThemeContext'
import { useI18n } from '@/context/I18nContext'
import { useAuth } from '@/context/AuthContext'
import {
  FONT_OPTIONS,
  MON_SAFE_FONT_IDS,
  getFontFamily,
  useTypography,
} from '@/context/TypographyContext'
import type { Locale } from '@/i18n'

function Row({
  label,
  options,
  value,
  onChange,
  compact = false,
  previewFonts = false,
}: {
  label: string
  options: { id: string; label: string }[]
  value: string
  onChange: (id: string) => void
  compact?: boolean
  previewFonts?: boolean
}) {
  return (
    <View className="mb-5">
      <Text className="mb-2 px-1 text-sm font-medium text-surface-500 dark:text-surface-400">
        {label}
      </Text>
      <View
        className={
          compact
            ? 'flex-row flex-wrap gap-2'
            : 'flex-row rounded-xl bg-surface-200 dark:bg-surface-800 p-1'
        }
      >
        {options.map((opt) => (
          <Pressable
            key={opt.id}
            onPress={() => onChange(opt.id)}
            className={
              compact
                ? `rounded-lg border px-3 py-2 ${
                    value === opt.id
                      ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/30'
                      : 'border-surface-300 bg-surface-200 dark:border-surface-700 dark:bg-surface-800'
                  }`
                : `flex-1 rounded-lg py-2 ${value === opt.id ? 'bg-white dark:bg-surface-700' : ''}`
            }
          >
            <Text
              style={previewFonts ? { fontFamily: getFontFamily(opt.id) } : undefined}
              className={`text-center text-sm font-medium ${
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

export default function SettingsScreen() {
  const { pref, setPref } = useTheme()
  const { t, locale, setLocale, locales } = useI18n()
  const { isLoggedIn, user, logout } = useAuth()
  const { bodyFont, headerFont, bodyFontFamily, headerFontFamily, setBodyFont, setHeaderFont } =
    useTypography()
  const typographyFonts = locale === 'mon'
    ? FONT_OPTIONS.filter((font) => MON_SAFE_FONT_IDS.has(font.id))
    : FONT_OPTIONS

  return (
    <Screen edges={[]}>
      <Stack.Screen options={{ title: t('nav.settings') }} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        {/* Appearance */}
        <Text className="mb-3 text-lg font-bold text-surface-900 dark:text-surface-50">
          {t('settings.appearance')}
        </Text>
        <Row
          label={t('settings.theme')}
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
          value={locale}
          onChange={(id) => setLocale(id as Locale)}
          options={locales.map((l) => ({ id: l.id, label: l.label }))}
        />

        <Text className="mb-3 mt-2 text-lg font-bold text-surface-900 dark:text-surface-50">
          {t('settings.typography')}
        </Text>
        <Row
          label={t('settings.bodyFont')}
          value={bodyFont}
          onChange={setBodyFont}
          options={typographyFonts}
          compact
          previewFonts
        />
        <Row
          label={t('settings.headingFont')}
          value={headerFont}
          onChange={setHeaderFont}
          options={typographyFonts}
          compact
          previewFonts
        />
        <View className="mb-5 rounded-xl bg-white dark:bg-surface-800 p-4">
          <Text className="mb-2 text-xs uppercase tracking-wider text-surface-500 dark:text-surface-400">
            {t('settings.preview')}
          </Text>
          <Text
            className="text-lg font-bold text-surface-900 dark:text-surface-50"
            style={headerFontFamily ? { fontFamily: headerFontFamily } : undefined}
          >
            ဒုၚ်တၠုၚ်မုက်လိက် — Loikmon
          </Text>
          <Text
            className="mt-1 text-sm text-surface-600 dark:text-surface-300"
            style={bodyFontFamily ? { fontFamily: bodyFontFamily } : undefined}
          >
            လိက်ပတ်မန် ညံၚ်ဟွံဂွံကၠေံ၊ ညံၚ်ဂွံမံက်ဂတဝ် အကြာညးလောကမန်။
          </Text>
        </View>

        {/* Account */}
        <Text className="mb-3 mt-2 text-lg font-bold text-surface-900 dark:text-surface-50">
          {t('settings.account')}
        </Text>
        {isLoggedIn ? (
          <View className="rounded-xl bg-white dark:bg-surface-800 p-4">
            <Text className="text-base text-surface-900 dark:text-surface-50">
              {user?.name}
            </Text>
            <Text className="text-sm text-surface-500 dark:text-surface-400">{user?.email}</Text>
            <Pressable
              onPress={() => {
                void logout()
                router.replace('/(tabs)')
              }}
              className="mt-4 flex-row items-center"
            >
              <Ionicons name="log-out-outline" size={18} color="#ef4444" />
              <Text className="ml-2 font-medium text-red-500">{t('nav.logout')}</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            onPress={() => router.push('/(auth)/login')}
            className="flex-row items-center justify-between rounded-xl bg-white dark:bg-surface-800 p-4"
          >
            <Text className="font-medium text-surface-900 dark:text-surface-50">
              {t('auth.signIn')}
            </Text>
            <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
          </Pressable>
        )}
      </ScrollView>
    </Screen>
  )
}
