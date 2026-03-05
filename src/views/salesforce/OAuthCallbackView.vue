<script setup lang="ts">
import { handleSalesforceOAuthCallback } from '@/services/salesforceAuth'
import { onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'

onMounted(async () => {
  const route = useRoute()
  const router = useRouter()

  const code = String(route.query.code || '')
  const state = String(route.query.state || '')
  try {
    await handleSalesforceOAuthCallback(code, state)
    router.push({ name: 'salesforceIndex' })
  } catch (error) {
    console.error('Salesforce OAuth callback processing failed.', error)
  }
})
</script>
<template>
  <div class="py-10 text-center text-sm text-slate-600">Completing Salesforce sign in...</div>
</template>
