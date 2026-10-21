export type MailboxMessageSender = 'USER' | 'SYSTEM' | 'WEBHOOK' | 'CRON'

export type MailboxMessageStatus = 'QUEUED' | 'PLACED' | 'COMPLETED' | 'FAILED'

export type WakeUpTriggerStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'CANCELLED' | 'FAILED'

export interface EnqueueMailboxMessageInput {
    sessionId: string
    sender: MailboxMessageSender
    content: string
    metadata?: Record<string, any>
}

export interface PlaceMailboxMessagesInput {
    sessionId: string
}

export interface CompleteMailboxMessagesInput {
    messageIds: string[]
}

export interface FailMailboxMessagesInput {
    messageIds: string[]
    error?: string
}

export interface ScheduleWakeUpInput {
    sessionId: string
    triggerAt: Date
    reason?: string
    payload?: Record<string, any>
}

export interface ParkSessionInput {
    sessionId: string
    reason?: string
}

export interface UnparkSessionInput {
    sessionId: string
}

export interface WakeUpSweeperOptions {
    intervalMs?: number
    jobDispatcher?: (data: {
        sessionId: string
        userId: string
        prompt: string
        triggerId: string
    }) => Promise<void>
}
