import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { expect, test, describe, afterEach, beforeEach, mock } from 'bun:test'
import React from 'react'

import { useAppStore } from '../src/app/store'
import { PlanChecklistPanel } from '../src/features/preview/components/PlanChecklistPanel'
import { sessionAPI } from '../src/features/sessions/api/session'

if (!globalThis.document) {
    GlobalRegistrator.register()
}

const { render, screen, cleanup, fireEvent } = await import('@testing-library/react')

describe('Structured Plan Checklist Panel (Ticket #588)', () => {
    beforeEach(() => {
        useAppStore.setState({
            sessionPlan: null,
        })
    })

    afterEach(() => {
        cleanup()
    })

    test('renders 5 canonical milestone phases with distinct statuses', () => {
        const mockPlan = {
            sessionId: 'sess-plan-ui-1',
            activePhaseId: 'implement' as const,
            milestones: [
                {
                    id: 'reproduce' as const,
                    title: 'Reproduce & Understand',
                    description: 'Analyze user prompt and problem context',
                    status: 'completed' as const,
                    logs: ['Inspected user issue details'],
                    completedAt: '2026-10-23T09:00:00Z',
                },
                {
                    id: 'locate' as const,
                    title: 'Locate Relevant Code',
                    description: 'Search repository and locate target files',
                    status: 'completed' as const,
                    logs: ['grep for Navigation in src/'],
                    completedAt: '2026-10-23T09:01:00Z',
                },
                {
                    id: 'implement' as const,
                    title: 'Implement Solution',
                    description: 'Modify files and implement requested changes',
                    status: 'in_progress' as const,
                    rationale: 'Adding responsive hamburger navigation',
                    logs: ['Editing src/components/Navigation.tsx'],
                },
                {
                    id: 'test' as const,
                    title: 'Run Tests & Verify',
                    description: 'Run automated tests and verify build',
                    status: 'pending' as const,
                    logs: [],
                },
                {
                    id: 'pr' as const,
                    title: 'Branch & Create PR',
                    description: 'Push task branch and open pull request',
                    status: 'pending' as const,
                    logs: [],
                },
            ],
            updatedAt: Date.now(),
        }

        useAppStore.setState({ sessionPlan: mockPlan })

        render(<PlanChecklistPanel sessionId="sess-plan-ui-1" />)

        // All 5 phase titles present
        expect(screen.getByText('Reproduce & Understand')).not.toBeNull()
        expect(screen.getByText('Locate Relevant Code')).not.toBeNull()
        expect(screen.getByText('Implement Solution')).not.toBeNull()
        expect(screen.getByText('Run Tests & Verify')).not.toBeNull()
        expect(screen.getByText('Branch & Create PR')).not.toBeNull()

        // Status indicators
        expect(screen.getAllByText(/completed/i).length).toBeGreaterThanOrEqual(2)
        expect(screen.getByText(/in progress/i)).not.toBeNull()
        expect(screen.getAllByText(/pending/i).length).toBeGreaterThanOrEqual(2)
    })

    test('expands phase to inspect detailed logs and agent rationale', () => {
        const mockPlan = {
            sessionId: 'sess-plan-ui-2',
            activePhaseId: 'implement' as const,
            milestones: [
                {
                    id: 'reproduce' as const,
                    title: 'Reproduce & Understand',
                    description: 'Analyze user prompt',
                    status: 'completed' as const,
                    logs: [],
                },
                {
                    id: 'locate' as const,
                    title: 'Locate Relevant Code',
                    description: 'Search repository',
                    status: 'completed' as const,
                    logs: ['Found file src/components/Sidebar.tsx'],
                },
                {
                    id: 'implement' as const,
                    title: 'Implement Solution',
                    description: 'Modify files',
                    status: 'in_progress' as const,
                    rationale: 'Refactoring sidebar collapse logic to support mobile',
                    logs: ['Modified src/features/navigation/Sidebar.tsx'],
                },
                {
                    id: 'test' as const,
                    title: 'Run Tests & Verify',
                    description: 'Run test suite',
                    status: 'pending' as const,
                    logs: [],
                },
                {
                    id: 'pr' as const,
                    title: 'Branch & Create PR',
                    description: 'Open PR',
                    status: 'pending' as const,
                    logs: [],
                },
            ],
            updatedAt: Date.now(),
        }

        useAppStore.setState({ sessionPlan: mockPlan })

        render(<PlanChecklistPanel sessionId="sess-plan-ui-2" />)

        // Click on implement milestone row to toggle/inspect details
        const implementRow = screen.getByText('Implement Solution')
        fireEvent.click(implementRow)

        // Rationale and logs are visible
        expect(
            screen.getByText('Refactoring sidebar collapse logic to support mobile')
        ).not.toBeNull()
        expect(screen.getByText('Modified src/features/navigation/Sidebar.tsx')).not.toBeNull()
    })

    test('fetches plan on mount when sessionPlan store is null', async () => {
        sessionAPI.getSessionPlan = mock(async () => ({
            plan: null,
        }))

        render(<PlanChecklistPanel sessionId="sess-plan-mount" />)

        expect(sessionAPI.getSessionPlan).toHaveBeenCalledWith('sess-plan-mount')
    })
})
