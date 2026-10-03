import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { describe, expect, it } from 'bun:test'

import { LspClient } from '../../src/lsp-client'

describe('LspClient (Unit)', () => {
    it('initializes with default options and workspaceRoot', () => {
        const client = new LspClient({ workspaceRoot: '/test/workspace' })
        expect(client.workspaceRoot).toBe(path.resolve('/test/workspace'))
    })

    it('manages document symbol outline and maps symbols correctly', async () => {
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lsp-unit-test-'))
        try {
            fs.writeFileSync(
                path.join(tmpDir, 'tsconfig.json'),
                JSON.stringify({
                    compilerOptions: {
                        target: 'ES2022',
                        module: 'NodeNext',
                        moduleResolution: 'NodeNext',
                        strict: true,
                    },
                })
            )
            fs.writeFileSync(
                path.join(tmpDir, 'sample.ts'),
                'export interface Config {\n    port: number\n}\n\nexport function runServer(cfg: Config): void {\n    console.log(cfg.port)\n}\n'
            )

            const client = new LspClient({ workspaceRoot: tmpDir })
            await client.start()

            const outline = await client.getOutline('sample.ts')
            expect(outline.length).toBeGreaterThanOrEqual(2)

            const iface = outline.find((s) => s.name === 'Config')
            expect(iface).toBeDefined()
            expect(iface?.kind).toBe('interface')

            const fn = outline.find((s) => s.name === 'runServer')
            expect(fn).toBeDefined()
            expect(fn?.kind).toBe('function')

            await client.shutdown()
        } finally {
            fs.rmSync(tmpDir, { recursive: true, force: true })
        }
    })

    it('shuts down cleanly and rejects pending requests on early exit', async () => {
        const client = new LspClient({ workspaceRoot: '/non/existent/dir', requestTimeoutMs: 500 })
        await client.shutdown()

        await expect(client.sendRequest('any/method', {})).rejects.toThrow(
            'LSP client is not running'
        )
    })
})
