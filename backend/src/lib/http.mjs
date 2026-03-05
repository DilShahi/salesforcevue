export const parseUpstreamResponse = async (response) => {
  const text = await response.text()
  try {
    return text ? JSON.parse(text) : {}
  } catch {
    return text
  }
}

export const getMethod = (event) =>
  event?.requestContext?.http?.method || event?.httpMethod || 'GET'

export const getPath = (event) =>
  event?.rawPath || event?.path || event?.requestContext?.http?.path || '/'

export const parseBody = (event) => {
  if (!event?.body) return {}
  try {
    const raw = event.isBase64Encoded
      ? Buffer.from(event.body, 'base64').toString('utf-8')
      : event.body
    return raw ? JSON.parse(raw) : {}
  } catch {
    return null
  }
}
