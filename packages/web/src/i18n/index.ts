import { createI18n } from 'vue-i18n'
import en from './locales/en.json'
import mon from './locales/mon.json'

const i18n = createI18n({
  legacy: false,
  locale: localStorage.getItem('locale') ?? 'en',
  fallbackLocale: 'en',
  messages: { en, mon },
})

export default i18n
