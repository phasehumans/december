const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

interface RetryAsyncOptions<T> {
    label: string
    maxAttempts?: number
    initialDelayMs?: number
    maxDelayMs?: number
    task: (attempt: number, lastError: Error | null) => Promise<T>
}

export const retryAsync = async <T>(options: RetryAsyncOptions<T>) => {
    const { label, maxAttempts = 3, initialDelayMs = 250, maxDelayMs = 1500, task } = options

    let lastError: Error | null = null

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
            return await task(attempt, lastError)
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error))

            if (attempt === maxAttempts) {
                throw new Error(
                    `${label} failed after ${maxAttempts} attempts | ${lastError.message}`
                )
            }

            const delayMs = Math.min(initialDelayMs * 2 ** (attempt - 1), maxDelayMs)
            await sleep(delayMs)
        }
    }

    throw new Error(`${label} failed without producing a result`)
}
