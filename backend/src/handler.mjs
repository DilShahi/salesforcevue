import { trimEnv } from './lib/env.mjs'
import { getMethod, getPath, parseBody } from './lib/http.mjs'
import { handleEventsSummary } from './services/bedrock.mjs'
import {
  directForceLogout,
  directOrganizationList,
  directOrganizationUserList,
  directUserInfo,
  directforceTokenRequest,
} from './services/direct.mjs'
import { proxySalesforceRequest, salesforceTokenRequest } from './services/salesforce.mjs'

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

const readBearerToken = (event, body) => {
  const authHeader = event?.headers?.authorization || event?.headers?.Authorization || ''
  const bearerToken =
    typeof authHeader === 'string' && authHeader.toLowerCase().startsWith('bearer ')
      ? authHeader.slice(7).trim()
      : ''

  return typeof body.token === 'string' && body.token ? body.token : bearerToken
}

export const handler = async (event) => {
  const requestOrigin = event?.headers?.origin || event?.headers?.Origin || ''
  const method = getMethod(event)
  const path = getPath(event)
  const query = event?.queryStringParameters || {}

  if (method === 'OPTIONS') {
    return emptyResponse(204, requestOrigin)
  }

  const body = parseBody(event)
  if (body === null) {
    return jsonResponse(400, { error: 'Invalid JSON body.' }, requestOrigin)
  }

  try {
    if (method === 'POST' && path === '/api/auth/direct/token') {
      const code = typeof body.code === 'string' ? body.code : ''
      if (!code) {
        return jsonResponse(400, { error: 'Missing authorization code.' }, requestOrigin)
      }
      const payload = await directforceTokenRequest({
        grant_type: 'authorization_code',
        code,
        client_id: trimEnv(process.env.DIRECT_CLIENT_ID),
        client_secret: trimEnv(process.env.DIRECT_CLIENT_SECRET),
        redirect_uri: trimEnv(process.env.DIRECT_REDIRECT_URI),
      })
      return jsonResponse(200, payload, requestOrigin)
    }

    if (method === 'POST' && path === '/api/auth/direct/refresh') {
      const refreshToken = typeof body.refreshToken === 'string' ? body.refreshToken : ''
      if (!refreshToken) {
        return jsonResponse(400, { error: 'Missing refresh token.' }, requestOrigin)
      }
      const payload = await directforceTokenRequest({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: trimEnv(process.env.DIRECT_CLIENT_ID),
        client_secret: trimEnv(process.env.DIRECT_CLIENT_SECRET),
      })
      return jsonResponse(200, payload, requestOrigin)
    }

    if (method === 'POST' && path === '/api/auth/direct/userinfo') {
      const token = readBearerToken(event, body)
      if (!token) {
        return jsonResponse(400, { error: 'Missing access token' }, requestOrigin)
      }
      const payload = await directUserInfo({ token })
      return jsonResponse(200, payload, requestOrigin)
    }

    if (method === 'POST' && path === '/api/auth/direct/logout') {
      const token = readBearerToken(event, body)
      if (!token) {
        return jsonResponse(400, { error: 'Missing access token' }, requestOrigin)
      }
      const payload = await directForceLogout({ token })
      return jsonResponse(200, payload, requestOrigin)
    }

    if (method === 'GET' && path === '/api/direct/organization') {
      const token = readBearerToken(event, body)
      if (!token) {
        return jsonResponse(400, { error: 'Missing access token' }, requestOrigin)
      }
      const payload = await directOrganizationList({ token })
      return jsonResponse(200, payload, requestOrigin)
    }

    if (method === 'GET' && path.match(/^\/api\/direct\/([^/]+)\/users$/)) {
      const token = readBearerToken(event, body)
      if (!token) {
        return jsonResponse(400, { error: 'Missing access token' }, requestOrigin)
      }
      const domainId = decodeURIComponent(path.match(/^\/api\/direct\/([^/]+)\/users$/)[1])
      console.log('Doamin ID of the organization is:', domainId)
      const payload = await directOrganizationUserList({
        token,
        domainId,
        limit: query.limit,
        offset: query.offset,
      })
      return jsonResponse(200, payload, requestOrigin)
    }

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
