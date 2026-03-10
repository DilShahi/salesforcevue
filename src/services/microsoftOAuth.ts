import { ENV } from '@/config/env'

type MicrosoftTokenResponse = {
  token_type: string
  scope?: string
  expires_in: number
  access_token: string
  refresh_token?: string
  id_token?: string
}

type MicrosoftAuthSession = {
  accessToken: string
  refreshToken?: string
  tokenType: string
  state: string
  scope?: string
  savedAt: string
}

const normalizeBaseUrl = (url: string) => url.replace(/\/+$/, '')

const OAUTH_STATE_STORAGE_KEY = 'microsoft_oauth_state'
const OAUTH_SESSION_STORAGE_KEY = 'microsoft_oauth_session'
const OAUTH_SESSION_INFO = 'microsoft_user_info'
export const DIRECT_AUTH_CHANGED_EVENT = 'microsoft-auth-changed'

const randomString = (len = 32) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let out = ''
  const arr = new Uint32Array(len)
  window.crypto.getRandomValues(arr)
  for (const value of arr) {
    out += chars[value % chars.length]
  }
  return out
}

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

const buildOAuthState = () => {
  const alias = ENV.salesforce.aliasName || 'microsoft-okicom'
  const state = `${alias}:${Date.now()}`

  if (typeof window !== 'undefined') {
    window.sessionStorage.setItem(OAUTH_STATE_STORAGE_KEY, state)
  }

  return state
}

export const buildMicrosoftAuthorizeUrl = () => {
  const { clientId, clientSecret, redirectUrl, scopes, loginUrl, tenantId } = ENV.microsoft
  if (!clientId || !clientSecret || !redirectUrl) {
    throw new Error(
      'Missing microsoft OAuth env values. Required: MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET and MICROSOFT_REDIRECT_URI',
    )
  }
  console.log('Scopes is:', scopes)
  const url = new URL(`${normalizeBaseUrl(loginUrl)}/${tenantId}/oauth2/v2.0/authorize`)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', redirectUrl)
  url.searchParams.set('scope', scopes)
  url.searchParams.set('state', buildOAuthState())
  url.searchParams.set('prompt', 'consent')
  url.searchParams.set('nonce', randomString(24))
  return url.toString()
}

export const redirectToMicrosoftLogin = () => {
  const authorizeUrl = buildMicrosoftAuthorizeUrl()
  window.location.assign(authorizeUrl)
}

export const handleMicrosoftOAuthCallback = async (code: string, state: string) => {
  console.log('Handle salesforce oauth callback is triggered....')
  if (typeof window === 'undefined') {
    throw new Error('OAuth callback requires a browser environment.')
  }
  const expectedState = window.sessionStorage.getItem(OAUTH_STATE_STORAGE_KEY)
  if (expectedState && expectedState !== state) {
    throw new Error('OAuth state mismatch. Please try signing in again.')
  }

  const token = await fetchMicrosoftforceToken({ code })
  const session = mapTokenToSession(token, state)
  console.log('SEssion value is:;', session)
  saveMicrosoftSession(session)
  window.sessionStorage.removeItem(OAUTH_STATE_STORAGE_KEY)
  return session
}

const fetchMicrosoftforceToken = async (payload: Record<string, string>) => {
  const response = await fetch(apiUrl('/api/auth/microsoft/token'), {
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
  console.log('Data from the server is:', data)
  if (!response.ok) {
    const message =
      typeof data.error_description === 'string'
        ? data.error_description
        : 'Failed to exchange microsoft authorization code.'
    throw new Error(message)
  }
  const token = data as unknown as MicrosoftTokenResponse
  if (!token.access_token || !token.token_type) {
    throw new Error(
      'Invalid token response from /api/auth/microsoft/token. Check production /api routing and backend response.',
    )
  }
  return token
}

const mapTokenToSession = (
  token: MicrosoftTokenResponse,
  state: string,
  existingRefreshToken?: string,
): MicrosoftAuthSession => {
  return {
    accessToken: token.access_token,
    refreshToken: token.refresh_token || existingRefreshToken,
    tokenType: token.token_type,
    state,
    scope: token.scope,
    savedAt: new Date().toISOString(),
  }
}

const saveMicrosoftSession = (session: MicrosoftAuthSession) => {
  if (typeof window === 'undefined') return
  localStorage.setItem(OAUTH_SESSION_STORAGE_KEY, JSON.stringify(session))
  console.log('Data successfully saved in localstorage')
  dispatchEvent(new CustomEvent(DIRECT_AUTH_CHANGED_EVENT))
}

export const getMicrosoftSession = (): MicrosoftAuthSession | null => {
  if (typeof window === 'undefined') return null
  const raw = window.localStorage.getItem(OAUTH_SESSION_STORAGE_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as MicrosoftAuthSession
  } catch {
    window.localStorage.removeItem(OAUTH_SESSION_STORAGE_KEY)
    return null
  }
}

export const clearMicrosoftSession = () => {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(OAUTH_SESSION_STORAGE_KEY)
  window.localStorage.removeItem(OAUTH_SESSION_INFO)
  window.sessionStorage.removeItem(OAUTH_STATE_STORAGE_KEY)
  dispatchEvent(new CustomEvent(DIRECT_AUTH_CHANGED_EVENT))
}

const fetchMicrosoftRefreshToken = async (payload: Record<string, string>) => {
  const response = await fetch(apiUrl('/api/auth/microsoft/refresh'), {
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
        : typeof data.error === 'string'
          ? data.error
          : 'Failed to refresh Microsoft access token.'
    throw new Error(message)
  }
  const token = data as unknown as MicrosoftTokenResponse
  if (!token.access_token || !token.token_type) {
    throw new Error('Invalid token response from /api/auth/microsoft/refresh.')
  }
  return token
}

export const refreshMicrosoftAccessToken = async () => {
  const session = getMicrosoftSession()
  if (!session?.refreshToken) {
    throw new Error('No Microsoft refresh token is available.')
  }
  const token = await fetchMicrosoftRefreshToken({ refreshToken: session.refreshToken })
  const updatedSession = mapTokenToSession(token, session.state, session.refreshToken)
  saveMicrosoftSession(updatedSession)
  return updatedSession
}

const performMicrosoftAuthorizedRequest = async (session: MicrosoftAuthSession, path: string) => {
  return fetch(apiUrl(path), {
    method: 'GET',
    headers: {
      Authorization: `${session.tokenType || 'Bearer'} ${session.accessToken}`,
      Accept: 'application/json',
    },
  })
}

export const microsoftApiFetch = async (path: string) => {
  const session = getMicrosoftSession()
  if (!session?.accessToken) {
    throw new Error('No Microsoft session found. Please sign in first.')
  }

  let response = await performMicrosoftAuthorizedRequest(session, path)
  if (response.status !== 401) {
    return response
  }

  try {
    const refreshedSession = await refreshMicrosoftAccessToken()
    response = await performMicrosoftAuthorizedRequest(refreshedSession, path)
    if (response.status === 401) {
      clearMicrosoftSession()
      throw new Error('Microsoft session expired. Please sign in again.')
    }
    return response
  } catch {
    clearMicrosoftSession()
    throw new Error('Microsoft session expired. Please sign in again.')
  }
}
