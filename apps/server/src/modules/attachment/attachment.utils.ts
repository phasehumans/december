import { getAttachmentKind } from '@december/shared'

import type { ResolveAttachmentType } from './attachment.types'

const startsWith = (content: Uint8Array, bytes: number[], offset = 0): boolean =>
    content.length >= offset + bytes.length &&
    bytes.every((byte, index) => content[offset + index] === byte)

const ascii = (text: string): number[] => [...text].map((char) => char.charCodeAt(0))

/** the image type from the first bytes of the file. null when it is not an allowed image */
export const detectImageType = (content: Uint8Array): string | null => {
    if (startsWith(content, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png'
    if (startsWith(content, [0xff, 0xd8, 0xff])) return 'image/jpeg'
    if (startsWith(content, ascii('GIF87a')) || startsWith(content, ascii('GIF89a'))) {
        return 'image/gif'
    }
    if (startsWith(content, ascii('RIFF')) && startsWith(content, ascii('WEBP'), 8)) {
        return 'image/webp'
    }
    return null
}

/** text has no zero byte and is valid UTF-8 */
export const isTextContent = (content: Uint8Array): boolean => {
    if (content.includes(0)) return false
    try {
        new TextDecoder('utf-8', { fatal: true }).decode(content)
        return true
    } catch {
        // Intentionally swallowed: bytes that are not UTF-8 are not a text file
        return false
    }
}

const TEXT_CONTENT_TYPES: Record<string, string> = {
    md: 'text/markdown',
    markdown: 'text/markdown',
    json: 'application/json',
    csv: 'text/csv',
}

/**
 * The content type of an upload, or null when the file is refused. The name gives the
 * kind (image or text) and the bytes must agree: the type the browser sent is never used.
 */
export const resolveAttachmentType = (data: ResolveAttachmentType): string | null => {
    const { name, content } = data
    const kind = getAttachmentKind(name)
    if (kind === 'image') return detectImageType(content)
    if (kind === 'text') {
        if (!isTextContent(content)) return null
        const extension = name.slice(name.lastIndexOf('.') + 1).toLowerCase()
        return TEXT_CONTENT_TYPES[extension] ?? 'text/plain'
    }
    return null
}

/** every file of a session is under the session prefix, so a session wipe removes it */
export const attachmentPrefix = (sessionId: string) => `sessions/${sessionId}/attachments/`

export const attachmentFileKey = (sessionId: string, attachmentId: string, name: string) =>
    `${attachmentPrefix(sessionId)}${attachmentId}/${name}`
