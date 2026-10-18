import { describe, it, expect, mock } from 'bun:test'
import { render } from 'ink-testing-library'
import React from 'react'

import { CommandMenu } from '../../src/components/command-menu'
import { COMMANDS } from '../../src/components/command-menu/commands'
import {
    getFilteredCommands,
    getAllAvailableCommands,
} from '../../src/components/command-menu/filter-commands'
import { useCommandMenu } from '../../src/components/command-menu/use-command-menu'
import { KeyboardLayerProvider } from '../../src/providers/keyboard-layer'

function CommandInputHarness({ onAutocomplete }: { onAutocomplete?: (text: string) => void }) {
    const {
        showCommandMenu,
        commandQuery,
        selectedIndex,
        windowStart,
        handleContentChange,
        setSelectedIndex,
    } = useCommandMenu({ onAutocomplete })

    return (
        <>
            {showCommandMenu && (
                <CommandMenu
                    query={commandQuery}
                    selectedIndex={selectedIndex}
                    windowStart={windowStart}
                    totalFiltered={1}
                    onSelect={setSelectedIndex}
                    onExecute={() => {}}
                />
            )}
            <TestTrigger onTrigger={() => handleContentChange('/pl')} />
        </>
    )
}

function TestTrigger({ onTrigger }: { onTrigger: () => void }) {
    const triggered = React.useRef(false)
    React.useLayoutEffect(() => {
        if (!triggered.current) {
            triggered.current = true
            onTrigger()
        }
    }, [onTrigger])
    return null
}

describe('CommandMenu Component (Unit)', () => {
    it('registers /plan slash command', () => {
        const planCmd = COMMANDS.find((c) => c.name === 'plan')
        expect(planCmd).toBeDefined()
        expect(planCmd?.value).toBe('/plan')
    })

    it('autocompletes highlighted command on Tab keypress', () => {
        const onAutocomplete = mock()
        const { stdin } = render(
            <KeyboardLayerProvider>
                <CommandInputHarness onAutocomplete={onAutocomplete} />
            </KeyboardLayerProvider>
        )

        stdin.write('\t')
        expect(onAutocomplete).toHaveBeenCalledWith('/plan ')
    })

    it('filters commands including dynamically loaded custom commands', () => {
        const all = getAllAvailableCommands()
        expect(all.some((c: any) => c.name === 'plan')).toBe(true)

        const filtered = getFilteredCommands('pl')
        expect(filtered.some((c: any) => c.name === 'plan')).toBe(true)
    })

    it('navigates commands with up and down arrow keys', async () => {
        function CommandNavigationHarness() {
            const {
                showCommandMenu,
                commandQuery,
                selectedIndex,
                windowStart,
                handleContentChange,
                setSelectedIndex,
            } = useCommandMenu()

            return (
                <>
                    {showCommandMenu && (
                        <CommandMenu
                            query={commandQuery}
                            selectedIndex={selectedIndex}
                            windowStart={windowStart}
                            totalFiltered={0}
                            onSelect={setSelectedIndex}
                            onExecute={() => {}}
                        />
                    )}
                    <TestTrigger onTrigger={() => handleContentChange('/')} />
                </>
            )
        }

        const { stdin, lastFrame } = render(
            <KeyboardLayerProvider>
                <CommandNavigationHarness />
            </KeyboardLayerProvider>
        )

        expect(lastFrame()).toContain('❭ /ask')

        stdin.write('\u001B[B') // Down
        await new Promise((resolve) => setTimeout(resolve, 20))
        expect(lastFrame()).toContain('❭ /changelog')

        stdin.write('\u001B[A') // Up
        await new Promise((resolve) => setTimeout(resolve, 20))
        expect(lastFrame()).toContain('❭ /ask')
    })

    it('renders clean compact layout without status indicator for single match', () => {
        const { lastFrame } = render(
            <CommandMenu
                query="log"
                selectedIndex={0}
                windowStart={0}
                totalFiltered={1}
                onSelect={() => {}}
                onExecute={() => {}}
            />
        )

        const frame = lastFrame() || ''
        expect(frame).toContain('/login')
        expect(frame).not.toContain('more')
        // Ensure no empty padded lines
        const lines = frame.split('\n').filter((l) => l.trim().length > 0)
        expect(lines.length).toBe(1)
    })

    it('renders bottom status pagination line when commands overflow WINDOW_SIZE', () => {
        const { lastFrame } = render(
            <CommandMenu
                query=""
                selectedIndex={0}
                windowStart={0}
                totalFiltered={0}
                onSelect={() => {}}
                onExecute={() => {}}
            />
        )

        const frame = lastFrame() || ''
        expect(frame).toMatch(/↓ \d+ more/)
        expect(frame).not.toContain('↑')
    })
})
