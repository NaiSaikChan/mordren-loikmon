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

module.exports = withNativeWind(config, { input: './global.css' })
