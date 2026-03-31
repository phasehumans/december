import type {
    GenerateWebsiteInput,
    GenerationStreamEvent,
    PlannedProjectFile,
} from './generation.types'

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const splitIntoChunks = (content: string, minLength: number, maxLength: number) => {
    const chunks: string[] = []
    let cursor = 0

    while (cursor < content.length) {
        const remaining = content.length - cursor
        const currentMaxLength = Math.min(maxLength, remaining)
        const currentMinLength = Math.min(minLength, currentMaxLength)
        let sliceLength = currentMinLength

        if (currentMaxLength > currentMinLength) {
            sliceLength += Math.floor(Math.random() * (currentMaxLength - currentMinLength + 1))
        }

        let nextCursor = cursor + sliceLength

        if (nextCursor < content.length) {
            const whitespaceIndex = content.lastIndexOf(' ', nextCursor)

            if (whitespaceIndex > cursor + 2) {
                nextCursor = whitespaceIndex + 1
            }
        }

        const chunk = content.slice(cursor, nextCursor)

        if (chunk) {
            chunks.push(chunk)
        }

        cursor = nextCursor
    }

    return chunks.length > 0 ? chunks : [content]
}

const splitFileContentIntoChunks = (content: string, targetChunkLength = 72) => {
    if (!content) {
        return ['']
    }

    const chunks: string[] = []
    let cursor = 0

    while (cursor < content.length) {
        let nextCursor = Math.min(cursor + targetChunkLength, content.length)
        const newlineIndex = content.lastIndexOf('\n', nextCursor)
        const whitespaceIndex = content.lastIndexOf(' ', nextCursor)

        if (newlineIndex >= cursor + 18) {
            nextCursor = newlineIndex + 1
        } else if (whitespaceIndex >= cursor + 18) {
            nextCursor = whitespaceIndex + 1
        }

        if (nextCursor <= cursor) {
            nextCursor = Math.min(cursor + targetChunkLength, content.length)
        }

        chunks.push(content.slice(cursor, nextCursor))
        cursor = nextCursor
    }

    return chunks
}

export const emitAssistantMessage = async (
    onEvent: GenerateWebsiteInput['onEvent'],
    data: {
        messageId: string
        status: 'thinking' | 'planning'
        content: string
    }
) => {
    if (!onEvent) {
        return
    }

    const chunkRange =
        data.status === 'planning'
            ? { minLength: 6, maxLength: 12, minDelay: 22, maxDelay: 40 }
            : { minLength: 8, maxLength: 16, minDelay: 20, maxDelay: 36 }

    await onEvent({
        type: 'message-start',
        data: {
            messageId: data.messageId,
            status: data.status,
        },
    })

    await sleep(120)

    for (const chunk of splitIntoChunks(data.content, chunkRange.minLength, chunkRange.maxLength)) {
        await onEvent({
            type: 'message-chunk',
            data: {
                messageId: data.messageId,
                chunk,
            },
        })

        const delay =
            chunkRange.minDelay +
            Math.floor(Math.random() * (chunkRange.maxDelay - chunkRange.minDelay + 1))

        await sleep(delay)
    }

    await sleep(32)

    await onEvent({
        type: 'message-complete',
        data: {
            messageId: data.messageId,
            status: 'done',
        },
    })
}

export const emitFileStream = async (
    onEvent: GenerateWebsiteInput['onEvent'],
    data: {
        file: PlannedProjectFile
        content: string
        index: number
        total: number
    }
) => {
    if (!onEvent) {
        return
    }

    await onEvent({
        type: 'file-start',
        data: {
            path: data.file.path,
            purpose: data.file.purpose,
            generator: data.file.generator,
            index: data.index,
            total: data.total,
        },
    })

    await sleep(32)

    for (const chunk of splitFileContentIntoChunks(data.content)) {
        await onEvent({
            type: 'file-chunk',
            data: {
                path: data.file.path,
                chunk,
            },
        })

        await sleep(10)
    }

    await sleep(20)

    await onEvent({
        type: 'file-complete',
        data: {
            path: data.file.path,
            index: data.index,
            total: data.total,
        },
    })
}
