import { describe, it, expect } from 'bun:test'

import { extractPlanSummary, openPlanInPager } from '../../src/utils/pager'

describe('Pager Utilities (Unit)', () => {
    it('extracts key steps from implementation plan', () => {
        const planText = `
### Implementation Plan
1. Create packages/tui/src/utils/pager.ts
2. Update plan approve menu with pager view
3. Verify keyboard shortcuts

Additional background information here.
`
        const summary = extractPlanSummary(planText, 3)
        expect(summary).toContain('1. Create packages/tui/src/utils/pager.ts')
        expect(summary).toContain('2. Update plan approve menu with pager view')
        expect(summary).toContain('3. Verify keyboard shortcuts')
    })

    it('returns empty string if plan text is empty', () => {
        expect(extractPlanSummary('')).toBe('')
    })

    it('resolves safely in test environment for openPlanInPager', async () => {
        await expect(openPlanInPager('Test plan content')).resolves.toBeUndefined()
    })
})
