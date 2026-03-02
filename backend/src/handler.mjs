import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime'
import { NodeHttpHandler } from '@smithy/node-http-handler'

const normalizeBaseUrl = (url) => String(url || '').replace(/\/+$/, '')
const trimEnv = (value, fallback = '') => {
  if (!value) return fallback
  const trimmed = String(value).trim()
  const match = trimmed.match(/^"(.*)"$/)
  return (match ? match[1] : trimmed).trim()
}

const envNumber = (value, fallback) => {
  const parsed = Number(trimEnv(value))
  return Number.isFinite(parsed) ? parsed : fallback
}

const resolveAllowedOrigin = (requestOrigin) => {
  const configured = trimEnv(process.env.FRONTEND_ORIGIN, '*')
  if (configured === '*') return '*'

  const allowedOrigins = configured
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

  if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
    return requestOrigin
  }

  return allowedOrigins[0] || '*'
}

const corsHeaders = (requestOrigin) => ({
  'Access-Control-Allow-Origin': resolveAllowedOrigin(requestOrigin),
  'Access-Control-Allow-Headers': 'content-type,authorization',
  'Access-Control-Allow-Methods': 'OPTIONS,POST,GET',
  'Access-Control-Allow-Credentials': 'false',
})

const jsonResponse = (statusCode, body, requestOrigin) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    ...corsHeaders(requestOrigin),
  },
  body: JSON.stringify(body),
})

const emptyResponse = (statusCode, requestOrigin) => ({
  statusCode,
  headers: {
    ...corsHeaders(requestOrigin),
  },
  body: '',
})

const getMethod = (event) => event?.requestContext?.http?.method || event?.httpMethod || 'GET'
const getPath = (event) => event?.rawPath || event?.path || event?.requestContext?.http?.path || '/'

const parseBody = (event) => {
  if (!event?.body) return {}
  try {
    const raw = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf-8') : event.body
    return raw ? JSON.parse(raw) : {}
  } catch {
    return null
  }
}

const parseUpstreamResponse = async (response) => {
  const text = await response.text()
  try {
    return text ? JSON.parse(text) : {}
  } catch {
    return text
  }
}

const salesforceTokenRequest = async (params) => {
  const loginUrl = trimEnv(process.env.SF_LOGIN_URL)
  if (!loginUrl) {
    throw new Error('Missing SF_LOGIN_URL.')
  }

  const tokenUrl = `${normalizeBaseUrl(loginUrl)}/services/oauth2/token`
  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString(),
  })

  const payload = await parseUpstreamResponse(response)
  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && typeof payload.error_description === 'string'
        ? payload.error_description
        : 'Salesforce token request failed.'
    const error = new Error(message)
    error.statusCode = response.status
    throw error
  }

  return payload
}

const proxySalesforceRequest = async (body) => {
  const instanceUrl = trimEnv(body.instanceUrl)
  const path = typeof body.path === 'string' ? body.path : ''

  if (!instanceUrl || !path) {
    const error = new Error('Missing instanceUrl or path.')
    error.statusCode = 400
    throw error
  }

  const url = `${normalizeBaseUrl(instanceUrl)}${path.startsWith('/') ? path : `/${path}`}`
  const response = await fetch(url, {
    method: body.method || 'GET',
    headers: body.headers || {},
    body: body.body,
  })

  const payload = await parseUpstreamResponse(response)
  return { statusCode: response.status, payload }
}

const decodeJsonPayload = (text) => {
  try {
    const parsed = JSON.parse(text)
    if (parsed && typeof parsed === 'object') return parsed
  } catch {
    // continue
  }

  const fencedMatch = text.match(/```json\s*(\{[\s\S]*\}|\[[\s\S]*\])\s*```/i)
  if (fencedMatch?.[1]) {
    try {
      const parsed = JSON.parse(fencedMatch[1])
      if (parsed && typeof parsed === 'object') return parsed
    } catch {
      // continue
    }
  }

  const plainMatch = text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/)
  if (plainMatch?.[1]) {
    try {
      const parsed = JSON.parse(plainMatch[1])
      if (parsed && typeof parsed === 'object') return parsed
    } catch {
      // continue
    }
  }

  return null
}

const sanitizeEventsForSummary = (events, maxEvents) => {
  const normalized = events.map((event) => {
    const value = event && typeof event === 'object' ? event : {}
    return {
      Id: typeof value.Id === 'string' ? value.Id : null,
      Subject: typeof value.Subject === 'string' ? value.Subject : '',
      StartDateTime: typeof value.StartDateTime === 'string' ? value.StartDateTime : null,
      EndDateTime: typeof value.EndDateTime === 'string' ? value.EndDateTime : null,
    }
  })

  if (maxEvents > 0) return normalized.slice(0, maxEvents)
  return normalized
}

