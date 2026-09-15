// Packages that ship untranspiled ESM/Flow and therefore must NOT be ignored
// by Babel during transform. Kept as an array for readability/maintainability.
const transpileModules = [
  '(jest-)?react-native',
  '@react-native(-community)?',
  'expo(nent)?',
  '@expo(nent)?/.*',
  '@expo-google-fonts/.*',
  'react-navigation',
  '@react-navigation/.*',
  '@unimodules/.*',
  'unimodules',
  'sentry-expo',
  'native-base',
  'react-native-svg',
  'nativewind',
  'react-native-css-interop',
  'expo-iap',
  '@loikmon/.*',
]

module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  // @loikmon/api is symlinked from ../api (outside this package): resolve its
  // dependencies and Babel helpers from this app's node_modules as a fallback.
  modulePaths: ['<rootDir>/node_modules'],
  transformIgnorePatterns: [`node_modules/(?!(${transpileModules.join('|')}))`],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    // @loikmon/api is TypeScript source using ESM-style `./file.js` specifiers.
    '^(\\.{1,2}/(?:endpoints/)?(?:client|types|auth|books|articles|authors|categories|library|media|misc|reviews|search|subscriptions))\\.js$':
      '$1',
  },
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
}
