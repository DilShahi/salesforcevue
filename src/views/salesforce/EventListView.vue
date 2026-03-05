<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  fetchMitocoEventsByUserAndDateRange,
  toSummaryEventPayload,
  type SalesforceMitocoEventRecord,
} from '@/services/salesforceAuth'

const route = useRoute()
const router = useRouter()
const events = ref<SalesforceMitocoEventRecord[]>([])
const isLoading = ref(false)
const errorMessage = ref('')

const userId = computed(() => String(route.params.userId || ''))
const startDate = computed(() => String(route.query.startDate || ''))
const endDate = computed(() => String(route.query.endDate || ''))
const userName = computed(() => String(route.query.userName || 'Selected User'))
const summaryPayloadKey = 'users_event_summary_payload'

const formatDateTime = (value: string | null) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}`
}

const loadEvents = async () => {
  if (!userId.value || !startDate.value || !endDate.value) {
    errorMessage.value = 'Missing user or date range. Please select from User List again.'
    return
  }

  isLoading.value = true
  errorMessage.value = ''

  try {
    events.value = await fetchMitocoEventsByUserAndDateRange(
      userId.value,
      startDate.value,
      endDate.value,
    )
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Failed to load Mitoco events.'
  } finally {
    isLoading.value = false
  }
}

onMounted(loadEvents)

const goToSummary = async () => {
  if (!userId.value) {
    errorMessage.value = 'Missing user id for summary.'
    return
  }

  if (events.value.length === 0) {
    errorMessage.value = 'No events available to summarize.'
    return
  }

  window.sessionStorage.setItem(
    summaryPayloadKey,
    JSON.stringify({
      userId: userId.value,
      userName: userName.value,
      startDate: startDate.value,
      endDate: endDate.value,
      events: toSummaryEventPayload(events.value),
    }),
  )

  await router.push({
    name: 'salesforceUserEventSummary',
    params: { userId: userId.value },
    query: {
      userName: userName.value,
      startDate: startDate.value,
      endDate: endDate.value,
    },
  })
}
</script>

<template>
  <section class="space-y-4">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-semibold text-slate-900">Mitoco Events</h1>
        <p class="text-sm text-slate-600">
          User: {{ userName }} | {{ startDate }} to {{ endDate }}
        </p>
      </div>
      <div class="flex items-center gap-2">
        <button
          type="button"
          class="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          @click="router.push({ name: 'users' })"
        >
          Back to Users
        </button>
        <button
          type="button"
          class="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
          @click="loadEvents"
        >
          Refresh
        </button>
      </div>
    </div>

    <p v-if="isLoading" class="text-sm text-slate-600">Loading events...</p>
    <p v-else-if="errorMessage" class="text-sm text-rose-600">{{ errorMessage }}</p>

    <div v-else class="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table class="min-w-full divide-y divide-slate-200 text-sm">
        <thead class="bg-slate-50">
          <tr>
            <th class="px-4 py-3 text-left font-semibold text-slate-700">SN</th>
            <th class="px-4 py-3 text-left font-semibold text-slate-700">Subject</th>
            <th class="px-4 py-3 text-left font-semibold text-slate-700">Date</th>
            <th class="px-4 py-3 text-left font-semibold text-slate-700">Start</th>
            <th class="px-4 py-3 text-left font-semibold text-slate-700">End</th>
            <th class="px-4 py-3 text-left font-semibold text-slate-700">Location</th>
            <th class="px-4 py-3 text-left font-semibold text-slate-700">Owner</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-200">
          <tr v-for="(event, index) in events" :key="event.Id" class="hover:bg-slate-50">
            <td class="px-4 py-3 text-slate-900">{{ index + 1 }}</td>
            <td class="px-4 py-3 text-slate-900">{{ event.Subject }}</td>
            <td class="px-4 py-3 text-slate-700">{{ event.ActivityDate || '-' }}</td>
            <td class="px-4 py-3 text-slate-700">{{ formatDateTime(event.StartDateTime) }}</td>
            <td class="px-4 py-3 text-slate-700">{{ formatDateTime(event.EndDateTime) }}</td>
            <td class="px-4 py-3 text-slate-700">
              <span class="block max-w-56 truncate" :title="event.Location || '-'">
                {{ event.Location || '-' }}
              </span>
            </td>
            <td class="px-4 py-3 text-slate-700 text-nowrap">{{ event.Owner?.Name || '-' }}</td>
          </tr>
          <tr v-if="events.length === 0">
            <td colspan="6" class="px-4 py-6 text-center text-slate-600">
              No Mitoco events found for the selected range.
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>

  <button
    type="button"
    class="fixed bottom-6 right-6 z-40 rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400"
    @click="goToSummary"
  >
    SUMMARIZE
  </button>
</template>
