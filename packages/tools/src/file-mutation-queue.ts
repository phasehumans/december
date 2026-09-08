import path from 'node:path'

const fileMutationQueues = new Map<string, Promise<void>>()
let registrationQueue = Promise.resolve()

/**
 * Serialize file mutation operations targeting the same file.
 * Operations for different files still run in parallel.
 */
export async function withFileMutationQueue<T>(filePath: string, fn: () => Promise<T>): Promise<T> {
    const key = path.resolve(filePath)

    const registration = registrationQueue.then(async () => {
        const currentQueue = fileMutationQueues.get(key) ?? Promise.resolve()

        let releaseNext!: () => void
        const nextQueue = new Promise<void>((resolveQueue) => {
            releaseNext = resolveQueue
        })
        const chainedQueue = currentQueue.then(() => nextQueue)
        fileMutationQueues.set(key, chainedQueue)

        return { key, currentQueue, chainedQueue, releaseNext }
    })

    registrationQueue = registration.then(
        () => undefined,
        () => undefined
    )

    const { currentQueue, chainedQueue, releaseNext } = await registration
    await currentQueue

    try {
        return await fn()
    } finally {
        releaseNext()
        if (fileMutationQueues.get(key) === chainedQueue) {
            fileMutationQueues.delete(key)
        }
    }
}
