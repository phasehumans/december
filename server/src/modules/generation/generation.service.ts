import { z } from 'zod'
import { prisma } from '../../config/db'
import { extractProjectPlan } from '../../core/agents/plan.agent'
import { extractProjectIntent } from '../../core/agents/prompt.agent'
import { cleanPrompt } from '../../utils/cleanPrompt'
import {
    generateProjectFileSchema,
    planAgentResponseSchema,
    projectIntentSchema,
    promptAgentResponseSchema,
} from './generation.schema'

type GenerateWebsite = {
    prompt: string
    userId: string
    isDB: boolean
    dbURL?: string
    onEvent?: (event: GenerationStreamEvent) => Promise<void> | void
}

type ProjectIntent = z.infer<typeof projectIntentSchema>
type ProjectPlan = z.infer<typeof generateProjectFileSchema>
type ProjectRecord = Awaited<ReturnType<typeof prisma.project.create>>

type GenerationStreamEvent =
    | {
          type: 'project-created'
          data: {
              project: ProjectRecord
          }
      }
    | {
          type: 'phase'
          data: {
              phase: 'thinking' | 'planning' | 'done'
          }
      }
    | {
          type: 'message-start'
          data: {
              messageId: string
              status: 'thinking' | 'planning'
          }
      }
    | {
          type: 'message-chunk'
          data: {
              messageId: string
              chunk: string
          }
      }
    | {
          type: 'message-complete'
          data: {
              messageId: string
              status: 'done'
          }
      }
    | {
          type: 'result'
          data: {
              project: ProjectRecord
              intent: ProjectIntent
              plan: ProjectPlan
              isDB: boolean
              dbURL?: string
          }
      }

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const createProjectName = (prompt: string) => {
    const words = cleanPrompt(prompt)
        .split(' ')
        .filter(Boolean)
        .slice(0, 4)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())

    const name = words.join(' ').trim()
    return name.length >= 3 ? name.slice(0, 40) : 'New Project'
}

const splitIntoChunks = (content: string, maxLength = 28) => {
    const tokens = content.split(/(\s+)/).filter(Boolean)
    const chunks: string[] = []
    let currentChunk = ''

    for (const token of tokens) {
        if ((currentChunk + token).length > maxLength && currentChunk) {
            chunks.push(currentChunk)
            currentChunk = token
            continue
        }

        currentChunk += token
    }

    if (currentChunk) {
        chunks.push(currentChunk)
    }

    return chunks.length > 0 ? chunks : [content]
}

const applyDatabaseSelection = (intent: ProjectIntent, isDB: boolean) => {
    if (!isDB) {
        return {
            ...intent,
            database: 'none' as const,
            needsDatabase: false,
        }
    }

    return {
        ...intent,
        database: 'postgres' as const,
        needsDatabase: true,
        needsBackend: true,
    }
}

const emitAssistantMessage = async (
    onEvent: GenerateWebsite['onEvent'],
    data: {
        messageId: string
        status: 'thinking' | 'planning'
        content: string
    }
) => {
    if (!onEvent) {
        return
    }

    await onEvent({
        type: 'message-start',
        data: {
            messageId: data.messageId,
            status: data.status,
        },
    })

    for (const chunk of splitIntoChunks(data.content)) {
        await onEvent({
            type: 'message-chunk',
            data: {
                messageId: data.messageId,
                chunk,
            },
        })

        await sleep(18)
    }

    await onEvent({
        type: 'message-complete',
        data: {
            messageId: data.messageId,
            status: 'done',
        },
    })
}

const generateWebsite = async (data: GenerateWebsite) => {
    const { prompt, userId, isDB, dbURL, onEvent } = data
    let project: ProjectRecord | null = null

    try {
        const userPrompt = cleanPrompt(prompt)

        project = await prisma.project.create({
            data: {
                name: createProjectName(userPrompt),
                description: 'Generation in progress',
                prompt,
                projectStatus: 'GENERATING',
                userId,
            },
        })

        await onEvent?.({
            type: 'project-created',
            data: {
                project,
            },
        })

        await onEvent?.({
            type: 'phase',
            data: {
                phase: 'thinking',
            },
        })

        const rawIntentResponse = await extractProjectIntent({ userPrompt })
        const parseIntent = promptAgentResponseSchema.safeParse(rawIntentResponse)

        if (!parseIntent.success) {
            throw new Error('invalid response | prompt agent')
        }

        const intent = applyDatabaseSelection(parseIntent.data.intent, isDB)

        await emitAssistantMessage(onEvent, {
            messageId: `${project.id}:prompt-agent`,
            status: 'thinking',
            content: parseIntent.data.message,
        })

        await onEvent?.({
            type: 'phase',
            data: {
                phase: 'planning',
            },
        })

        const rawPlanResponse = await extractProjectPlan(intent)
        const parsePlan = planAgentResponseSchema.safeParse(rawPlanResponse)

        if (!parsePlan.success) {
            throw new Error('invalid response | plan agent')
        }

        if (!parsePlan.data.plan.success) {
            throw new Error(parsePlan.data.plan.errors[0] || 'invalid response | plan agent')
        }

        await emitAssistantMessage(onEvent, {
            messageId: `${project.id}:plan-agent`,
            status: 'planning',
            content: parsePlan.data.message,
        })

        const updatedProject = await prisma.project.update({
            where: {
                id: project.id,
            },
            data: {
                name: parsePlan.data.plan.data.projectName,
                description: intent.summary,
                projectStatus: 'READY',
            },
        })

        await onEvent?.({
            type: 'phase',
            data: {
                phase: 'done',
            },
        })

        const result = {
            project: updatedProject,
            intent,
            plan: parsePlan.data.plan,
            isDB,
            ...(dbURL ? { dbURL } : {}),
        }

        await onEvent?.({
            type: 'result',
            data: result,
        })

        return result
    } catch (error) {
        if (project) {
            await prisma.project.update({
                where: {
                    id: project.id,
                },
                data: {
                    projectStatus: 'FAILED',
                },
            })
        }

        throw error
    }
}

export const generateService = {
    generateWebsite,
}
