import { normalizeBaseUrl, trimEnv } from '../lib/env.mjs'
import { parseUpstreamResponse } from '../lib/http.mjs'

export const salesforceTokenRequest = async (params) => {
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

export const proxySalesforceRequest = async (body) => {
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
