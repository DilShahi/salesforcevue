<script setup lang="ts">
import { handleDirectForceOAuthCallback } from '@/services/directOAuth'
import { onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'

onMounted(async () => {
  const route = useRoute()
  const router = useRouter()

  const code = String(route.query.code || '')
  const state = String(route.query.state || '')
  const expected = sessionStorage.getItem('direct_oauth_state')
  if (!code || !state || !expected || state !== expected) {
    console.error('Invalid OAuth state')
    await router.replace({ name: 'directLayout' })
    return
  }
  try {
    await handleDirectForceOAuthCallback(code, state)
    router.push({ name: 'directTalkRoom' })
  } catch (error) {
    console.error('Salesforce OAuth callback processing failed:', error)
  }
})
</script>
<template>
  <div class="py-10 text-center text-sm text-slate-600">Completing direct sign in...</div>
</template>
