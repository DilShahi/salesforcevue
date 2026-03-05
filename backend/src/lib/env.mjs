export const normalizeBaseUrl = (url) => String(url || '').replace(/\/+$/, '')

export const trimEnv = (value, fallback = '') => {
  if (!value) return fallback
  const trimmed = String(value).trim()
  const match = trimmed.match(/^"(.*)"$/)
  return (match ? match[1] : trimmed).trim()
}

export const envNumber = (value, fallback) => {
  const parsed = Number(trimEnv(value))
  return Number.isFinite(parsed) ? parsed : fallback
}
