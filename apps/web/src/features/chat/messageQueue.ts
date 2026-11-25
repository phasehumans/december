import { create } from 'zustand'

import type { PromptInputSubmitOptions } from '@/features/home/types'
import type { MessageWhileWorking } from '@/features/profile/lib/preferences'

/**
 * A new message while December works (#637).
 *
 * "Queue": the message waits in this browser and goes out when the run ends. "Send now":
 * the message goes to the running agent at once. The queue is kept for this tab only, in
 * `sessionStorage`, so a reload does not lose it. The files of a message are stored on
 * the server before it is queued, so the queue holds only their ids and names.
 */
export interface QueuedMessage {
    id: string
    sessionId: string
    text: string
    /** the model, the run options and the files picked when the message was written */
    options?: PromptInputSubmitOptions
}

interface MessageQueueState {
    queued: QueuedMessage[]
    /** adds a message after the ones that already wait */
    add: (message: Omit<QueuedMessage, 'id'> & { id?: string }) => QueuedMessage
    /** puts a message the server did not take back in front of the others */
    putBack: (message: QueuedMessage) => void
    remove: (id: string) => void
    /** takes the message of a session that waits the longest, or one message by its id */
    take: (sessionId: string, id?: string) => QueuedMessage | undefined
    /** sends one queued message now. the chat controller of the open session sets it */
    sendNow: (id: string) => void
    /** reads the queue the tab kept. it runs once when the page loads */
    restore: () => void
}

const STORAGE_KEY = 'december.messageQueue'

const isQueuedMessage = (value: unknown): value is QueuedMessage => {
    const message = value as Partial<QueuedMessage> | null
    return (
        typeof message?.id === 'string' &&
        typeof message.sessionId === 'string' &&
        typeof message.text === 'string'
    )
}

const readKeptQueue = (): QueuedMessage[] => {
    try {
        const kept: unknown = JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) ?? '[]')
        return Array.isArray(kept) ? kept.filter(isQueuedMessage) : []
    } catch {
        // no storage (private mode) or text that is not JSON: the queue starts empty
        return []
    }
}

const keepQueue = (queued: QueuedMessage[]) => {
    try {
        if (queued.length === 0) window.sessionStorage.removeItem(STORAGE_KEY)
        else window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(queued))
    } catch {
        // no storage or no room: the queue still works for this page, it is only not kept
    }
}

let nextId = 0
const newQueueId = () => `queued-${Date.now()}-${(nextId += 1)}`

export const useMessageQueue = create<MessageQueueState>((set, get) => ({
    queued: [],
    add: (message) => {
        const queuedMessage = { ...message, id: message.id ?? newQueueId() }
        set((state) => ({ queued: [...state.queued, queuedMessage] }))
        return queuedMessage
    },
    putBack: (message) =>
        set((state) => ({
            queued: [message, ...state.queued.filter((other) => other.id !== message.id)],
        })),
    remove: (id) => set((state) => ({ queued: state.queued.filter((m) => m.id !== id) })),
    take: (sessionId, id) => {
        const message = get().queued.find(
            (m) => m.sessionId === sessionId && (id === undefined || m.id === id)
        )
        if (message) get().remove(message.id)
        return message
    },
    sendNow: () => {},
    restore: () => set({ queued: readKeptQueue() }),
}))

useMessageQueue.getState().restore()
useMessageQueue.subscribe((state, previous) => {
    if (state.queued !== previous.queued) keepQueue(state.queued)
})

export type SubmitRoute = 'run' | 'queue' | 'steer'

/** what a message sent now does: start a run, wait for the end of the run, or go to the agent */
export const decideSubmit = (data: {
    isWorking: boolean
    mode: MessageWhileWorking
}): SubmitRoute => {
    if (!data.isWorking) return 'run'
    return data.mode === 'send' ? 'steer' : 'queue'
}

export type RunEndStep = 'wait' | 'follow' | 'send-next'

/**
 * What the end of a run does. After a stop the queued messages wait for the user. A message
 * that was sent to the agent and that the agent did not read gets its own run on the
 * server: the session follows that run. Otherwise the next queued message goes out.
 */
export const decideRunEnd = (data: {
    stopped: boolean
    /** messages sent to the running agent that it did not read */
    unread: number
    queued: number
}): RunEndStep => {
    if (data.stopped) return 'wait'
    if (data.unread > 0) return 'follow'
    return data.queued > 0 ? 'send-next' : 'wait'
}
