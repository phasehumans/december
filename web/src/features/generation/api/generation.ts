import { API_BASE_URL, ApiError, getAuthToken } from '@/shared/api/client'
import type { BackendProject } from '@/features/projects/api/project'

export type GenerationMessageStatus = 'thinking' | 'planning' | 'done' | 'error'

export type GenerationStreamEvent =
    | {
          type: 'connected'
          data: {
              ok: boolean
          }
      }
    | {
          type: 'project-created'
          data: {
              project: BackendProject
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
              project: BackendProject
              intent: unknown
              plan: unknown
              isDB: boolean
              dbURL?: string
          }
      }
    | {
          type: 'error'
          data: {
              message: string
          }
      }

type GenerateProjectInput = {
    prompt: string
    isDB: boolean
    dbURL?: string
    signal?: AbortSignal
    onEvent: (event: GenerationStreamEvent) => void
}

const toApiError = async (res: Response) => {
    let payload: { message?: string; errors?: unknown } | null = null

    try {
        payload = await res.json()
    } catch {
        payload = null
    }

    const message =
        payload?.message ||
        (typeof payload?.errors === 'string' ? payload.errors : undefined) ||
        `Request failed with status ${res.status}`

    return new ApiError(message, res.status, payload?.errors)
}

const parseEventBlock = (block: string) => {
    const lines = block.split('\n')
    let eventType = 'message'
    const dataLines: string[] = []

    for (const line of lines) {
        if (line.startsWith('event:')) {
            eventType = line.slice(6).trim()
            continue
        }

        if (line.startsWith('data:')) {
            dataLines.push(line.slice(5).trimStart())
        }
    }

    if (dataLines.length === 0) {
        return null
    }

    return {
        type: eventType,
        data: JSON.parse(dataLines.join('\n')),
    } as GenerationStreamEvent
}

const generateProjectStream = async ({ prompt, isDB, dbURL, signal, onEvent }: GenerateProjectInput) => {
    const token = getAuthToken()
    const res = await fetch(`${API_BASE_URL}/generate`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: token } : {}),
        },
        body: JSON.stringify({ prompt, isDB, dbURL }),
        signal,
    })

    if (!res.ok) {
        throw await toApiError(res)
    }

    if (!res.body) {
        throw new Error('generation stream body is missing')
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let resultEvent: Extract<GenerationStreamEvent, { type: 'result' }> | null = null

    while (true) {
        const { done, value } = await reader.read()
        buffer += decoder.decode(value, { stream: !done })
        buffer = buffer.replace(/\r/g, '')

        let boundaryIndex = buffer.indexOf('\n\n')

        while (boundaryIndex !== -1) {
            const block = buffer.slice(0, boundaryIndex).trim()
            buffer = buffer.slice(boundaryIndex + 2)

            if (block) {
                const parsedEvent = parseEventBlock(block)

                if (parsedEvent) {
                    onEvent(parsedEvent)

                    if (parsedEvent.type === 'error') {
                        throw new ApiError(parsedEvent.data.message, 500, parsedEvent.data)
                    }

                    if (parsedEvent.type === 'result') {
                        resultEvent = parsedEvent
                    }
                }
            }

            boundaryIndex = buffer.indexOf('\n\n')
        }

        if (done) {
            break
        }
    }

    return resultEvent?.data ?? null
}

export const generationAPI = {
    generateProjectStream,
}
