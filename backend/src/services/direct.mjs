import { normalizeBaseUrl, trimEnv } from '../lib/env.mjs'
import { parseUpstreamResponse } from '../lib/http.mjs'

export const directforceTokenRequest = async (params) => {
  const tokenUrl =
    trimEnv(process.env.DIRECT_TOKEN_URL) || 'https://directdev.feel-on.com/oauth2/token'

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
        : 'Direct token request failed.'
    const error = new Error(message)
    error.statusCode = response.status
    throw error
  }
  return payload
}

export const directUserInfo = async (params) => {
  const baseUrl = normalizeBaseUrl(
    trimEnv(process.env.DIRECT_REST_API, 'https://restapi-directdev.feel-on.com'),
  )
  const url = `${baseUrl}/albero-app-server/users/me/openIdConnect`
  const token = typeof params.token === 'string' ? params.token : ''
  if (!token) {
    const error = new Error('Missing access token')
    error.statusCode = 400
    throw error
  }
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Bearer ${token}`,
    },
  })

  const payload = await parseUpstreamResponse(response)
  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && typeof payload.error_description === 'string'
        ? payload.error_description
        : 'User info request failed.'
    const error = new Error(message)
    error.statusCode = response.status
    throw error
  }
  return payload
}

export const directForceLogout = async (params) => {
  const url =
    trimEnv(process.env.DIRECT_LOGOUT_URL) ||
    `${normalizeBaseUrl(trimEnv(process.env.DIRECT_REST_API, 'https://directdev.feel-on.com'))}/oauth2/revoke`
  const token = typeof params.token === 'string' ? params.token : ''
  if (!token) {
    const error = new Error('Missing access token')
    error.statusCode = 400
    throw error
  }
  const body = new URLSearchParams({
    token,
    client_id: trimEnv(process.env.DIRECT_CLIENT_ID),
    client_secret: trimEnv(process.env.DIRECT_CLIENT_SECRET),
  }).toString()
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  })
  const payload = await parseUpstreamResponse(resp)
  if (!resp.ok) {
    const error = new Error(`revoke failed: ${resp.status}`)
    error.statusCode = resp.status
    throw error
  }
  return payload && typeof payload === 'object' ? payload : { success: true }
}

export const directOrganizationList = async (params) => {
  const token = typeof params.token === 'string' ? params.token.trim() : ''
  if (!token) {
    const error = new Error('Missing access token')
    error.statusCode = 400
    throw error
  }

  const baseUrl = normalizeBaseUrl(
    trimEnv(process.env.DIRECT_REST_API, 'https://restapi-directdev.feel-on.com'),
  )
  const url = `${baseUrl}/albero-app-server/domains`
  console.log('URL of the server is:', url)
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  })
  console.log('Response from the sever is:', response)

  const payload = await parseUpstreamResponse(response)
  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && typeof payload.error_description === 'string'
        ? payload.error_description
        : 'Direct organization list request failed.'
    const error = new Error(message)
    error.statusCode = response.status
    throw error
  }

  return payload
}

export const directOrganizationUserList = async (params) => {
  const token = typeof params.token === 'string' ? params.token.trim() : ''
  if (!token) {
    const error = new Error('Missing access token')
    error.statusCode = 400
    throw error
  }

  const domainId =
    (typeof params.domainId === 'string' ? params.domainId.trim() : '') ||
    trimEnv(process.env.DIRECT_DOMAIN_ID)
  if (!domainId) {
    const error = new Error('Missing Direct domain id')
    error.statusCode = 400
    throw error
  }

  const limitValue = Number(params.limit)
  const offsetValue = Number(params.offset)
  const limit = Number.isFinite(limitValue) && limitValue > 0 ? Math.floor(limitValue) : 50
  const offset = Number.isFinite(offsetValue) && offsetValue >= 0 ? Math.floor(offsetValue) : 0

  const baseUrl = normalizeBaseUrl(
    trimEnv(process.env.DIRECT_REST_API, 'https://restapi-directdev.feel-on.com'),
  )
  const url = new URL(`${baseUrl}/rest/1/domains/${domainId}/members`)
  url.searchParams.set('limit', String(limit))
  url.searchParams.set('offset', String(offset))
  console.log('URL of the direct is:', url)
  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  })
  console.log('Response from the sever is:', response)

  const payload = await parseUpstreamResponse(response)
  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && typeof payload.error_description === 'string'
        ? payload.error_description
        : 'Direct organization user list request failed.'
    const error = new Error(message)
    error.statusCode = response.status
    throw error
  }

  return payload
}
