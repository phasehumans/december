import { describe, it, expect } from 'bun:test'

import {
    createDefaultSessionPlan,
    advancePlanPhase,
    inferPhaseFromToolCall,
    type SessionPlan,
} from '../../src/plan-milestones'

describe('Kernel Plan & Milestone Engine (Ticket #588)', () => {
    it('initializes default plan with 5 canonical phases and reproduce in_progress', () => {
        const plan = createDefaultSessionPlan('sess-plan-1')

        expect(plan.sessionId).toBe('sess-plan-1')
        expect(plan.activePhaseId).toBe('reproduce')
        expect(plan.milestones).toHaveLength(5)

        const phaseIds = plan.milestones.map((m) => m.id)
        expect(phaseIds).toEqual(['reproduce', 'locate', 'implement', 'test', 'pr'])

        expect(plan.milestones[0].status).toBe('in_progress')
        expect(plan.milestones[1].status).toBe('pending')
        expect(plan.milestones[2].status).toBe('pending')
        expect(plan.milestones[3].status).toBe('pending')
        expect(plan.milestones[4].status).toBe('pending')
    })

    it('infers correct phase from tool calls and command inputs', () => {
        // Read/search tools -> locate
        expect(inferPhaseFromToolCall('read_file', { path: 'src/index.ts' })).toBe('locate')
        expect(inferPhaseFromToolCall('grep', { query: 'function App' })).toBe('locate')
        expect(inferPhaseFromToolCall('find', { pattern: '*.ts' })).toBe('locate')

        // Mutating tools -> implement
        expect(inferPhaseFromToolCall('write_file', { path: 'src/App.tsx' })).toBe('implement')
        expect(inferPhaseFromToolCall('edit_file', { path: 'src/App.tsx' })).toBe('implement')

        // Test commands -> test
        expect(inferPhaseFromToolCall('bash', { command: 'bun test' })).toBe('test')
        expect(inferPhaseFromToolCall('shell', { command: 'npm run test:unit' })).toBe('test')
        expect(inferPhaseFromToolCall('terminal', { command: 'pytest' })).toBe('test')

        // Other generic commands
        expect(inferPhaseFromToolCall('bash', { command: 'git checkout' })).toBeNull()
    })

    it('advances plan phase, marks prior phases completed, and records logs and rationale', () => {
        let plan: SessionPlan = createDefaultSessionPlan('sess-plan-2')

        // Advance to locate
        plan = advancePlanPhase({
            plan,
            targetPhaseId: 'locate',
            rationale: 'Searching for navigation component definitions',
            log: 'Executing grep for NavLink in src/',
        })

        expect(plan.activePhaseId).toBe('locate')
        expect(plan.milestones.find((m) => m.id === 'reproduce')?.status).toBe('completed')
        const locateMilestone = plan.milestones.find((m) => m.id === 'locate')
        expect(locateMilestone?.status).toBe('in_progress')
        expect(locateMilestone?.rationale).toBe('Searching for navigation component definitions')
        expect(locateMilestone?.logs).toContain('Executing grep for NavLink in src/')

        // Advance to implement
        plan = advancePlanPhase({
            plan,
            targetPhaseId: 'implement',
            rationale: 'Adding responsive hamburger menu and sidebar items',
            log: 'Modified src/components/Navigation.tsx',
        })

        expect(plan.activePhaseId).toBe('implement')
        expect(plan.milestones.find((m) => m.id === 'locate')?.status).toBe('completed')
        expect(plan.milestones.find((m) => m.id === 'implement')?.status).toBe('in_progress')

        // Advance to test
        plan = advancePlanPhase({
            plan,
            targetPhaseId: 'test',
            rationale: 'Running unit tests for navigation suite',
            log: 'Running bun test navigation.test.tsx',
        })

        expect(plan.activePhaseId).toBe('test')
        expect(plan.milestones.find((m) => m.id === 'implement')?.status).toBe('completed')
        expect(plan.milestones.find((m) => m.id === 'test')?.status).toBe('in_progress')

        // Advance to pr
        plan = advancePlanPhase({
            plan,
            targetPhaseId: 'pr',
            rationale: 'Creating pull request for task branch',
            log: 'Pushed december/sess-plan-2 and created PR #99',
        })

        expect(plan.activePhaseId).toBe('pr')
        expect(plan.milestones.find((m) => m.id === 'test')?.status).toBe('completed')
        expect(plan.milestones.find((m) => m.id === 'pr')?.status).toBe('in_progress')
    })
})
