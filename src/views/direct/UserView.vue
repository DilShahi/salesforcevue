<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  fetchDirectOrganizationUserList,
  type DirectOrganizationUser,
} from '@/services/directOAuth'

const route = useRoute()
const router = useRouter()

const isLoading = ref(false)
const errorMessage = ref('')
const users = ref<DirectOrganizationUser[]>([])
const limit = ref(50)
const offset = ref(0)

const domainId = computed(() => String(route.params.domainId || ''))

const userName = (user: DirectOrganizationUser) => {
  return (
    (typeof user.display_name === 'string' && user.display_name) ||
    (typeof user.name === 'string' && user.name) ||
    '-'
  )
}

const formatLastUsed = (user: DirectOrganizationUser) => {
  if (typeof user.last_used_at_str === 'string' && user.last_used_at_str) {
    const date = new Date(user.last_used_at_str)
    if (!Number.isNaN(date.getTime())) {
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      const hours = String(date.getHours()).padStart(2, '0')
      const minutes = String(date.getMinutes()).padStart(2, '0')
      return `${year}-${month}-${day} ${hours}:${minutes}`
    }
    return user.last_used_at_str
  }
  return '-'
}

const userId = (user: DirectOrganizationUser) => {
  if (typeof user.user_id_str === 'string' && user.user_id_str) return user.user_id_str
  if (typeof user.user_id === 'number') return String(user.user_id)
  if (typeof user.user_id === 'string') return user.user_id
  return '-'
}

const loadUsers = async () => {
  if (!domainId.value) {
    errorMessage.value = 'Missing domain id.'
    return
  }

  isLoading.value = true
  errorMessage.value = ''
  try {
    users.value = await fetchDirectOrganizationUserList(domainId.value, {
      limit: limit.value,
      offset: offset.value,
    })
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : 'Failed to fetch organization users.'
  } finally {
    isLoading.value = false
  }
}

onMounted(loadUsers)
</script>

<template>
  <section class="space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="text-xl font-semibold text-slate-900">Organization Users</h1>
        <p class="text-sm text-slate-600">Domain ID: {{ domainId }}</p>
      </div>

      <div class="flex items-center gap-2">
        <button
          type="button"
          class="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
          @click="router.push({ name: 'directOrganization' })"
        >
          Back
        </button>
        <button
          type="button"
          class="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
          @click="loadUsers"
        >
          Refresh
        </button>
      </div>
    </div>

    <p v-if="isLoading" class="text-sm text-slate-600">Loading users...</p>
    <p v-else-if="errorMessage" class="text-sm text-rose-600">{{ errorMessage }}</p>

    <div v-else class="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table class="min-w-full divide-y divide-slate-200 text-sm">
        <thead class="bg-slate-50">
          <tr>
            <th class="px-4 py-2 text-left font-semibold text-slate-700">SN</th>
            <th class="px-4 py-2 text-left font-semibold text-slate-700">User ID</th>
            <th class="px-4 py-2 text-left font-semibold text-slate-700">Name</th>
            <th class="px-4 py-2 text-left font-semibold text-slate-700">Kana</th>
            <th class="px-4 py-2 text-left font-semibold text-slate-700">Email</th>
            <th class="px-4 py-2 text-left font-semibold text-slate-700">Role ID</th>
            <th class="px-4 py-2 text-left font-semibold text-slate-700">Last Used</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-200">
          <tr v-for="(user, index) in users" :key="`${userId(user)}-${index}`">
            <td class="px-4 py-2 text-slate-800">{{ index + 1 }}</td>
            <td class="px-4 py-2 text-slate-800">{{ userId(user) }}</td>
            <td class="px-4 py-2 text-slate-800">{{ userName(user) }}</td>
            <td class="px-4 py-2 text-slate-700">{{ user.kana || '-' }}</td>
            <td class="px-4 py-2 text-slate-700">{{ user.email || '-' }}</td>
            <td class="px-4 py-2 text-slate-700">{{ user.role_id ?? '-' }}</td>
            <td class="px-4 py-2 text-slate-700">{{ formatLastUsed(user) }}</td>
          </tr>
          <tr v-if="users.length === 0">
            <td colspan="6" class="px-4 py-4 text-center text-slate-500">No users found.</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
