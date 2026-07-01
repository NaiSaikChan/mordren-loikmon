/// <reference types="../../node_modules/.vue-global-types/vue_3.5_0_0_0.d.ts" />
import { ref, reactive } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/stores/auth';
const { t } = useI18n();
const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();
const mode = ref('login');
const form = reactive({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
});
const errorMsg = ref('');
const successMsg = ref('');
async function handleSubmit() {
    errorMsg.value = '';
    successMsg.value = '';
    try {
        if (mode.value === 'login') {
            await authStore.login({ email: form.email, password: form.password });
            const redirect = route.query.redirect ?? '/';
            router.push(redirect);
        }
        else if (mode.value === 'register') {
            if (form.password !== form.confirmPassword) {
                errorMsg.value = 'Passwords do not match';
                return;
            }
            await authStore.register({
                name: form.name, email: form.email,
                password: form.password, password_confirmation: form.confirmPassword,
            });
            router.push('/');
        }
        else {
            successMsg.value = 'Password reset link sent to your email.';
        }
    }
    catch (err) {
        errorMsg.value = (typeof err === 'string' ? err : err?.message) ?? 'Unknown error';
    }
}
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-brand-50 to-indigo-100 dark:from-surface-950 dark:to-surface-900" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "w-full max-w-md" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "text-center mb-8" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-brand-600 text-white text-3xl mb-4 shadow-lg" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h1, __VLS_intrinsicElements.h1)({
    ...{ class: "text-2xl font-bold text-gray-900 dark:text-white" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
    ...{ class: "text-gray-500 dark:text-gray-400 text-sm mt-1" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "card p-8" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "flex gap-1 mb-6 p-1 bg-gray-100 dark:bg-surface-800 rounded-xl" },
});
for (const [m] of __VLS_getVForSourceType(['login', 'register'])) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.mode = m;
                __VLS_ctx.errorMsg = '';
            } },
        key: (m),
        ...{ class: (['flex-1 py-1.5 text-sm font-medium rounded-lg transition-all',
                __VLS_ctx.mode === m
                    ? 'bg-white dark:bg-surface-700 text-brand-700 dark:text-brand-300 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300']) },
    });
    (m === 'login' ? __VLS_ctx.t('auth.login') : __VLS_ctx.t('auth.register'));
}
if (__VLS_ctx.errorMsg) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "mb-4 px-4 py-3 rounded-lg bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300 text-sm" },
    });
    (__VLS_ctx.errorMsg);
}
if (__VLS_ctx.successMsg) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "mb-4 px-4 py-3 rounded-lg bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300 text-sm" },
    });
    (__VLS_ctx.successMsg);
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.form, __VLS_intrinsicElements.form)({
    ...{ onSubmit: (__VLS_ctx.handleSubmit) },
    ...{ class: "space-y-4" },
});
if (__VLS_ctx.mode === 'register') {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
        ...{ class: "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" },
    });
    (__VLS_ctx.t('auth.name'));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
        value: (__VLS_ctx.form.name),
        type: "text",
        ...{ class: "input" },
        required: true,
    });
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
    ...{ class: "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" },
});
(__VLS_ctx.t('auth.email'));
__VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
    type: "email",
    ...{ class: "input" },
    required: true,
});
(__VLS_ctx.form.email);
if (__VLS_ctx.mode !== 'forgot') {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
        ...{ class: "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" },
    });
    (__VLS_ctx.t('auth.password'));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
        type: "password",
        ...{ class: "input" },
        required: true,
    });
    (__VLS_ctx.form.password);
}
if (__VLS_ctx.mode === 'register') {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
        ...{ class: "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" },
    });
    (__VLS_ctx.t('auth.confirmPassword'));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
        type: "password",
        ...{ class: "input" },
        required: true,
    });
    (__VLS_ctx.form.confirmPassword);
}
if (__VLS_ctx.mode === 'login') {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "text-right" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.mode === 'login'))
                    return;
                __VLS_ctx.mode = 'forgot';
            } },
        type: "button",
        ...{ class: "text-sm text-brand-600 hover:text-brand-500 dark:text-brand-400" },
    });
    (__VLS_ctx.t('auth.forgotPassword'));
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    type: "submit",
    ...{ class: "btn-primary w-full justify-center py-2.5" },
    disabled: (__VLS_ctx.authStore.loading),
});
if (__VLS_ctx.authStore.loading) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    (__VLS_ctx.t('common.loading'));
}
else if (__VLS_ctx.mode === 'login') {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    (__VLS_ctx.t('auth.login'));
}
else if (__VLS_ctx.mode === 'register') {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    (__VLS_ctx.t('auth.register'));
}
else {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    (__VLS_ctx.t('auth.resetPassword'));
}
if (__VLS_ctx.mode === 'forgot') {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.mode === 'forgot'))
                    return;
                __VLS_ctx.mode = 'login';
            } },
        type: "button",
        ...{ class: "w-full text-center text-sm text-gray-500 hover:text-gray-700" },
    });
    (__VLS_ctx.t('auth.hasAccount'));
}
/** @type {__VLS_StyleScopedClasses['min-h-screen']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gradient-to-br']} */ ;
/** @type {__VLS_StyleScopedClasses['from-brand-50']} */ ;
/** @type {__VLS_StyleScopedClasses['to-indigo-100']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:from-surface-950']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:to-surface-900']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['max-w-md']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-8']} */ ;
/** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['w-16']} */ ;
/** @type {__VLS_StyleScopedClasses['h-16']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-brand-600']} */ ;
/** @type {__VLS_StyleScopedClasses['text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['text-3xl']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['text-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['p-8']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-6']} */ ;
/** @type {__VLS_StyleScopedClasses['p-1']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-100']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:bg-surface-800']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-3']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-red-50']} */ ;
/** @type {__VLS_StyleScopedClasses['text-red-700']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:bg-red-900/30']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:text-red-300']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-3']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-green-50']} */ ;
/** @type {__VLS_StyleScopedClasses['text-green-700']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:bg-green-900/30']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:text-green-300']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['space-y-4']} */ ;
/** @type {__VLS_StyleScopedClasses['block']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:text-gray-300']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
/** @type {__VLS_StyleScopedClasses['input']} */ ;
/** @type {__VLS_StyleScopedClasses['block']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:text-gray-300']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
/** @type {__VLS_StyleScopedClasses['input']} */ ;
/** @type {__VLS_StyleScopedClasses['block']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:text-gray-300']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
/** @type {__VLS_StyleScopedClasses['input']} */ ;
/** @type {__VLS_StyleScopedClasses['block']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:text-gray-300']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
/** @type {__VLS_StyleScopedClasses['input']} */ ;
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-brand-600']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:text-brand-500']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:text-brand-400']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2.5']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:text-gray-700']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            t: t,
            authStore: authStore,
            mode: mode,
            form: form,
            errorMsg: errorMsg,
            successMsg: successMsg,
            handleSubmit: handleSubmit,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
