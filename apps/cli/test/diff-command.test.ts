import { COMMANDS } from '@december/tui'
import { describe, it, expect } from 'vitest'

describe('CLI diff slash command', () => {
    it('registers /diff in COMMANDS with correct metadata', () => {
        const diffCmd = COMMANDS.find((c) => c.name === 'diff')
        expect(diffCmd).toBeDefined()
        expect(diffCmd?.value).toBe('/diff')
        expect(diffCmd?.description).toContain('View git diff and workspace changes')
    })
})
