import { enqueueJob } from '@december/shared'

import type { HandlePromptDto } from './core.schema'

export async function processPromptJob(userId: string, data: HandlePromptDto) {
    return enqueueJob('prompt_job', {
        prompt: data.prompt,
        projectId: data.projectId,
        sessionId: data.sessionId,
        userId,
    })
}

export const coreService = {
    processPromptJob,
}