const mergeCategories = (categoryMap, categories) => {
  categories.forEach((category) => {
    if (!category || typeof category !== 'object') return

    const name = typeof category.name === 'string' ? category.name : ''
    const events = Array.isArray(category.events) ? category.events : []
    if (!name) return

    if (!categoryMap.has(name)) {
      categoryMap.set(name, new Map())
    }

    const existing = categoryMap.get(name)
    events.forEach((event) => {
      if (!event || typeof event !== 'object') return
      const subject = typeof event.subject === 'string' ? event.subject : ''
      const startDateTime =
        typeof event.startDateTime === 'string'
          ? event.startDateTime
          : typeof event.StartDateTime === 'string'
            ? event.StartDateTime
            : ''
      const endDateTime =
        typeof event.endDateTime === 'string'
          ? event.endDateTime
          : typeof event.EndDateTime === 'string'
            ? event.EndDateTime
            : ''

      if (!subject) return
      const key = `${subject}|${startDateTime}|${endDateTime}`
      existing.set(key, {
        subject,
        startDateTime,
        endDateTime,
      })
    })
  })
}

const invokeBedrock = async (client, modelId, payload) => {
  const command = new InvokeModelCommand({
    modelId,
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify(payload),
  })

  const result = await client.send(command)
  const bodyText = new TextDecoder().decode(result.body)
  const decoded = JSON.parse(bodyText)
  return decoded?.content?.[0]?.text || ''
}

const createSummaryText = (overview, categories) => {
  const lines = []
  if (overview.trim()) lines.push(overview.trim())
  categories.forEach((category) => lines.push(`${category.name}: ${category.count}`))
  return lines.length > 0 ? lines.join('\n') : 'Summary generated successfully.'
}

const summarizeEvents = async (events) => {
  const region =
    trimEnv(process.env.AWS_DEFAULT_REGION) ||
    trimEnv(process.env.AWS_REGION) ||
    trimEnv(process.env.AWS_REGION_NAME)
  const modelId = trimEnv(process.env.BEDROCK_MODEL_ID)

  if (!region || !modelId) {
    throw new Error('Missing AWS_DEFAULT_REGION or BEDROCK_MODEL_ID.')
  }

  const maxTokens = Math.max(envNumber(process.env.BEDROCK_MAX_TOKENS, 32000), 1)
  const temperature = envNumber(process.env.BEDROCK_TEMPERATURE, 1)
  const topK = Math.max(envNumber(process.env.BEDROCK_TOP_K, 250), 1)
  const connectTimeout = Math.max(envNumber(process.env.BEDROCK_CONNECT_TIMEOUT, 30), 1)
  const requestTimeout = Math.max(envNumber(process.env.BEDROCK_REQUEST_TIMEOUT, 300), 1)
  const retries = Math.max(envNumber(process.env.BEDROCK_RETRIES, 2), 0)
  const configuredMaxEvents = Math.max(envNumber(process.env.BEDROCK_MAX_EVENTS, 0), 0)
  const effectiveMaxEvents = configuredMaxEvents > 0 ? configuredMaxEvents : 500
  const maxPromptChars = Math.max(envNumber(process.env.BEDROCK_MAX_PROMPT_CHARS, 0), 0)
  const chunkSize = Math.max(envNumber(process.env.BEDROCK_CHUNK_SIZE, 50), 1)

  const client = new BedrockRuntimeClient({
    region,
    maxAttempts: retries + 1,
    requestHandler: new NodeHttpHandler({
      connectionTimeout: connectTimeout * 1000,
      socketTimeout: requestTimeout * 1000,
    }),
  })

  const sanitizedEvents = sanitizeEventsForSummary(events, effectiveMaxEvents).filter(
    (event) => event.Subject,
  )
  if (sanitizedEvents.length === 0) {
    throw new Error('No events available for summary.')
  }

  const chunks = []
  for (let index = 0; index < sanitizedEvents.length; index += chunkSize) {
    chunks.push(sanitizedEvents.slice(index, index + chunkSize))
  }

  const categoryMap = new Map()

  for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex += 1) {
    const chunk = chunks[chunkIndex]
    const chunkPrompt = JSON.stringify(chunk, null, 2)
    if (!chunkPrompt) {
      throw new Error('Failed to encode events.')
    }

    if (maxPromptChars > 0 && chunkPrompt.length > maxPromptChars) {
      throw new Error('Event data is too large to summarize. Please select a smaller date range.')
    }

    const raw = await invokeBedrock(client, modelId, {
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: maxTokens,
      system:
        'You are given event data JSON. Return only valid JSON with shape: {"categories":[{"name":"category name","count":number,"events":[{"subject":"event subject","startDateTime":"ISO datetime or empty string","endDateTime":"ISO datetime or empty string"}]}]}. Categorize all input events. Ensure counts match event lengths.',
      messages: [
        {
          role: 'user',
          content: [{ type: 'text', text: chunkPrompt }],
        },
      ],
      temperature,
      top_k: topK,
    })

    const decoded = decodeJsonPayload(raw)
    const categories = decoded?.categories
    if (!Array.isArray(categories)) {
      throw new Error(`Invalid summary response for chunk ${chunkIndex + 1}.`)
    }

    mergeCategories(categoryMap, categories)
  }

  const categoryDetails = Array.from(categoryMap.entries())
    .map(([name, eventsMap]) => {
      const categoryEvents = Array.from(eventsMap.values())
      return {
        name,
        count: categoryEvents.length,
        events: categoryEvents,
      }
    })
    .sort((left, right) => right.count - left.count)

  const overview = `Total ${sanitizedEvents.length} events grouped into ${categoryDetails.length} categories.`

  return {
    summary: JSON.stringify({ overview, categories: categoryDetails }, null, 2),
    summaryText: createSummaryText(overview, categoryDetails),
    chartLabels: categoryDetails.map((category) => category.name),
    chartCounts: categoryDetails.map((category) => category.count),
    categoryDetails,
  }
}

