<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { usePurchasesStore } from '@/stores/purchases'
import LoadingSpinner from '@/components/shared/LoadingSpinner.vue'

const { t } = useI18n()
const authStore = useAuthStore()
const store = usePurchasesStore()

const couponCode = ref('')
const couponMsg  = ref('')
const couponLoading = ref(false)
const couponSuccess = ref(false)

async function redeemCoinCoupon() {
  if (!couponCode.value.trim()) return
  couponLoading.value = true
  couponMsg.value = ''
  couponSuccess.value = false
  try {
    const res = await store.redeemCoinCoupon(couponCode.value.trim())
    couponSuccess.value = res?.status === 'ok'
    couponMsg.value = res?.message ?? res?.msg ?? (res?.status === 'ok' ? t('purchases.coinCouponSuccess') : t('purchases.coinCouponFailed'))
    if (res?.status === 'ok') couponCode.value = ''
  } catch (e: any) {
    couponMsg.value = e?.message ?? t('purchases.coinCouponError')
  } finally {
    couponLoading.value = false
  }
}

// --- Buy Coins modal state ---
const selectedPkg   = ref<any>(null)
const proofFile     = ref<File | null>(null)
const fileInputRef  = ref<HTMLInputElement | null>(null)
const buyMsg        = ref('')
const buySuccess    = ref(false)

// Country / bank selection
const countries       = ref<any[]>([])
const countriesLoading = ref(false)
const selectedCountry = ref<number | null>(null)
const banks           = ref<any[]>([])
const banksLoading    = ref(false)
const selectedBank    = ref<any>(null)

async function fetchCountries() {
  if (countries.value.length) return
  countriesLoading.value = true
  try {
    const res = await store.loadCountries()
    countries.value = res?.countries ?? []
  } catch {
    countries.value = []
  } finally {
    countriesLoading.value = false
  }
}

// Coupon redeemable within the modal (calls subscribeCoupon independently of payment)
const modalCoupon        = ref('')
const modalCouponLoading = ref(false)
const modalCouponMsg     = ref('')
const modalCouponSuccess = ref(false)

async function redeemModalCoupon() {
  if (!modalCoupon.value.trim()) return
  modalCouponLoading.value = true
  modalCouponMsg.value     = ''
  modalCouponSuccess.value = false
  try {
    const res = await store.redeemCoinCoupon(modalCoupon.value.trim())
    modalCouponSuccess.value = res?.status === 'ok'
    modalCouponMsg.value = res?.message ?? res?.msg ?? (res?.status === 'ok' ? t('purchases.coinCouponSuccess') : t('purchases.coinCouponFailed'))
    if (res?.status === 'ok') modalCoupon.value = ''
  } catch (e: any) {
    modalCouponMsg.value = e?.message ?? t('purchases.coinCouponError')
  } finally {
    modalCouponLoading.value = false
  }
}

async function onCountryChange() {
  selectedBank.value = null
  banks.value        = []
  if (!selectedCountry.value) return
  banksLoading.value = true
  try {
    const res  = await store.loadBanks(selectedCountry.value)
    banks.value = res?.banks ?? []
  } catch {
    banks.value = []
  } finally {
    banksLoading.value = false
  }
}

function selectPackage(pkg: any) {
  selectedPkg.value        = pkg
  proofFile.value          = null
  buyMsg.value             = ''
  buySuccess.value         = false
  modalCoupon.value        = ''
  modalCouponMsg.value     = ''
  modalCouponSuccess.value = false
  selectedCountry.value    = null
  selectedBank.value       = null
  banks.value              = []
  fetchCountries()
}

function onFileChange(e: Event) {
  proofFile.value = (e.target as HTMLInputElement).files?.[0] ?? null
}

async function submitPayment() {
  if (!selectedPkg.value || !proofFile.value) return
  buyMsg.value = ''
  try {
    await store.buyCoins(
      String(selectedPkg.value.id),
      selectedPkg.value.name,
      String(selectedPkg.value.amount),
      proofFile.value,
      undefined,
      selectedBank.value ? String(selectedBank.value.id) : undefined,
    )
    buySuccess.value = true
    buyMsg.value = t('purchases.proofSubmitted')
  } catch {
    buyMsg.value = store.buyError ?? t('purchases.submissionFailed')
  }
}

function closeModal() {
  selectedPkg.value        = null
  buySuccess.value         = false
  buyMsg.value             = ''
  proofFile.value          = null
  modalCoupon.value        = ''
  modalCouponMsg.value     = ''
  modalCouponSuccess.value = false
  selectedCountry.value    = null
  selectedBank.value       = null
  banks.value              = []
}

onMounted(async () => {
  if (authStore.isLoggedIn) {
    await store.fetchAll()
    await store.fetchCoinPackages()
  }
})
</script>

