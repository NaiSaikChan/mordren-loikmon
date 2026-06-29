import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router';
import i18n from './i18n';
import './assets/main.css';
import { useAuthStore } from './stores/auth';
const app = createApp(App);
const pinia = createPinia();
app.use(pinia);
app.use(router);
app.use(i18n);
// Restore persisted session before mounting so auth state is available immediately
const authStore = useAuthStore();
authStore.restore();
app.mount('#app');
