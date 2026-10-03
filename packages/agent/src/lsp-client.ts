import { spawn, type ChildProcess } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import type { DiagnosticItem, LocationItem, OutlineItem } from '@december/shared'

const SYMBOL_KINDS: Record<number, string> = {
    1: 'file',
    2: 'module',
    3: 'namespace',
    4: 'package',
    5: 'class',
    6: 'method',
    7: 'property',
    8: 'field',
    9: 'constructor',
    10: 'enum',
    11: 'interface',
    12: 'function',
    13: 'variable',
    14: 'constant',
    15: 'string',
    16: 'number',
    17: 'boolean',
    18: 'array',
    19: 'object',
    20: 'key',
    21: 'null',
    22: 'enumMember',
    23: 'struct',
    24: 'event',
    25: 'operator',
    26: 'typeParameter',
}

export interface LspClientOptions {
    workspaceRoot: string
    binaryPath?: string
    requestTimeoutMs?: number
}

export class LspClient {
    public readonly workspaceRoot: string
    private binaryPath?: string
    private requestTimeoutMs: number
    private child: ChildProcess | null = null
    private nextId = 1
    private pendingRequests = new Map<
        number,
        {
            resolve: (val: any) => void
            reject: (err: any) => void
            timeout: NodeJS.Timeout
        }
    >()
    private buffer = Buffer.alloc(0)
    private diagnosticsByUri = new Map<string, DiagnosticItem[]>()
    private openedDocuments = new Set<string>()
    private initPromise: Promise<void> | null = null
    private isShutdown = false

    constructor(options: LspClientOptions) {
        this.workspaceRoot = path.resolve(options.workspaceRoot)
        this.binaryPath = options.binaryPath
        this.requestTimeoutMs = options.requestTimeoutMs ?? 15_000
    }

    public async start(): Promise<void> {
        if (this.initPromise) {
            return this.initPromise
        }

        this.initPromise = this.initInternal()
        return this.initPromise
    }

    private findBinary(): string {
        if (this.binaryPath && fs.existsSync(this.binaryPath)) {
            return this.binaryPath
        }

        const candidatePaths = [
            path.resolve(this.workspaceRoot, 'node_modules/.bin/typescript-language-server'),
            path.resolve(process.cwd(), 'node_modules/.bin/typescript-language-server'),
            path.resolve(process.cwd(), 'node_modules/typescript-language-server/lib/cli.mjs'),
        ]

        for (const candidate of candidatePaths) {
            if (fs.existsSync(candidate)) {
                return candidate
            }
        }

        return 'typescript-language-server'
    }

    private async initInternal(): Promise<void> {
        const bin = this.findBinary()

        this.child = spawn(bin, ['--stdio'], {
            cwd: this.workspaceRoot,
            env: { ...process.env },
            stdio: ['pipe', 'pipe', 'pipe'],
        })

        this.child.stdout?.on('data', (chunk: Buffer) => {
            this.handleStdout(chunk)
        })

        this.child.stderr?.on('data', (_chunk: Buffer) => {
            // Intentionally ignored: LSP server diagnostics and debug output on stderr
        })
        ;(this.child as any).on('error', (err: any) => {
            this.rejectAllPending(new Error(`LSP process error: ${err.message}`))
        })
        ;(this.child as any).on('exit', (code: any) => {
            this.rejectAllPending(new Error(`LSP process exited with code ${code}`))
            this.child = null
            this.initPromise = null
        })

        const rootUri = pathToFileURL(this.workspaceRoot).toString()

        await this.sendRequest('initialize', {
            processId: process.pid,
            rootUri,
            rootPath: this.workspaceRoot,
            capabilities: {
                textDocument: {
                    definition: { dynamicRegistration: false, linkSupport: true },
                    references: { dynamicRegistration: false },
                    documentSymbol: {
                        dynamicRegistration: false,
                        hierarchicalDocumentSymbolSupport: true,
                    },
                    synchronization: {
                        dynamicRegistration: false,
                        willSave: false,
                        didSave: true,
                    },
                },
            },
        })

        this.sendNotification('initialized', {})
    }

