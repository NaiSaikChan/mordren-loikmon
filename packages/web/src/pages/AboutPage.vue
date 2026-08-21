<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import AboutFeatureCard from '@/components/about/AboutFeatureCard.vue'
import AboutPolicyCard from '@/components/about/AboutPolicyCard.vue'
import AboutStatCard from '@/components/about/AboutStatCard.vue'

const { t } = useI18n()

const stats = [
  {
    value: '100%',
    label: 'Author ownership',
    description: 'Creators keep full control of their ebooks, articles, audio, pricing, and publication settings.',
  },
  {
    value: 'Web + Android',
    label: 'Accessible anywhere',
    description: 'LoikMon is available through modern web and Android apps for readers around the world.',
  },
  {
    value: 'PDF · EPUB · Audio',
    label: 'Multiple formats',
    description: 'The platform supports flexible digital reading and listening experiences, including offline access.',
  },
]

const features = [
  {
    icon: '📚',
    title: 'Digital publishing marketplace',
    description: 'A direct bridge where Mon authors can publish and sell ebooks, articles, and literary works to readers globally.',
  },
  {
    icon: '✍️',
    title: 'Independent author tools',
    description: 'Writers can upload, manage, price, and publish their own content through a personal admin dashboard.',
  },
  {
    icon: '🎧',
    title: 'Reading and listening options',
    description: 'Readers can enjoy Mon works as text, audio, PDFs, and EPUB books with modern digital access.',
  },
  {
    icon: '🛡️',
    title: 'Clear platform boundaries',
    description: 'LoikMon hosts and distributes content but does not claim ownership or modify works without author approval.',
  },
  {
    icon: '💳',
    title: 'Sustainable creator economy',
    description: 'A small commission supports hosting, development, security, support, marketing, and cultural initiatives.',
  },
  {
    icon: '🌏',
    title: 'Global Mon audience',
    description: 'The long-term mission is to empower writers, encourage literacy, and preserve Mon identity through technology.',
  },
]

const policyCards = [
  {
    icon: '📜',
    title: 'Terms & Conditions',
    description: 'A transparent framework for readers, authors, payments, platform availability, and fair use.',
    href: 'https://loikmon.org/webapis/terms',
    points: [
      'Authors retain 100% ownership of their content.',
      'Readers use accessed or purchased works for personal use only.',
      'LoikMon collects a small commission to support platform operations.',
    ],
  },
  {
    icon: '🔐',
    title: 'Privacy Policy',
    description: 'A privacy-first summary of how LoikMon collects, uses, protects, and handles platform information.',
    href: 'https://loikmon.org/webapis/privacy',
    points: [
      'LoikMon does not sell, rent, or trade personal user data.',
      'Payment details are handled by trusted third-party payment providers.',
      'Users can access, update, clarify, or request deletion of account data.',
    ],
  },
]
</script>

