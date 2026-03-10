<script setup lang="ts">
import { handleMicrosoftOAuthCallback } from '@/services/microsoftOAuth'
import { onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'

onMounted(async () => {
  const route = useRoute()
  const router = useRouter()

  const code = String(route.query.code || '')
  const state = String(route.query.state || '')
  try {
    await handleMicrosoftOAuthCallback(code, state)
    router.push({ name: 'microsoftIndex' })
  } catch (error) {
    console.error('Salesforce OAuth callback processing failed.', error)
    router.push({ name: 'microsoftIndex' })
  }
})
</script>
<template>
  <div class="py-10 text-center text-sm text-slate-600">Completing microsoft sign in...</div>
</template>
