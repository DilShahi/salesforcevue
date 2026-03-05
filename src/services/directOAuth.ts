import { ENV } from '@/config/env'

const normalizeBaseUrl = (url: string) => url.replace(/\/+$/, '')

const OAUTH_STATE_STORAGE_KEY = 'direct_oauth_state'
const OAUTH_SESSION_STORAGE_KEY = 'direct_oauth_session'
const OAUTH_SESSION_INFO = 'direct_user_info'
export const DIRECT_AUTH_CHANGED_EVENT = 'direct-auth-changed'

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

type LoggedInUserInfo = {
  email: string
  name: string
  sub: string
}

export type DirectOrganization = {
  domain_id: number
  domain_id_str: string
  domain_name: string
  updated_at: number
  role?: {
    role_id: number
    name: string
    type: number
  }
}

export type DirectOrganizationUser = {
  user_id?: number | string
  user_id_str?: string
  name?: string
  kana?: string
  display_name?: string
  email?: string
  role_id?: number
  last_used_at?: number
  last_used_at_str?: string
  [key: string]: unknown
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
  console.log('Scopes is:', scopes)
  const url = new URL(`${normalizeBaseUrl(restApi)}/oauth2/authorize`)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', redirectUrl)
  url.searchParams.set('scope', scopes)
  url.searchParams.set('state', buildOAuthState())
  url.searchParams.set('nonce', randomString(24))
  url.searchParams.set('prompt', 'consent') // it is necessary to get refresh token
  return url.toString()
}

export const redirectToDirectLogin = () => {
  const authorizeUrl = buildDirectAuthorizeUrl()
  window.location.assign(authorizeUrl)
}

const directLogout = async (session: DirectAuthSession | null) => {
  if (!session?.accessToken) return

  const response = await fetch(apiUrl('/api/auth/direct/logout'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `${session.tokenType || 'Bearer'} ${session.accessToken}`,
    },
    body: JSON.stringify({
      token: session.accessToken,
    }),
  })

  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>
  if (!response.ok) {
    const message =
      typeof payload.error === 'string' ? payload.error : 'Failed to logout from Direct.'
    throw new Error(message)
  }
}

const fetchDirectForceToken = async (payload: Record<string, string>) => {
  const response = await fetch(apiUrl('/api/auth/direct/token'), {
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

const mapIdToken = (info: any): LoggedInUserInfo => {
  return {
    email: info.email,
    name: info.name,
    sub: info.sub,
  }
}

const saveDirectSession = (session: DirectAuthSession) => {
  if (typeof window === 'undefined') return
  localStorage.setItem(OAUTH_SESSION_STORAGE_KEY, JSON.stringify(session))
  console.log('Data successfully saved in localstorage')
  dispatchEvent(new CustomEvent(DIRECT_AUTH_CHANGED_EVENT))
}

const saveUserInfo = (info: LoggedInUserInfo) => {
  if (typeof window === 'undefined') return
  localStorage.setItem(OAUTH_SESSION_INFO, JSON.stringify(info))
}

export const getDirectSession = (): DirectAuthSession | null => {
  if (typeof window === 'undefined') return null

  const raw = window.localStorage.getItem(OAUTH_SESSION_STORAGE_KEY)
  if (!raw) return null

  try {
    return JSON.parse(raw) as DirectAuthSession
  } catch {
    window.localStorage.removeItem(OAUTH_SESSION_STORAGE_KEY)
    return null
  }
}

export const clearDirectSession = async () => {
  if (typeof window === 'undefined') return
  const session = getDirectSession()
  try {
    await directLogout(session)
  } catch (error) {
    console.error('Direct logout request failed:', error)
  }
  window.localStorage.removeItem(OAUTH_SESSION_STORAGE_KEY)
  window.localStorage.removeItem(OAUTH_SESSION_INFO)
  window.sessionStorage.removeItem(OAUTH_STATE_STORAGE_KEY)
  dispatchEvent(new CustomEvent(DIRECT_AUTH_CHANGED_EVENT))
}

const getLoggedInUserInfo = async (accessToken: string) => {
  const response = await fetch(apiUrl('/api/auth/direct/userinfo'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
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
        : 'Failed to get logged in user info.'
    throw new Error(message)
  }
  return data as LoggedInUserInfo
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
  console.log('Session value is:', session)
  saveDirectSession(session)
  const response = await getLoggedInUserInfo(token.access_token ?? '')
  const info = mapIdToken(response)
  saveUserInfo(info)
  window.sessionStorage.removeItem(OAUTH_STATE_STORAGE_KEY)
  return token
}

export const fetchDirectOrganizationList = async () => {
  const session = getDirectSession()
  if (!session?.accessToken) {
    throw new Error('No Direct session found. Please sign in first.')
  }

  const response = await fetch(apiUrl('/api/direct/organization'), {
    method: 'GET',
    headers: {
      Authorization: `${session.tokenType || 'Bearer'} ${session.accessToken}`,
      Accept: 'application/json',
    },
  })

  const payload = (await response.json().catch(() => [])) as unknown
  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && !Array.isArray(payload) && 'error' in payload
        ? String((payload as Record<string, unknown>).error || '')
        : 'Failed to fetch organizations.'
    throw new Error(message || 'Failed to fetch organizations.')
  }

  return (Array.isArray(payload) ? payload : []) as DirectOrganization[]
}

export const fetchDirectOrganizationUserList = async (
  domainId: string,
  options?: { limit?: number; offset?: number },
) => {
  const session = getDirectSession()
  if (!session?.accessToken) {
    throw new Error('No Direct session found. Please sign in first.')
  }
  if (!domainId) {
    throw new Error('Missing domain id.')
  }

  const query = new URLSearchParams()
  if (typeof options?.limit === 'number') query.set('limit', String(options.limit))
  if (typeof options?.offset === 'number') query.set('offset', String(options.offset))
  const suffix = query.toString() ? `?${query.toString()}` : ''

  const response = await fetch(apiUrl(`/api/direct/${encodeURIComponent(domainId)}/users${suffix}`), {
    method: 'GET',
    headers: {
      Authorization: `${session.tokenType || 'Bearer'} ${session.accessToken}`,
      Accept: 'application/json',
    },
  })

  const payload = (await response.json().catch(() => ({}))) as unknown
  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && !Array.isArray(payload) && 'error' in payload
        ? String((payload as Record<string, unknown>).error || '')
        : 'Failed to fetch organization users.'
    throw new Error(message || 'Failed to fetch organization users.')
  }

  if (Array.isArray(payload)) {
    return payload as DirectOrganizationUser[]
  }
  if (payload && typeof payload === 'object') {
    const objectPayload = payload as Record<string, unknown>
    if (Array.isArray(objectPayload.contents)) return objectPayload.contents as DirectOrganizationUser[]
    if (Array.isArray(objectPayload.members)) return objectPayload.members as DirectOrganizationUser[]
    if (Array.isArray(objectPayload.users)) return objectPayload.users as DirectOrganizationUser[]
    if (Array.isArray(objectPayload.data)) return objectPayload.data as DirectOrganizationUser[]
  }

  return []
}
