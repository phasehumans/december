import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { mock } from 'bun:test'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'

import { ArtifactManager } from '../../src/artifacts/artifact-manager'
import { WriteArtifactTool } from '../../src/write_artifact'
import { createMockContext } from '../mock-context'

describe('WriteArtifactTool', () => {
    let tmpDir: string
    let context: any

    beforeEach(async () => {
        tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'december-write-artifact-test-'))
        context = createMockContext()
        context.operations.env.cwd = () => tmpDir
        context.sessionId = 'test-session-1'
    })

    afterEach(async () => {
        await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {
            // Intentionally swallowed: test cleanup
        })
        const globalTestDir = ArtifactManager.getArtifactsDir('test-session-1')
        await fs.rm(globalTestDir, { recursive: true, force: true }).catch(() => {
            // Intentionally swallowed: test cleanup
        })
    })

    it('creates an artifact and saves to disk without interactive review when no ui review provided', async () => {
        const result = await WriteArtifactTool.execute(
            {
                filename: 'plan.md',
                title: 'Architecture Plan',
                content: '# Architecture\n1. [ ] Create endpoints',
                requestFeedback: false,
            },
            context
        )

        expect(result).toContain('saved to')
        const artifactPath = path.join(ArtifactManager.getArtifactsDir('test-session-1'), 'plan.md')
        const fileContent = await fs.readFile(artifactPath, 'utf8')
        expect(fileContent).toContain('Architecture Plan')
        expect(fileContent).toContain('1. [ ] Create endpoints')
    })

    it('triggers interactive review and handles proceed approval', async () => {
        context.operations.ui.reviewArtifact = mock(async () => ({
            action: 'proceed',
        }))

        const result = await WriteArtifactTool.execute(
            {
                filename: 'plan.md',
                title: 'Architecture Plan',
                content: '# Architecture\n1. [ ] Touch points',
                requestFeedback: true,
            },
            context
        )

        expect(context.operations.ui.reviewArtifact).toHaveBeenCalled()
        expect(result).toContain('approved by user')
    })

    it('triggers interactive review and handles refine feedback', async () => {
        context.operations.ui.reviewArtifact = mock(async () => ({
            action: 'refine',
            feedback: 'Add database migration steps',
        }))

        const result = await WriteArtifactTool.execute(
            {
                filename: 'plan.md',
                title: 'Architecture Plan',
                content: '# Architecture\n1. [ ] Touch points',
                requestFeedback: true,
            },
            context
        )

        expect(context.operations.ui.reviewArtifact).toHaveBeenCalled()
        expect(result).toContain('User requested changes')
        expect(result).toContain('Add database migration steps')
    })

    it('triggers interactive review and handles reject', async () => {
        context.operations.ui.reviewArtifact = mock(async () => ({
            action: 'reject',
            feedback: 'Plan is invalid',
        }))

        const result = await WriteArtifactTool.execute(
            {
                filename: 'plan.md',
                title: 'Architecture Plan',
                content: '# Architecture',
                requestFeedback: true,
            },
            context
        )

        expect(context.operations.ui.reviewArtifact).toHaveBeenCalled()
        expect(result).toContain('User rejected')
        expect(result).toContain('Plan is invalid')
    })
})
