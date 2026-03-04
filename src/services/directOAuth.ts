import { ENV } from '@/config/env'

const normalizeBaseUrl = (url: string) => url.replace(/\/+$/, '')

const OAUTH_STATE_STORAGE_KEY = 'direct_oauth_state'
const OAUTH_SESSION_STORAGE_KEY = 'direct_oauth_session'
const AUTH_CHANGED_EVENT = 'direct-auth-changed'

type DirectTokenResponse = {
  access_token: string
  refresh_token?: string
  id_token: string
  scope?: string
  token_type: string
  expires_in: number
}

type DirectAuthSession = {
  accessToken: string
  refreshToken?: string
  tokenType: string
  state: string
  scope?: string
  savedAt: string
}

const DIRECT = {
  clientId: ENV.direct.clientId,
  clientSecret: ENV.direct.clientSecret,
  redirectUrl: ENV.direct.redirectUrl,
  restApi: normalizeBaseUrl(ENV.direct.restApi),
}

const apiUrl = (path: string) => {
  const configured = ENV.apiBaseUrl
  if (!configured) {
    throw new Error(
      'Missing Direct base url. Configure it to your API Gateway base URL for both development and production.',
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
  const state = `okicom-state:${Date.now()}`

  if (typeof window !== 'undefined') {
    window.sessionStorage.setItem(OAUTH_STATE_STORAGE_KEY, state)
  }

  return state
}

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

export const buildDirectAuthorizeUrl = () => {
  const { clientId, clientSecret, redirectUrl, restApi, scopes } = ENV.direct
  if (!clientId || !clientSecret || !redirectUrl) {
    throw new Error(
      'Missing direct OAuth env values. Required: DIRECT_CLIENT_ID, DIRECT_CLIENT_SECRET and DIRECT_REDIRECT_URL',
    )
  }
  const url = new URL(`${normalizeBaseUrl(restApi)}/oauth2/authorize`)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', redirectUrl)
  url.searchParams.set('scope', scopes)
  url.searchParams.set('state', buildOAuthState())
  url.searchParams.set('nonce', randomString(24))
  return url.toString()
}

export const redirectToDirectLogin = () => {
  const authorizeUrl = buildDirectAuthorizeUrl()
  window.location.assign(authorizeUrl)
}

const fetchDirectForceToken = async (payload: Record<string, string>) => {
  const response = await fetch(apiUrl('/api/auth/direct/token'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  console.log('Response value is:', response)
  const rawText = await response.text()
  console.log('Raw text value is:', rawText)
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
        : 'Failed to exchange direct authorization code.'
    throw new Error(message)
  }
  const token = data as unknown as DirectTokenResponse
  if (!token.access_token || !token.token_type || !token.id_token) {
    throw new Error(
      'Invalid token response from /api/auth/direct/token. Check production /api routing and backend response',
    )
  }
  return token
}

const mapTokenToSession = (
  token: DirectTokenResponse,
  state: string,
  existingRefreshToken?: string,
): DirectAuthSession => {
  return {
    accessToken: token.access_token,
    refreshToken: token.refresh_token || existingRefreshToken,
    tokenType: token.token_type,
    state,
    scope: token.scope,
    savedAt: new Date().toISOString(),
  }
}

const saveDirectSession = (session: DirectAuthSession) => {
  if (typeof window === 'undefined') return
  localStorage.setItem(OAUTH_SESSION_STORAGE_KEY, JSON.stringify(session))
  console.log('Data successfully saved in localstorage')
  dispatchEvent(new CustomEvent(AUTH_CHANGED_EVENT))
}

export const handleDirectForceOAuthCallback = async (code: string, state: string) => {
  console.log('Handle direct oauth callback is triggered....')
  if (typeof window === 'undefined') {
    throw new Error('OAuth callback requires a browser environment')
  }
  const expectedState = window.sessionStorage.getItem(OAUTH_STATE_STORAGE_KEY)
  if (expectedState && expectedState !== state) {
    throw new Error('OAuth state mismatch. Please try signing in again.')
  }
  const token = await fetchDirectForceToken({ code })
  const session = mapTokenToSession(token, state)
  console.log('Token value is:', token)
  console.log('Session value is:', session)
  saveDirectSession(session)
  window.sessionStorage.removeItem(OAUTH_STATE_STORAGE_KEY)
  return token
}
