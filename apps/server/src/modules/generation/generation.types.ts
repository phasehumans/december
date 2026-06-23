import { z } from 'zod'

import {
    plannedProjectFileSchema,
    projectChangePlanSchema,
    projectPatchOperationSchema,
    projectIntentSchema,
    projectPlanSchema,
} from './generation.schema'

import type { PreviewManifestRef } from '../../shared/preview-manifest.types'
import type { Project } from '@december/database'

export type GenerateWebsiteInput = {
    prompt: string
    userId: string
    projectId?: string
    canvasState?: any
    model?: string
    onEvent?: (event: GenerationStreamEvent) => Promise<void> | void
}

export type ProjectIntent = z.infer<typeof projectIntentSchema>
export type ProjectPlan = z.infer<typeof projectPlanSchema>
export type PlannedProjectFile = z.infer<typeof plannedProjectFileSchema>
export type ProjectChangePlan = z.infer<typeof projectChangePlanSchema>
export type ProjectPatchOperation = z.infer<typeof projectPatchOperationSchema>
export type ProjectRecord = Project

// StoredProjectFile is imported from project.types

export type RevisionBase = {
    project: Project
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
              phase: 'thinking' | 'building'
          }
      }
    | {
          type: 'message-start'
          data: {
              messageId: string
              status: 'thinking' | 'done'
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
          type: 'patch-plan'
          data: {
              files: ProjectPatchOperation[]
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
              plan: ProjectPlan | ProjectChangePlan
              generatedFiles: Record<string, string>
              versions?: VersionSummary[]
              chatMessages?: any[]
              appliedFiles?: string[]
              deletedFiles?: string[]
              assistantMessage?: string
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

export type ApplyProjectEdit = {
    userId: string
    projectId: string
    versionId?: string
    prompt: string
    selectedElement?: {
        tagName: string
        textContent: string
    }
    canvasState?: GenerateWebsiteInput['canvasState']
    model?: string
    onEvent?: GenerateWebsiteInput['onEvent']
    isSelfHealing?: boolean
}

export type ApplyProjectFix = {
    userId: string
    projectId: string
    versionId?: string
    errorMessage: string
    stack?: string
    model?: string
    onEvent?: GenerateWebsiteInput['onEvent']
    isSelfHealing?: boolean
}

export type MergeProjectFiles = {
    currentFiles: Record<string, string>
    updatedFiles: Array<{ path: string; content: string }>
    deletedFiles: string[]
}

export type MapVersionSummary = {
    id: string
    versionNumber: number
    label: string | null
    sourcePrompt: string
    summary: string | null
    status: 'GENERATING' | 'READY' | 'FAILED'
    objectStoragePrefix: string
    manifestJson: unknown
    createdAt: Date
    updatedAt: Date
}

export type NormalizeGenerationError = {
    error: unknown
    path?: string
}

export type EmitAssistantMessage = {
    onEvent: GenerateWebsiteInput['onEvent']
    messageId: string
    status: 'thinking'
    content: string
}

export type EmitFileStream = {
    onEvent: GenerateWebsiteInput['onEvent']
    file: PlannedProjectFile
    content: string
    index: number
    total: number
}

export type EmitPatchFileStream = {
    onEvent: GenerateWebsiteInput['onEvent']
    file: ProjectPatchOperation
    content: string
    index: number
    total: number
}

export type GetProjectRevisionBase = {
    userId: string
    projectId: string
    versionId?: string
}

export type PersistProjectRevision = {
    project: RevisionBase['project']
    userId: string
    baseVersion: RevisionBase['baseVersion']
    nextVersionNumber: number
    mergedFiles: Record<string, string>
    removedFiles: string[]
    sourcePrompt: string
    assistantMessage: string
    summary: string
    nextProjectPrompt?: string
    canvasState?: unknown
}

export type MarkGenerationFailed = {
    project: ProjectRecord
    versionId: string
    prompt: string
    assistantMessageContent: string
    hadCurrentVersion: boolean
    messagesPersisted: boolean
    error: unknown
}

export type NotifyRuntimeOfManifest = {
    projectId: string
    manifest: PreviewManifestRef | null
}

export type PublishIncrementalPreviewSnapshot = {
    projectId: string
    versionId: string
    path: string
    content: string
    generatedFiles: Record<string, string>
    sequence: number
}

export type PublishFinalPreviewSnapshot = {
    projectId: string
    versionId: string
    files: Array<{
        path: string
        key: string
        contentType?: string
        size: number
    }>
}
