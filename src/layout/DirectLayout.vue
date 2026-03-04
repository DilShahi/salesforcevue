<script setup lang="ts">
import {
  clearDirectSession,
  DIRECT_AUTH_CHANGED_EVENT,
  getDirectSession,
  redirectToDirectLogin,
} from '@/services/directOAuth'
import { onBeforeUnmount, onMounted, ref } from 'vue'

const isDirectLoggedIn = ref(false)

const refreshDirectAuthState = () => {
  isDirectLoggedIn.value = Boolean(getDirectSession()?.accessToken)
}

const handleSignIn = () => {
  try {
    redirectToDirectLogin()
  } catch (error) {
    console.error(error)
    alert('Direct login is not configured. Please check OAuth env variables.')
  }
}

const handleLogout = () => {
  clearDirectSession()
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
  <div>
    <button
      v-if="!isDirectLoggedIn"
      @click="handleSignIn"
      type="button"
      class="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
    >
      Sign In To Direct
    </button>
    <button
      v-else
      @click="handleLogout"
      type="button"
      class="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
    >
      Logout
    </button>
    <RouterView />
  </div>
</template>
