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
  '@loikmon/.*',
]

module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  transformIgnorePatterns: [`node_modules/(?!(${transpileModules.join('|')}))`],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
}
