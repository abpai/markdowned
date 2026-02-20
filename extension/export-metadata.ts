const MAX_FILE_NAME_LENGTH = 120
export const UNTITLED_PAGE = 'Untitled Page'

const UUID_LIKE_TITLE_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type ExportTitleInput = {
  preferredTitle?: string | null
  readabilityTitle?: string | null
  documentTitle?: string | null
  url: string
}

const sanitizeText = (value: string): string => {
  return value.replace(/\s+/g, ' ').trim()
}

const normalizeText = (value: string | null | undefined): string => {
  return value ? sanitizeText(value) : ''
}

const sanitizeFileName = (value: string): string => {
  const name = normalizeText(value).toLowerCase()
  const cleaned = name
    .replace(/[^a-z0-9\s-_]/gi, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  const base = cleaned || 'markdowned-page'
  const truncated = base.slice(0, MAX_FILE_NAME_LENGTH).trim().replace(/-+$/, '')
  return `${truncated || 'markdowned-page'}.md`
}

const isLowSignalTitle = (title: string): boolean => {
  const normalized = normalizeText(title)
  if (!normalized) {
    return true
  }

  if (normalized.toLowerCase() === UNTITLED_PAGE.toLowerCase()) {
    return true
  }

  if (UUID_LIKE_TITLE_PATTERN.test(normalized)) {
    return true
  }

  const alphanumeric = normalized.replace(/[^a-z0-9]/gi, '')
  if (alphanumeric.length < 3) {
    return true
  }

  const hasLetter = /[a-z]/i.test(alphanumeric)
  if (!hasLetter && /\d/.test(alphanumeric)) {
    return true
  }

  return false
}

const getHostFallbackTitle = (url: string): string => {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./i, '')
    const normalizedHostname = normalizeText(hostname)
    if (normalizedHostname) {
      return normalizedHostname
    }
  } catch {
    // Ignore malformed URL and use generic fallback.
  }

  return 'markdowned-page'
}

export const selectExportTitle = ({
  preferredTitle,
  readabilityTitle,
  documentTitle,
  url,
}: ExportTitleInput): string => {
  const candidates = [readabilityTitle, preferredTitle, documentTitle]

  for (const candidate of candidates) {
    const normalized = normalizeText(candidate)
    if (!isLowSignalTitle(normalized)) {
      return normalized
    }
  }

  return getHostFallbackTitle(url)
}

export const buildExportFileName = (title: string, extractedAt: string): string => {
  return sanitizeFileName(`${title}-${extractedAt.slice(0, 10)}`)
}