const handleEventsSummary = async (body) => {
  const userId = typeof body.userId === 'string' ? body.userId : ''
  if (!/^[a-zA-Z0-9]{15,18}$/.test(userId)) {
    const error = new Error('Invalid user id.')
    error.statusCode = 400
    throw error
  }

  let events = Array.isArray(body.events) ? body.events : null
  if (!events) {
    const error = new Error('Invalid events payload.')
    error.statusCode = 422
    throw error
  }

  if (events.length === 0) {
    const error = new Error('No events provided for summary.')
    error.statusCode = 422
    throw error
  }

  return summarizeEvents(events)
}

export const handler = async (event) => {
  const requestOrigin = event?.headers?.origin || event?.headers?.Origin || ''
  const method = getMethod(event)
  const path = getPath(event)

  if (method === 'OPTIONS') {
    return emptyResponse(204, requestOrigin)
  }

  const body = parseBody(event)
  if (body === null) {
    return jsonResponse(400, { error: 'Invalid JSON body.' }, requestOrigin)
  }

  try {
    if (method === 'POST' && path === '/api/auth/salesforce/token') {
      const code = typeof body.code === 'string' ? body.code : ''
      if (!code) {
        return jsonResponse(400, { error: 'Missing authorization code.' }, requestOrigin)
      }

      const payload = await salesforceTokenRequest({
        grant_type: 'authorization_code',
        code,
        client_id: trimEnv(process.env.SF_CLIENT_ID),
        client_secret: trimEnv(process.env.SF_CLIENT_SECRET),
        redirect_uri: trimEnv(process.env.SF_REDIRECT_URI),
      })
      return jsonResponse(200, payload, requestOrigin)
    }

    if (method === 'POST' && path === '/api/auth/salesforce/refresh') {
      const refreshToken = typeof body.refreshToken === 'string' ? body.refreshToken : ''
      if (!refreshToken) {
        return jsonResponse(400, { error: 'Missing refresh token.' }, requestOrigin)
      }

      const payload = await salesforceTokenRequest({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: trimEnv(process.env.SF_CLIENT_ID),
        client_secret: trimEnv(process.env.SF_CLIENT_SECRET),
      })
      return jsonResponse(200, payload, requestOrigin)
    }

    if (method === 'POST' && path === '/api/salesforce/request') {
      const { statusCode, payload } = await proxySalesforceRequest(body)
      return jsonResponse(statusCode, payload, requestOrigin)
    }

    if (method === 'POST' && path === '/api/bedrock/events-summary') {
      const payload = await handleEventsSummary(body)
      return jsonResponse(200, payload, requestOrigin)
    }

    return jsonResponse(404, { error: 'Route not found.' }, requestOrigin)
  } catch (error) {
    const statusCode = Number.isFinite(error?.statusCode) ? error.statusCode : 500
    const message = error instanceof Error ? error.message : 'Unexpected server error.'
    return jsonResponse(statusCode, { error: message }, requestOrigin)
  }
}
