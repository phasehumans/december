import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { describe, it, expect } from 'bun:test'

import { getProjectContext } from '../../src/utils/project-context'

describe('getProjectContext (Unit)', () => {
    it('extracts package.json dependencies and layout when present', () => {
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'context-test-'))
        try {
            fs.writeFileSync(
                path.join(tmpDir, 'package.json'),
                JSON.stringify({
                    name: 'test-app',
                    dependencies: { react: '^18.0.0', express: '^4.0.0' },
                })
            )
            fs.mkdirSync(path.join(tmpDir, 'src'))

            const context = getProjectContext(tmpDir)
            expect(context).toContain('Project: test-app')
            expect(context).toContain('Dependencies: react, express')
            expect(context).toContain('Workspace layout:')
            expect(context).toContain('src/')
        } finally {
            fs.rmSync(tmpDir, { recursive: true, force: true })
        }
    })

    it('returns empty string if directory is empty and no errors thrown', () => {
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'context-empty-'))
        try {
            const context = getProjectContext(tmpDir)
            expect(typeof context).toBe('string')
        } finally {
            fs.rmSync(tmpDir, { recursive: true, force: true })
        }
    })
})
