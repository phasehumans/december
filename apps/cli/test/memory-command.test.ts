import { COMMANDS } from '@december/tui'
import { describe, it, expect } from 'vitest'

describe('CLI memory slash command', () => {
    it('registers /memory in COMMANDS with correct metadata', () => {
        const memCmd = COMMANDS.find((c) => c.name === 'memory')
        expect(memCmd).toBeDefined()
        expect(memCmd?.value).toBe('/memory')
        expect(memCmd?.description).toContain('workspace memory')
        expect(memCmd?.description).toContain('AGENTS.md')
    })
})
