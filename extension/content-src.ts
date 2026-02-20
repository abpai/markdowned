import { Readability } from '@mozilla/readability'
import TurndownService from 'turndown'
import { buildExportFileName, selectExportTitle, UNTITLED_PAGE } from './export-metadata.ts'

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
type ExtractedContent = {
  title: string
  html: string
  text: string
  readabilityTitle: string
  documentTitle: string
}

const MAX_URL_LENGTH = 2_048
const TOAST_DURATION_MS = 2500
const EXPORTED_TOAST_TEXT = '✅ Copied & downloaded.'
const TOAST_ID = 'markdowned-toast'
const MAIN_CONTENT_SELECTORS = ['main', '[role="main"]', 'article', '#main', '.main'] as const
const APP_STRUCTURE_HINT_SELECTORS = [
  '[data-testid*="message" i]',
  '[class*="message" i]',
  '[class*="chat" i]',
  '[class*="conversation" i]',
  '[class*="response" i]',
] as const
const NOISE_SELECTORS = [
  'script',
  'style',
  'noscript',
  'nav',
  'header',
  'footer',
  'aside',
  '[role="navigation"]',
  '[role="banner"]',
  '[role="complementary"]',
  '[aria-hidden="true"]',
  '[hidden]',
  '[class*="sidebar" i]',
  '[class*="sidenav" i]',
  '[class*="toolbar" i]',
  '[class*="tooltip" i]',
  '[class*="sr-only" i]',
] as const
const INTERACTIVE_ELEMENT_SELECTOR = 'button, a, input, textarea, select, [role="button"]'
const MAIN_CONTENT_INTERACTIVE_PRUNE_SELECTOR =
  'button, input, textarea, select, [role="button"], [aria-label*="menu" i]'
const HIDDEN_STYLE_MARKERS = ['display:none', 'visibility:hidden', 'opacity:0'] as const
const APP_SIGNAL_THRESHOLDS = {
  buttonCount: 20,
  interactiveCount: 30,
  appStructureCount: 2,
} as const
const CONTENT_QUALITY_THRESHOLDS = {
  appModeRatio: 1.35,
  shortReadabilityLength: 350,
  substantialMainLength: 600,
  strongMainRatio: 1.8,
  interactiveOnlyTextLength: 60,
} as const

const sanitizeText = (value: string): string => {
  return value.replace(/\s+/g, ' ').trim()
}

