/// <reference types="../../../node_modules/.vue-global-types/vue_3.5_0_0_0.d.ts" />
import { onMounted } from 'vue';
import { RouterView } from 'vue-router';
import AppSidebar from './AppSidebar.vue';
import AppTopBar from './AppTopBar.vue';
import AudioPlayer from '@/components/media/AudioPlayer.vue';
import { useAuthStore } from '@/stores/auth';
import { useUiStore } from '@/stores/ui';
const authStore = useAuthStore();
const uiStore = useUiStore();
onMounted(() => {
    authStore.restore();
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "flex h-full bg-surface-50 dark:bg-surface-950" },
});
/** @type {[typeof AppSidebar, ]} */ ;
// @ts-ignore
const __VLS_0 = __VLS_asFunctionalComponent(AppSidebar, new AppSidebar({}));
const __VLS_1 = __VLS_0({}, ...__VLS_functionalComponentArgsRest(__VLS_0));
const __VLS_3 = {}.Transition;
/** @type {[typeof __VLS_components.Transition, typeof __VLS_components.Transition, ]} */ ;
// @ts-ignore
const __VLS_4 = __VLS_asFunctionalComponent(__VLS_3, new __VLS_3({
    name: "fade",
}));
const __VLS_5 = __VLS_4({
    name: "fade",
}, ...__VLS_functionalComponentArgsRest(__VLS_4));
__VLS_6.slots.default;
if (__VLS_ctx.uiStore.sidebarOpen) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.uiStore.sidebarOpen))
                    return;
                __VLS_ctx.uiStore.closeSidebar();
            } },
        ...{ class: "fixed inset-0 z-20 bg-black/50 lg:hidden" },
    });
}
var __VLS_6;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "flex flex-col flex-1 min-w-0 overflow-hidden" },
});
/** @type {[typeof AppTopBar, ]} */ ;
// @ts-ignore
const __VLS_7 = __VLS_asFunctionalComponent(AppTopBar, new AppTopBar({}));
const __VLS_8 = __VLS_7({}, ...__VLS_functionalComponentArgsRest(__VLS_7));
__VLS_asFunctionalElement(__VLS_intrinsicElements.main, __VLS_intrinsicElements.main)({
    ...{ class: "flex-1 overflow-y-auto" },
});
const __VLS_10 = {}.RouterView;
/** @type {[typeof __VLS_components.RouterView, typeof __VLS_components.RouterView, ]} */ ;
// @ts-ignore
const __VLS_11 = __VLS_asFunctionalComponent(__VLS_10, new __VLS_10({}));
const __VLS_12 = __VLS_11({}, ...__VLS_functionalComponentArgsRest(__VLS_11));
{
    const { default: __VLS_thisSlot } = __VLS_13.slots;
    const [{ Component }] = __VLS_getSlotParams(__VLS_thisSlot);
    const __VLS_14 = {}.Transition;
    /** @type {[typeof __VLS_components.Transition, typeof __VLS_components.Transition, ]} */ ;
    // @ts-ignore
    const __VLS_15 = __VLS_asFunctionalComponent(__VLS_14, new __VLS_14({
        name: "page",
        mode: "out-in",
    }));
    const __VLS_16 = __VLS_15({
        name: "page",
        mode: "out-in",
    }, ...__VLS_functionalComponentArgsRest(__VLS_15));
    __VLS_17.slots.default;
    const __VLS_18 = ((Component));
    // @ts-ignore
    const __VLS_19 = __VLS_asFunctionalComponent(__VLS_18, new __VLS_18({}));
    const __VLS_20 = __VLS_19({}, ...__VLS_functionalComponentArgsRest(__VLS_19));
    var __VLS_17;
    __VLS_13.slots['' /* empty slot name completion */];
}
var __VLS_13;
/** @type {[typeof AudioPlayer, ]} */ ;
// @ts-ignore
const __VLS_22 = __VLS_asFunctionalComponent(AudioPlayer, new AudioPlayer({}));
const __VLS_23 = __VLS_22({}, ...__VLS_functionalComponentArgsRest(__VLS_22));
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['h-full']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-surface-50']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:bg-surface-950']} */ ;
/** @type {__VLS_StyleScopedClasses['fixed']} */ ;
/** @type {__VLS_StyleScopedClasses['inset-0']} */ ;
/** @type {__VLS_StyleScopedClasses['z-20']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-black/50']} */ ;
/** @type {__VLS_StyleScopedClasses['lg:hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-y-auto']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            RouterView: RouterView,
            AppSidebar: AppSidebar,
            AppTopBar: AppTopBar,
            AudioPlayer: AudioPlayer,
            uiStore: uiStore,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
