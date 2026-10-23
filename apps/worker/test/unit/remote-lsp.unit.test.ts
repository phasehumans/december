import { CodeIntelligenceTool } from '@december/tools'
import { describe, expect, it, mock } from 'bun:test'

import { RemotePlatformAdapter } from '../../src/remote-operations'

describe('RemotePlatformAdapter LSP & Code Intelligence (Ticket #592 - Seam 1)', () => {
    it('should find symbol definition via grep search in the sandbox', async () => {
        const adapter = new RemotePlatformAdapter('mock-vm-lsp-1')

        adapter.fs.readFile = mock(async () => 'export const authService = new AuthService()')
        adapter.bash.exec = mock(async (cmd: string) => {
            if (cmd.includes('export') && cmd.includes('authService')) {
                return {
                    exitCode: 0,
                    output: '/workspace/src/auth.service.ts:15:export const authService = new AuthService()',
                }
            }
            return { exitCode: 0, output: '' }
        }) as any

        const defs = await adapter.lsp.getDefinition!('src/index.ts', 1, 14)
        expect(Array.isArray(defs)).toBe(true)
        const defArray = defs as any[]
        expect(defArray.length).toBe(1)
        expect(defArray[0].filePath).toBe('src/auth.service.ts')
        expect(defArray[0].line).toBe(15)
        expect(defArray[0].preview).toContain('export const authService')
    })

    it('should find symbol references across files in the sandbox', async () => {
        const adapter = new RemotePlatformAdapter('mock-vm-lsp-2')

        adapter.fs.readFile = mock(async () => 'export function calculateTotal() {}')
        adapter.bash.exec = mock(async () => ({
            exitCode: 0,
            output: [
                '/workspace/src/cart.ts:10:const total = calculateTotal()',
                '/workspace/src/checkout.ts:25:const finalAmount = calculateTotal() + tax',
            ].join('\n'),
        })) as any

        const refs = await adapter.lsp.getReferences!('src/cart.ts', 1, 18)
        expect(refs.length).toBe(2)
        expect(refs[0].filePath).toBe('src/cart.ts')
        expect(refs[0].line).toBe(10)
        expect(refs[1].filePath).toBe('src/checkout.ts')
        expect(refs[1].line).toBe(25)
    })

    it('should extract document outline of symbols with kinds and line numbers', async () => {
        const adapter = new RemotePlatformAdapter('mock-vm-lsp-3')

        const sampleCode = `
export interface UserPayload {
    id: string
}

export type AuthToken = string

export class AuthService {
    login() {}
}

export async function hashPassword(pw: string) {
    return pw
}

export const defaultTimeout = 5000
`
        adapter.fs.readFile = mock(async () => sampleCode)

        const outline = await adapter.lsp.getOutline!('src/auth.ts')
        expect(outline.length).toBe(5)

        const names = outline.map((s) => s.name)
        expect(names).toContain('UserPayload')
        expect(names).toContain('AuthToken')
        expect(names).toContain('AuthService')
        expect(names).toContain('hashPassword')
        expect(names).toContain('defaultTimeout')

        const iface = outline.find((s) => s.name === 'UserPayload')
        expect(iface?.kind).toBe('interface')

        const cls = outline.find((s) => s.name === 'AuthService')
        expect(cls?.kind).toBe('class')
    })

    it('should parse tsc compiler diagnostics into structured DiagnosticItem format', async () => {
        const adapter = new RemotePlatformAdapter('mock-vm-lsp-4')

        adapter.fs.exists = mock(async () => true)
        adapter.bash.exec = mock(async (cmd: string) => {
            if (cmd.includes('tsc')) {
                return {
                    exitCode: 1,
                    output: '/workspace/src/server.ts(42,10): error TS2304: Cannot find name "missingVar".\n',
                }
            }
            return { exitCode: 0, output: '' }
        }) as any

        const diags = await adapter.diagnostics.getDiagnostics('src/server.ts')
        expect(Array.isArray(diags)).toBe(true)
        const items = diags as any[]
        expect(items.length).toBe(1)
        expect(items[0].filePath).toBe('src/server.ts')
        expect(items[0].line).toBe(42)
        expect(items[0].column).toBe(10)
        expect(items[0].severity).toBe('error')
        expect(items[0].source).toBe('TS2304')
        expect(items[0].message).toContain('Cannot find name "missingVar"')
    })

    it('should execute CodeIntelligenceTool without runtime exceptions against RemotePlatformAdapter', async () => {
        const adapter = new RemotePlatformAdapter('mock-vm-lsp-5')

        adapter.fs.readFile = mock(async () => 'export const apiKey = "secret"')
        adapter.bash.exec = mock(async () => ({
            exitCode: 0,
            output: '/workspace/src/keys.ts:1:export const apiKey = "secret"',
        })) as any

        const context: any = {
            operations: adapter,
        }

        const outlineRes = await CodeIntelligenceTool.execute(
            { action: 'outline', path: 'src/keys.ts' },
            context
        )
        expect(outlineRes).toContain('Document outline for src/keys.ts')
        expect(outlineRes).toContain('apiKey')

        const defRes = await CodeIntelligenceTool.execute(
            { action: 'definition', path: 'src/keys.ts', symbol: 'apiKey' },
            context
        )
        expect(defRes).toContain('Definition')

        const diagRes = await CodeIntelligenceTool.execute(
            { action: 'diagnostics', path: 'src/keys.ts' },
            context
        )
        expect(diagRes).toContain('No diagnostic errors found')
    })
})
