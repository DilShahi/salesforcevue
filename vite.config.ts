import { fileURLToPath, URL } from 'node:url'
import type { IncomingMessage, ServerResponse } from 'node:http'
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
  type InvokeModelCommandOutput,
} from '@aws-sdk/client-bedrock-runtime'
import { NodeHttpHandler } from '@smithy/node-http-handler'

import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import vueDevTools from 'vite-plugin-vue-devtools'
import tailwindcss from '@tailwindcss/vite'

const normalizeBaseUrl = (url: string) => url.replace(/\/+$/, '')

const sendJson = (res: ServerResponse, statusCode: number, body: Record<string, unknown>) => {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}

const readJsonBody = async (req: IncomingMessage) => {
  const chunks: Buffer[] = []

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }

  const rawBody = Buffer.concat(chunks).toString('utf-8')
  return rawBody ? JSON.parse(rawBody) : {}
}

const exchangeToken = async (
  env: Record<string, string>,
  bodyParams: URLSearchParams,
): Promise<Record<string, unknown>> => {
  const tokenUrl = `${normalizeBaseUrl(env.SF_LOGIN_URL || '')}/services/oauth2/token`

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: bodyParams.toString(),
  })

  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>

  if (!response.ok) {
    throw {
      statusCode: response.status,
      payload,
    }
  }

  return payload
}

type MiddlewareRequest = IncomingMessage & { url?: string; method?: string }
type MiddlewareNext = (error?: unknown) => void

type SummaryEventInput = {
  Id?: string
  Subject?: string
  StartDateTime?: string | null
  EndDateTime?: string | null
}

type CategoryEvent = {
  subject: string
  startDateTime: string
  endDateTime: string
}

type CategoryDetail = {
  name: string
  count: number
  events: CategoryEvent[]
}

const trimEnv = (value: string | undefined, fallback = '') => {
  if (!value) return fallback
  const trimmed = value.trim()
  const match = trimmed.match(/^"(.*)"$/)
  return (match ? match[1] : trimmed).trim()
}

const envNumber = (value: string | undefined, fallback: number) => {
  const parsed = Number(trimEnv(value))
  return Number.isFinite(parsed) ? parsed : fallback
}

const decodeJsonPayload = (text: string): Record<string, unknown> | null => {
  try {
    const parsed = JSON.parse(text)
    if (parsed && typeof parsed === 'object') return parsed as Record<string, unknown>
  } catch {
    // ignore and continue
  }

  const fencedMatch = text.match(/```json\s*(\{[\s\S]*\}|\[[\s\S]*\])\s*```/i)
  if (fencedMatch?.[1]) {
    try {
      const parsed = JSON.parse(fencedMatch[1])
      if (parsed && typeof parsed === 'object') return parsed as Record<string, unknown>
    } catch {
      // ignore and continue
    }
  }

  const plainMatch = text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/)
  if (plainMatch?.[1]) {
    try {
      const parsed = JSON.parse(plainMatch[1])
      if (parsed && typeof parsed === 'object') return parsed as Record<string, unknown>
    } catch {
      // ignore
    }
  }

  return null
}

const sanitizeEventsForSummary = (
  events: unknown[],
  maxEvents: number,
): Array<{
  Id: string | null
  Subject: string
  StartDateTime: string | null
  EndDateTime: string | null
}> => {
  const normalized = events.map((event) => {
    const value = (event && typeof event === 'object' ? event : {}) as SummaryEventInput
    return {
      Id: typeof value.Id === 'string' ? value.Id : null,
      Subject: typeof value.Subject === 'string' ? value.Subject : '',
      StartDateTime: typeof value.StartDateTime === 'string' ? value.StartDateTime : null,
      EndDateTime: typeof value.EndDateTime === 'string' ? value.EndDateTime : null,
    }
  })

  if (maxEvents > 0) {
    return normalized.slice(0, maxEvents)
  }

  return normalized
}

const toSalesforceDateTimeRange = (startDate?: string, endDate?: string) => {
  const conditions: string[] = []

  if (startDate) {
    const start = new Date(`${startDate}T00:00:00.000Z`).toISOString().replace('.000', '')
    conditions.push(`StartDateTime >= ${start}`)
  }

  if (endDate) {
    const end = new Date(`${endDate}T23:59:59.999Z`).toISOString().replace('.999', '')
    conditions.push(`EndDateTime <= ${end}`)
  }

  return conditions
}

const invokeBedrock = async (
  client: BedrockRuntimeClient,
  modelId: string,
  maxTokens: number,
  temperature: number,
  topK: number,
  prompt: string,
  systemPrompt: string,
) => {
  const payload = {
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: [{ type: 'text', text: prompt }],
      },
    ],
    temperature,
    top_k: topK,
  }

  const result: InvokeModelCommandOutput = await client.send(
    new InvokeModelCommand({
      modelId,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(payload),
    }),
  )

  const bodyText = new TextDecoder().decode(result.body as Uint8Array)
  const response = JSON.parse(bodyText) as { content?: Array<{ text?: string }> }
  return response.content?.[0]?.text ?? ''
}

