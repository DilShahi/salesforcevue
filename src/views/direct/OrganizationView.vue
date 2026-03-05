<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { fetchDirectOrganizationList, type DirectOrganization } from '@/services/directOAuth'

const router = useRouter()
const isLoading = ref(false)
const errorMessage = ref('')
const organizations = ref<DirectOrganization[]>([])

const formatUnixDateTime = (value: number) => {
  if (!Number.isFinite(value)) return '-'
  const date = new Date(value * 1000)
  if (Number.isNaN(date.getTime())) return '-'

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}`
}

const openUsers = (domainId: string) => {
  router.push({ name: 'directUserList', params: { domainId } })
}

const loadOrganizations = async () => {
  isLoading.value = true
  errorMessage.value = ''
  try {
    organizations.value = await fetchDirectOrganizationList()
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : 'Failed to fetch Direct organizations.'
  } finally {
    isLoading.value = false
  }
}

onMounted(loadOrganizations)
</script>

<template>
  <section class="space-y-4">
    <div class="flex items-center justify-between">
      <h1 class="text-xl font-semibold text-slate-900">Organization List</h1>
      <button
        type="button"
        class="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
        @click="loadOrganizations"
      >
        Refresh
      </button>
    </div>

    <p v-if="isLoading" class="text-sm text-slate-600">Loading organizations...</p>
    <p v-else-if="errorMessage" class="text-sm text-rose-600">{{ errorMessage }}</p>

    <div v-else class="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table class="min-w-full divide-y divide-slate-200 text-sm">
        <thead class="bg-slate-50">
          <tr>
            <th class="px-4 py-2 text-left font-semibold text-slate-700">Domain ID</th>
            <th class="px-4 py-2 text-left font-semibold text-slate-700">Domain Name</th>
            <th class="px-4 py-2 text-left font-semibold text-slate-700">Role</th>
            <th class="px-4 py-2 text-left font-semibold text-slate-700">Updated At</th>
            <th class="px-4 py-2 text-left font-semibold text-slate-700">Action</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-200">
          <tr v-for="org in organizations" :key="org.domain_id_str">
            <td class="px-4 py-2 text-slate-800">{{ org.domain_id_str }}</td>
            <td class="px-4 py-2 text-slate-800">{{ org.domain_name }}</td>
            <td class="px-4 py-2 text-slate-700">{{ org.role?.name || '-' }}</td>
            <td class="px-4 py-2 text-slate-700">{{ formatUnixDateTime(org.updated_at) }}</td>
            <td class="px-4 py-2">
              <button
                type="button"
                class="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700"
                @click="openUsers(org.domain_id_str)"
              >
                View Users
              </button>
            </td>
          </tr>
          <tr v-if="organizations.length === 0">
            <td colspan="5" class="px-4 py-4 text-center text-slate-500">No organizations found.</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
