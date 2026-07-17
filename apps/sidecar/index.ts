import { Agent } from '@december/agent'
import { getProvider, registerProvider, OpenAIProvider } from '@december/providers'
import { BashTool } from '@december/tools'
import { WireAgentEvent, toWire } from '@december/shared'
import { PlatformAdapter } from '@december/agent/src/platform-adapter'
import { exec } from 'child_process'
import { promisify } from 'util'
import * as fs from 'fs/promises'
import * as fsSync from 'fs'
import path from 'path'

const execAsync = promisify(exec)

class LocalPlatformAdapter implements PlatformAdapter {
    constructor(private workspaceDir: string) {
        fsSync.mkdirSync(this.workspaceDir, { recursive: true })
    }

    bash = {
        exec: async (command: string, onData?: (chunk: string) => void) => {
            try {
                const child = exec(command, { cwd: this.workspaceDir })
                let output = ''
                if (child.stdout) {
                    child.stdout.on('data', (data) => {
                        output += data
                        if (onData) onData(data.toString())
                    })
                }
                if (child.stderr) {
                    child.stderr.on('data', (data) => {
                        output += data
                        if (onData) onData(data.toString())
                    })
                }
                const exitCode = await new Promise<number>((resolve) => {
                    child.on('close', resolve)
                })
                return { exitCode, output }
            } catch (e: any) {
                return { exitCode: 1, output: String(e) }
            }
        },
    }

    fs = {
        readFile: async (filepath: string) =>
            fs.readFile(path.resolve(this.workspaceDir, filepath), 'utf-8'),
        writeFile: async (filepath: string, content: string) =>
            fs.writeFile(path.resolve(this.workspaceDir, filepath), content),
        readdir: async (dirPath: string) => {
            const files = await fs.readdir(path.resolve(this.workspaceDir, dirPath), {
                withFileTypes: true,
            })
            return files.map((f) => `[${f.isDirectory() ? 'DIR ' : 'FILE'}] ${f.name}`)
        },
        mkdir: async (dirPath: string, options?: { recursive?: boolean }) => {
            await fs.mkdir(path.resolve(this.workspaceDir, dirPath), options)
        },
        exists: async (filepath: string) => {
            try {
                await fs.access(path.resolve(this.workspaceDir, filepath))
                return true
            } catch {
                return false
            }
        },
    }

    search = {
        find: async (dirPath: string, query: string) => {
            const { output } = await this.bash.exec(`find "${dirPath}" -name "${query}"`)
            return output
        },
        grep: async (dirPath: string, query: string) => {
            const { output } = await this.bash.exec(`grep -rnI "${query}" "${dirPath}"`)
            return output
        },
    }

    env = {
        cwd: () => this.workspaceDir,
        get: (key: string) => process.env[key],
    }
}

async function main() {
    // Read config frame #0 from stdin (4 byte length, then JSON payload)
    const stdin = Bun.file('/dev/stdin')
    const stream = stdin.stream()
    const reader = stream.getReader()

    // Simplistic frame reader for stdin
    const firstChunk = await reader.read()
    if (!firstChunk.value) {
        process.exit(1)
    }

    const buf = firstChunk.value
    if (buf.length < 4) process.exit(1)

    const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
    const len = view.getUint32(0, false) // big endian

    const configStr = new TextDecoder().decode(buf.slice(4, 4 + len))
    const config = JSON.parse(configStr)

    // configure LLM providers
    registerProvider(new OpenAIProvider())
    const llm = getProvider(config.provider_settings?.id || 'openai')

    // stdout frame writer
    const writeEvent = (event: WireAgentEvent) => {
        const payload = new TextEncoder().encode(JSON.stringify(event))
        const lenBuf = new ArrayBuffer(4)
        new DataView(lenBuf).setUint32(0, payload.length, false)
        process.stdout.write(new Uint8Array(lenBuf))
        process.stdout.write(payload)
    }

    // run the agent loop
    const agent = new Agent({
        llm,
        operations: new LocalPlatformAdapter(config.workspace_directory),
        systemPrompt: config.prompts?.system,
        tools: [BashTool],
    })

    for await (const event of agent.run()) {
        writeEvent(toWire(event))
    }
}

main().catch(console.error)
