import { computed, onMounted, onUnmounted, ref, watch, type Ref } from 'vue'
import { useAuthStore } from '@/stores/auth'

const COPY_MESSAGE = 'Copying content is not permitted.'
const PRINT_MESSAGE = 'Printing is disabled for protected content.'

export function useContentProtection(target: Ref<HTMLElement | null>) {
  const auth = useAuthStore()
  const toastVisible = ref(false)
  const toastMessage = ref(COPY_MESSAGE)
  const devToolsDetected = ref(false)
  let toastTimer: ReturnType<typeof setTimeout> | null = null
  let devToolsTimer: ReturnType<typeof setInterval> | null = null

  const watermarkText = computed(() => {
    const user = auth.user
    return `Loikmon • ${user?.name || user?.email || `User ${user?.id ?? 'guest'}`}`
  })

  function notifyCopyBlocked(message = COPY_MESSAGE) {
    toastMessage.value = message
    toastVisible.value = true
    if (toastTimer) clearTimeout(toastTimer)
    toastTimer = setTimeout(() => { toastVisible.value = false }, 2500)
  }

  function blockInteraction(event: Event) {
    event.preventDefault()
    notifyCopyBlocked()
  }

  function blockShortcut(event: KeyboardEvent) {
    const eventTarget = event.target
    if (!target.value || !(eventTarget instanceof Node) || !target.value.contains(eventTarget)) return
    const modifier = event.ctrlKey || event.metaKey
    if (!modifier) return
    if (['c', 'x', 'a', 's', 'p'].includes(event.key.toLowerCase())) {
      event.preventDefault()
      event.stopPropagation()
      notifyCopyBlocked(event.key.toLowerCase() === 'p' ? PRINT_MESSAGE : COPY_MESSAGE)
    }
  }

  function checkDevTools() {
    const widthGap = window.outerWidth - window.innerWidth
    const heightGap = window.outerHeight - window.innerHeight
    const detected = widthGap > 160 || heightGap > 160
    if (detected && !devToolsDetected.value) {
      devToolsDetected.value = true
      console.warn('[content-protection] Developer tools detected')
    } else if (!detected) {
      devToolsDetected.value = false
    }

  }

  function onCopyBlocked() {
    notifyCopyBlocked()
  }

  let attachedElement: HTMLElement | null = null
  function attach(element: HTMLElement | null) {
    if (attachedElement === element) return
    if (attachedElement) {
      for (const eventName of ['contextmenu', 'copy', 'cut', 'dragstart', 'selectstart']) {
        attachedElement.removeEventListener(eventName, blockInteraction)
      }
    }
    attachedElement = element
    if (!element) return
    for (const eventName of ['contextmenu', 'copy', 'cut', 'dragstart', 'selectstart']) {
      element.addEventListener(eventName, blockInteraction)
    }
  }

  onMounted(() => {
    attach(target.value)
    window.addEventListener('keydown', blockShortcut, true)
    window.addEventListener('loikmon:copy-blocked', onCopyBlocked)
    checkDevTools()
    devToolsTimer = setInterval(checkDevTools, 2000)
  })

  watch(target, attach)

  onUnmounted(() => {
    if (attachedElement) {
      for (const eventName of ['contextmenu', 'copy', 'cut', 'dragstart', 'selectstart']) {
        attachedElement.removeEventListener(eventName, blockInteraction)
      }
    }
    window.removeEventListener('keydown', blockShortcut, true)
    window.removeEventListener('loikmon:copy-blocked', onCopyBlocked)
    if (toastTimer) clearTimeout(toastTimer)
    if (devToolsTimer) clearInterval(devToolsTimer)
  })

  return { toastVisible, toastMessage, devToolsDetected, watermarkText }
}

export { COPY_MESSAGE, PRINT_MESSAGE }
