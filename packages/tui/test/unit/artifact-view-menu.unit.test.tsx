import { describe, expect, it, mock } from 'bun:test'
import React from 'react'

import { ArtifactViewMenu } from '../../src/components/menus/artifact-view-menu'
import { renderWithProviders } from '../test-providers'

import type { ArtifactEntry } from '@december/tools'

describe('ArtifactViewMenu Component (Unit)', () => {
    const mockArtifacts: ArtifactEntry[] = [
        {
            id: 'sess-1-plan',
            sessionId: 'sess-1',
            filename: 'plan.md',
            filePath: '.december/artifacts/sess-1/plan.md',
            title: 'Auth Migration',
            type: 'plan',
            status: 'needs_review',
            summary: 'Migrate to Lucia v3',
            content: '# Plan\n\n1. [x] Step one\n2. [ ] Step two',
            createdAt: 1000,
            updatedAt: 2000,
            requestFeedback: true,
        },
        {
            id: 'sess-1-spec',
            sessionId: 'sess-1',
            filename: 'architecture.md',
            filePath: '.december/artifacts/sess-1/architecture.md',
            title: 'Architecture Spec',
            type: 'spec',
            status: 'approved',
            content: '# Architecture Spec\n\nDiagram details',
            createdAt: 1000,
            updatedAt: 1500,
        },
    ]

    it('renders list view with session artifacts, titles, and status badges', async () => {
        const { lastFrame } = renderWithProviders(
            <ArtifactViewMenu
                sessionId="sess-1"
                initialArtifacts={mockArtifacts}
                initialDetailView={false}
            />
        )

        await new Promise((resolve) => setTimeout(resolve, 30))
        const frame = lastFrame()
        expect(frame).toContain('Session Artifacts')
        expect(frame).toContain('plan.md')
        expect(frame).toContain('(Auth Migration)')
        expect(frame).toContain('[Plan]')
        expect(frame).toContain('[Needs Review]')
        expect(frame).toContain('architecture.md')
        expect(frame).toContain('[Spec]')
        expect(frame).toContain('[Approved]')
        expect(frame).toContain('view artifact')
    })

    it('renders detail view with line numbers, status, and path', async () => {
        const { lastFrame } = renderWithProviders(
            <ArtifactViewMenu
                sessionId="sess-1"
                initialArtifacts={mockArtifacts}
                initialDetailView={true}
            />
        )

        await new Promise((resolve) => setTimeout(resolve, 30))
        const frame = lastFrame()
        expect(frame).toContain('[Artifact 1/2]')
        expect(frame).toContain('plan.md')
        expect(frame).toContain('[Needs Review]')
        expect(frame).toContain('.december/artifacts/sess-1/plan.md')
        expect(frame).toContain('01 │')
        expect(frame).toContain('# Plan')
        expect(frame).toContain('approve')
        expect(frame).toContain('refine')
        expect(frame).toContain('reject')
    })

    it('handles interactive approval on y keypress in pending review', async () => {
        const resolveMock = mock()
        const onCloseMock = mock()
        const pendingReview = {
            artifact: mockArtifacts[0]!,
            resolve: resolveMock,
        }

        const { stdin } = renderWithProviders(
            <ArtifactViewMenu
                sessionId="sess-1"
                pendingArtifactReview={pendingReview}
                onClose={onCloseMock}
            />
        )

        await new Promise((resolve) => setTimeout(resolve, 30))
        stdin.write('y')

        expect(resolveMock).toHaveBeenCalledWith({ action: 'proceed' })
        expect(onCloseMock).toHaveBeenCalled()
    })

    it('handles reject on n keypress in pending review', async () => {
        const resolveMock = mock()
        const onCloseMock = mock()
        const pendingReview = {
            artifact: mockArtifacts[0]!,
            resolve: resolveMock,
        }

        const { stdin } = renderWithProviders(
            <ArtifactViewMenu
                sessionId="sess-1"
                pendingArtifactReview={pendingReview}
                onClose={onCloseMock}
            />
        )

        await new Promise((resolve) => setTimeout(resolve, 30))
        stdin.write('n')

        expect(resolveMock).toHaveBeenCalledWith({
            action: 'reject',
            feedback: 'Execution cancelled by user.',
        })
        expect(onCloseMock).toHaveBeenCalled()
    })

    it('transitions from list view to detail view on Enter', async () => {
        const { stdin, lastFrame } = renderWithProviders(
            <ArtifactViewMenu
                sessionId="sess-1"
                initialArtifacts={mockArtifacts}
                initialDetailView={false}
            />
        )

        await new Promise((resolve) => setTimeout(resolve, 30))
        stdin.write('\r')

        await new Promise((resolve) => setTimeout(resolve, 30))
        const frame = lastFrame()
        expect(frame).toContain('[Artifact 1/2]')
        expect(frame).toContain('01 │')
    })
})
