<script setup lang="ts">
import { redirectToDirectLogin } from '@/services/directOAuth'

const handleSignIn = () => {
  try {
    redirectToDirectLogin()
  } catch (error) {
    console.error(error)
    alert('Direct login is not configured. Please check OAuth env variables.')
  }
}
</script>
<template>
  <div>
    <button
      @click="handleSignIn"
      type="button"
      class="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
    >
      Sign In To Direct
    </button>
    <RouterView />
  </div>
</template>
