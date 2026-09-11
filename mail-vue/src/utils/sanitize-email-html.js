import DOMPurify from 'dompurify'

const FORBIDDEN_TAGS = [
  'base', 'button', 'embed', 'form', 'frame', 'frameset', 'iframe', 'input',
  'link', 'math', 'meta', 'object', 'option', 'script', 'select', 'style',
  'svg', 'textarea'
]

const FORBIDDEN_ATTRIBUTES = [
  'autofocus', 'formaction', 'ping', 'srcdoc', 'srcset', 'xlink:href'
]

const DANGEROUS_CSS = /(?:@import|behavior\s*:|expression\s*\(|-moz-binding|position\s*:\s*(?:fixed|sticky)|url\s*\()/i
const SAFE_IMAGE_DATA = /^data:image\/(?:gif|jpeg|png|webp);base64,[a-z0-9+/=\s]+$/i

function safeUrl(value, protocols) {
  try {
    const url = new URL(value)
    return protocols.includes(url.protocol)
  } catch (_) {
    return false
  }
}

export function sanitizeEmailHtml(html = '') {
  const sanitized = DOMPurify.sanitize(String(html), {
    USE_PROFILES: { html: true },
    FORBID_TAGS: FORBIDDEN_TAGS,
    FORBID_ATTR: FORBIDDEN_ATTRIBUTES,
    ALLOW_UNKNOWN_PROTOCOLS: false
  })

  const template = document.createElement('template')
  template.innerHTML = sanitized

  template.content.querySelectorAll('*').forEach(element => {
    const style = element.getAttribute('style')
    if (style && DANGEROUS_CSS.test(style)) element.removeAttribute('style')
  })

  template.content.querySelectorAll('a').forEach(link => {
    const href = link.getAttribute('href') || ''
    if (!safeUrl(href, ['https:', 'http:', 'mailto:'])) {
      link.removeAttribute('href')
      link.removeAttribute('target')
      link.removeAttribute('rel')
      return
    }
    link.setAttribute('target', '_blank')
    link.setAttribute('rel', 'noopener noreferrer')
  })

  template.content.querySelectorAll('img').forEach(image => {
    const src = image.getAttribute('src') || ''
    if (!safeUrl(src, ['https:', 'http:']) && !SAFE_IMAGE_DATA.test(src)) {
      image.removeAttribute('src')
    }
    image.setAttribute('loading', 'lazy')
    image.setAttribute('decoding', 'async')
    image.setAttribute('referrerpolicy', 'no-referrer')
  })

  return template.innerHTML
}
