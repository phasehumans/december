/**
 * Subscriptions on the worker's redis clients.
 *
 * The clients are lazy and have no offline queue: nothing opens the connection by itself,
 * and ioredis refuses a subscribe that is sent before "ready". A subscribe that is sent
 * right after `duplicate()` or at module load is lost, and no message ever arrives.
 */

/** the part of an ioredis client that a subscription needs */
export interface SubscriberClient {
    status?: string
    on: (event: 'ready', handler: () => void) => unknown
    connect?: () => Promise<unknown>
}

export interface SubscribeWhenReady {
    client: SubscriberClient
    /** sends the subscribe (or psubscribe) command */
    subscribe: () => Promise<unknown>
    /** who subscribes, for the log line of a failure */
    label: string
}

/**
 * Sends the subscribe when the connection is ready: now when it is, and on every "ready"
 * after that (the first connect and each reconnect). Opens a connection that is not open.
 * A failed subscribe is logged, never silent.
 */
export const subscribeWhenReady = (data: SubscribeWhenReady): void => {
    const { client, subscribe, label } = data
    const send = () => {
        Promise.resolve()
            .then(subscribe)
            .catch((error: any) => {
                console.error(`[${label}] redis subscribe failed:`, error?.message || error)
            })
    }

    client.on('ready', send)
    // a client with no status is a test double: it takes commands at once
    if (client.status === 'ready' || client.status === undefined) {
        send()
    } else if (client.status === 'wait' && typeof client.connect === 'function') {
        client.connect().catch((error: any) => {
            // the client tries again by itself; "ready" then sends the subscribe
            console.error(`[${label}] redis connect failed:`, error?.message || error)
        })
    }
}

/** the part of an ioredis client that a wait for "ready" needs */
export interface ReadyClient {
    status?: string
    once: (event: any, handler: () => void) => unknown
    off: (event: any, handler: () => void) => unknown
    connect?: () => Promise<unknown>
}

/** how long a command waits for a connection that opens */
export const READY_WAIT_MS = 2000

/**
 * The one way to wait for a worker redis client. True when the client takes commands: now,
 * or after its connection opened (a lazy connection that nothing opened is opened here).
 * False when the connection is closed, or did not open in `timeoutMs`: the caller then
 * skips the command, it does not send it to a client that refuses it.
 */
export const waitUntilReady = async (
    client: ReadyClient,
    timeoutMs: number = READY_WAIT_MS
): Promise<boolean> => {
    // a client with no status is a test double: it takes commands at once
    if (client.status === 'ready' || client.status === undefined) return true
    const opens = ['wait', 'connecting', 'connect'].includes(client.status)
    if (!opens) return false

    return new Promise<boolean>((resolve) => {
        const done = (ready: boolean) => {
            clearTimeout(timer)
            client.off('ready', onReady)
            client.off('end', onEnd)
            resolve(ready)
        }
        const onReady = () => done(true)
        const onEnd = () => done(false)
        const timer = setTimeout(() => done(client.status === 'ready'), timeoutMs)
        client.once('ready', onReady)
        client.once('end', onEnd)
        if (client.status === 'wait' && typeof client.connect === 'function') {
            client.connect().catch(() => {
                // Intentionally swallowed: the client tries again by itself; the wait ends
                // on "ready" or on the time limit
            })
        }
    })
}

export interface PublishWhenReady {
    client: ReadyClient & { publish: (channel: string, message: string) => Promise<unknown> }
    channel: string
    message: string
    timeoutMs?: number
}

/**
 * Publishes when the connection is ready. An event that is sent while the connection opens
 * is not dropped. False when redis is offline: nothing was sent.
 */
export const publishWhenReady = async (data: PublishWhenReady): Promise<boolean> => {
    const { client, channel, message, timeoutMs } = data
    if (!(await waitUntilReady(client, timeoutMs))) return false
    await client.publish(channel, message)
    return true
}
