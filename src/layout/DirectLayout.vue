<script setup lang="ts">
import {
  clearDirectSession,
  DIRECT_AUTH_CHANGED_EVENT,
  getDirectSession,
  redirectToDirectLogin,
} from '@/services/directOAuth'
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

const isDirectLoggedIn = ref(false)
const isMobileMenuOpen = ref(false)

const refreshDirectAuthState = () => {
  isDirectLoggedIn.value = Boolean(getDirectSession()?.accessToken)
}

const handleSignIn = () => {
  try {
    redirectToDirectLogin()
    isMobileMenuOpen.value = false
  } catch (error) {
    console.error(error)
    alert('Direct login is not configured. Please check OAuth env variables.')
  }
}

const handleLogout = async () => {
  await clearDirectSession()
  router.push({ name: 'directIndex' })
  isMobileMenuOpen.value = false
}

onMounted(() => {
  refreshDirectAuthState()
  window.addEventListener(DIRECT_AUTH_CHANGED_EVENT, refreshDirectAuthState)
  window.addEventListener('storage', refreshDirectAuthState)
})

onBeforeUnmount(() => {
  window.removeEventListener(DIRECT_AUTH_CHANGED_EVENT, refreshDirectAuthState)
  window.removeEventListener('storage', refreshDirectAuthState)
})
</script>
<template>
  <div class="min-h-screen bg-slate-50">
    <header class="border-b border-slate-200 bg-white">
      <nav class="mx-auto flex items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <div class="flex items-center gap-6">
          <RouterLink
            :to="{ name: 'directIndex' }"
            class="text-base font-semibold tracking-wide text-slate-900"
          >
            Direct
          </RouterLink>
          <RouterLink
            v-if="isDirectLoggedIn"
            :to="{ name: 'directOrganization' }"
            class="hidden text-sm font-medium text-slate-600 transition hover:text-slate-900 sm:block"
          >
            Organization
          </RouterLink>
          <RouterLink
            v-if="isDirectLoggedIn"
            :to="{ name: 'directTalkRoom' }"
            class="hidden text-sm font-medium text-slate-600 transition hover:text-slate-900 sm:block"
          >
            Talk Room
          </RouterLink>
        </div>

        <div class="hidden items-center sm:flex">
          <button
            v-if="!isDirectLoggedIn"
            @click="handleSignIn"
            type="button"
            class="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
          >
            Sign In
          </button>
          <button
            v-else
            @click="handleLogout"
            type="button"
            class="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
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
            v-if="isDirectLoggedIn"
            :to="{ name: 'directUserList' }"
            class="text-sm font-medium text-slate-700"
            @click="isMobileMenuOpen = false"
          >
            Users
          </RouterLink>
          <RouterLink
            v-if="isDirectLoggedIn"
            :to="{ name: 'directTalkRoom' }"
            class="text-sm font-medium text-slate-700"
            @click="isMobileMenuOpen = false"
          >
            Talk Room
          </RouterLink>

          <button
            v-if="!isDirectLoggedIn"
            @click="handleSignIn"
            type="button"
            class="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
          >
            Sign In To Direct
          </button>
          <button
            v-else
            @click="handleLogout"
            type="button"
            class="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
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
