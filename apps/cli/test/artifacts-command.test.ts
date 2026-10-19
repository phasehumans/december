import { COMMANDS } from '@december/tui'
import { describe, it, expect } from 'vitest'

describe('CLI artifacts slash command', () => {
    it('registers /artifacts in COMMANDS with correct metadata', () => {
        const artifactsCmd = COMMANDS.find((c) => c.name === 'artifacts')
        expect(artifactsCmd).toBeDefined()
        expect(artifactsCmd?.value).toBe('/artifacts')
        expect(artifactsCmd?.description).toContain('View and review session artifacts')
    })
})
