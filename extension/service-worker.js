const BADGE_RESET_MS = 2200
const EXPORT_MESSAGE = { type: 'EXPORT_PAGE_MARKDOWN' }
const NO_RECEIVER_ERROR_FRAGMENT = 'Receiving end does not exist'
const UNSUPPORTED_PROTOCOL_MESSAGE = 'Unsupported page. Use this on http/https pages only.'
const DEFAULT_ACTION_TITLE = 'Export page to Markdown'
const SUPPORTED_PROTOCOLS = new Set(['http:', 'https:'])
const BADGE_COLORS = {
  error: '#B91C1C',
  info: '#0369A1',
  success: '#15803D',
}
const UNSUPPORTED_TAB_BADGE_STATE = {
  text: '!',
  color: BADGE_COLORS.error,
  title: UNSUPPORTED_PROTOCOL_MESSAGE,
}
const COPYING_BADGE_STATE = {
  text: '...',
  color: BADGE_COLORS.info,
  title: 'Exporting page markdown...',
}
const SUCCESS_BADGE_STATE = {
  text: 'OK',
  color: BADGE_COLORS.success,
  title: 'Page copied and downloaded.',
}

const getContentScriptInjectionError = (error) => {
  const message = error instanceof Error ? error.message : 'Unknown script injection error'

  if (message.includes('Cannot access contents of url')) {
    return 'Unsupported page. Use this on regular http/https pages.'
  }

  if (message.includes("Could not load file: 'content.js'")) {
    return 'Missing extension build artifact. Run bun run build:extension and reload the extension.'
  }

  return `Unable to inject export script: ${message}`
}

const isNoReceiverError = (error) =>
  error instanceof Error && error.message.includes(NO_RECEIVER_ERROR_FRAGMENT)

const getErrorMessage = (error, fallback) => (error instanceof Error ? error.message : fallback)

const setBadge = async (tabId, { text, color, title }) => {
  await chrome.action.setBadgeText({ tabId, text })
  await chrome.action.setBadgeBackgroundColor({ tabId, color })

  if (title) {
    await chrome.action.setTitle({ tabId, title })
  }
}

const clearBadgeLater = (tabId) => {
  setTimeout(() => {
    void chrome.action.setBadgeText({ tabId, text: '' })
    void chrome.action.setTitle({ tabId, title: DEFAULT_ACTION_TITLE })
  }, BADGE_RESET_MS)
}

const isSupportedTab = (url) => {
  if (typeof url !== 'string') {
    return false
  }

  try {
    return SUPPORTED_PROTOCOLS.has(new URL(url).protocol)
  } catch {
    return false
  }
}

const getFailureBadgeState = (errorMessage) => ({
  text: '!',
  color: BADGE_COLORS.error,
  title: errorMessage,
})

const ensureContentScript = async (tabId) => {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js'],
    })
  } catch (error) {
    throw new Error(getContentScriptInjectionError(error))
  }
}

const requestExportFromTab = async (tabId) => {
  const response = await chrome.tabs.sendMessage(tabId, EXPORT_MESSAGE)

  if (!response || typeof response !== 'object' || response.ok !== true) {
    throw new Error(response?.error || 'Markdown export failed.')
  }

  return response.payload
}

const exportFromTab = async (tabId) => {
  try {
    return await requestExportFromTab(tabId)
  } catch (error) {
    if (!isNoReceiverError(error)) {
      throw error
    }

    await ensureContentScript(tabId)
    return requestExportFromTab(tabId)
  }
}

const exportCurrentTab = async (tab) => {
  const tabId = tab.id
  if (typeof tabId !== 'number') {
    return
  }

  if (!isSupportedTab(tab.url)) {
    await setBadge(tabId, UNSUPPORTED_TAB_BADGE_STATE)
    clearBadgeLater(tabId)
    return
  }

  await setBadge(tabId, COPYING_BADGE_STATE)

  try {
    await exportFromTab(tabId)
    await setBadge(tabId, SUCCESS_BADGE_STATE)
  } catch (error) {
    console.error('Markdown export failed', error)
    await setBadge(tabId, getFailureBadgeState(getErrorMessage(error, 'Export failed')))
  }

  clearBadgeLater(tabId)
}

chrome.action.onClicked.addListener((tab) => {
  void exportCurrentTab(tab)
})
