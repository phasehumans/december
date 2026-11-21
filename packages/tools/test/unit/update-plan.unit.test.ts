import { describe, expect, test } from 'bun:test'

import { CORE_TOOLS } from '../../src/index'
import { UpdatePlanTool, validatePlan } from '../../src/update_plan'

const run = (input: any) => UpdatePlanTool.execute(input, {} as any)

describe('update_plan tool', () => {
    test('is a core tool, so the agent can always show a plan', () => {
        expect(CORE_TOOLS.map((t) => t.name)).toContain('update_plan')
    })

    test('accepts a plan and reports progress', async () => {
        const result = await run({
            items: [
                { text: 'Find where the TTL is set', status: 'done' },
                { text: 'Move TTL to env', status: 'in_progress' },
                { text: 'Update tests', status: 'pending' },
            ],
        })
        expect(result).toBe('Plan updated (1/3 done).')
    })

    test('rejects an empty plan', () => {
        expect(validatePlan({ items: [] })).toContain('at least one item')
    })

    test('rejects items without text', () => {
        expect(validatePlan({ items: [{ text: '  ', status: 'pending' }] })).toContain(
            'non-empty text'
        )
    })

    test('rejects more than one item in progress', async () => {
        const result = await run({
            items: [
                { text: 'a', status: 'in_progress' },
                { text: 'b', status: 'in_progress' },
            ],
        })
        expect(result).toContain('only one plan item')
    })
})
