import type { StoredSessionFile } from './session.types'

export const parseStoredSessionFiles = (value: unknown): StoredSessionFile[] => {
    if (!Array.isArray(value)) {
        return []
    }

    return value.reduce<StoredSessionFile[]>((files, item) => {
        if (!item || typeof item !== 'object') {
            return files
        }

        const candidate = item as Partial<StoredSessionFile>

        if (typeof candidate.path !== 'string' || typeof candidate.key !== 'string') {
            return files
        }

        files.push({
            path: candidate.path,
            key: candidate.key,
            ...(typeof candidate.contentType === 'string'
                ? { contentType: candidate.contentType }
                : {}),
            size: typeof candidate.size === 'number' ? candidate.size : 0,
        })

        return files
    }, [])
}