const mergeCategories = (
  categoryMap: Map<string, Map<string, CategoryEvent>>,
  categories: unknown[],
) => {
  categories.forEach((category) => {
    if (!category || typeof category !== 'object') return
    const value = category as Record<string, unknown>
    const name = typeof value.name === 'string' ? value.name : ''
    const events = Array.isArray(value.events) ? value.events : []

    if (!name) return
    if (!categoryMap.has(name)) {
      categoryMap.set(name, new Map<string, CategoryEvent>())
    }

    const existing = categoryMap.get(name)!
    events.forEach((event) => {
      if (!event || typeof event !== 'object') return
      const item = event as Record<string, unknown>
      const subject = typeof item.subject === 'string' ? item.subject : ''
      const startDateTime =
        typeof item.startDateTime === 'string'
          ? item.startDateTime
          : typeof item.StartDateTime === 'string'
            ? item.StartDateTime
            : ''
      const endDateTime =
        typeof item.endDateTime === 'string'
          ? item.endDateTime
          : typeof item.EndDateTime === 'string'
            ? item.EndDateTime
            : ''

      if (!subject) return
      const key = `${subject}|${startDateTime}|${endDateTime}`
      existing.set(key, { subject, startDateTime, endDateTime })
    })
  })
}

const createSummaryText = (overview: string, categories: CategoryDetail[]) => {
  const lines = []
  if (overview.trim()) lines.push(overview.trim())
  categories.forEach((category) => lines.push(`${category.name}: ${category.count}`))
  return lines.length > 0 ? lines.join('\n') : 'Summary generated successfully.'
}

const summarizeEvents = async (env: Record<string, string>, events: unknown[]) => {
  const region = trimEnv(env.AWS_DEFAULT_REGION)
  const accessKeyId = trimEnv(env.AWS_ACCESS_KEY_ID)
  const secretAccessKey = trimEnv(env.AWS_SECRET_ACCESS_KEY)
  const modelId = trimEnv(env.BEDROCK_MODEL_ID)

  if (!region || !modelId) {
    throw new Error('Bedrock config is missing AWS_DEFAULT_REGION or BEDROCK_MODEL_ID.')
  }

  const maxTokens = Math.max(envNumber(env.BEDROCK_MAX_TOKENS, 32000), 1)
  const temperature = envNumber(env.BEDROCK_TEMPERATURE, 1)
  const topK = Math.max(envNumber(env.BEDROCK_TOP_K, 250), 1)
  const connectTimeout = Math.max(envNumber(env.BEDROCK_CONNECT_TIMEOUT, 5), 1)
  const requestTimeout = Math.max(envNumber(env.BEDROCK_REQUEST_TIMEOUT, 20), 1)
  const retries = Math.max(envNumber(env.BEDROCK_RETRIES, 0), 0)
  const configuredMaxEvents = Math.max(envNumber(env.BEDROCK_MAX_EVENTS, 0), 0)
  const effectiveMaxEvents = configuredMaxEvents > 0 ? configuredMaxEvents : 500
  const maxPromptChars = Math.max(envNumber(env.BEDROCK_MAX_PROMPT_CHARS, 0), 0)
  const chunkSize = Math.max(envNumber(env.BEDROCK_CHUNK_SIZE, 120), 1)
  const client = new BedrockRuntimeClient({
    region,
    maxAttempts: retries + 1,
    requestHandler: new NodeHttpHandler({
      connectionTimeout: connectTimeout * 1000,
      socketTimeout: requestTimeout * 1000,
    }),
    credentials:
      accessKeyId && secretAccessKey
        ? {
            accessKeyId,
            secretAccessKey,
          }
        : undefined,
  })

  const sanitizedEvents = sanitizeEventsForSummary(events, effectiveMaxEvents).filter(
    (event) => event.Subject,
  )
  if (sanitizedEvents.length === 0) {
    throw new Error('No events available for summary.')
  }

  const chunks: (typeof sanitizedEvents)[] = []
  for (let index = 0; index < sanitizedEvents.length; index += chunkSize) {
    chunks.push(sanitizedEvents.slice(index, index + chunkSize))
  }

  const categoryMap = new Map<string, Map<string, CategoryEvent>>()

  for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex += 1) {
    const chunk = chunks[chunkIndex]
    const chunkPrompt = JSON.stringify(chunk, null, 2)
    if (!chunkPrompt) {
      throw new Error('Failed to encode events.')
    }
    if (maxPromptChars > 0 && chunkPrompt.length > maxPromptChars) {
      throw new Error('Event data is too large to summarize. Please select a smaller date range.')
    }

    const raw = await invokeBedrock(
      client,
      modelId,
      maxTokens,
      temperature,
      topK,
      chunkPrompt,
      'You are given event data JSON. Return only valid JSON: {"categories":[{"name":"category name","count":number,"events":[{"subject":"event subject","startDateTime":"ISO datetime or empty string","endDateTime":"ISO datetime or empty string"}]}]}. Categorize all input events. Ensure counts match events length.',
    )

    const decoded = decodeJsonPayload(raw)
    const categories = decoded?.categories
    if (!Array.isArray(categories)) {
      throw new Error(`Invalid summary response for chunk ${chunkIndex + 1}.`)
    }
    mergeCategories(categoryMap, categories)
  }

  const categoryDetails: CategoryDetail[] = Array.from(categoryMap.entries())
    .map(([name, eventsMap]) => {
      const events = Array.from(eventsMap.values())
      return { name, count: events.length, events }
    })
    .sort((left, right) => right.count - left.count)

  const overview = `Total ${sanitizedEvents.length} events grouped into ${categoryDetails.length} categories.`
  const chartLabels = categoryDetails.map((category) => category.name)
  const chartCounts = categoryDetails.map((category) => category.count)
  const summary = JSON.stringify(
    {
      overview,
      categories: categoryDetails,
    },
    null,
    2,
  )

  return {
    summary,
    summaryText: createSummaryText(overview, categoryDetails),
    chartLabels,
    chartCounts,
    categoryDetails,
  }
}

