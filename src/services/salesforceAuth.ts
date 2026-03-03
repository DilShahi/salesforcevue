import { ENV } from '@/config/env'
import { processDatasetInChunks } from '@dshahi468/nd-dataset-split'

const normalizeBaseUrl = (url: string) => url.replace(/\/+$/, '')
const apiUrl = (path: string) => {
  const configured = ENV.apiBaseUrl?.trim()
  if (!configured) {
    throw new Error(
      'Missing VITE_API_BASE_URL. Configure it to your API Gateway base URL for both development and production.',
    )
  }

  const base = normalizeBaseUrl(configured)
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  if (base.endsWith('/api') && normalizedPath.startsWith('/api/')) {
    return `${base}${normalizedPath.slice(4)}`
  }

  return `${base}${normalizedPath}`
}
const OAUTH_STATE_STORAGE_KEY = 'salesforce_oauth_state'
const OAUTH_SESSION_STORAGE_KEY = 'salesforce_oauth_session'
const AUTH_CHANGED_EVENT = 'salesforce-auth-changed'

type SalesforceTokenResponse = {
  access_token: string
  refresh_token?: string
  instance_url: string
  id: string
  token_type: string
  issued_at: string
  signature: string
  scope?: string
}

export type SalesforceAuthSession = {
  accessToken: string
  refreshToken?: string
  instanceUrl: string
  identityUrl: string
  tokenType: string
  issuedAt: string
  signature: string
  scope?: string
  state: string
  savedAt: string
}

export type SalesforceUserRecord = {
  Id: string
  Name: string
  Email: string | null
  Username: string
  IsActive: boolean
  Profile?: { Name?: string }
}

export type SalesforceMitocoEventRecord = {
  Id: string
  Subject: string
  ActivityDate: string | null
  StartDateTime: string | null
  EndDateTime: string | null
  Location: string | null
  Owner?: { Name?: string }
}

export type SummaryEventPayload = {
  Id: string
  Subject: string
  StartDateTime: string | null
  EndDateTime: string | null
}

export type EventSummaryCategoryEvent = {
  subject: string
  startDateTime: string
  endDateTime: string
}

export type EventSummaryCategoryDetail = {
  name: string
  count: number
  events: EventSummaryCategoryEvent[]
}

export type EventSummaryResponse = {
  summary: string
  summaryText: string
  chartLabels: string[]
  chartCounts: number[]
  categoryDetails: EventSummaryCategoryDetail[]
}

const SUMMARY_CHUNK_SIZE = 20
const SUMMARY_MAX_CONCURRENCY = 3
const SUMMARY_MAX_RETRIES = 2

const isTransientSummaryError = (message: string) => {
  const normalized = message.toLowerCase()
  return (
    normalized.includes('429') ||
    normalized.includes('500') ||
    normalized.includes('502') ||
    normalized.includes('503') ||
    normalized.includes('504') ||
    normalized.includes('throttl') ||
    normalized.includes('timeout') ||
    normalized.includes('service unavailable')
  )
}

const buildOAuthState = () => {
  const alias = ENV.salesforce.aliasName || 'salesforce'
  const state = `${alias}:${Date.now()}`

  if (typeof window !== 'undefined') {
    window.sessionStorage.setItem(OAUTH_STATE_STORAGE_KEY, state)
  }

  return state
}

export const buildSalesforceAuthorizeUrl = () => {
  const { loginUrl, clientId, redirectUri, scopes } = ENV.salesforce

  if (!loginUrl || !clientId || !redirectUri || !scopes) {
    throw new Error(
      'Missing Salesforce OAuth env values. Required: SF_LOGIN_URL, SF_CLIENT_ID, SF_REDIRECT_URI, SF_SCOPES.',
    )
  }

  const url = new URL(`${normalizeBaseUrl(loginUrl)}/services/oauth2/authorize`)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('scope', scopes)
  url.searchParams.set('state', buildOAuthState())

  return url.toString()
}

export const redirectToSalesforceLogin = () => {
  const authorizeUrl = buildSalesforceAuthorizeUrl()
  console.log('Authorize URL =', authorizeUrl)
  window.location.assign(authorizeUrl)
}

