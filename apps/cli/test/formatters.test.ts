import { expect, test, describe } from 'bun:test'

import { getToolSummary, toPascalCase } from '../src/utils/formatters'

describe('formatters', () => {
    describe('getToolSummary', () => {
        test('formats read_file', () => {
            expect(getToolSummary('read_file', JSON.stringify({ filePath: 'foo.ts' }))).toBe(
                'Read(foo.ts)'
            )
            expect(getToolSummary('read_file', JSON.stringify({ path: 'bar.ts' }))).toBe(
                'Read(bar.ts)'
            )
            const absPath = `${process.cwd()}/apps/cli/src/index.ts`
            expect(getToolSummary('read_file', JSON.stringify({ AbsolutePath: absPath }))).toBe(
                'Read(apps/cli/src/index.ts)'
            )
        })

        test('formats write_file', () => {
            expect(getToolSummary('write_file', JSON.stringify({ filePath: 'foo.ts' }))).toBe(
                'Create(foo.ts)'
            )
        })

        test('formats edit_file and edit_diff', () => {
            expect(getToolSummary('edit_file', JSON.stringify({ filePath: 'foo.ts' }))).toBe(
                'Edit(foo.ts)'
            )
            expect(getToolSummary('edit_diff', JSON.stringify({ path: 'bar.ts' }))).toBe(
                'Edit(bar.ts)'
            )
        })

        test('formats list_dir', () => {
            expect(getToolSummary('list_dir', JSON.stringify({ dirPath: 'src/' }))).toBe(
                'ListDir(src/)'
            )
            const absPath = `${process.cwd()}/apps/cli/src`
            expect(getToolSummary('list_dir', JSON.stringify({ DirectoryPath: absPath }))).toBe(
                'ListDir(apps/cli/src)'
            )
            expect(
                getToolSummary('list_dir', JSON.stringify({ DirectoryPath: process.cwd() }))
            ).toBe('ListDir(.)')
            expect(getToolSummary('ls', JSON.stringify({ dirPath: 'src/' }))).toBe('ListDir(src/)')
        })

        test('formats bash', () => {
            expect(getToolSummary('bash', JSON.stringify({ command: 'ls -la' }))).toBe(
                'Bash(ls -la)'
            )
        })

        test('formats search tools', () => {
            expect(getToolSummary('find_files', JSON.stringify({ pattern: '*.ts' }))).toBe(
                'Search(*.ts)'
            )
            expect(getToolSummary('grep_search', JSON.stringify({ query: 'TODO' }))).toBe(
                'Search(TODO)'
            )
            expect(getToolSummary('code_search', JSON.stringify({ query: 'BotMessage' }))).toBe(
                'Search(BotMessage)'
            )
            expect(
                getToolSummary('read_url_content', JSON.stringify({ Url: 'https://example.com' }))
            ).toBe('WebSearch(https://example.com)')
        })

        test('formats manage_subagent and subagent tools', () => {
            expect(getToolSummary('manage_subagent', JSON.stringify({ action: 'list' }))).toBe(
                'ManageSubagent(list)'
            )
            expect(
                getToolSummary(
                    'manage_subagent',
                    JSON.stringify({ action: 'status', subagentId: 'agent-123' })
                )
            ).toBe('ManageSubagent(status:agent-123)')
            expect(getToolSummary('invoke_subagent', JSON.stringify({ role: 'researcher' }))).toBe(
                'SubAgent(researcher)'
            )
        })

        test('formats write_artifact and specialized tools', () => {
            expect(
                getToolSummary('write_artifact', JSON.stringify({ filePath: 'report.md' }))
            ).toBe('Artifact(report.md)')
            expect(getToolSummary('browser', JSON.stringify({ action: 'launch' }))).toBe(
                'Browser(launch)'
            )
            expect(getToolSummary('manage_memory', JSON.stringify({ action: 'recall' }))).toBe(
                'ManageMemory(recall)'
            )
        })

        test('handles unknown tools with automatic PascalCase', () => {
            expect(getToolSummary('unknown_tool', JSON.stringify({ foo: 'bar' }))).toBe(
                'UnknownTool()'
            )
            expect(getToolSummary('custom_mcp_tool', JSON.stringify({}))).toBe('CustomMcpTool()')
        })

        test('handles malformed JSON input with PascalCase', () => {
            expect(getToolSummary('read_file', 'malformed {')).toBe('ReadFile()')
            expect(getToolSummary('bash', undefined as unknown as string)).toBe('Bash()')
        })
    })

    describe('toPascalCase', () => {
        test('converts snake_case, kebab-case, and dot notation to PascalCase', () => {
            expect(toPascalCase('manage_subagent')).toBe('ManageSubagent')
            expect(toPascalCase('read_file')).toBe('ReadFile')
            expect(toPascalCase('custom-tool-name')).toBe('CustomToolName')
            expect(toPascalCase('mcp.tools:run')).toBe('McpToolsRun')
            expect(toPascalCase('SubAgent')).toBe('SubAgent')
            expect(toPascalCase('')).toBe('')
        })
    })
})
