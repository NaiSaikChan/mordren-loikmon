import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { purchases as purchasesApi } from '@loikmon/api'
import { PrimaryButton } from '@/components/PrimaryButton'
import { useI18n } from '@/context/I18nContext'
import type { CoinPackage } from '@/hooks/usePurchases'
import { useTypography } from '@/context/TypographyContext'

type RNFileAsset = { uri: string; name: string; type: string }

interface Props {
  pkg: CoinPackage | null
  visible: boolean
  onClose: () => void
  redeemCoinCoupon: (code: string) => Promise<{ status: string; message?: string; msg?: string }>
  buyCoins: (packageId: string, packageName: string, coinAmount: string, file: RNFileAsset, coupon?: string, bankId?: string) => Promise<void>
  buyLoading: boolean
}

// Strip HTML tags from bank details (server returns Facebook-styled HTML spans)
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
}

export function BuyCoinsModal({ pkg, visible, onClose, redeemCoinCoupon, buyCoins, buyLoading }: Props) {
  const { t } = useI18n()
  const insets = useSafeAreaInsets()
  const { bodyFontFamily, headerFontFamily } = useTypography()

  const [countries, setCountries] = useState<any[]>([])
  const [countriesLoading, setCountriesLoading] = useState(false)
  const [countryDropdownOpen, setCountryDropdownOpen] = useState(false)

  const [selectedCountry, setSelectedCountry] = useState<number | null>(null)
  const [banks, setBanks] = useState<any[]>([])
  const [banksLoading, setBanksLoading] = useState(false)
  const [selectedBank, setSelectedBank] = useState<any>(null)

  const [modalCoupon, setModalCoupon] = useState('')
  const [couponLoading, setCouponLoading] = useState(false)
  const [couponMsg, setCouponMsg] = useState('')
  const [couponSuccess, setCouponSuccess] = useState(false)

  const [proofFile, setProofFile] = useState<RNFileAsset | null>(null)
  const [buySuccess, setBuySuccess] = useState(false)
  const [buyMsg, setBuyMsg] = useState('')

  // Fetch countries once when modal first opens; cache across re-opens
  useEffect(() => {
    if (!visible || countries.length) return
    setCountriesLoading(true)
    purchasesApi
      .loadCountries()
      .then(res => setCountries((res.data as any)?.countries ?? []))
      .catch(() => setCountries([]))
      .finally(() => setCountriesLoading(false))
  }, [visible, countries.length])

  // Reset form state when modal closes
  useEffect(() => {
    if (visible) return
    setSelectedCountry(null)
    setCountryDropdownOpen(false)
    setBanks([])
    setSelectedBank(null)
    setModalCoupon('')
    setCouponMsg('')
    setCouponSuccess(false)
    setProofFile(null)
    setBuySuccess(false)
    setBuyMsg('')
  }, [visible])

  async function onSelectCountry(id: number) {
    setSelectedCountry(id)
    setCountryDropdownOpen(false)
    setSelectedBank(null)
    setBanks([])
    setBanksLoading(true)
    try {
      const res = await purchasesApi.loadBanks(id)
      setBanks((res.data as any)?.banks ?? [])
    } catch {
      setBanks([])
    } finally {
      setBanksLoading(false)
    }
  }

  async function onRedeemCoupon() {
    const code = modalCoupon.trim()
    if (!code) return
    setCouponLoading(true)
    setCouponMsg('')
    setCouponSuccess(false)
    try {
      const res = await redeemCoinCoupon(code)
      const ok = res.status === 'ok'
      setCouponSuccess(ok)
      setCouponMsg(res.message ?? res.msg ?? (ok ? t('purchases.coinCouponSuccess') : t('purchases.coinCouponInvalid')))
      if (ok) setModalCoupon('')
    } catch (e: unknown) {
      setCouponMsg(e instanceof Error ? e.message : t('purchases.coinCouponError'))
    } finally {
      setCouponLoading(false)
    }
  }

  async function onPickFile() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    })
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0]
      setProofFile({
        uri: asset.uri,
        name: asset.fileName ?? `proof_${Date.now()}.jpg`,
        type: asset.mimeType ?? 'image/jpeg',
      })
    }
  }

  async function onSubmit() {
    if (!pkg || !proofFile) return
    setBuyMsg('')
    try {
      await buyCoins(
        String(pkg.id),
        pkg.name ?? '',
        String(pkg.coins ?? pkg.amount ?? ''),
        proofFile,
        undefined,
        selectedBank ? String(selectedBank.id) : undefined,
      )
      setBuySuccess(true)
      setBuyMsg(t('purchases.proofSubmitted'))
    } catch (e: unknown) {
      setBuyMsg(e instanceof Error ? e.message : t('purchases.submissionFailed'))
    }
  }

  if (!pkg) return null

  const canSubmit = !!proofFile && !buyLoading && (banks.length === 0 || !!selectedBank)
  const priceDisplay = String((pkg as any).value ?? (pkg as any).price ?? pkg.amount ?? '')
  const coinsDisplay = String(pkg.coins ?? pkg.amount ?? '')
  const selectedCountryName = countries.find(c => Number(c.id) === selectedCountry)?.name ?? ''
  const titleStyle = bodyFontFamily ? { fontFamily: bodyFontFamily } : undefined
  const bodyStyle = bodyFontFamily ? { fontFamily: bodyFontFamily } : undefined
  const headerPreviewStyle = headerFontFamily ? { fontFamily: headerFontFamily } : undefined

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View className="flex-1 bg-white dark:bg-surface-900">
        {/* Header */}
        <View
          className="flex-row items-center justify-between border-b border-surface-200 dark:border-surface-700 px-4 py-4"
          style={{ paddingTop: insets.top + 8 }}
        >
          <Text className="text-lg text-surface-900 dark:text-surface-50" style={titleStyle}>
            {t('purchases.buyCoins')}: {pkg.name}
          </Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <Ionicons name="close" size={24} color="#64748b" />
          </Pressable>
        </View>

        {buySuccess ? (
          <View className="flex-1 items-center justify-center gap-4 px-6" style={{ paddingBottom: insets.bottom + 16 }}>
            <Text className="text-5xl" style={headerPreviewStyle}>✅</Text>
            <Text className="text-center font-semibold text-green-600" style={titleStyle}>{t('purchases.proofSubmittedShort')}</Text>
            <Text className="text-center text-sm text-surface-500 dark:text-surface-400" style={bodyStyle}>{buyMsg}</Text>
            <PrimaryButton label={t('common.close')} onPress={onClose} />
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 24 }}
            contentInsetAdjustmentBehavior="automatic"
            keyboardShouldPersistTaps="handled"
          >

            {/* Package summary */}
            <View className="my-4 items-center rounded-2xl bg-brand-50 dark:bg-brand-900/20 p-5">
              <Text className="text-3xl text-brand-600 dark:text-brand-400" style={headerPreviewStyle}>{coinsDisplay} 🪙</Text>
              {priceDisplay ? (
                <Text className="mt-1 text-sm text-surface-500 dark:text-surface-400" style={bodyStyle}>{priceDisplay} THB</Text>
              ) : null}
            </View>

            {/* Country selection */}
            <Text className="mb-2 text-sm font-semibold text-surface-700 dark:text-surface-300" style={titleStyle}>
              {t('purchases.selectCountry')}
            </Text>
            {countriesLoading ? (
              <ActivityIndicator size="small" className="my-2" />
            ) : (
              <View className="mb-4 gap-2">
                <Pressable
                  onPress={() => setCountryDropdownOpen(prev => !prev)}
                  className="flex-row items-center justify-between rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 px-4 py-3"
                >
                  <Text className={`text-sm ${selectedCountryName ? 'text-surface-800 dark:text-surface-200' : 'text-surface-400 dark:text-surface-500'}`} style={bodyStyle}>
                    {selectedCountryName || t('purchases.chooseCountry')}
                  </Text>
                  <Ionicons name={countryDropdownOpen ? 'chevron-up' : 'chevron-down'} size={16} color="#64748b" />
                </Pressable>

                {countryDropdownOpen ? (
                  <View className="overflow-hidden rounded-xl border border-surface-200 dark:border-surface-700">
                    {countries.map((c, i) => (
                      <Pressable
                        key={String(c.id)}
                        onPress={() => void onSelectCountry(Number(c.id))}
                        className={`flex-row items-center justify-between px-4 py-3 ${i > 0 ? 'border-t border-surface-100 dark:border-surface-800' : ''} ${selectedCountry === Number(c.id) ? 'bg-brand-50 dark:bg-brand-900/20' : 'bg-white dark:bg-surface-800'}`}
                      >
                        <Text className={`text-sm ${selectedCountry === Number(c.id) ? 'font-semibold text-brand-600 dark:text-brand-400' : 'text-surface-700 dark:text-surface-300'}`} style={bodyStyle}>
                          {c.name}
                        </Text>
                        {selectedCountry === Number(c.id) ? (
                          <Ionicons name="checkmark" size={16} color="#7c3aed" />
                        ) : null}
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </View>
            )}

            {/* Bank list */}
            {banksLoading ? (
              <ActivityIndicator size="small" className="mb-4" />
            ) : selectedCountry !== null && banks.length === 0 ? (
              <Text className="mb-4 text-sm text-surface-400" style={bodyStyle}>{t('purchases.noBanks')}</Text>
            ) : banks.length > 0 ? (
              <View className="mb-4">
                <Text className="mb-2 text-sm font-semibold text-surface-700 dark:text-surface-300" style={titleStyle}>
                  {t('purchases.selectBank')}
                </Text>
                <View className="overflow-hidden rounded-xl border border-surface-200 dark:border-surface-700">
                  {banks.map((bank, i) => (
                    <Pressable
                      key={String(bank.id)}
                      onPress={() => setSelectedBank(bank)}
                      className={`flex-row items-center gap-3 px-4 py-3 ${i > 0 ? 'border-t border-surface-100 dark:border-surface-800' : ''} ${selectedBank?.id === bank.id ? 'bg-brand-50 dark:bg-brand-900/20' : 'bg-white dark:bg-surface-800'}`}>
                      {bank.thumbnail ? (
                        <Image source={{ uri: bank.thumbnail }} className="h-10 w-10 rounded-lg" resizeMode="contain" />
                      ) : null}
                      <View className="flex-1">
                        <Text className={`text-sm font-semibold ${selectedBank?.id === bank.id ? 'text-brand-600 dark:text-brand-400' : 'text-surface-800 dark:text-surface-200'}`} style={titleStyle}>
                          {bank.accountname}
                        </Text>
                        <Text className="text-xs text-surface-400" style={bodyStyle}>{bank.countryname}</Text>
                      </View>
                      {selectedBank?.id === bank.id ? (
                        <Ionicons name="checkmark-circle" size={18} color="#7c3aed" />
                      ) : null}
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}

            {/* Selected bank details */}
            {selectedBank ? (
              <View className="mb-4 rounded-xl bg-surface-50 dark:bg-surface-800 p-3">
                <Text className="mb-1 text-sm font-semibold text-surface-700 dark:text-surface-200" style={titleStyle}>
                  {selectedBank.accountname}
                </Text>
                {selectedBank.details ? (
                  <Text className="text-sm leading-6 text-surface-600 dark:text-surface-400" style={bodyStyle}>
                    {stripHtml(String(selectedBank.details))}
                  </Text>
                ) : null}
              </View>
            ) : null}

            {/* Payment instructions */}
            <View className="mb-4 rounded-xl bg-surface-50 dark:bg-surface-800 p-3">
              <Text className="mb-1 text-sm font-semibold text-surface-700 dark:text-surface-200" style={titleStyle}>
                {t('purchases.paymentInstructions')}
              </Text>
              <Text className="text-sm leading-6 text-surface-500 dark:text-surface-400" style={bodyStyle}>
                1. {t('purchases.paymentTransferStep', { amount: priceDisplay })}
              </Text>
              <Text className="text-sm leading-6 text-surface-500 dark:text-surface-400" style={bodyStyle}>
                2. {t('purchases.paymentReceiptStep')}
              </Text>
              <Text className="text-sm leading-6 text-surface-500 dark:text-surface-400" style={bodyStyle}>
                3. {t('purchases.paymentUploadStep')}
              </Text>
              <Text className="mt-1 text-xs text-surface-400" style={bodyStyle}>{t('purchases.creditAfterReview')}</Text>
            </View>

            {/* Coupon */}
            <Text className="mb-1 text-sm font-semibold text-surface-700 dark:text-surface-300" style={titleStyle}>
              {t('purchases.modalCouponLabel')}{' '}
              <Text className="text-xs font-normal text-surface-400" style={bodyStyle}>({t('common.optional')})</Text>
            </Text>
            <View className="mb-1 flex-row items-center gap-2">
              <TextInput
                value={modalCoupon}
                onChangeText={v => { setModalCoupon(v); setCouponMsg('') }}
                placeholder={t('purchases.coinCouponPlaceholder')}
                autoCapitalize="characters"
                placeholderTextColor="#94a3b8"
                className="flex-1 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 px-4 py-3 text-surface-900 dark:text-surface-50"
              />
              <View className="w-28">
                <PrimaryButton
                  label={couponLoading ? '…' : t('purchases.redeemAction')}
                  loading={couponLoading}
                  onPress={() => void onRedeemCoupon()}
                />
              </View>
            </View>
            {couponMsg ? (
              <Text className={`mb-4 text-xs ${couponSuccess ? 'text-green-500' : 'text-red-400'}`} style={bodyStyle}>{couponMsg}</Text>
            ) : (
              <View className="mb-4" />
            )}

            {/* File upload */}
            <Text className="mb-2 text-sm font-semibold text-surface-700 dark:text-surface-300" style={titleStyle}>
              {t('purchases.paymentProof')}
            </Text>
            <Pressable
              onPress={() => void onPickFile()}
              className="mb-4 flex-row items-center gap-3 rounded-xl border border-dashed border-surface-300 dark:border-surface-600 bg-surface-50 dark:bg-surface-800 px-4 py-4">
              <Ionicons name="image-outline" size={22} color="#94a3b8" />
              <Text className="flex-1 text-sm text-surface-500 dark:text-surface-400" numberOfLines={1} style={bodyStyle}>
                {proofFile ? proofFile.name : t('purchases.chooseFile')}
              </Text>
              {proofFile ? <Ionicons name="checkmark-circle" size={20} color="#22c55e" /> : null}
            </Pressable>

            {buyMsg && !buySuccess ? (
              <Text className="mb-3 text-sm text-red-400" style={bodyStyle}>{buyMsg}</Text>
            ) : null}

            {/* Actions */}
            <View className="flex-row gap-3">
              <Pressable
                onPress={onClose}
                className="flex-1 items-center justify-center rounded-xl border border-surface-300 dark:border-surface-600 py-3">
                <Text className="text-sm font-semibold text-surface-600 dark:text-surface-300" style={bodyStyle}>{t('common.cancel')}</Text>
              </Pressable>
              <View className="flex-1">
                <PrimaryButton
                  label={buyLoading ? t('purchases.submitting') : t('purchases.submitProof')}
                  loading={buyLoading}
                  disabled={!canSubmit}
                  onPress={() => void onSubmit()}
                />
              </View>
            </View>
          </ScrollView>
        )}
      </View>
    </Modal>
  )
}
