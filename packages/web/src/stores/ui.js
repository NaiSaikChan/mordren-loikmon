import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
export const useUiStore = defineStore('ui', () => {
    const theme = ref(localStorage.getItem('theme') ?? 'system');
    const locale = ref(localStorage.getItem('locale') ?? 'en');
    const sidebarOpen = ref(false);
    function applyTheme() {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const isDark = theme.value === 'dark' || (theme.value === 'system' && prefersDark);
        document.documentElement.classList.toggle('dark', isDark);
    }
    function setTheme(t) {
        theme.value = t;
        localStorage.setItem('theme', t);
        applyTheme();
    }
    function setLocale(l) {
        locale.value = l;
        localStorage.setItem('locale', l);
    }
    function toggleSidebar() { sidebarOpen.value = !sidebarOpen.value; }
    function closeSidebar() { sidebarOpen.value = false; }
    // Listen for OS preference changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if (theme.value === 'system')
            applyTheme();
    });
    watch(theme, applyTheme, { immediate: true });
    return { theme, locale, sidebarOpen, setTheme, setLocale, toggleSidebar, closeSidebar };
});
