import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { describe, it, expect, beforeEach, afterEach } from 'vitest'

import { ArtifactManager } from '../../src/artifacts/artifact-manager'

describe('ArtifactManager', () => {
    let tmpDir: string

    beforeEach(async () => {
        tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'december-artifacts-test-'))
    })

    afterEach(async () => {
        await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {
            // Intentionally swallowed: test cleanup
        })
    })

    it('parses and serializes markdown frontmatter accurately', () => {
        const metadata = {
            id: 'test-1',
            title: 'Test Plan',
            type: 'plan',
            status: 'needs_review',
        }
        const body = '# Implementation Plan\n\n1. Step one\n2. Step two'

        const serialized = ArtifactManager.serializeFrontmatter(metadata, body)
        expect(serialized).toContain('title: Test Plan')
        expect(serialized).toContain('type: plan')
        expect(serialized).toContain('# Implementation Plan')

        const parsed = ArtifactManager.parseFrontmatter(serialized)
        expect(parsed.metadata.title).toBe('Test Plan')
        expect(parsed.metadata.type).toBe('plan')
        expect(parsed.body).toBe(body)
    })

    it('saves an artifact and persists to .december/artifacts/<sessionId>/', async () => {
        const artifact = await ArtifactManager.saveArtifact(tmpDir, 'sess_123', {
            filename: 'plan.md',
            title: 'Migration Plan',
            type: 'plan',
            summary: 'Migrate to Lucia v3',
            content: '# Plan\n- [ ] Step 1',
            requestFeedback: true,
        })

        expect(artifact.filePath).toContain(path.join(tmpDir, 'sess_123', 'plan.md'))

        const fileExists = await fs.stat(artifact.filePath)
        expect(fileExists.isFile()).toBe(true)

        // Default global path verification
        const defaultGlobalDir = ArtifactManager.getArtifactsDir('sess_123')
        expect(defaultGlobalDir).toContain(path.join('.december', 'artifacts', 'sess_123'))
    })

    it('lists all artifacts in a session ordered by update time', async () => {
        await ArtifactManager.saveArtifact(tmpDir, 'sess_123', {
            filename: 'alpha.md',
            title: 'Alpha Plan',
            content: '# Alpha',
        })
        await ArtifactManager.saveArtifact(tmpDir, 'sess_123', {
            filename: 'beta.md',
            title: 'Beta Spec',
            type: 'spec',
            content: '# Beta',
        })

        const artifacts = await ArtifactManager.listArtifacts(tmpDir, 'sess_123')
        expect(artifacts.length).toBe(2)
        const filenames = artifacts.map((a) => a.filename)
        expect(filenames).toContain('alpha.md')
        expect(filenames).toContain('beta.md')
    })

    it('updates artifact status correctly', async () => {
        await ArtifactManager.saveArtifact(tmpDir, 'sess_123', {
            filename: 'plan.md',
            title: 'Plan',
            content: '# Content',
            requestFeedback: true,
        })

        const updated = await ArtifactManager.updateArtifactStatus(
            tmpDir,
            'sess_123',
            'plan.md',
            'approved'
        )

        expect(updated).not.toBeNull()
        expect(updated?.status).toBe('approved')

        const fetched = await ArtifactManager.getArtifact(tmpDir, 'sess_123', 'plan.md')
        expect(fetched?.status).toBe('approved')
    })
})
