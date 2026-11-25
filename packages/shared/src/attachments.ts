/**
 * Files sent with a prompt in December Cloud (#634). The web checks a file with these
 * rules before the upload, the server checks it again, and the worker uses the same safe
 * name for the path in the sandbox. This file has no imports, so the browser can load it.
 */

export const ATTACHMENT_MAX_FILES = 5
export const ATTACHMENT_MAX_BYTES = 5 * 1024 * 1024
/** all files of one session together */
export const ATTACHMENT_SESSION_MAX_BYTES = 50 * 1024 * 1024
const ATTACHMENT_NAME_MAX_LENGTH = 100

export const ATTACHMENT_IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'gif'] as const

export const ATTACHMENT_TEXT_EXTENSIONS = [
    'txt',
    'md',
    'markdown',
    'json',
    'jsonl',
    'csv',
    'tsv',
    'log',
    'yaml',
    'yml',
    'toml',
    'xml',
    'html',
    'css',
    'scss',
    'js',
    'jsx',
    'mjs',
    'cjs',
    'ts',
    'tsx',
    'py',
    'rb',
    'go',
    'rs',
    'java',
    'kt',
    'swift',
    'c',
    'h',
    'cpp',
    'hpp',
    'cs',
    'php',
    'sh',
    'sql',
    'graphql',
    'proto',
    'ini',
    'conf',
    'diff',
    'patch',
    'vue',
    'svelte',
] as const

export type AttachmentKind = 'image' | 'text'

/** why a file is refused; null when it can be sent */
export type AttachmentProblem = 'count' | 'type' | 'empty' | 'size'

/** what the server and the chat know about a stored file */
export type AttachmentInfo = {
    id: string
    name: string
    contentType: string
    sizeBytes: number
}

/** the value of the `accept` attribute of the file picker */
export const ATTACHMENT_ACCEPT = [...ATTACHMENT_IMAGE_EXTENSIONS, ...ATTACHMENT_TEXT_EXTENSIONS]
    .map((extension) => `.${extension}`)
    .join(',')

const getExtension = (name: string): string => {
    const dot = name.lastIndexOf('.')
    return dot > 0 ? name.slice(dot + 1).toLowerCase() : ''
}

/** image or text, from the extension of the name. null for a type that is not allowed */
export const getAttachmentKind = (name: string): AttachmentKind | null => {
    const extension = getExtension(name)
    if ((ATTACHMENT_IMAGE_EXTENSIONS as readonly string[]).includes(extension)) return 'image'
    if ((ATTACHMENT_TEXT_EXTENSIONS as readonly string[]).includes(extension)) return 'text'
    return null
}

/**
 * A file name that is safe as one path segment and inside a shell command: no path parts,
 * no control or direction characters, only letters, digits, dot, dash and underscore. It
 * never starts with a dot or a dash, and it is never empty.
 */
export const safeAttachmentName = (name: string): string => {
    const lastSegment = String(name ?? '')
        .split(/[\\/]/)
        .pop() as string
    const cleaned = lastSegment
        .normalize('NFC')
        .replace(/[\p{Cc}\p{Cf}]/gu, '')
        .replace(/[^\p{L}\p{N}._-]+/gu, '_')
        .replace(/_+(?=\.)/g, '')
        .replace(/^[._-]+/, '')
        .replace(/[._]+$/, '')
    if (!cleaned) return 'file'
    if (cleaned.length <= ATTACHMENT_NAME_MAX_LENGTH) return cleaned

    const dot = cleaned.lastIndexOf('.')
    const extension = dot > 0 && cleaned.length - dot <= 16 ? cleaned.slice(dot) : ''
    return cleaned.slice(0, ATTACHMENT_NAME_MAX_LENGTH - extension.length) + extension
}

/** the check before a file joins the prompt. `count` is the number of files already there */
export const checkAttachment = (data: {
    name: string
    size: number
    count: number
}): AttachmentProblem | null => {
    const { name, size, count } = data
    if (count >= ATTACHMENT_MAX_FILES) return 'count'
    if (!getAttachmentKind(name)) return 'type'
    if (size <= 0) return 'empty'
    if (size > ATTACHMENT_MAX_BYTES) return 'size'
    return null
}
