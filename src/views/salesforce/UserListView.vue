<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  fetchSalesforceUsers,
  getSalesforceSession,
  type SalesforceUserRecord,
} from '@/services/salesforceAuth'

const users = ref<SalesforceUserRecord[]>([])
const isLoading = ref(false)
const errorMessage = ref('')
const isMitocoModalOpen = ref(false)
const selectedUser = ref<SalesforceUserRecord | null>(null)
const startDate = ref('')
const endDate = ref('')
const isEventsLoading = ref(false)
const eventsErrorMessage = ref('')
const router = useRouter()

const isAuthenticated = computed(() => Boolean(getSalesforceSession()?.accessToken))
const maxAllowedEndDate = computed(() => {
  if (!startDate.value) return ''
  const base = new Date(`${startDate.value}T00:00:00`)
  if (Number.isNaN(base.getTime())) return ''
  base.setMonth(base.getMonth() + 3)
  return base.toISOString().slice(0, 10)
})

const loadUsers = async () => {
  if (!isAuthenticated.value) {
    errorMessage.value = 'Please sign in to load Salesforce users.'
    return
  }

  isLoading.value = true
  errorMessage.value = ''

  try {
    users.value = await fetchSalesforceUsers()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Failed to load Salesforce users.'
  } finally {
    isLoading.value = false
  }
}

onMounted(loadUsers)

const openMitocoModal = (user: SalesforceUserRecord) => {
  selectedUser.value = user
  const today = new Date().toISOString().slice(0, 10)
  startDate.value = today
  endDate.value = today
  eventsErrorMessage.value = ''
  isMitocoModalOpen.value = true
}

const closeMitocoModal = () => {
  isMitocoModalOpen.value = false
}

const loadMitocoEvents = async () => {
  if (!selectedUser.value) {
    return
  }

  if (!startDate.value || !endDate.value) {
    eventsErrorMessage.value = 'Please select both start date and end date.'
    return
  }

  if (startDate.value > endDate.value) {
    eventsErrorMessage.value = 'Start date cannot be later than end date.'
    return
  }

  if (maxAllowedEndDate.value && endDate.value > maxAllowedEndDate.value) {
    eventsErrorMessage.value = 'Date range must be within 3 months.'
    return
  }

  isEventsLoading.value = true
  eventsErrorMessage.value = ''

  try {
    await router.push({
      name: 'salesforceUserEvent',
      params: { userId: selectedUser.value.Id },
      query: {
        startDate: startDate.value,
        endDate: endDate.value,
        userName: selectedUser.value.Name,
      },
    })
    isMitocoModalOpen.value = false
  } catch (error) {
    eventsErrorMessage.value =
      error instanceof Error ? error.message : 'Failed to open events page.'
  } finally {
    isEventsLoading.value = false
  }
}
</script>

<template>
  <section class="space-y-4">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-semibold text-slate-900">Salesforce Users</h1>
      <button
        type="button"
        class="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
        @click="loadUsers"
      >
        Refresh
      </button>
    </div>

    <p v-if="isLoading" class="text-sm text-slate-600">Loading users...</p>
    <p v-else-if="errorMessage" class="text-sm text-rose-600">{{ errorMessage }}</p>

    <div v-else class="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table class="min-w-full divide-y divide-slate-200 text-sm">
        <thead class="bg-slate-50">
          <tr>
            <th class="px-4 py-3 text-left font-semibold text-slate-700">SN</th>
            <th class="px-4 py-3 text-left font-semibold text-slate-700">Name</th>
            <th class="px-4 py-3 text-left font-semibold text-slate-700">Email</th>
            <th class="px-4 py-3 text-left font-semibold text-slate-700">Username</th>
            <th class="px-4 py-3 text-left font-semibold text-slate-700">Profile</th>
            <th class="px-4 py-3 text-left font-semibold text-slate-700">Status</th>
            <th class="px-4 py-3 text-left font-semibold text-slate-700">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-200">
          <tr v-for="(user, index) in users" :key="user.Id" class="hover:bg-slate-50">
            <td class="px-4 py-3 text-slate-900">{{ index + 1 }}</td>
            <td class="px-4 py-3 text-slate-900">{{ user.Name }}</td>
            <td class="px-4 py-3 text-slate-700">{{ user.Email || '-' }}</td>
            <td class="px-4 py-3 text-slate-700">{{ user.Username }}</td>
            <td class="px-4 py-3 text-slate-700">{{ user.Profile?.Name || '-' }}</td>
            <td class="px-4 py-3">
              <span
                class="rounded-full px-2 py-1 text-xs font-semibold"
                :class="
                  user.IsActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700'
                "
              >
                {{ user.IsActive ? 'Active' : 'Inactive' }}
              </span>
            </td>
            <td class="px-4 py-3">
              <button
                type="button"
                class="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-900 hover:bg-slate-900 hover:text-white"
                @click="openMitocoModal(user)"
              >
                Mitoco
              </button>
            </td>
          </tr>
          <tr v-if="users.length === 0">
            <td colspan="7" class="px-4 py-6 text-center text-slate-600">No users found.</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="isMitocoModalOpen" class="fixed inset-0 z-50 flex items-center justify-center">
      <div class="absolute inset-0 bg-slate-900/40" @click="closeMitocoModal" />
      <div class="relative z-10 w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h2 class="text-lg font-semibold text-slate-900">Mitoco Events Filter</h2>
        <p class="mt-1 text-sm text-slate-600">
          User:
          <span class="font-medium text-slate-800">{{ selectedUser?.Name }}</span>
        </p>

        <form class="mt-4 space-y-4" @submit.prevent="loadMitocoEvents">
          <div>
            <label for="startDate" class="mb-1 block text-sm font-medium text-slate-700"
              >Start Date</label
            >
            <input
              id="startDate"
              v-model="startDate"
              type="date"
              class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-slate-900 focus:outline-none"
            />
          </div>

          <div>
            <label for="endDate" class="mb-1 block text-sm font-medium text-slate-700"
              >End Date</label
            >
            <input
              id="endDate"
              v-model="endDate"
              type="date"
              :min="startDate"
              :max="maxAllowedEndDate || undefined"
              class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-slate-900 focus:outline-none"
            />
          </div>

          <p v-if="eventsErrorMessage" class="text-sm text-rose-600">{{ eventsErrorMessage }}</p>

          <div class="flex justify-end gap-2">
            <button
              type="button"
              class="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              @click="closeMitocoModal"
            >
              Cancel
            </button>
            <button
              type="submit"
              class="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
              :disabled="isEventsLoading"
            >
              {{ isEventsLoading ? 'Loading...' : 'Submit' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </section>
</template>