const fetchSalesforceToken = async (payload: Record<string, string>) => {
  const response = await fetch(apiUrl('/api/auth/salesforce/token'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  const rawText = await response.text()
  let data: Record<string, unknown> = {}
  try {
    data = rawText ? (JSON.parse(rawText) as Record<string, unknown>) : {}
  } catch {
    data = {}
  }

  if (!response.ok) {
    const message =
      typeof data.error_description === 'string'
        ? data.error_description
        : 'Failed to exchange Salesforce authorization code.'
    throw new Error(message)
  }

  const token = data as unknown as SalesforceTokenResponse
  if (!token.access_token || !token.instance_url || !token.token_type || !token.id) {
    throw new Error(
      'Invalid token response from /api/auth/salesforce/token. Check production /api routing and backend response.',
    )
  }

  return token
}

const mapTokenToSession = (
  token: SalesforceTokenResponse,
  state: string,
  existingRefreshToken?: string,
): SalesforceAuthSession => {
  return {
    accessToken: token.access_token,
    refreshToken: token.refresh_token || existingRefreshToken,
    instanceUrl: token.instance_url,
    identityUrl: token.id,
    tokenType: token.token_type,
    issuedAt: token.issued_at,
    signature: token.signature,
    scope: token.scope,
    state,
    savedAt: new Date().toISOString(),
  }
}

export const saveSalesforceSession = (session: SalesforceAuthSession) => {
  if (typeof window === 'undefined') return
  localStorage.setItem(OAUTH_SESSION_STORAGE_KEY, JSON.stringify(session))
  console.log('Data successfully saved in localstorage.')
  // localStorage.setItem(OAUTH_SESSION_STORAGE_KEY, JSON.stringify(session))
  dispatchEvent(new CustomEvent(AUTH_CHANGED_EVENT))
}

export const getSalesforceSession = (): SalesforceAuthSession | null => {
  if (typeof window === 'undefined') return null

  const raw = window.localStorage.getItem(OAUTH_SESSION_STORAGE_KEY)
  if (!raw) return null

  try {
    return JSON.parse(raw) as SalesforceAuthSession
  } catch {
    window.localStorage.removeItem(OAUTH_SESSION_STORAGE_KEY)
    return null
  }
}

export const clearSalesforceSession = () => {
  if (typeof window === 'undefined') return
  localStorage.removeItem(OAUTH_SESSION_STORAGE_KEY)
  sessionStorage.removeItem(OAUTH_STATE_STORAGE_KEY)
  dispatchEvent(new CustomEvent(AUTH_CHANGED_EVENT))
}

export const handleSalesforceOAuthCallback = async (code: string, state: string) => {
  console.log('Handle salesforce oauth callback is triggered....')
  if (typeof window === 'undefined') {
    throw new Error('OAuth callback requires a browser environment.')
  }

  const expectedState = window.sessionStorage.getItem(OAUTH_STATE_STORAGE_KEY)
  if (expectedState && expectedState !== state) {
    throw new Error('OAuth state mismatch. Please try signing in again.')
  }

  const token = await fetchSalesforceToken({ code })
  const session = mapTokenToSession(token, state)
  console.log('Session value is:', session)
  saveSalesforceSession(session)
  window.sessionStorage.removeItem(OAUTH_STATE_STORAGE_KEY)

  return session
}

export const refreshSalesforceAccessToken = async () => {
  const currentSession = getSalesforceSession()
  if (!currentSession?.refreshToken) {
    throw new Error('No Salesforce refresh token is available.')
  }

  const response = await fetch(apiUrl('/api/auth/salesforce/refresh'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: currentSession.refreshToken }),
  })

  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>
  if (!response.ok) {
    const message =
      typeof data.error_description === 'string'
        ? data.error_description
        : 'Failed to refresh Salesforce access token.'
    throw new Error(message)
  }

  const token = data as unknown as SalesforceTokenResponse
  const updatedSession = mapTokenToSession(token, currentSession.state, currentSession.refreshToken)
  saveSalesforceSession(updatedSession)
  return updatedSession
}

const performSalesforceRequest = async (
  session: SalesforceAuthSession,
  path: string,
  init: RequestInit = {},
) => {
  const headers = new Headers(init.headers || {})
  headers.set('Authorization', `${session.tokenType} ${session.accessToken}`)
  headers.set('Accept', 'application/json')

  const response = await fetch(apiUrl('/api/salesforce/request'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      instanceUrl: session.instanceUrl,
      path: path.startsWith('/') ? path : `/${path}`,
      method: init.method || 'GET',
      headers: Object.fromEntries(headers.entries()),
      body: typeof init.body === 'string' ? init.body : undefined,
    }),
  })

  return response
}

export const salesforceApiFetch = async (path: string, init: RequestInit = {}) => {
  const session = getSalesforceSession()
  if (!session) {
    throw new Error('No Salesforce session found. Please sign in first.')
  }

  let response = await performSalesforceRequest(session, path, init)

  if (response.status !== 401) {
    return response
  }

  const refreshedSession = await refreshSalesforceAccessToken()
  response = await performSalesforceRequest(refreshedSession, path, init)
  return response
}

type SalesforceQueryResponse<T> = {
  records: T[]
}

export const fetchSalesforceUsers = async () => {
  const soql = 'SELECT Id, Name, Email, Username, IsActive, Profile.Name FROM User ORDER BY Name'
  const query = new URLSearchParams({ q: soql }).toString()
  const response = await salesforceApiFetch(`/services/data/v62.0/query?${query}`)

  if (!response.ok) {
    throw new Error(`Failed to fetch Salesforce users. Status: ${response.status}`)
  }

  const data = (await response.json()) as SalesforceQueryResponse<SalesforceUserRecord>
  return data.records || []
}

