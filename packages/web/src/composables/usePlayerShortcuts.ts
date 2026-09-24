import { onMounted, onUnmounted } from 'vue'
import { SKIP_SECONDS, type PlayerEngine } from '@/composables/usePlayerEngine'

/**
 * True while the listener is typing, so shortcuts never steal a keystroke.
 *
 * Checking only `INPUT` is not enough: search boxes, the CMS rich text editor
 * and any `contenteditable` region must be left alone too.
 */
function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el || !el.tagName) return false
  const tag = el.tagName.toUpperCase()
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable
}

/**
 * Keyboard shortcuts for the global player. Only active while something is
 * loaded, so the keys stay available to the rest of the app otherwise.
 */
export function usePlayerShortcuts(engine: PlayerEngine) {
  function onKeydown(e: KeyboardEvent) {
    if (!engine.current.value) return
    if (isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return

    switch (e.key) {
      case ' ':
      case 'k':
      case 'K':
        e.preventDefault()
        engine.toggle()
        break
      case 'ArrowRight':
        e.preventDefault()
        if (e.shiftKey) engine.next()
        else engine.skip(SKIP_SECONDS)
        break
      case 'ArrowLeft':
        e.preventDefault()
        if (e.shiftKey) engine.previous()
        else engine.skip(-SKIP_SECONDS)
        break
      default:
        break
    }
  }

  onMounted(() => document.addEventListener('keydown', onKeydown))
  onUnmounted(() => document.removeEventListener('keydown', onKeydown))
}
