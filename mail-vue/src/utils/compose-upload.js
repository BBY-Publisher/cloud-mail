import { getExtName } from './file-utils.js'

export const MAX_COMPOSE_FILE_SIZE = 64 * 1024 * 1024

// 单封邮件允许添加的普通附件数量上限，与后端 mail-worker 的附件数量校验保持一致。
export const MAX_COMPOSE_ATTACHMENTS = 64

const IMAGE_EXTENSIONS = new Set([
    'avif',
    'bmp',
    'gif',
    'jfif',
    'jpeg',
    'jpg',
    'png',
    'svg',
    'webp'
])

export function isImageUpload(file) {
    if (!file) return false
    if (String(file.type || '').toLowerCase().startsWith('image/')) return true
    return IMAGE_EXTENSIONS.has(getExtName(file.name))
}

export function classifyComposeFiles(files) {
    const accepted = []
    const rejected = []

    for (const file of Array.from(files || [])) {
        if (!file) continue
        if (!Number.isFinite(file.size) || file.size <= 0 || file.size > MAX_COMPOSE_FILE_SIZE) {
            rejected.push(file)
            continue
        }
        accepted.push(file)
    }

    return { accepted, rejected }
}
