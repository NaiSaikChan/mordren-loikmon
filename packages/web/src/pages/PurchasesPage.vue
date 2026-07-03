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
const couponBookId = ref('')

async function redeemCoupon() {
  if (!couponCode.value) return
  try {
    const res = await store.redeemCoupon(couponCode.value, couponBookId.value || '0')
    couponMsg.value = res.message ?? (res.status === 'ok' ? 'Redeemed successfully!' : 'Failed')
  } catch {
    couponMsg.value = 'Error redeeming coupon'
  }
}

// --- Buy Coins modal state ---
const selectedPkg   = ref<any>(null)
const proofFile     = ref<File | null>(null)
const fileInputRef  = ref<HTMLInputElement | null>(null)
const buyMsg        = ref('')
const buySuccess    = ref(false)

function selectPackage(pkg: any) {
  selectedPkg.value = pkg
  proofFile.value   = null
  buyMsg.value      = ''
  buySuccess.value  = false
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
    )
    buySuccess.value = true
    buyMsg.value = t('purchases.proofSubmitted')
  } catch {
    buyMsg.value = store.buyError ?? 'Submission failed. Please try again.'
  }
}

function closeModal() {
  selectedPkg.value = null
  buySuccess.value  = false
  buyMsg.value      = ''
  proofFile.value   = null
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
      <p class="mb-4">Login to view your purchases and coins</p>
      <RouterLink to="/auth" class="btn-primary inline-flex">Login</RouterLink>
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
            <div v-for="pkg in store.coinPackages" :key="pkg.id"
              class="card p-4 text-center hover:border-brand-400 cursor-pointer transition-colors"
              @click="selectPackage(pkg)">
              <div class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">{{ pkg.name }}</div>
              <div class="text-2xl font-bold text-brand-600 dark:text-brand-400">{{ pkg.amount }} 🪙</div>
              <div class="text-xs font-medium text-gray-500 dark:text-gray-400 mt-1">{{ pkg.value }} MMK</div>
            </div>
          </div>
        </div>

        <!-- Redeem coupon -->
        <div class="card p-6">
          <h2 class="font-semibold text-gray-800 dark:text-gray-200 mb-4">{{ t('purchases.redeemCoupon') }}</h2>
          <div class="flex gap-2">
            <input v-model="couponCode" class="input flex-1" placeholder="Enter coupon code" />
            <button class="btn-primary" @click="redeemCoupon">Redeem</button>
          </div>
          <p v-if="couponMsg" :class="['text-sm mt-2', couponMsg.includes('success') ? 'text-green-500' : 'text-red-400']">
            {{ couponMsg }}
          </p>
        </div>

        <!-- Purchased books list -->
        <div v-if="store.books.length">
          <h2 class="font-semibold text-gray-800 dark:text-gray-200 mb-3">Purchased Books ({{ store.books.length }})</h2>
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
          <h2 class="font-semibold text-gray-800 dark:text-gray-200 mb-3">Purchased Articles ({{ store.articles.length }})</h2>
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
          <div class="text-sm text-gray-500 dark:text-gray-400 mt-1">{{ selectedPkg.value }} MMK</div>
        </div>

        <!-- Success state -->
        <div v-if="buySuccess" class="text-center py-4 space-y-3">
          <div class="text-5xl">✅</div>
          <p class="text-green-600 dark:text-green-400 font-semibold">Proof submitted!</p>
          <p class="text-sm text-gray-500 dark:text-gray-400">{{ buyMsg }}</p>
          <button @click="closeModal" class="btn-primary mt-2 px-6">{{ t('common.close') }}</button>
        </div>

        <!-- Upload form -->
        <div v-else class="space-y-4">
          <!-- Payment instructions -->
          <div class="text-sm text-gray-600 dark:text-gray-300 space-y-1">
            <p class="font-semibold">{{ t('purchases.paymentInstructions') }}</p>
            <ol class="list-decimal list-inside space-y-1 text-gray-500 dark:text-gray-400">
              <li>Transfer <strong class="text-gray-700 dark:text-gray-200">{{ selectedPkg.value }} MMK</strong> to our bank account.</li>
              <li>Take a screenshot or photo of the transfer receipt.</li>
              <li>Upload the proof image below and tap Submit.</li>
            </ol>
            <p class="text-xs text-gray-400 pt-1">Coins are credited within 24 hours after admin review.</p>
          </div>

          <!-- File upload -->
          <label class="block">
            <span class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Payment Proof</span>
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
              :disabled="!proofFile || store.buyLoading"
              :class="{ 'opacity-50 cursor-not-allowed': !proofFile || store.buyLoading }"
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
