<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Chart, type ChartConfiguration, registerables } from 'chart.js'
import {
  fetchEventSummary,
  type EventSummaryCategoryDetail,
  type SummaryEventPayload,
} from '@/services/salesforceAuth'

Chart.register(...registerables)

const route = useRoute()
const router = useRouter()
const summaryPayloadKey = 'users_event_summary_payload'

const isLoading = ref(false)
const errorMessage = ref('')
const summaryText = ref('')
const chartLabels = ref<string[]>([])
const chartCounts = ref<number[]>([])
const categoryDetails = ref<EventSummaryCategoryDetail[]>([])
const openCategoryName = ref<string | null>(null)
const userName = ref(String(route.query.userName || 'Selected User'))
const startDate = ref(String(route.query.startDate || ''))
const endDate = ref(String(route.query.endDate || ''))
const chartCanvas = ref<HTMLCanvasElement | null>(null)
let chartInstance: Chart<'bar'> | null = null

const toggleCategory = (name: string) => {
  openCategoryName.value = openCategoryName.value === name ? null : name
}

const formatDateTime = (value: string) => {
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

const renderChart = () => {
  if (!chartCanvas.value) return
  if (chartInstance) {
    chartInstance.destroy()
    chartInstance = null
  }

  if (chartLabels.value.length === 0) {
    return
  }

  const config: ChartConfiguration<'bar'> = {
    type: 'bar',
    data: {
      labels: chartLabels.value,
      datasets: [
        {
          label: 'Events Count',
          data: chartCounts.value,
          backgroundColor: '#0f172a',
          borderRadius: 6,
          maxBarThickness: 48,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            precision: 0,
          },
        },
      },
    },
  }

  chartInstance = new Chart(chartCanvas.value, config)
}

const loadSummary = async () => {
  const userId = String(route.params.userId || '')
  if (!userId) {
    errorMessage.value = 'Missing user id.'
    return
  }

  const rawPayload = window.sessionStorage.getItem(summaryPayloadKey)
  if (!rawPayload) {
    errorMessage.value = 'No events payload found. Please go back and submit summary again.'
    return
  }

  let events: SummaryEventPayload[] = []
  try {
    const parsed = JSON.parse(rawPayload) as {
      userId?: string
      userName?: string
      startDate?: string
      endDate?: string
      events?: SummaryEventPayload[]
    }
    if (parsed.userId !== userId) {
      errorMessage.value = 'Summary payload user mismatch. Please retry from event list.'
      return
    }
    userName.value = parsed.userName || userName.value
    startDate.value = parsed.startDate || startDate.value
    endDate.value = parsed.endDate || endDate.value
    events = Array.isArray(parsed.events) ? parsed.events : []
  } catch {
    errorMessage.value = 'Invalid summary payload.'
    return
  }

  isLoading.value = true
  errorMessage.value = ''

  try {
    const response = await fetchEventSummary(
      userId,
      events,
      {
        startDate: startDate.value,
        endDate: endDate.value,
      },
    )
    summaryText.value = response.summaryText
    chartLabels.value = response.chartLabels
    chartCounts.value = response.chartCounts
    categoryDetails.value = response.categoryDetails
    // openCategoryName.value = response.categoryDetails[0]?.name || null
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Failed to generate summary.'
  } finally {
    isLoading.value = false
  }
}

onMounted(loadSummary)

watch(
  [chartLabels, chartCounts, isLoading, errorMessage],
  async () => {
    await nextTick()
    renderChart()
  },
  { flush: 'post' },
)

onBeforeUnmount(() => {
  if (chartInstance) {
    chartInstance.destroy()
    chartInstance = null
  }
})
</script>

<template>
  <section class="space-y-5">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-semibold text-slate-900">Events Summary</h1>
        <p class="text-sm text-slate-600">
          User: {{ userName }} | {{ startDate }} to {{ endDate }}
        </p>
      </div>
      <button
        type="button"
        class="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
        @click="
          router.push({
            name: 'usersEvent',
            params: { userId: route.params.userId },
            query: { userName, startDate, endDate },
          })
        "
      >
        Back to Events
      </button>
    </div>

    <p v-if="isLoading" class="text-sm text-slate-600">Generating summary...</p>
    <p v-else-if="errorMessage" class="text-sm text-rose-600">{{ errorMessage }}</p>

    <div v-else class="space-y-4">
      <div class="rounded-lg border border-slate-200 bg-white p-4">
        <h2 class="mb-2 text-lg font-semibold text-slate-900">Overview</h2>
        <pre class="whitespace-pre-wrap text-sm text-slate-700">{{ summaryText }}</pre>
      </div>

      <div class="space-y-3">
        <h2 class="text-lg font-semibold text-slate-900">Category Details</h2>
        <div
          v-for="category in categoryDetails"
          :key="category.name"
          class="rounded-lg border border-slate-200 bg-white"
        >
          <button
            type="button"
            class="flex w-full items-center justify-between rounded-lg px-4 py-3 text-left text-sm font-semibold text-slate-800 hover:bg-slate-50"
            @click="toggleCategory(category.name)"
          >
            <span>{{ category.name }} ({{ category.count }})</span>
            <span class="text-slate-500">{{ openCategoryName === category.name ? '−' : '+' }}</span>
          </button>

          <div v-if="openCategoryName === category.name" class="border-t border-slate-200">
            <div class="overflow-x-auto">
              <table class="min-w-full divide-y divide-slate-200 text-sm">
                <thead class="bg-slate-50">
                  <tr>
                    <th class="px-4 py-2 text-left font-semibold text-slate-700">Subject</th>
                    <th class="px-4 py-2 text-left font-semibold text-slate-700">Start</th>
                    <th class="px-4 py-2 text-left font-semibold text-slate-700">End</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-200">
                  <tr
                    v-for="event in category.events"
                    :key="`${event.subject}-${event.startDateTime}-${event.endDateTime}`"
                  >
                    <td class="px-4 py-2 text-slate-800">{{ event.subject }}</td>
                    <td class="px-4 py-2 text-slate-700">
                      {{ formatDateTime(event.startDateTime) }}
                    </td>
                    <td class="px-4 py-2 text-slate-700">
                      {{ formatDateTime(event.endDateTime) }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <p v-if="categoryDetails.length === 0" class="text-sm text-slate-600">
          No category details.
        </p>
      </div>

      <div id="chartDiv" class="rounded-lg border border-slate-200 bg-white p-4">
        <h2 class="mb-2 text-lg font-semibold text-slate-900">Category Chart</h2>
        <div class="h-72">
          <canvas ref="chartCanvas" />
        </div>
      </div>
    </div>
  </section>
</template>