    private handleStdout(chunk: Buffer): void {
        this.buffer = Buffer.concat([this.buffer, chunk])

        while (true) {
            const headerEnd = this.buffer.indexOf('\r\n\r\n')
            if (headerEnd === -1) break

            const headerStr = this.buffer.subarray(0, headerEnd).toString('utf8')
            const match = headerStr.match(/Content-Length:\s*(\d+)/i)
            if (!match) {
                // Skip malformed header prefix
                this.buffer = this.buffer.subarray(headerEnd + 4)
                continue
            }

            const contentLength = parseInt(match[1]!, 10)
            const totalMsgLength = headerEnd + 4 + contentLength
            if (this.buffer.length < totalMsgLength) break

            const body = this.buffer.subarray(headerEnd + 4, totalMsgLength).toString('utf8')
            this.buffer = this.buffer.subarray(totalMsgLength)

            try {
                const msg = JSON.parse(body)
                if (msg.id !== undefined && this.pendingRequests.has(msg.id)) {
                    const pending = this.pendingRequests.get(msg.id)!
                    clearTimeout(pending.timeout)
                    this.pendingRequests.delete(msg.id)

                    if (msg.error) {
                        pending.reject(new Error(msg.error.message || 'LSP error'))
                    } else {
                        pending.resolve(msg.result)
                    }
                } else if (msg.method === 'textDocument/publishDiagnostics') {
                    this.handlePublishDiagnostics(msg.params)
                }
            } catch {
                // Intentionally swallowed: invalid JSON payload from stream
            }
        }
    }

    private handlePublishDiagnostics(params: any): void {
        if (!params || !params.uri || !Array.isArray(params.diagnostics)) return

        const uri = params.uri as string
        const filePath = fileURLToPath(uri)
        const items: DiagnosticItem[] = params.diagnostics.map((d: any) => {
            const sevNum = d.severity ?? 1
            const severity: 'error' | 'warning' | 'info' =
                sevNum === 1 ? 'error' : sevNum === 2 ? 'warning' : 'info'

            return {
                filePath,
                line: (d.range?.start?.line ?? 0) + 1,
                column: (d.range?.start?.character ?? 0) + 1,
                message: d.message || '',
                severity,
                source: d.source || 'typescript',
            }
        })

        this.diagnosticsByUri.set(uri, items)
    }

