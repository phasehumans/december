import type { EmitAssistantMessage, EmitFileStream, EmitPatchFileStream } from '@december/shared'

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

export const emitAssistantMessage = async (data: EmitAssistantMessage) => {
    const { onEvent, messageId, status, content } = data
    if (!onEvent) {
        return
    }

    const chunkRange = { minLength: 8, maxLength: 16, minDelay: 20, maxDelay: 36 }

    await onEvent({
        type: 'message-start',
        data: {
            messageId,
            status,
        },
    })

    await sleep(120)

    for (const chunk of splitIntoChunks(content, chunkRange.minLength, chunkRange.maxLength)) {
        await onEvent({
            type: 'message-chunk',
            data: {
                messageId,
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
            messageId,
            status: 'done',
        },
    })
}

export const emitFileStream = async (data: EmitFileStream) => {
    const { onEvent, file, content, index, total } = data
    if (!onEvent) {
        return
    }

    await onEvent({
        type: 'file-start',
        data: {
            path: file.path,
            purpose: file.purpose,
            generator: file.generator,
            index,
            total,
        },
    })

    await sleep(32)

    for (const chunk of splitFileContentIntoChunks(content)) {
        await onEvent({
            type: 'file-chunk',
            data: {
                path: file.path,
                chunk,
            },
        })

        await sleep(10)
    }

    await sleep(20)

    await onEvent({
        type: 'file-complete',
        data: {
            path: file.path,
            index,
            total,
        },
    })
}

export const emitPatchFileStream = async (data: EmitPatchFileStream) => {
    const { onEvent, file, content, index, total } = data
    if (!onEvent) {
        return
    }

    await onEvent({
        type: 'file-start',
        data: {
            path: file.path,
            purpose: file.purpose,
            generator: 'component',
            index,
            total,
        },
    })

    await sleep(32)

    for (const chunk of splitFileContentIntoChunks(content)) {
        await onEvent({
            type: 'file-chunk',
            data: {
                path: file.path,
                chunk,
            },
        })

        await sleep(10)
    }

    await sleep(20)

    await onEvent({
        type: 'file-complete',
        data: {
            path: file.path,
            index,
            total,
        },
    })
}
