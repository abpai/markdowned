import { Readability } from '@mozilla/readability'
import TurndownService from 'turndown'

const EXPORT_PAGE_MARKDOWN = 'EXPORT_PAGE_MARKDOWN' as const
const DEFAULT_EXPORT_ERROR_MESSAGE = 'Failed to export page as markdown.'

type ExportRequest = {
  type: typeof EXPORT_PAGE_MARKDOWN
}

type ExportResponse =
  | {
      ok: true
      payload: {
        title: string
        url: string
        markdown: string
        fileName: string
        extractedAt: string
      }
    }
  | { ok: false; error: string }
type ExportSuccessResponse = Extract<ExportResponse, { ok: true }>

const MAX_URL_LENGTH = 2_048
const MAX_TITLE_LENGTH = 120
const MAX_FILE_NAME_LENGTH = 120
const TOAST_DURATION_MS = 2500
const EXPORTED_TOAST_TEXT = '✅ Copied & downloaded.'
const TOAST_ID = 'markdowned-toast'

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

const isExportRequest = (message: unknown): message is ExportRequest => {
  return (
    Boolean(message) &&
    typeof message === 'object' &&
    (message as Record<string, unknown>).type === EXPORT_PAGE_MARKDOWN
  )
}

const getReadableArticle = (): ReturnType<Readability['parse']> | null => {
  try {
    return new Readability(document.cloneNode(true) as Document).parse()
  } catch {
    return null
  }
}

const createMarkdownConverter = () => {
  return new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
    fence: '```',
    emDelimiter: '*',
    strongDelimiter: '**',
  })
}

const buildMarkdown = (
  article: ReturnType<Readability['parse']>,
  url: string,
  extractedAt: string,
): string => {
  const turndown = createMarkdownConverter()
  const markdownTitle = sanitizeText(article?.title || document.title || 'Untitled Page')
  const markdownBodySource = article?.content || document.documentElement?.outerHTML || ''
  const markdownBody = turndown.turndown(markdownBodySource)

  return [
    `# ${markdownTitle}`,
    '',
    `Source: ${url}`,
    `Generated: ${extractedAt}`,
    '',
    markdownBody.trim(),
    '',
  ].join('\n')
}

const isSupportedProtocol = (protocol: string): protocol is 'http:' | 'https:' => {
  return protocol === 'http:' || protocol === 'https:'
}

const downloadMarkdown = (markdown: string, fileName: string): void => {
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' })
  const objectUrl = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = objectUrl
  link.download = fileName
  link.rel = 'noopener'
  link.style.display = 'none'

  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(objectUrl)
}

const copyToClipboard = async (markdown: string): Promise<void> => {
  if (!navigator.clipboard?.writeText) {
    throw new Error('Clipboard API unavailable in this context.')
  }

  await navigator.clipboard.writeText(markdown)
}

const buildTitle = (article: ReturnType<Readability['parse']>): string => {
  const normalizedTitle = normalizeText(article?.title || document.title || 'Untitled Page')
  const truncatedTitle = normalizedTitle.slice(0, MAX_TITLE_LENGTH)
  return truncatedTitle || 'Untitled Page'
}

const getErrorMessage = (error: unknown, fallback: string): string => {
  return error instanceof Error ? error.message : fallback
}

const showToast = (message: string, isError = false): void => {
  document.getElementById(TOAST_ID)?.remove()

  const toast = document.createElement('div')
  toast.id = TOAST_ID
  toast.textContent = message
  toast.style.position = 'fixed'
  toast.style.left = '50%'
  toast.style.bottom = '28px'
  toast.style.transform = 'translateX(-50%)'
  toast.style.zIndex = '2147483647'
  toast.style.padding = '10px 14px'
  toast.style.borderRadius = '10px'
  toast.style.fontFamily = 'ui-sans-serif, system-ui, sans-serif'
  toast.style.fontSize = '13px'
  toast.style.lineHeight = '1.4'
  toast.style.color = '#fff'
  toast.style.background = isError ? '#b91c1c' : '#0f766e'
  toast.style.boxShadow = '0 8px 20px rgba(0, 0, 0, 0.22)'
  toast.style.opacity = '0'
  toast.style.transition = 'opacity 150ms ease, transform 150ms ease'
  toast.style.pointerEvents = 'none'
  toast.style.maxWidth = '85vw'
  toast.style.textAlign = 'center'
  toast.style.border = `1px solid ${isError ? 'rgba(248, 113, 113, 0.45)' : 'rgba(45, 212, 191, 0.45)'}`

  document.body.appendChild(toast)

  requestAnimationFrame(() => {
    toast.style.opacity = '1'
    toast.style.transform = 'translateX(-50%) translateY(-2px)'
  })

  window.setTimeout(() => {
    toast.style.opacity = '0'
    toast.style.transform = 'translateX(-50%) translateY(4px)'
    window.setTimeout(() => toast.remove(), 180)
  }, TOAST_DURATION_MS)
}

const buildPayload = (
  article: ReturnType<Readability['parse']>,
  url: string,
  markdown: string,
  extractedAt: string,
): ExportSuccessResponse => {
  const title = buildTitle(article)
  const fileName = sanitizeFileName(`${title}-${extractedAt.slice(0, 10)}`)

  return {
    ok: true,
    payload: {
      title,
      url,
      markdown,
      fileName,
      extractedAt,
    },
  }
}

chrome.runtime.onMessage.addListener(
  (message, _sender, sendResponse: (response: ExportResponse) => void) => {
    if (!isExportRequest(message)) {
      return false
    }

    void (async () => {
      try {
        const protocol = window.location.protocol.toLowerCase()
        if (!isSupportedProtocol(protocol)) {
          throw new Error(`Unsupported protocol: ${protocol}`)
        }

        const url = normalizeText(window.location.href)
        if (!url) {
          throw new Error('No URL available for this page.')
        }

        if (url.length > MAX_URL_LENGTH) {
          throw new Error('Current URL is too long to export safely.')
        }

        const article = getReadableArticle()
        const extractedAt = new Date().toISOString()
        const markdown = buildMarkdown(article, url, extractedAt)
        const payload = buildPayload(article, url, markdown, extractedAt)

        await copyToClipboard(markdown)
        downloadMarkdown(markdown, payload.payload.fileName)
        showToast(EXPORTED_TOAST_TEXT)

        sendResponse(payload)
      } catch (error) {
        const message = getErrorMessage(error, DEFAULT_EXPORT_ERROR_MESSAGE)
        showToast(message, true)
        sendResponse({ ok: false, error: message })
      }
    })()

    return true
  },
)