<template>
  <div class="page-wrapper max-w-3xl">
    <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-6">{{ t('purchases.title') }}</h1>

    <!-- Not logged in -->
    <div v-if="!authStore.isLoggedIn" class="card p-12 text-center text-gray-400">
      <div class="text-6xl mb-4">🪙</div>
      <p class="mb-4">{{ t('purchases.loginPrompt') }}</p>
      <RouterLink to="/auth" class="btn-primary inline-flex">{{ t('auth.login') }}</RouterLink>
    </div>

    <div v-else>
      <LoadingSpinner v-if="store.loading" />

      <div v-else class="space-y-6">
        <!-- Coin balance -->
        <div class="card p-6 flex items-center gap-5">
          <div class="w-16 h-16 rounded-2xl bg-yellow-100 dark:bg-yellow-900/20 flex items-center justify-center text-3xl">🪙</div>
          <div>
            <p class="text-sm text-gray-400">{{ t('purchases.coins') }}</p>
            <p class="text-3xl font-bold text-yellow-600 dark:text-yellow-400">{{ store.coinBalance }}</p>
          </div>
        </div>

        <!-- Coin packages -->
        <div v-if="store.coinPackages.length">
          <h2 class="font-semibold text-gray-800 dark:text-gray-200 mb-3">{{ t('purchases.buyCoins') }}</h2>
          <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div v-for="pkg in store.coinPackages" :key="pkg.id" class="card p-4 hover:border-brand-400 transition-colors">
              <!-- Clickable package summary -->
              <div class="text-center cursor-pointer mb-3" @click="selectPackage(pkg)">
                <div class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">{{ pkg.name }}</div>
                <div class="text-2xl font-bold text-brand-600 dark:text-brand-400">{{ pkg.amount }} 🪙</div>
                <div class="text-xs font-medium text-gray-500 dark:text-gray-400 mt-1">{{ pkg.value }} THB</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Purchased books list -->
        <div v-if="store.books.length">
          <h2 class="font-semibold text-gray-800 dark:text-gray-200 mb-3">{{ t('purchases.purchasedBooks', { count: store.books.length }) }}</h2>
          <div class="space-y-2">
            <RouterLink v-for="b in store.books" :key="b.id" :to="`/books/${b.id}`"
              class="card p-3 flex items-center gap-3 hover:border-brand-400 transition-colors">
              <div class="text-xl">📚</div>
              <span class="text-sm font-medium text-gray-900 dark:text-white">{{ b.title ?? b.name ?? b }}</span>
            </RouterLink>
          </div>
        </div>

        <!-- Purchased articles list -->
        <div v-if="store.articles.length">
          <h2 class="font-semibold text-gray-800 dark:text-gray-200 mb-3">{{ t('purchases.purchasedArticles', { count: store.articles.length }) }}</h2>
          <div class="space-y-2">
            <RouterLink v-for="a in store.articles" :key="a.id" :to="`/articles/${a.id}`"
              class="card p-3 flex items-center gap-3 hover:border-brand-400 transition-colors">
              <div class="text-xl">📰</div>
              <span class="text-sm font-medium text-gray-900 dark:text-white">{{ a.title ?? a.name ?? a }}</span>
            </RouterLink>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Buy Coins Modal -->
  <Teleport to="body">
    <div v-if="selectedPkg"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      @click.self="closeModal">
      <div class="bg-white dark:bg-surface-800 rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5">

        <!-- Header -->
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-bold text-gray-900 dark:text-white">
            {{ t('purchases.buyCoins') }}: {{ selectedPkg.name }}
          </h3>
          <button @click="closeModal" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl leading-none">&times;</button>
        </div>

        <!-- Package summary -->
        <div class="bg-brand-50 dark:bg-brand-900/20 rounded-xl p-4 text-center">
          <div class="text-3xl font-bold text-brand-600 dark:text-brand-400">{{ selectedPkg.amount }} 🪙</div>
          <div class="text-sm text-gray-500 dark:text-gray-400 mt-1">{{ selectedPkg.value }} THB</div>
        </div>

        <!-- Success state -->
        <div v-if="buySuccess" class="text-center py-4 space-y-3">
          <div class="text-5xl">✅</div>
          <p class="text-green-600 dark:text-green-400 font-semibold">{{ t('purchases.proofSubmittedShort') }}</p>
          <p class="text-sm text-gray-500 dark:text-gray-400">{{ buyMsg }}</p>
          <button @click="closeModal" class="btn-primary mt-2 px-6">{{ t('common.close') }}</button>
        </div>

        <!-- Upload form -->
        <div v-else class="space-y-4">
          <!-- Country dropdown -->
          <div>
            <label class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
              {{ t('purchases.selectCountry') }}
            </label>
            <select
              v-model="selectedCountry"
              class="input w-full"
              :disabled="countriesLoading"
              @change="onCountryChange">
              <option :value="null" disabled>
                {{ countriesLoading ? t('purchases.loadingBanks') : t('purchases.chooseCountry') }}
              </option>
              <option v-for="c in countries" :key="c.id" :value="c.id">{{ c.name }}</option>
            </select>
          </div>

          <!-- Bank list -->
          <div v-if="banksLoading" class="text-sm text-gray-400">{{ t('purchases.loadingBanks') }}</div>
          <div v-else-if="selectedCountry !== null && !banks.length" class="text-sm text-gray-400">
            {{ t('purchases.noBanks') }}
          </div>
          <div v-else-if="banks.length" class="space-y-2">
            <label class="text-sm font-medium text-gray-700 dark:text-gray-300 block">
              {{ t('purchases.selectBank') }}
            </label>
            <div
              v-for="bank in banks"
              :key="bank.id"
              class="flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors"
              :class="selectedBank?.id === bank.id
                ? 'border-brand-400 bg-brand-50 dark:bg-brand-900/20'
                : 'border-gray-200 dark:border-gray-700 hover:border-brand-300 dark:hover:border-brand-600'"
              @click="selectedBank = bank">
              <img v-if="bank.thumbnail" :src="bank.thumbnail" :alt="bank.accountname"
                class="w-10 h-10 object-contain rounded-lg shrink-0" />
              <div>
                <p class="text-sm font-semibold text-gray-800 dark:text-gray-200">{{ bank.accountname }}</p>
                <p class="text-xs text-gray-500 dark:text-gray-400">{{ bank.countryname }}</p>
              </div>
            </div>
          </div>

          <!-- Selected bank account details -->
          <div v-if="selectedBank"
            class="bg-gray-50 dark:bg-surface-700 rounded-xl p-3 space-y-1 text-sm">
            <p class="font-semibold text-gray-700 dark:text-gray-200">{{ selectedBank.accountname }}</p>
            <!-- eslint-disable-next-line vue/no-v-html -->
            <div v-if="selectedBank.details"
              class="text-gray-600 dark:text-gray-400 [&_span]:font-inherit! [&_p]:leading-normal"
              v-html="selectedBank.details" />
          </div>

          <!-- Payment instructions -->
          <div class="text-sm text-gray-600 dark:text-gray-300 space-y-1">
            <p class="font-semibold">{{ t('purchases.paymentInstructions') }}</p>
            <ol class="list-decimal list-inside space-y-1 text-gray-500 dark:text-gray-400">
              <li>{{ t('purchases.paymentTransferStep', { amount: selectedPkg.value }) }}</li>
              <li>{{ t('purchases.paymentReceiptStep') }}</li>
              <li>{{ t('purchases.paymentUploadStep') }}</li>
            </ol>
            <p class="text-xs text-gray-400 pt-1">{{ t('purchases.creditAfterReview') }}</p>
          </div>

          <!-- Coupon code with inline Redeem -->
          <div>
            <label class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
              {{ t('purchases.modalCouponLabel') }}
              <span class="text-xs text-gray-400 font-normal ml-1">({{ t('common.optional') }})</span>
            </label>
            <div class="flex gap-2">
              <input
                v-model="modalCoupon"
                type="text"
                class="input flex-1"
                :placeholder="t('purchases.modalCouponPlaceholder')"
                @keyup.enter="redeemModalCoupon" />
              <button
                class="btn-primary shrink-0"
                :disabled="!modalCoupon.trim() || modalCouponLoading"
                :class="{ 'opacity-50 cursor-not-allowed': !modalCoupon.trim() || modalCouponLoading }"
                @click="redeemModalCoupon">
                {{ modalCouponLoading ? '…' : t('purchases.redeemAction') }}
              </button>
            </div>
            <p v-if="modalCouponMsg" :class="['text-xs mt-1', modalCouponSuccess ? 'text-green-500' : 'text-red-400']">
              {{ modalCouponMsg }}
            </p>
          </div>

          <!-- File upload -->
          <label class="block">
            <span class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">{{ t('purchases.paymentProof') }}</span>
            <input
              ref="fileInputRef"
              type="file"
              accept="image/*,application/pdf"
              class="block w-full text-sm text-gray-500 dark:text-gray-400
                file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0
                file:text-sm file:font-medium
                file:bg-brand-50 file:text-brand-700
                dark:file:bg-brand-900/30 dark:file:text-brand-400
                hover:file:bg-brand-100 dark:hover:file:bg-brand-900/50 cursor-pointer"
              @change="onFileChange"
            />
          </label>

          <!-- Error -->
          <p v-if="buyMsg && !buySuccess" class="text-red-500 dark:text-red-400 text-sm">{{ buyMsg }}</p>

          <!-- Actions -->
          <div class="flex gap-3 pt-1">
            <button class="btn-ghost flex-1" @click="closeModal">{{ t('common.cancel') }}</button>
            <button
              class="btn-primary flex-1"
              :disabled="!proofFile || store.buyLoading || (banks.length > 0 && !selectedBank)"
              :class="{ 'opacity-50 cursor-not-allowed': !proofFile || store.buyLoading || (banks.length > 0 && !selectedBank) }"
              @click="submitPayment">
              <span v-if="store.buyLoading">{{ t('purchases.submitting') }}</span>
              <span v-else>{{ t('purchases.submitProof') }}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  </Teleport>
</template>
