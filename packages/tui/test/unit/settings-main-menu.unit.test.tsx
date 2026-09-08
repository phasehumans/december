import { describe, expect, it, mock } from 'bun:test'
import { render } from 'ink-testing-library'
import React from 'react'

import { SettingsMainMenu } from '../../src/components/menus/settings-main-menu'

describe('SettingsMainMenu Component (Unit)', () => {
    it('renders all settings menu items with default/fallback values', () => {
        const { lastFrame } = render(
            <SettingsMainMenu
                settingsNonWorkspace={false}
                settingsToolPermission="always-proceed"
                settingsThinkingLevel="auto"
                settingsPathGuard={true}
                handleSettingsMainSelect={mock(() => {})}
            />
        )

        const frame = lastFrame() || ''
        expect(frame).toContain('Settings')
        expect(frame).toContain('Active Provider')
        expect(frame).toContain('[Not configured]')
        expect(frame).toContain('Active Model')
        expect(frame).toContain('[default]')
        expect(frame).toContain('Tool Permission')
        expect(frame).toContain('[always-proceed]')
        expect(frame).toContain('PathGuard Protection')
        expect(frame).toContain('[on]')
        expect(frame).toContain('Non-Workspace Access')
        expect(frame).toContain('[off]')
        expect(frame).toContain('Thinking Level')
        expect(frame).toContain('[auto]')
        expect(frame).toContain('MCP Servers')
        expect(frame).toContain('[Configure]')
    })

    it('renders active provider and model when configured', () => {
        const { lastFrame } = render(
            <SettingsMainMenu
                selectedProvider="anthropic"
                authMethod="byok"
                activeModel="claude-3-7-sonnet"
                settingsNonWorkspace={true}
                settingsToolPermission="always-ask"
                settingsThinkingLevel="high"
                settingsPathGuard={false}
                handleSettingsMainSelect={mock(() => {})}
            />
        )

        const frame = lastFrame() || ''
        expect(frame).toContain('Active Provider')
        expect(frame).toContain('[Anthropic (BYOK)]')
        expect(frame).toContain('Active Model')
        expect(frame).toContain('[claude-3-7-sonnet]')
        expect(frame).toContain('Tool Permission')
        expect(frame).toContain('[always-ask]')
        expect(frame).toContain('PathGuard Protection')
        expect(frame).toContain('[off]')
        expect(frame).toContain('Non-Workspace Access')
        expect(frame).toContain('[on]')
        expect(frame).toContain('Thinking Level')
        expect(frame).toContain('[high]')
    })

    it('renders subscription and december cloud labels correctly', () => {
        const sub = render(
            <SettingsMainMenu
                selectedProvider="claude"
                authMethod="subscription"
                handleSettingsMainSelect={mock(() => {})}
            />
        )
        expect(sub.lastFrame()).toContain('[Anthropic (Subscription)]')

        const dec = render(
            <SettingsMainMenu
                selectedProvider="december_proxy"
                authMethod="december"
                handleSettingsMainSelect={mock(() => {})}
            />
        )
        expect(dec.lastFrame()).toContain('[December Cloud]')
    })
})
