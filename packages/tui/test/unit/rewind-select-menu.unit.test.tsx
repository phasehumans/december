import { describe, it, expect, mock } from 'bun:test'
import { render } from 'ink-testing-library'
import React from 'react'

import { RewindSelectMenu } from '../../src/components/menus/rewind-select-menu'

describe('RewindSelectMenu Component (Unit)', () => {
    it('renders clean fallback when no snapshots exist', () => {
        const { lastFrame } = render(<RewindSelectMenu rewindItems={[]} />)
        const output = lastFrame() || ''

        expect(output).toContain('Rewind Workspace & Conversation Timeline')
        expect(output).toContain('No turn snapshots recorded in this session.')
        expect(output).toContain('Navigate')
        expect(output).toContain('Rewind to Turn')
    })

    it('renders list of turn snapshots with turn numbers, preview, and files count', () => {
        const items = [
            {
                turnIndex: 1,
                commitHash: 'a1b2c3d4e5f6',
                prompt: 'create initial database schema',
                timestamp: Date.now() - 60_000,
                touchedFiles: ['schema.prisma'],
            },
            {
                turnIndex: 2,
                commitHash: 'f6e5d4c3b2a1',
                prompt: 'add authentication routes',
                timestamp: Date.now() - 10_000,
                touchedFiles: ['auth.routes.ts', 'auth.service.ts'],
            },
        ]

        const { lastFrame } = render(<RewindSelectMenu rewindItems={items} />)
        const output = lastFrame() || ''

        expect(output).toContain('Turn 1')
        expect(output).toContain('Turn 2')
        expect(output).toContain('create initial database schema')
        expect(output).toContain('add authentication routes')
        expect(output).toContain('a1b2c3d')
        expect(output).toContain('f6e5d4c')
        expect(output).toContain('(1 file)')
        expect(output).toContain('(2 files)')
        expect(output).toContain('❯')
    })

    it('navigates with up and down arrow keys and selects turn on Enter', async () => {
        const onSelectTurn = mock()
        const items = [
            {
                turnIndex: 1,
                commitHash: '111111111111',
                prompt: 'turn one',
                timestamp: Date.now() - 30_000,
            },
            {
                turnIndex: 2,
                commitHash: '222222222222',
                prompt: 'turn two',
                timestamp: Date.now() - 10_000,
            },
        ]

        // Note: items are sorted in descending order, so Turn 2 is at index 0, Turn 1 at index 1
        const { stdin } = render(
            <RewindSelectMenu rewindItems={items} onSelectTurn={onSelectTurn} />
        )

        // Press down arrow to move selection to Turn 1
        stdin.write('\u001B[B') // Down arrow
        await new Promise((resolve) => setTimeout(resolve, 30))

        // Press Enter to confirm
        stdin.write('\r')
        await new Promise((resolve) => setTimeout(resolve, 30))

        expect(onSelectTurn).toHaveBeenCalledWith(1)
    })

    it('exits on Escape key', async () => {
        const onClose = mock()
        const { stdin } = render(
            <RewindSelectMenu
                rewindItems={[
                    {
                        turnIndex: 1,
                        commitHash: '1234567890ab',
                        prompt: 'test prompt',
                        timestamp: Date.now(),
                    },
                ]}
                onClose={onClose}
            />
        )

        stdin.write('\u001B') // Escape
        await new Promise((resolve) => setTimeout(resolve, 30))
        expect(onClose).toHaveBeenCalledTimes(1)
    })
})
