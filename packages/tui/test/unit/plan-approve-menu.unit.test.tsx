import { describe, it, expect, mock } from 'bun:test'
import { render } from 'ink-testing-library'
import React from 'react'

import { PlanApproveMenu } from '../../src/components/menus/plan-approve-menu'

describe('PlanApproveMenu Component (Unit)', () => {
    it('renders approve and reject options with keys', () => {
        const handlePlanApprovalSelect = mock()
        const { lastFrame } = render(
            <PlanApproveMenu
                handlePlanApprovalSelect={handlePlanApprovalSelect}
                planSummary="Step 1: Refactor auth"
            />
        )
        const output = lastFrame() || ''

        expect(output).toContain('Step 1: Refactor auth')
        expect(output).toContain('Approve')
        expect(output).toContain('Refine')
        expect(output).toContain('Reject')
        expect(output).toContain('y')
        expect(output).toContain('r')
        expect(output).toContain('n')
    })

    it('approves instantly on pressing y key', () => {
        const handlePlanApprovalSelect = mock()
        const { stdin } = render(
            <PlanApproveMenu
                handlePlanApprovalSelect={handlePlanApprovalSelect}
                planSummary="Test plan"
            />
        )

        stdin.write('y')
        expect(handlePlanApprovalSelect).toHaveBeenCalledWith(
            expect.objectContaining({ value: 'approve' })
        )
    })

    it('rejects instantly on pressing n or escape key', () => {
        const handlePlanApprovalSelect = mock()
        const { stdin } = render(
            <PlanApproveMenu
                handlePlanApprovalSelect={handlePlanApprovalSelect}
                planSummary="Test plan"
            />
        )

        stdin.write('n')
        expect(handlePlanApprovalSelect).toHaveBeenCalledWith(
            expect.objectContaining({ value: 'reject' })
        )
    })

    it('refines instantly on pressing r key', () => {
        const handlePlanApprovalSelect = mock()
        const { stdin } = render(
            <PlanApproveMenu
                handlePlanApprovalSelect={handlePlanApprovalSelect}
                planSummary="Test plan"
            />
        )

        stdin.write('r')
        expect(handlePlanApprovalSelect).toHaveBeenCalledWith(
            expect.objectContaining({ value: 'refine' })
        )
    })

    it('views full plan on pressing v key', () => {
        const handlePlanApprovalSelect = mock()
        const { stdin } = render(
            <PlanApproveMenu
                handlePlanApprovalSelect={handlePlanApprovalSelect}
                planSummary="Test plan"
            />
        )

        stdin.write('v')
        expect(handlePlanApprovalSelect).toHaveBeenCalledWith(
            expect.objectContaining({ value: 'view' })
        )
    })
})
