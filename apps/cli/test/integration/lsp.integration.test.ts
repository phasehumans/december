import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { CodeIntelligenceTool } from '@december/tools'
import { describe, expect, it, afterAll, beforeAll } from 'bun:test'

import { localOperations, setActiveScopeDir, isTypeScriptProject } from '../../src/local-operations'

describe('LSP & Code Intelligence Integration', () => {
    let tmpDir: string

    beforeAll(async () => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lsp-integration-test-'))

        fs.writeFileSync(
            path.join(tmpDir, 'tsconfig.json'),
            JSON.stringify(
                {
                    compilerOptions: {
                        target: 'ES2022',
                        module: 'NodeNext',
                        moduleResolution: 'NodeNext',
                        strict: true,
                    },
                },
                null,
                2
            )
        )

        fs.writeFileSync(
            path.join(tmpDir, 'service.ts'),
            'export interface UserConfig {\n    id: string\n    name: string\n}\n\nexport function createUser(config: UserConfig): string {\n    return `${config.id}:${config.name}`\n}\n'
        )

        fs.writeFileSync(
            path.join(tmpDir, 'consumer.ts'),
            "import { createUser, UserConfig } from './service'\n\nconst cfg: UserConfig = { id: 'u1', name: 'Alice' }\nconst userId = createUser(cfg)\nconsole.log(userId)\n"
        )

        setActiveScopeDir(tmpDir)

        // Warm up LSP client so TSServer indexes the test project
        await new Promise((r) => setTimeout(r, 600))
    })

    afterAll(async () => {
        if (localOperations.lsp?.shutdown) {
            await localOperations.lsp.shutdown()
        }
        setActiveScopeDir(undefined)
        fs.rmSync(tmpDir, { recursive: true, force: true })
    })

    it('detects typescript project in workspace', () => {
        expect(isTypeScriptProject(tmpDir)).toBe(true)
    })

    it('resolves symbol definition across files in a typescript project', async () => {
        const context = {
            operations: localOperations as any,
            env: new Map<string, string>(),
            onStream: () => {},
        }

        const consumerPath = path.join(tmpDir, 'consumer.ts')
        const servicePath = path.join(tmpDir, 'service.ts')

        // Resolve function definition across files
        const defResult = await CodeIntelligenceTool.execute(
            {
                action: 'definition',
                path: consumerPath,
                symbol: 'createUser',
            },
            context
        )

        expect(defResult).toContain('Definition found at')
        expect(defResult).toContain(servicePath)
        expect(defResult).toContain(':6:') // line 6 of service.ts

        // Resolve interface definition across files
        const ifaceResult = await CodeIntelligenceTool.execute(
            {
                action: 'definition',
                path: consumerPath,
                symbol: 'UserConfig',
            },
            context
        )

        expect(ifaceResult).toContain('Definition found at')
        expect(ifaceResult).toContain(servicePath)
        expect(ifaceResult).toContain(':1:') // line 1 of service.ts
    })

    it('returns all call sites and import references of a symbol across files', async () => {
        const context = {
            operations: localOperations as any,
            env: new Map<string, string>(),
            onStream: () => {},
        }

        const servicePath = path.join(tmpDir, 'service.ts')
        const consumerPath = path.join(tmpDir, 'consumer.ts')

        const refResult = await CodeIntelligenceTool.execute(
            {
                action: 'references',
                path: servicePath,
                symbol: 'createUser',
            },
            context
        )

        expect(refResult).toContain('Found')
        expect(refResult).toContain('reference(s)')
        expect(refResult).toContain(servicePath)
        expect(refResult).toContain(consumerPath)
    })

    it('returns document symbols outline for a typescript file', async () => {
        const context = {
            operations: localOperations as any,
            env: new Map<string, string>(),
            onStream: () => {},
        }

        const servicePath = path.join(tmpDir, 'service.ts')

        const outlineResult = await CodeIntelligenceTool.execute(
            {
                action: 'outline',
                path: servicePath,
            },
            context
        )

        expect(outlineResult).toContain('Document outline for')
        expect(outlineResult).toContain('UserConfig')
        expect(outlineResult).toContain('createUser')
    })
})
