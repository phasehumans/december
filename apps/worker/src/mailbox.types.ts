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
        /** the id of the run that claimed the session */
        runId: string
    }) => Promise<void>
    /**
     * Claims the session for the run of a wake-up (#637): the id of the run, or null when a
     * run is queued or active. The default claims the run mark in redis.
     */
    claimRun?: (sessionId: string) => Promise<string | null>
    /** frees a session whose claimed run was not queued, or ran in this process */
    releaseRun?: (sessionId: string, runId: string) => Promise<void>
    /** a wake-up for a session that is not free is tried again after this long */
    retryMs?: number
}
