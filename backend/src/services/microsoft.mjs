import { normalizeBaseUrl, trimEnv } from '../lib/env.mjs'
import { parseUpstreamResponse } from '../lib/http.mjs'

const buildTokenUrl = () => {
  const baseUrl = normalizeBaseUrl(
    trimEnv(process.env.MICROSOFT_TOKEN_URL, 'https://login.microsoftonline.com'),
  )
  const tenantId = trimEnv(process.env.MICROSOFT_TENANT_ID)
  if (!tenantId) {
    throw new Error('Missing MICROSOFT_TENANT_ID.')
  }
  return `${baseUrl}/${tenantId}/oauth2/v2.0/token`
}

export const microsoftforceTokenRequest = async (params) => {
  const tokenURL = buildTokenUrl()
  const response = await fetch(tokenURL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString(),
  })
  const payload = await parseUpstreamResponse(response)
  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && typeof payload.error_description === 'string'
        ? payload.error_description
        : 'Microsoft token request failed.'
    const error = new Error(message)
    error.statusCode = response.status
    throw error
  }
  return payload
}

export const microsoftRefreshTokenRequest = async (params) => {
  const refreshToken = typeof params.refreshToken === 'string' ? params.refreshToken.trim() : ''
  if (!refreshToken) {
    const error = new Error('Missing refresh token.')
    error.statusCode = 400
    throw error
  }
  const tokenURL = buildTokenUrl()
  const response = await fetch(tokenURL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: trimEnv(process.env.MICROSOFT_CLIENT_ID),
    }).toString(),
  })
  const payload = await parseUpstreamResponse(response)
  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && typeof payload.error_description === 'string'
        ? payload.error_description
        : 'Microsoft token refresh failed.'
    const error = new Error(message)
    error.statusCode = response.status
    throw error
  }
  return payload
}
