import { describe, expect, mock, test } from 'bun:test'

import { PROJECT_RULE_MAX_CHARS, projectRules } from '../../src/project-rules'

const { loadSandboxProjectRules } = projectRules

/** a sandbox file system with these files; any other path fails like `cat` does */
const sandboxFs = (files: Record<string, string>) => {
    const readFile = mock(async (path: string) => {
        if (path in files) return files[path]!
        throw new Error(`Failed to read file ${path}: No such file or directory`)
    })
    return { readFile }
}

describe('cloud runs read the repository rule file from the sandbox', () => {
    test('AGENTS.md at the repository root', async () => {
        const fs = sandboxFs({ '/workspace/AGENTS.md': '  # Repo rules\nuse bun\n' })
        expect(await loadSandboxProjectRules({ fs, workspaceDir: '/workspace' })).toEqual([
            { path: '/workspace/AGENTS.md', content: '# Repo rules\nuse bun' },
        ])
    })

    test('CLAUDE.md when the repository has no AGENTS.md', async () => {
        const fs = sandboxFs({ '/workspace/CLAUDE.md': '# Claude rules' })
        expect(await loadSandboxProjectRules({ fs, workspaceDir: '/workspace' })).toEqual([
            { path: '/workspace/CLAUDE.md', content: '# Claude rules' },
        ])
        expect(fs.readFile.mock.calls.map((c) => c[0])).toEqual([
            '/workspace/AGENTS.md',
            '/workspace/CLAUDE.md',
        ])
    })

    test('AGENTS.md wins over CLAUDE.md, and CLAUDE.md is then not read', async () => {
        const fs = sandboxFs({
            '/workspace/AGENTS.md': '# Agents',
            '/workspace/CLAUDE.md': '# Claude',
        })
        const rules = await loadSandboxProjectRules({ fs, workspaceDir: '/workspace' })
        expect(rules.map((r) => r.content)).toEqual(['# Agents'])
        expect(fs.readFile).toHaveBeenCalledTimes(1)
    })

    test('an empty AGENTS.md falls through to CLAUDE.md', async () => {
        const fs = sandboxFs({
            '/workspace/AGENTS.md': '   \n',
            '/workspace/CLAUDE.md': '# Claude',
        })
        const rules = await loadSandboxProjectRules({ fs, workspaceDir: '/workspace' })
        expect(rules.map((r) => r.path)).toEqual(['/workspace/CLAUDE.md'])
    })

    test('no rule file gives no rules and no error', async () => {
        const fs = sandboxFs({})
        expect(await loadSandboxProjectRules({ fs, workspaceDir: '/workspace' })).toEqual([])
    })

    test('a trailing slash on the folder does not double the slash', async () => {
        const fs = sandboxFs({ '/workspace/AGENTS.md': '# Agents' })
        const rules = await loadSandboxProjectRules({ fs, workspaceDir: '/workspace/' })
        expect(rules[0]?.path).toBe('/workspace/AGENTS.md')
    })

    test('a very long file is cut and says so', async () => {
        const long = 'x'.repeat(PROJECT_RULE_MAX_CHARS + 500)
        const fs = sandboxFs({ '/workspace/AGENTS.md': long })
        const [rule] = await loadSandboxProjectRules({ fs, workspaceDir: '/workspace' })
        expect(rule!.content.startsWith('x'.repeat(PROJECT_RULE_MAX_CHARS))).toBe(true)
        expect(rule!.content).not.toContain('x'.repeat(PROJECT_RULE_MAX_CHARS + 1))
        expect(rule!.content).toContain('the rest is left out')
    })
})
