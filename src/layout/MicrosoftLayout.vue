<script setup lang="ts">
import {
  clearMicrosoftSession,
  getMicrosoftSession,
  redirectToMicrosoftLogin,
  DIRECT_AUTH_CHANGED_EVENT as MICROSOFT_AUTH_CHANGED_EVENT,
} from '@/services/microsoftOAuth'
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

const isMobileMenuOpen = ref(false)
const isAuthenticated = ref(false)

const refreshSession = () => {
  isAuthenticated.value = Boolean(getMicrosoftSession()?.accessToken)
}

const handleSignIn = () => {
  try {
    redirectToMicrosoftLogin()
    isMobileMenuOpen.value = false
  } catch (error) {
    console.error(error)
    alert('Microsoft login is not configured. Please check OAuth env variables.')
  }
}

const handleSignOut = () => {
  clearMicrosoftSession()
  isMobileMenuOpen.value = false
  router.push({ name: 'microsoftIndex' })
}

onMounted(() => {
  refreshSession()
  window.addEventListener(MICROSOFT_AUTH_CHANGED_EVENT, refreshSession)
  window.addEventListener('storage', refreshSession)
})

onBeforeUnmount(() => {
  window.removeEventListener(MICROSOFT_AUTH_CHANGED_EVENT, refreshSession)
  window.removeEventListener('storage', refreshSession)
})
</script>

<template>
  <div class="min-h-screen bg-slate-50">
    <header class="border-b border-slate-200 bg-white">
      <nav class="mx-auto flex items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <div class="flex items-center gap-6">
          <RouterLink
            :to="{ name: 'microsoftIndex' }"
            class="text-base font-semibold tracking-wide text-slate-900"
          >
            Microsoft
          </RouterLink>
          <RouterLink
            :to="{ name: 'microsoftIndex' }"
            class="hidden text-sm font-medium text-slate-600 transition hover:text-slate-900 sm:block"
          >
            Dashboard
          </RouterLink>
        </div>

        <div class="hidden items-center sm:flex">
          <button
            v-if="!isAuthenticated"
            type="button"
            class="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
            @click="handleSignIn"
          >
            Sign In
          </button>
          <button
            v-else
            type="button"
            class="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
            @click="handleSignOut"
          >
            Logout
          </button>
        </div>

        <button
          type="button"
          class="inline-flex items-center rounded-md border border-slate-300 p-2 text-slate-700 sm:hidden"
          :aria-expanded="isMobileMenuOpen"
          aria-label="Toggle navigation"
          @click="isMobileMenuOpen = !isMobileMenuOpen"
        >
          <svg
            v-if="!isMobileMenuOpen"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            class="h-5 w-5"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
          <svg
            v-else
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            class="h-5 w-5"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 6l12 12M18 6l-12 12"
            />
          </svg>
        </button>
      </nav>

      <div v-if="isMobileMenuOpen" class="border-t border-slate-200 px-4 py-3 sm:hidden">
        <div class="flex flex-col gap-3">
          <RouterLink
            :to="{ name: 'microsoftIndex' }"
            class="text-sm font-medium text-slate-700"
            @click="isMobileMenuOpen = false"
          >
            Dashboard
          </RouterLink>

          <button
            v-if="!isAuthenticated"
            type="button"
            class="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
            @click="handleSignIn"
          >
            Sign In
          </button>
          <button
            v-else
            type="button"
            class="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
            @click="handleSignOut"
          >
            Logout
          </button>
        </div>
      </div>
    </header>

    <main class="mx-auto px-4 py-6 sm:px-6 lg:px-8">
      <RouterView />
    </main>
  </div>
</template>
