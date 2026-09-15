import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import i18n from './i18n'
import './assets/main.css'
import "@fontsource/padauk/400.css";
import "@fontsource/padauk/700.css";

import { installApiClient } from './api'
import { useAuthStore } from './stores/auth'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)

// Configure @loikmon/api (base URL, bearer token, 401 handling) before any request.
installApiClient({ pinia, router })

app.use(router)
app.use(i18n)

// Validate the persisted session (auth.me()) — protected routes wait for it.
void useAuthStore(pinia).restore()

app.mount('#app')