const createSalesforceAuthMiddleware = (env: Record<string, string>) => {
  return async (req: MiddlewareRequest, res: ServerResponse, next: MiddlewareNext) => {
    if (!req.url) {
      next()
      return
    }

    const requestUrl = new URL(req.url, 'http://localhost')
    const isTokenExchange =
      req.method === 'POST' && requestUrl.pathname === '/api/auth/salesforce/token'
    const isTokenRefresh =
      req.method === 'POST' && requestUrl.pathname === '/api/auth/salesforce/refresh'
    const isSalesforceProxy =
      req.method === 'POST' && requestUrl.pathname === '/api/salesforce/request'
    const isEventsSummary =
      req.method === 'POST' && requestUrl.pathname === '/api/bedrock/events-summary'

    if (!isTokenExchange && !isTokenRefresh && !isSalesforceProxy && !isEventsSummary) {
      next()
      return
    }

    if (isSalesforceProxy) {
      try {
        const body = (await readJsonBody(req as IncomingMessage)) as {
          instanceUrl?: string
          path?: string
          method?: string
          headers?: Record<string, string>
          body?: string
        }

        if (!body.instanceUrl || !body.path) {
          sendJson(res, 400, { error: 'Missing instanceUrl or path.' })
          return
        }

        const url = `${normalizeBaseUrl(body.instanceUrl)}${
          body.path.startsWith('/') ? body.path : `/${body.path}`
        }`

        const upstreamHeaders = new Headers(body.headers || {})
        const upstreamResponse = await fetch(url, {
          method: body.method || 'GET',
          headers: upstreamHeaders,
          body: body.body,
        })

        const responseText = await upstreamResponse.text()
        res.statusCode = upstreamResponse.status
        res.setHeader(
          'Content-Type',
          upstreamResponse.headers.get('content-type') || 'application/json',
        )
        res.end(responseText)
        return
      } catch {
        sendJson(res, 500, { error: 'Salesforce proxy request failed.' })
        return
      }
    }

    if (isEventsSummary) {
      try {
        const body = (await readJsonBody(req as IncomingMessage)) as {
          userId?: string
          events?: unknown
          startDate?: string
          endDate?: string
          instanceUrl?: string
          accessToken?: string
          tokenType?: string
        }

        const userId = typeof body.userId === 'string' ? body.userId : ''
        if (!/^[a-zA-Z0-9]{15,18}$/.test(userId)) {
          sendJson(res, 400, { error: 'Invalid user id.' })
          return
        }

        let events = Array.isArray(body.events) ? body.events : null
        if (!events) {
          sendJson(res, 422, { error: 'Invalid events payload.' })
          return
        }

        if (events.length === 0) {
          const startDate = typeof body.startDate === 'string' ? body.startDate : ''
          const endDate = typeof body.endDate === 'string' ? body.endDate : ''
          const instanceUrl = typeof body.instanceUrl === 'string' ? body.instanceUrl.trim() : ''
          const accessToken = typeof body.accessToken === 'string' ? body.accessToken.trim() : ''
          const tokenType = typeof body.tokenType === 'string' ? body.tokenType.trim() : 'Bearer'

          if (!instanceUrl || !accessToken || !startDate || !endDate) {
            sendJson(res, 422, {
              error:
                'No events provided. Missing date range or Salesforce session context to fetch events.',
            })
            return
          }

          const configuredMaxEvents = Math.max(envNumber(env.BEDROCK_MAX_EVENTS, 0), 0)
          const effectiveMaxEvents = configuredMaxEvents > 0 ? configuredMaxEvents : 500
          const safeUserId = userId.replace(/'/g, "\\'")
          const conditions = [`OwnerId='${safeUserId}'`, ...toSalesforceDateTimeRange(startDate, endDate)]
          const soql =
            `SELECT Id, Subject, StartDateTime, EndDateTime ` +
            `FROM Event ` +
            `WHERE ${conditions.join(' AND ')} ` +
            `ORDER BY StartDateTime DESC ` +
            `LIMIT ${effectiveMaxEvents}`
          const query = new URLSearchParams({ q: soql }).toString()
          const salesforceUrl = `${normalizeBaseUrl(instanceUrl)}/services/data/v62.0/query?${query}`
          const sfResponse = await fetch(salesforceUrl, {
            method: 'GET',
            headers: {
              Authorization: `${tokenType} ${accessToken}`,
              Accept: 'application/json',
            },
          })

          const sfPayload = (await sfResponse.json().catch(() => ({}))) as Record<string, unknown>
          if (!sfResponse.ok) {
            const message =
              typeof sfPayload.error === 'string'
                ? sfPayload.error
                : Array.isArray(sfPayload)
                  ? 'Could not fetch events from Salesforce.'
                  : 'Could not fetch events from Salesforce.'
            sendJson(res, sfResponse.status, { error: message })
            return
          }

          const records = Array.isArray(sfPayload.records) ? sfPayload.records : []
          events = records
        }

        if (events.length === 0) {
          sendJson(res, 422, {
            error: 'No events found for the selected range.',
          })
          return
        }

        const summaryData = await summarizeEvents(env, events)
        sendJson(res, 200, summaryData)
        return
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to summarize events.'
        sendJson(res, 422, { error: message })
        return
      }
    }

    if (!env.SF_CLIENT_ID || !env.SF_CLIENT_SECRET || !env.SF_REDIRECT_URI || !env.SF_LOGIN_URL) {
      sendJson(res, 500, {
        error: 'Salesforce OAuth is not configured on the server.',
      })
      return
    }

    try {
      const body = (await readJsonBody(req as IncomingMessage)) as Record<string, unknown>
      const params = new URLSearchParams({
        client_id: env.SF_CLIENT_ID,
        client_secret: env.SF_CLIENT_SECRET,
      })

      if (isTokenExchange) {
        if (typeof body.code !== 'string' || !body.code) {
          sendJson(res, 400, { error: 'Missing authorization code.' })
          return
        }

        params.set('grant_type', 'authorization_code')
        params.set('code', body.code)
        params.set('redirect_uri', env.SF_REDIRECT_URI.trim())
      } else {
        if (typeof body.refreshToken !== 'string' || !body.refreshToken) {
          sendJson(res, 400, { error: 'Missing refresh token.' })
          return
        }

        params.set('grant_type', 'refresh_token')
        params.set('refresh_token', body.refreshToken)
      }

      const payload = await exchangeToken(env, params)
      sendJson(res, 200, payload)
    } catch (error) {
      const statusCode =
        typeof error === 'object' &&
        error !== null &&
        'statusCode' in error &&
        typeof error.statusCode === 'number'
          ? error.statusCode
          : 500

      const payload =
        typeof error === 'object' && error !== null && 'payload' in error
          ? (error.payload as Record<string, unknown>)
          : { error: 'Salesforce token request failed.' }

      sendJson(res, statusCode, payload)
    }
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [
      vue(),
      vueJsx(),
      vueDevTools(),
      tailwindcss(),
      {
        name: 'salesforce-oauth-middleware',
        configureServer(server) {
          server.middlewares.use(createSalesforceAuthMiddleware(env))
        },
        configurePreviewServer(server) {
          server.middlewares.use(createSalesforceAuthMiddleware(env))
        },
      },
    ],
    define: {
      __SF_LOGIN_URL__: JSON.stringify(env.SF_LOGIN_URL ?? ''),
      __SF_CLIENT_ID__: JSON.stringify(env.SF_CLIENT_ID ?? ''),
      __SF_REDIRECT_URI__: JSON.stringify(env.SF_REDIRECT_URI ?? ''),
      __SF_SCOPES__: JSON.stringify(env.SF_SCOPES ?? ''),
      __SF_ALIAS_NAME__: JSON.stringify(env.SF_ALIAS_NAME ?? ''),
    },
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
  }
})