    public sendRequest<T = any>(method: string, params: any): Promise<T> {
        if (!this.child || !this.child.stdin || this.isShutdown) {
            return Promise.reject(new Error('LSP client is not running'))
        }

        const id = this.nextId++
        return new Promise<T>((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.pendingRequests.delete(id)
                reject(
                    new Error(`LSP request "${method}" timed out after ${this.requestTimeoutMs}ms`)
                )
            }, this.requestTimeoutMs)

            this.pendingRequests.set(id, { resolve, reject, timeout })

            const payload = JSON.stringify({ jsonrpc: '2.0', id, method, params })
            const header = `Content-Length: ${Buffer.byteLength(payload, 'utf8')}\r\n\r\n`
            this.child?.stdin?.write(header + payload)
        })
    }

    public sendNotification(method: string, params: any): void {
        if (!this.child || !this.child.stdin || this.isShutdown) return

        const payload = JSON.stringify({ jsonrpc: '2.0', method, params })
        const header = `Content-Length: ${Buffer.byteLength(payload, 'utf8')}\r\n\r\n`
        this.child.stdin.write(header + payload)
    }

    public async openDocument(filePath: string, content?: string): Promise<string> {
        const absPath = path.isAbsolute(filePath)
            ? filePath
            : path.resolve(this.workspaceRoot, filePath)
        const uri = pathToFileURL(absPath).toString()

        if (this.openedDocuments.has(uri)) {
            return uri
        }

        let fileContent = content
        if (fileContent === undefined) {
            try {
                fileContent = fs.readFileSync(absPath, 'utf8')
            } catch {
                fileContent = ''
            }
        }

        this.sendNotification('textDocument/didOpen', {
            textDocument: {
                uri,
                languageId: 'typescript',
                version: 1,
                text: fileContent,
            },
        })

        this.openedDocuments.add(uri)
        return uri
    }

    public async getDefinition(
        filePath: string,
        line: number,
        column: number
    ): Promise<LocationItem[]> {
        await this.start()
        const uri = await this.openDocument(filePath)

        const raw = await this.sendRequest('textDocument/definition', {
            textDocument: { uri },
            position: {
                line: Math.max(0, line - 1),
                character: Math.max(0, column - 1),
            },
        })

        if (!raw) return []

        const array = Array.isArray(raw) ? raw : [raw]
        const locations: LocationItem[] = []

        for (const loc of array) {
            const targetUri = loc.targetUri || loc.uri
            if (!targetUri) continue

            const targetRange = loc.targetSelectionRange || loc.targetRange || loc.range
            const targetFilePath = fileURLToPath(targetUri)

            locations.push({
                filePath: targetFilePath,
                line: (targetRange?.start?.line ?? 0) + 1,
                column: (targetRange?.start?.character ?? 0) + 1,
            })
        }

        return locations
    }

    public async getReferences(
        filePath: string,
        line: number,
        column: number
    ): Promise<LocationItem[]> {
        await this.start()
        const uri = await this.openDocument(filePath)

        const raw = await this.sendRequest('textDocument/references', {
            textDocument: { uri },
            position: {
                line: Math.max(0, line - 1),
                character: Math.max(0, column - 1),
            },
            context: { includeDeclaration: true },
        })

        if (!raw || !Array.isArray(raw)) return []

        const locations: LocationItem[] = []

        for (const loc of raw) {
            if (!loc.uri) continue
            const targetFilePath = fileURLToPath(loc.uri)

            locations.push({
                filePath: targetFilePath,
                line: (loc.range?.start?.line ?? 0) + 1,
                column: (loc.range?.start?.character ?? 0) + 1,
            })
        }

        return locations
    }

    public async getOutline(filePath: string): Promise<OutlineItem[]> {
        await this.start()
        const uri = await this.openDocument(filePath)

        const raw = await this.sendRequest('textDocument/documentSymbol', {
            textDocument: { uri },
        })

        if (!raw || !Array.isArray(raw)) return []

        const items: OutlineItem[] = []

        const extractSymbols = (symbols: any[], containerName?: string) => {
            for (const sym of symbols) {
                const kindStr = SYMBOL_KINDS[sym.kind] || 'symbol'
                const range = sym.range || sym.location?.range
                const line = (range?.start?.line ?? 0) + 1
                const column = (range?.start?.character ?? 0) + 1

                items.push({
                    name: sym.name || 'anonymous',
                    kind: kindStr,
                    line,
                    column,
                    containerName: sym.containerName || containerName,
                })

                if (Array.isArray(sym.children) && sym.children.length > 0) {
                    extractSymbols(sym.children, sym.name)
                }
            }
        }

        extractSymbols(raw)
        return items
    }

    public getDiagnostics(filePath?: string): DiagnosticItem[] {
        if (filePath) {
            const absPath = path.isAbsolute(filePath)
                ? filePath
                : path.resolve(this.workspaceRoot, filePath)
            const uri = pathToFileURL(absPath).toString()
            return this.diagnosticsByUri.get(uri) || []
        }

        const all: DiagnosticItem[] = []
        for (const items of this.diagnosticsByUri.values()) {
            all.push(...items)
        }
        return all
    }

    public async shutdown(): Promise<void> {
        if (this.isShutdown) return
        this.isShutdown = true

        if (this.child) {
            try {
                // Attempt clean LSP shutdown handshake with 500ms timeout
                await Promise.race([
                    this.sendRequest('shutdown', {}),
                    new Promise((r) => setTimeout(r, 500)),
                ])
                this.sendNotification('exit', {})
            } catch {
                // Intentionally swallowed: shutdown handshake timeout or process already closed
            }

            try {
                this.child.kill('SIGTERM')
            } catch {
                // Intentionally swallowed: child process kill fallback
            }

            this.child = null
        }

        this.rejectAllPending(new Error('LSP client shutdown'))
    }

    private rejectAllPending(err: Error): void {
        for (const [id, pending] of this.pendingRequests.entries()) {
            clearTimeout(pending.timeout)
            pending.reject(err)
            this.pendingRequests.delete(id)
        }
    }
}
