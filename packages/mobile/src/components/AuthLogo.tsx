import { View, type ViewStyle } from 'react-native'
import { Image } from 'expo-image'
import Animated, { ZoomIn, useReducedMotion } from 'react-native-reanimated'
import { useTheme } from '@/context/ThemeContext'
import { surface } from '@/theme/palette'

const logo = require('../../assets/splash-icon.png')

// Brand pastel used for the app icon/splash background (see app.json), with a
// dark-mode surface tone so the badge still reads as a distinct accent.
const BADGE_BG = { light: '#e0d0d0', dark: surface[800] }

/** Circular brand-colored badge used behind the logo (and auth success states). */
export function AuthBadge({
  size = 128,
  style,
  children,
}: {
  size?: number
  style?: ViewStyle
  children: React.ReactNode
}) {
  const { isDark } = useTheme()
  const reduceMotion = useReducedMotion()
  return (
    <Animated.View
      entering={reduceMotion ? undefined : ZoomIn.duration(450).springify().damping(14)}
      className="self-center items-center justify-center rounded-full"
      style={[
        {
          width: size,
          height: size,
          backgroundColor: isDark ? BADGE_BG.dark : BADGE_BG.light,
          boxShadow: isDark
            ? '0 10px 30px rgba(0, 0, 0, 0.45)'
            : '0 10px 30px rgba(224, 208, 208, 0.7)',
        },
        style,
      ]}
    >
      <View style={{ alignItems: 'center', justifyContent: 'center' }}>{children}</View>
    </Animated.View>
  )
}

/** Brand logo (mobile/assets/splash-icon.png) in the circular auth badge. */
export function AuthLogo({ size = 128, logoSize }: { size?: number; logoSize?: number }) {
  return (
    <AuthBadge size={size}>
      <Image
        source={logo}
        contentFit="contain"
        accessibilityIgnoresInvertColors
        accessible={false}
        style={{ width: logoSize ?? size * 0.72, height: logoSize ?? size * 0.72 }}
      />
    </AuthBadge>
  )
}
