import type { ConfigContext, ExpoConfig } from 'expo/config'

/**
 * Dynamic layer over app.json (the static config stays the source of truth).
 *
 * Development builds — local `expo run:*` or the EAS `development` profile —
 * may talk to a backend on localhost over plain HTTP. Preview and production
 * EAS builds ship without that App Transport Security exception.
 */
const IS_DEV_BUILD = process.env.APP_VARIANT === 'development' || !process.env.EAS_BUILD

export default ({ config }: ConfigContext): ExpoConfig => {
  const expo = config as ExpoConfig
  if (!IS_DEV_BUILD) return expo

  return {
    ...expo,
    ios: {
      ...expo.ios,
      infoPlist: {
        ...expo.ios?.infoPlist,
        NSAppTransportSecurity: {
          NSExceptionDomains: {
            localhost: { NSExceptionAllowsInsecureHTTPLoads: true, NSIncludesSubdomains: true },
          },
        },
      },
    },
  }
}
