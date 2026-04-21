import { z } from 'zod'

import { prisma } from '../../config/db'
import type { CanvasDocument } from '../canvas/canvas.persistence'

import {
    plannedProjectFileSchema,
    projectIntentSchema,
    projectPlanSchema,
} from './generation.schema'

export type GenerateWebsiteInput = {
    prompt: string
    userId: string
    projectId?: string
    canvasState?: CanvasDocument
    onEvent?: (event: GenerationStreamEvent) => Promise<void> | void
}

export type ProjectIntent = z.infer<typeof projectIntentSchema>
export type ProjectPlan = z.infer<typeof projectPlanSchema>
export type PlannedProjectFile = z.infer<typeof plannedProjectFileSchema>
export type ProjectRecord = Awaited<ReturnType<typeof prisma.project.create>>

export type StoredProjectFile = {
    path: string
    key: string
    contentType?: string
    size: number
}

export type RevisionBase = {
    project: NonNullable<Awaited<ReturnType<typeof prisma.project.findFirst>>>
    baseVersion: any
    baseFiles: Record<string, string>
    nextVersionNumber: number
}

export type VersionSummary = {
    id: string
    versionNumber: number
    label: string
    sourcePrompt: string
    summary: string | null
    status: 'GENERATING' | 'READY' | 'FAILED'
    objectStoragePrefix: string
    fileCount: number
    createdAt: Date
    updatedAt: Date
}

export type GenerationStreamEvent =
    | {
          type: 'project-created'
          data: {
              project: ProjectRecord
              version: {
                  id: string
                  versionNumber: number
                  label: string
              }
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
              files: PlannedProjectFile[]
              totalFiles: number
          }
      }
    | {
          type: 'file-start'
          data: {
              path: string
              purpose: string
              generator: PlannedProjectFile['generator']
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
              project: ProjectRecord
              version: {
                  id: string
                  versionNumber: number
                  label: string
                  status: 'READY'
              }
              intent: ProjectIntent
              plan: ProjectPlan
              generatedFiles: Record<string, string>
          }
      }

export type PersistedProjectRevision = {
    project: any
    version: {
        id: string
        versionNumber: number
        label: string
        status: 'READY'
    }
    versions: VersionSummary[]
    chatMessages: any[]
    generatedFiles: Record<string, string>
    assistantMessage: string
}
