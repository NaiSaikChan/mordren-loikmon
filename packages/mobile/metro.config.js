const { getDefaultConfig } = require('expo/metro-config')
const { withNativeWind } = require('nativewind/metro')
const path = require('path')

// Monorepo-aware Metro config.
// The mobile app lives in packages/mobile but consumes the workspace package
// `@loikmon/api` (TypeScript source). We add the repo root to watchFolders and
// let Metro resolve shared modules from the root node_modules as a fallback.
const projectRoot = __dirname
const workspaceRoot = path.resolve(projectRoot, '../..')

const config = getDefaultConfig(projectRoot)

config.watchFolders = [workspaceRoot]
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
]
// Allow importing the `.ts` source of @loikmon/api directly.
config.resolver.disableHierarchicalLookup = false

const nativeWindConfig = withNativeWind(config, { input: './global.css' })

// @loikmon/api uses TypeScript ESM-style imports (e.g. `./endpoints/auth.js`)
// that refer to `.ts` source files. Metro resolves them literally and fails.
// This custom resolver retries with `.ts` / `.tsx` when `.js` is not found.
const prevResolveRequest = nativeWindConfig.resolver.resolveRequest
nativeWindConfig.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolve = (name) =>
    prevResolveRequest
      ? prevResolveRequest(context, name, platform)
      : context.resolveRequest(context, name, platform)

  if (moduleName.endsWith('.js')) {
    try {
      return resolve(moduleName)
    } catch {
      for (const ext of ['.ts', '.tsx']) {
        try {
          return resolve(moduleName.slice(0, -3) + ext)
        } catch { /* try next */ }
      }
      return resolve(moduleName) // re-throw original error
    }
  }
  return resolve(moduleName)
}

module.exports = nativeWindConfig
