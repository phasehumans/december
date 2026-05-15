import { ApiError, apiFetch } from '@/shared/api/client'
import type { CanvasDocument, CanvasItem } from '@/features/canvas/types'
import type {
    BackendProject,
    BackendProjectMessage,
    BackendProjectVersionSummary,
} from '@/features/projects/api/project'

export type GenerationMessageStatus = 'thinking' | 'planning' | 'building' | 'done' | 'error'

export interface PlannedBuildFile {
    path: string
    purpose: string
    generate: boolean
    generator: string
}

export interface PreviewSelectedElementPayload {
    tagName: string
    textContent: string
}

export interface AppliedProjectChangeResult {
    project: BackendProject
    version: Pick<BackendProjectVersionSummary, 'id' | 'versionNumber' | 'label' | 'status'>
    versions: BackendProjectVersionSummary[]
    chatMessages: BackendProjectMessage[]
    generatedFiles: Record<string, string>
    appliedFiles: string[]
    deletedFiles: string[]
    assistantMessage: string
}

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
              version: Pick<BackendProjectVersionSummary, 'id' | 'versionNumber' | 'label'>
          }
      }
    | {
          type: 'phase'
          data: {
              phase: 'thinking' | 'planning' | 'building' | 'done'
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
          type: 'build-plan'
          data: {
              files: PlannedBuildFile[]
              totalFiles: number
          }
      }
    | {
          type: 'patch-plan'
          data: {
              files: Array<{
                  path: string
                  action: 'create' | 'update' | 'delete'
                  purpose: string
                  instructions: string
              }>
              totalFiles: number
          }
      }
    | {
          type: 'file-start'
          data: {
              path: string
              purpose: string
              generator: string
              index: number
              total: number
          }
      }
    | {
          type: 'file-chunk'
          data: {
              path: string
              chunk: string
          }
      }
    | {
          type: 'file-complete'
          data: {
              path: string
              index: number
              total: number
          }
      }
    | {
          type: 'file-error'
          data: {
              path: string
              message: string
          }
      }
    | {
          type: 'result'
          data: {
              project: BackendProject
              version: Pick<
                  BackendProjectVersionSummary,
                  'id' | 'versionNumber' | 'label' | 'status'
              >
              intent: unknown
              plan: unknown
              generatedFiles: Record<string, string>
              versions?: BackendProjectVersionSummary[]
              chatMessages?: BackendProjectMessage[]
              appliedFiles?: string[]
              deletedFiles?: string[]
              assistantMessage?: string
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
    projectId?: string | null
    canvasState?: CanvasDocument
    signal?: AbortSignal
    onEvent: (event: GenerationStreamEvent) => void
}
type ApplyProjectEditInput = {
    projectId: string
    versionId?: string | null
    prompt: string
    selectedElement?: PreviewSelectedElementPayload | null
    canvasState?: CanvasDocument
    signal?: AbortSignal
    onEvent: (event: GenerationStreamEvent) => void
}
type ApplyProjectFixInput = {
    projectId: string
    versionId?: string | null
    errorMessage: string
    stack?: string
    signal?: AbortSignal
    onEvent: (event: GenerationStreamEvent) => void
}

const stripSerializableCanvasItemContent = (item: CanvasItem): CanvasItem => {
    if (item.type !== 'image' || !item.assetKey) {
        return item
    }

    return {
        ...item,
        content: undefined,
    }
}

const sanitizeCanvasStateForRequest = (canvasState?: CanvasDocument) => {
    if (!canvasState) {
        return undefined
    }

    return {
        ...canvasState,
        items: canvasState.items.map(stripSerializableCanvasItemContent),
    }
}

const toApiError = async (res: Response) => {
    let payload: { message?: string; errors?: unknown } | null = null

    try {
        payload = await res.json()
    } catch {
        payload = null
    }

    const genericMessage =
        payload?.message && ['internal server error', 'server error'].includes(payload.message)

    const message =
        (typeof payload?.errors === 'string' && (genericMessage || !payload?.message)
            ? payload.errors
            : payload?.message) ||
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

const generateProjectStream = async ({
    prompt,
    projectId,
    canvasState,
    signal,
    onEvent,
}: GenerateProjectInput) => {
    const sanitizedCanvasState = sanitizeCanvasStateForRequest(canvasState)
    const res = await apiFetch('/generate', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            prompt,
            ...(projectId ? { projectId } : {}),
            ...(sanitizedCanvasState ? { canvasState: sanitizedCanvasState } : {}),
        }),
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

const readGenerationStream = async (
    res: Response,
    onEvent: (event: GenerationStreamEvent) => void
) => {
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

const applyProjectEdit = async (data: ApplyProjectEditInput) => {
    const sanitizedCanvasState = sanitizeCanvasStateForRequest(data.canvasState)

    const res = await apiFetch('/generate/edit', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            projectId: data.projectId,
            ...(data.versionId ? { versionId: data.versionId } : {}),
            prompt: data.prompt,
            ...(data.selectedElement ? { selectedElement: data.selectedElement } : {}),
            ...(sanitizedCanvasState ? { canvasState: sanitizedCanvasState } : {}),
        }),
        signal: data.signal,
    })

    return (await readGenerationStream(res, data.onEvent)) as AppliedProjectChangeResult | null
}

const applyProjectFix = async (data: ApplyProjectFixInput) => {
    const res = await apiFetch('/generate/fix', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            projectId: data.projectId,
            ...(data.versionId ? { versionId: data.versionId } : {}),
            errorMessage: data.errorMessage,
            ...(data.stack ? { stack: data.stack } : {}),
        }),
        signal: data.signal,
    })

    return (await readGenerationStream(res, data.onEvent)) as AppliedProjectChangeResult | null
}

export const generationAPI = {
    generateProjectStream,
    applyProjectEdit,
    applyProjectFix,
}