<template>
  <div class="page-wrapper max-w-6xl">
    <section class="relative overflow-hidden rounded-4xl border border-brand-100 bg-linear-to-br from-brand-50 via-white to-sky-50 p-6 shadow-sm dark:border-brand-900/50 dark:from-brand-950/50 dark:via-surface-900 dark:to-surface-950 sm:p-8 lg:p-10">
      <div class="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-brand-300/20 blur-3xl dark:bg-brand-700/20" />
      <div class="absolute -bottom-24 left-1/4 h-56 w-56 rounded-full bg-sky-300/20 blur-3xl dark:bg-sky-800/20" />

      <div class="relative grid gap-8 lg:grid-cols-3 lg:items-center">
        <div class="lg:col-span-2">
          <p class="mb-4 inline-flex items-center gap-2 rounded-full bg-white/75 px-3 py-1 text-xs font-bold uppercase tracking-wide text-brand-600 shadow-sm ring-1 ring-brand-100 dark:bg-surface-900/70 dark:text-brand-300 dark:ring-brand-800">
            🌿 Cultural technology platform
          </p>
          <h1 class="max-w-3xl text-3xl font-black tracking-tight text-gray-950 dark:text-white sm:text-5xl">
            LoikMon Mon Digital Library
          </h1>
          <p class="mt-5 max-w-3xl text-sm leading-8 text-gray-600 dark:text-gray-300 sm:text-base">
            LoikMon is a small cultural association dedicated to promoting Mon-language literature, culture, and creative works in the digital era. It connects Mon authors with readers around the world while preserving Mon identity through modern publishing technology.
          </p>

          <div class="mt-6 flex flex-wrap gap-3">
            <RouterLink to="/books" class="btn-primary rounded-2xl px-5 py-3">
              📚 Explore books
            </RouterLink>
            <RouterLink to="/authors" class="btn-secondary rounded-2xl px-5 py-3">
              ✍️ Discover authors
            </RouterLink>
            <a
              href="mailto:loikmon2026@gmail.com"
              class="btn-ghost rounded-2xl px-5 py-3"
            >
              ✉️ Contact us
            </a>
          </div>
        </div>

        <div class="rounded-4xl border border-white/70 bg-white/80 p-5 shadow-xl shadow-brand-200/40 backdrop-blur dark:border-white/10 dark:bg-surface-900/75 dark:shadow-black/20">
          <div class="flex h-20 w-20 items-center justify-center rounded-3xl bg-linear-to-br from-brand-600 to-sky-500 text-4xl shadow-lg shadow-brand-500/30">
            📚
          </div>
          <h2 class="mt-5 text-xl font-black text-gray-950 dark:text-white">Preserving Mon heritage</h2>
          <p class="mt-3 text-sm leading-relaxed text-gray-500 dark:text-gray-400">
            A digital bridge between creators and readers—supporting publishing, discovery, reading, listening, and cultural continuity.
          </p>
          <div class="mt-5 rounded-3xl bg-brand-50 p-4 text-sm font-semibold text-brand-700 dark:bg-brand-900/30 dark:text-brand-200">
            Founder-led by Sorn Rott Chan with a small editorial, technical, and operational team.
          </div>
        </div>
      </div>
    </section>

    <section class="mt-6 grid gap-4 md:grid-cols-3">
      <AboutStatCard
        v-for="stat in stats"
        :key="stat.label"
        :value="stat.value"
        :label="stat.label"
        :description="stat.description"
      />
    </section>

    <section class="mt-10 grid gap-6 xl:grid-cols-5 xl:items-start">
      <div class="rounded-4xl border border-gray-100 bg-white p-6 shadow-sm shadow-gray-200/60 dark:border-gray-800 dark:bg-surface-900 dark:shadow-black/20 sm:p-8 xl:col-span-2">
        <p class="text-xs font-bold uppercase tracking-wider text-brand-600 dark:text-brand-300">About us</p>
        <h2 class="mt-2 text-2xl font-black text-gray-950 dark:text-white">A sustainable digital ecosystem for Mon literature</h2>
        <div class="mt-5 space-y-4 text-sm leading-8 text-gray-600 dark:text-gray-300">
          <p>
            The LoikMon Platform serves as a digital bridge where Mon authors can publish and sell ebooks, articles, and other literary works directly. Alongside independent authors, LoikMon also publishes original cultural, educational, and community-focused content.
          </p>
          <p>
            LoikMon is currently in its foundational stage as an informal association, operating without external investors or government registration. Even in this early stage, the platform already supports Android and web access so Mon literature can be reached anytime and anywhere.
          </p>
          <p>
            In the long term, LoikMon aims to empower Mon writers, encourage reading and digital literacy, and preserve the Mon language through accessible modern tools.
          </p>
        </div>
      </div>

      <div class="grid gap-4 sm:grid-cols-2 xl:col-span-3">
        <AboutFeatureCard
          v-for="feature in features"
          :key="feature.title"
          :icon="feature.icon"
          :title="feature.title"
          :description="feature.description"
        />
      </div>
    </section>

    <section class="mt-10 rounded-4xl border border-gray-100 bg-white p-6 shadow-sm shadow-gray-200/60 dark:border-gray-800 dark:bg-surface-900 dark:shadow-black/20 sm:p-8">
      <div class="grid gap-8 lg:grid-cols-2 lg:items-center">
        <div>
          <p class="text-xs font-bold uppercase tracking-wider text-brand-600 dark:text-brand-300">Trust & ownership</p>
          <h2 class="mt-2 text-2xl font-black text-gray-950 dark:text-white">Built with respect for creators and readers</h2>
          <p class="mt-4 text-sm leading-8 text-gray-600 dark:text-gray-300">
            Each participating writer is an independent content owner. LoikMon provides secure hosting, content management, payment systems, analytics, and reader support while clearly defining its role as a platform—not a traditional publisher.
          </p>
        </div>
        <div class="grid gap-3 sm:grid-cols-2">
          <div class="rounded-3xl bg-gray-50 p-5 dark:bg-surface-800">
            <div class="text-2xl">🤝</div>
            <h3 class="mt-3 font-bold text-gray-950 dark:text-white">Fair creator model</h3>
            <p class="mt-2 text-sm leading-relaxed text-gray-500 dark:text-gray-400">Authors keep ownership and receive fair revenue shares while gaining access to a global Mon audience.</p>
          </div>
          <div class="rounded-3xl bg-gray-50 p-5 dark:bg-surface-800">
            <div class="text-2xl">🧭</div>
            <h3 class="mt-3 font-bold text-gray-950 dark:text-white">Transparent platform role</h3>
            <p class="mt-2 text-sm leading-relaxed text-gray-500 dark:text-gray-400">LoikMon hosts, displays, distributes, and promotes works within the platform with clear consent boundaries.</p>
          </div>
        </div>
      </div>
    </section>

    <section class="mt-10">
      <div class="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p class="text-xs font-bold uppercase tracking-wider text-brand-600 dark:text-brand-300">Policies</p>
          <h2 class="mt-2 text-2xl font-black text-gray-950 dark:text-white">Simple, clear, and transparent</h2>
        </div>
        <p class="max-w-xl text-sm leading-7 text-gray-500 dark:text-gray-400 lg:text-right">
          Summaries below are based on LoikMon’s official Terms & Conditions and Privacy Policy. Use the links for the full current documents.
        </p>
      </div>

      <div class="grid gap-4 md:grid-cols-2">
        <AboutPolicyCard
          v-for="policy in policyCards"
          :key="policy.title"
          :icon="policy.icon"
          :title="policy.title"
          :description="policy.description"
          :points="policy.points"
          :href="policy.href"
          action-label="Read full policy"
        />
      </div>
    </section>

    <section class="mt-10 overflow-hidden rounded-4xl bg-linear-to-br from-gray-950 via-brand-950 to-sky-950 p-6 text-white shadow-xl shadow-gray-300/30 dark:shadow-black/30 sm:p-8">
      <div class="grid gap-6 lg:grid-cols-2 lg:items-center">
        <div>
          <p class="text-xs font-bold uppercase tracking-wider text-white/60">Contact details</p>
          <h2 class="mt-2 text-2xl font-black">Let’s keep Mon literature thriving</h2>
          <p class="mt-3 max-w-2xl text-sm leading-8 text-white/70">
            Questions, author onboarding, support requests, and policy clarifications can be sent to the LoikMon platform administration team.
          </p>
        </div>
        <div class="flex flex-col gap-3 sm:flex-row lg:justify-end">
          <a href="mailto:info@loikmon.org" class="inline-flex min-w-64 items-center justify-center whitespace-nowrap rounded-2xl bg-white px-6 py-3 text-center text-sm font-bold text-brand-700 shadow-lg shadow-black/10 transition-colors hover:bg-brand-50">
            ✉️ info@loikmon.org
          </a>
          <a href="tel:+66955070956" class="inline-flex min-w-56 items-center justify-center whitespace-nowrap rounded-2xl bg-brand-500 px-6 py-3 text-center text-sm font-bold text-white shadow-lg shadow-brand-950/20 ring-1 ring-white/20 transition-colors hover:bg-brand-400">
            ☎️ +66 955070956
          </a>
        </div>
      </div>
    </section>

    <p class="py-8 text-center text-xs text-gray-400">
      🌐
      <a href="https://loikmon.org" target="_blank" rel="noopener noreferrer" class="font-semibold text-brand-500 hover:underline">
        loikmon.org
      </a>
      · Mon Digital Library — Preserving Mon Heritage
    </p>
  </div>
</template>
