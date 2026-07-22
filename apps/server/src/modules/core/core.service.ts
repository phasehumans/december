import { enqueueJob } from '@december/shared'

import type { ProcessPromptJob } from './core.types'

const processPromptJob = async (dataInput: ProcessPromptJob) => {
    const { userId, data } = dataInput
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