export const fetchMitocoEventsByUserAndDateRange = async (
  userId: string,
  startDate: string,
  endDate: string,
) => {
  const safeUserId = userId.replace(/'/g, "\\'")
  const conditions = [`OwnerId='${safeUserId}'`]

  if (startDate) {
    const startDateTime = new Date(`${startDate}T00:00:00.000Z`).toISOString().replace('.000', '')
    conditions.push(`StartDateTime >= ${startDateTime}`)
  }

  if (endDate) {
    const endDateTime = new Date(`${endDate}T23:59:59.999Z`).toISOString().replace('.999', '')
    conditions.push(`EndDateTime <= ${endDateTime}`)
  }

  const whereClause = conditions.join(' AND ')
  const soql =
    `SELECT Id, Subject, ActivityDate, StartDateTime, EndDateTime, Location, Owner.Name ` +
    `FROM Event ` +
    `WHERE ${whereClause} ` +
    `ORDER BY StartDateTime DESC`

  const query = new URLSearchParams({ q: soql }).toString()
  const response = await salesforceApiFetch(`/services/data/v62.0/query?${query}`)

  if (!response.ok) {
    throw new Error(`Failed to fetch Mitoco events. Status: ${response.status}`)
  }

  const data = (await response.json()) as SalesforceQueryResponse<SalesforceMitocoEventRecord>
  return data.records || []
}

export const toSummaryEventPayload = (
  events: SalesforceMitocoEventRecord[],
): SummaryEventPayload[] => {
  return events.map((event) => ({
    Id: event.Id,
    Subject: event.Subject || '',
    StartDateTime: event.StartDateTime || null,
    EndDateTime: event.EndDateTime || null,
  }))
}

export const fetchEventSummary = async (
  userId: string,
  events: SummaryEventPayload[],
  options?: { startDate?: string; endDate?: string },
): Promise<EventSummaryResponse> => {
  if (!Array.isArray(events) || events.length === 0) {
    throw new Error('No events provided for summary.')
  }

  const mergedSummary = (await processDatasetInChunks(
    events,
    async (chunkArray, chunkIndex, totalChunks): Promise<EventSummaryResponse> => {
      const response = await fetch(apiUrl('/api/bedrock/events-summary'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          events: chunkArray,
          startDate: options?.startDate,
          endDate: options?.endDate,
        }),
      })

      const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>
      if (!response.ok) {
        throw new Error(
          `Chunk ${chunkIndex + 1}/${totalChunks}: ${
            typeof payload.error === 'string' ? payload.error : 'Failed to summarize events.'
          }`,
        )
      }

      return payload as EventSummaryResponse
    },
    {
      chunkSize: SUMMARY_CHUNK_SIZE,
      maxConcurrency: SUMMARY_MAX_CONCURRENCY,
      retries: SUMMARY_MAX_RETRIES,
      retryDelayMs: 600,
      backoffMultiplier: 1.5,
      shouldRetry: (error) => isTransientSummaryError(String((error as Error).message)),
      mergeResults: (results): EventSummaryResponse => {
        const categoryMap = new Map<string, Map<string, EventSummaryCategoryEvent>>()

        results.forEach((summary) => {
          summary.categoryDetails.forEach((category) => {
            if (!categoryMap.has(category.name)) {
              categoryMap.set(category.name, new Map<string, EventSummaryCategoryEvent>())
            }

            const eventMap = categoryMap.get(category.name)!
            category.events.forEach((event) => {
              const key = `${event.subject}|${event.startDateTime}|${event.endDateTime}`
              eventMap.set(key, event)
            })
          })
        })

        const categoryDetails: EventSummaryCategoryDetail[] = Array.from(categoryMap.entries())
          .map(([name, eventsMap]) => {
            const mergedEvents = Array.from(eventsMap.values())
            return {
              name,
              count: mergedEvents.length,
              events: mergedEvents,
            }
          })
          .sort((left, right) => right.count - left.count)

        const chartLabels = categoryDetails.map((category) => category.name)
        const chartCounts = categoryDetails.map((category) => category.count)
        const overview = `Total ${events.length} events grouped into ${categoryDetails.length} categories.`
        const summaryTextLines = [
          overview,
          ...categoryDetails.map((item) => `${item.name}: ${item.count}`),
        ]

        return {
          summary: JSON.stringify(
            {
              overview,
              categories: categoryDetails,
            },
            null,
            2,
          ),
          summaryText: summaryTextLines.join('\n'),
          chartLabels,
          chartCounts,
          categoryDetails,
        }
      },
    },
  )) as EventSummaryResponse

  return mergedSummary
}
