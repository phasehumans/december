import { Tool } from '@december/shared'
import { Static, Type } from '@sinclair/typebox'

import { ArtifactManager } from './artifacts/artifact-manager'

import type { ArtifactType } from './artifacts/artifact-types'

const writeArtifactSchema = Type.Object({
    filename: Type.String({
        description:
            'File name for the artifact (e.g. plan.md, migration.md, architecture-spec.md).',
    }),
    title: Type.String({
        description: 'Human-readable title for the artifact.',
    }),
    type: Type.Optional(
        Type.Union(
            [
                Type.Literal('plan'),
                Type.Literal('spec'),
                Type.Literal('walkthrough'),
                Type.Literal('review'),
                Type.Literal('other'),
            ],
            {
                description: 'Type of artifact: plan, spec, walkthrough, review, or other.',
            }
        )
    ),
    summary: Type.Optional(
        Type.String({
            description: 'Brief 1-2 sentence executive summary of the artifact.',
        })
    ),
    content: Type.String({
        description:
            'Structured markdown content of the artifact. Can include Mermaid diagrams, checklists, touch points, and steps.',
    }),
    requestFeedback: Type.Optional(
        Type.Boolean({
            description:
                'Set to true to prompt interactive user review and approval in the TUI before continuing. Defaults to true.',
        })
    ),
})

export type WriteArtifactInput = Static<typeof writeArtifactSchema>

export const WriteArtifactTool: Tool<WriteArtifactInput> = {
    name: 'write_artifact',
    description:
        'Create or update a persistent markdown artifact (e.g. implementation plan, architectural spec, walkthrough) under ~/.december/artifacts/<session-id>/ with optional interactive user review and approval in the TUI before executing code mutations.',
    inputSchema: writeArtifactSchema,
    execute: async (input, context) => {
        const sessionId =
            (context as any).sessionId || (context as any).agent?.sessionId || 'default'
        const shouldRequestFeedback = input.requestFeedback !== false

        const artifact = await ArtifactManager.saveArtifact(sessionId, {
            filename: input.filename,
            title: input.title,
            type: (input.type as ArtifactType) || 'plan',
            summary: input.summary,
            content: input.content,
            requestFeedback: shouldRequestFeedback,
        })

        if (shouldRequestFeedback && context.operations.ui?.reviewArtifact) {
            const reviewResult = await context.operations.ui.reviewArtifact(artifact)

            if (reviewResult.action === 'proceed') {
                await ArtifactManager.updateArtifactStatus(sessionId, artifact.filename, 'approved')
                return `Artifact "${artifact.filename}" approved by user. You may proceed with executing code modifications.`
            }

            if (reviewResult.action === 'refine') {
                await ArtifactManager.updateArtifactStatus(
                    sessionId,
                    artifact.filename,
                    'needs_review'
                )
                return `User requested changes on "${artifact.filename}": ${
                    reviewResult.feedback || 'Please adjust the plan'
                }. Update the artifact and plan accordingly.`
            }

            if (reviewResult.action === 'reject') {
                await ArtifactManager.updateArtifactStatus(sessionId, artifact.filename, 'rejected')
                return `User rejected "${artifact.filename}": ${
                    reviewResult.feedback || 'Execution cancelled by user'
                }. Do not proceed with code modifications.`
            }
        }

        return `Artifact "${artifact.filename}" saved to ${artifact.filePath}.`
    },
}
