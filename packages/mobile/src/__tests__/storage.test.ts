import { Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as SecureStore from 'expo-secure-store'
import { resetSecureStorageForTests, secureStorage, SecureStorageUnavailableError } from '@/services/storage'

const isAvailable = SecureStore.isAvailableAsync as jest.Mock
const getItem = SecureStore.getItemAsync as jest.Mock
const setItem = SecureStore.setItemAsync as jest.Mock

const originalOS = Platform.OS
const setOS = (os: string) => Object.defineProperty(Platform, 'OS', { configurable: true, get: () => os })

beforeEach(async () => {
  jest.clearAllMocks()
  isAvailable.mockResolvedValue(true)
  getItem.mockResolvedValue(null)
  setItem.mockResolvedValue(undefined)
  await AsyncStorage.clear()
  resetSecureStorageForTests()
  setOS('ios')
})

afterAll(() => setOS(originalOS))

describe('secureStorage on native', () => {
  it('checks SecureStore availability once, not on every call', async () => {
    await secureStorage.set('token', 'a')
    await secureStorage.get('token')
    await secureStorage.remove('token')
    expect(isAvailable).toHaveBeenCalledTimes(1)
  })

  it('never falls back to plaintext AsyncStorage when SecureStore is unavailable', async () => {
    isAvailable.mockResolvedValue(false)
    await expect(secureStorage.set('token', 'secret')).rejects.toBeInstanceOf(SecureStorageUnavailableError)
    await expect(secureStorage.get('token')).rejects.toBeInstanceOf(SecureStorageUnavailableError)
    expect(await AsyncStorage.getItem('secure_token')).toBeNull()
  })

  it('surfaces a SecureStore write failure instead of writing plaintext', async () => {
    setItem.mockRejectedValueOnce(new Error('keystore locked'))
    await expect(secureStorage.set('token', 'secret')).rejects.toThrow('keystore locked')
    expect(await AsyncStorage.getItem('secure_token')).toBeNull()
  })

  it('treats an availability check that throws as unavailable (and still refuses plaintext)', async () => {
    isAvailable.mockRejectedValue(new Error('no native module'))
    await expect(secureStorage.set('token', 'secret')).rejects.toBeInstanceOf(SecureStorageUnavailableError)
    expect(await AsyncStorage.getItem('secure_token')).toBeNull()
  })

  it('migrates a plaintext secret left by an older build into SecureStore', async () => {
    await AsyncStorage.setItem('secure_token', 'legacy')
    expect(await secureStorage.get('token')).toBe('legacy')
    expect(setItem).toHaveBeenCalledWith('token', 'legacy')
    expect(await AsyncStorage.getItem('secure_token')).toBeNull()
  })

  it('remove() also deletes any plaintext copy', async () => {
    await AsyncStorage.setItem('secure_user', '{}')
    await secureStorage.remove('user')
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('user')
    expect(await AsyncStorage.getItem('secure_user')).toBeNull()
  })
})

describe('secureStorage on web', () => {
  it('uses AsyncStorage (localStorage) because SecureStore does not exist there', async () => {
    setOS('web')
    await secureStorage.set('token', 'web-token')
    expect(await secureStorage.get('token')).toBe('web-token')
    expect(await AsyncStorage.getItem('secure_token')).toBe('web-token')
    expect(isAvailable).not.toHaveBeenCalled()
    expect(setItem).not.toHaveBeenCalled()
  })
})
