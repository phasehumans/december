import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { ATTACHMENT_MAX_BYTES, ATTACHMENT_MAX_FILES, safeAttachmentName } from '@december/shared'

/**
 * Files sent with a prompt (#634). Before the turn the worker copies them from the file
 * store into the sandbox, outside /workspace, so they are never committed to the task
 * branch. The turn prompt then names each file and its path.
 */
export const ATTACHMENTS_ROOT = '/home/user/.december/attachments'

/** one file of a prompt, as the server puts it in the `run_agent` job */
export type JobAttachment = {
    id: string
    name: string
    key: string
    contentType: string
    sizeBytes: number
}

/** one file of the turn: where it is in the sandbox, or no path when it could not be put there */
export type TurnAttachment = {
    name: string
    path?: string
    isImage?: boolean
}

const isJobAttachment = (value: unknown): value is JobAttachment => {
    const item = value as Partial<JobAttachment> | null
    return (
        !!item &&
        typeof item.id === 'string' &&
        typeof item.name === 'string' &&
        typeof item.key === 'string' &&
        typeof item.contentType === 'string' &&
        typeof item.sizeBytes === 'number'
    )
}

/** the files of a job: at most 5, and only stored files of this session */
export const readJobAttachments = (data: {
    sessionId: string
    value: unknown
}): JobAttachment[] => {
    const { sessionId, value } = data
    if (!Array.isArray(value)) return []
    const prefix = `sessions/${sessionId}/attachments/`
    return value
        .filter(isJobAttachment)
        .filter((item) => item.key.startsWith(prefix) && !item.key.includes('..'))
        .slice(0, ATTACHMENT_MAX_FILES)
        .map(({ id, name, key, contentType, sizeBytes }) => ({
            id,
            name,
            key,
            contentType,
            sizeBytes,
        }))
}

/**
 * The path of each file in the sandbox. The folder and the names are made safe again
 * here, so no path leaves the attachments folder. Two files with one name get two paths.
 */
export const buildAttachmentPaths = (data: {
    /** the sequence of the user message */
    folder: string | number
    names: string[]
}): string[] => {
    const { folder, names } = data
    const safeFolder = String(folder).replace(/[^A-Za-z0-9_-]/g, '') || 'prompt'
    const used = new Set<string>()
    return names.map((name) => {
        const safeName = safeAttachmentName(name)
        const dot = safeName.lastIndexOf('.')
        const base = dot > 0 ? safeName.slice(0, dot) : safeName
        const extension = dot > 0 ? safeName.slice(dot) : ''
        let candidate = safeName
        for (let count = 2; used.has(candidate); count++) {
            candidate = `${base}-${count}${extension}`
        }
        used.add(candidate)
        return `${ATTACHMENTS_ROOT}/${safeFolder}/${candidate}`
    })
}

/** the prompt with the attached files and their paths after what the user typed */
export const withAttachments = (prompt: string, attachments: TurnAttachment[]): string => {
    if (attachments.length === 0) return prompt
    const lines = attachments.map((file) =>
        file.path
            ? `- ${file.name}${file.isImage ? ' (image)' : ''}: ${file.path}`
            : `- ${file.name}: could not be loaded`
    )
    return `${prompt}

<attached-files>
The user attached these files to this message. They are outside the repository. Read a file when the task needs it. Do not copy a file into the repository unless the user asks.
${lines.join('\n')}
</attached-files>`
}

let s3: S3Client | null = null

/** the bytes of a stored file; null when it is not there */
export const loadAttachmentBytes = async (key: string): Promise<Uint8Array | null> => {
    s3 ??= new S3Client({
        region: process.env.S3_REGION || 'us-east-1',
        endpoint: process.env.S3_ENDPOINT,
        credentials: {
            accessKeyId: process.env.S3_ACCESS_KEY || '',
            secretAccessKey: process.env.S3_SECRET_KEY || '',
        },
        forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== 'false',
    })
    const result = await s3.send(
        new GetObjectCommand({ Bucket: process.env.S3_BUCKET || 'december-storage', Key: key })
    )
    return (await result.Body?.transformToByteArray()) ?? null
}

/**
 * Copies the files of the turn into the sandbox. It never fails the turn: a file that
 * cannot be loaded or written comes back with no path, and the prompt says so.
 */
export const writeTurnAttachments = async (data: {
    sandbox?: any
    folder: string | number
    attachments: JobAttachment[]
    /** reads the bytes of a stored file. tests pass their own */
    load?: (key: string) => Promise<Uint8Array | null>
}): Promise<TurnAttachment[]> => {
    const { sandbox, folder, attachments, load = loadAttachmentBytes } = data
    const paths = buildAttachmentPaths({ folder, names: attachments.map((file) => file.name) })
    const result: TurnAttachment[] = []
    for (const [index, file] of attachments.entries()) {
        const isImage = file.contentType.startsWith('image/')
        const name = safeAttachmentName(file.name)
        const path = paths[index] as string
        try {
            if (!sandbox?.files?.write) throw new Error('the sandbox takes no files')
            const bytes = await load(file.key)
            if (!bytes || bytes.byteLength > ATTACHMENT_MAX_BYTES) {
                throw new Error('the file is missing or too large')
            }
            // a copy with its own buffer, the form the sandbox api takes
            await sandbox.files.write(path, new Uint8Array(bytes).buffer)
            result.push({ name, path, isImage })
        } catch (error) {
            console.warn(`[WORKER] attachment ${file.id} was not put in the sandbox:`, error)
            result.push({ name, isImage })
        }
    }
    return result
}