const normalizeText = (value: string | null | undefined): string => {
  return value ? sanitizeText(value) : ''
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

const getDocumentTitle = (): string => {
  return normalizeText(document.title || UNTITLED_PAGE)
}

const getMainContentRoot = (): globalThis.Element => {
  for (const selector of MAIN_CONTENT_SELECTORS) {
    const candidate = document.querySelector(selector)
    if (candidate instanceof globalThis.Element) {
      return candidate
    }
  }

  return document.body
}

const getSelectorMatchCount = (
  root: globalThis.Document | globalThis.Element,
  selectors: readonly string[],
): number => {
  return selectors.reduce((total, selector) => total + root.querySelectorAll(selector).length, 0)
}

const getAppSignalScore = (root: globalThis.Element): number => {
  const buttonCount = root.querySelectorAll('button').length
  const interactiveCount = root.querySelectorAll(INTERACTIVE_ELEMENT_SELECTOR).length
  const paragraphCount = root.querySelectorAll('p').length
  const editableCount = root.querySelectorAll('textarea, [contenteditable="true"]').length
  const appStructureCount = getSelectorMatchCount(root, APP_STRUCTURE_HINT_SELECTORS)

  let score = 0

  if (buttonCount >= APP_SIGNAL_THRESHOLDS.buttonCount) {
    score += 1
  }

  if (
    interactiveCount >= APP_SIGNAL_THRESHOLDS.interactiveCount &&
    interactiveCount > paragraphCount * 2
  ) {
    score += 1
  }

  if (editableCount > 0) {
    score += 1
  }

  if (appStructureCount >= APP_SIGNAL_THRESHOLDS.appStructureCount) {
    score += 1
  }

  return score
}

const hasHiddenInlineStyle = (element: globalThis.Element): boolean => {
  const style = element.getAttribute('style')?.toLowerCase() || ''
  return HIDDEN_STYLE_MARKERS.some((marker) => style.includes(marker))
}

const isLikelyInteractiveOnlyContainer = (element: globalThis.Element): boolean => {
  if (element.children.length === 0) {
    return false
  }

  const textLength = normalizeText(element.textContent).length
  const interactiveDescendants = element.querySelectorAll(INTERACTIVE_ELEMENT_SELECTOR).length
  const blockDescendants = element.querySelectorAll('p, li, pre, blockquote').length

  return (
    textLength < CONTENT_QUALITY_THRESHOLDS.interactiveOnlyTextLength &&
    interactiveDescendants > 0 &&
    blockDescendants === 0
  )
}

const pruneAppContentClone = (rootClone: globalThis.Element): void => {
  rootClone.querySelectorAll(NOISE_SELECTORS.join(',')).forEach((element) => element.remove())
  rootClone
    .querySelectorAll(MAIN_CONTENT_INTERACTIVE_PRUNE_SELECTOR)
    .forEach((element) => element.remove())

  rootClone.querySelectorAll('*').forEach((element) => {
    if (hasHiddenInlineStyle(element)) {
      element.remove()
      return
    }

    if (isLikelyInteractiveOnlyContainer(element)) {
      element.remove()
    }
  })
}

const getReadabilityCandidate = (): ExtractedContent | null => {
  const article = getReadableArticle()
  const text = normalizeText(article?.textContent)
  const html = article?.content || ''
  const documentTitle = getDocumentTitle() || UNTITLED_PAGE

  if (!html || text.length === 0) {
    return null
  }

  const title = normalizeText(article?.title || document.title || UNTITLED_PAGE)

  return {
    title,
    html,
    text,
    readabilityTitle: title,
    documentTitle,
  }
}

const getMainContentCandidate = (): ExtractedContent | null => {
  const sourceRoot = getMainContentRoot()
  const rootClone = sourceRoot.cloneNode(true)
  if (!(rootClone instanceof globalThis.Element)) {
    return null
  }

  pruneAppContentClone(rootClone)

  const html = rootClone.innerHTML.trim()
  const text = normalizeText(rootClone.textContent)
  if (!html || text.length === 0) {
    return null
  }

  return {
    title: getDocumentTitle() || UNTITLED_PAGE,
    html,
    text,
    readabilityTitle: '',
    documentTitle: getDocumentTitle() || UNTITLED_PAGE,
  }
}

const selectExtractionCandidate = (): ExtractedContent => {
  const readability = getReadabilityCandidate()
  const mainContent = getMainContentCandidate()
  const singleCandidate = readability || mainContent
  if (!readability || !mainContent) {
    if (singleCandidate) {
      return singleCandidate
    }

    return {
      title: getDocumentTitle() || UNTITLED_PAGE,
      html: document.documentElement?.outerHTML || '',
      text: normalizeText(document.body?.innerText || document.body?.textContent),
      readabilityTitle: '',
      documentTitle: getDocumentTitle() || UNTITLED_PAGE,
    }
  }

  const mainRoot = getMainContentRoot()
  const appSignalScore = getAppSignalScore(mainRoot)
  const readabilityTextLength = readability.text.length
  const mainTextLength = mainContent.text.length

  if (
    appSignalScore >= APP_SIGNAL_THRESHOLDS.appStructureCount &&
    mainTextLength > readabilityTextLength * CONTENT_QUALITY_THRESHOLDS.appModeRatio
  ) {
    return mainContent
  }

  if (
    readabilityTextLength < CONTENT_QUALITY_THRESHOLDS.shortReadabilityLength &&
    mainTextLength > CONTENT_QUALITY_THRESHOLDS.substantialMainLength
  ) {
    return mainContent
  }

  if (mainTextLength > readabilityTextLength * CONTENT_QUALITY_THRESHOLDS.strongMainRatio) {
    return mainContent
  }

  return readability
}

const buildMarkdown = (content: ExtractedContent, url: string, extractedAt: string): string => {
  const turndown = createMarkdownConverter()
  const markdownTitle = sanitizeText(content.title || document.title || UNTITLED_PAGE)
  const markdownBodySource = content.html || document.documentElement?.outerHTML || ''
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
  content: ExtractedContent,
  url: string,
  markdown: string,
  extractedAt: string,
): ExportSuccessResponse => {
  const title = selectExportTitle({
    preferredTitle: content.title,
    readabilityTitle: content.readabilityTitle,
    documentTitle: content.documentTitle,
    url,
  })
  const fileName = buildExportFileName(title, extractedAt)

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

        const content = selectExtractionCandidate()
        const extractedAt = new Date().toISOString()
        const markdown = buildMarkdown(content, url, extractedAt)
        const payload = buildPayload(content, url, markdown, extractedAt)

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
