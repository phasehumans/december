import { exec } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

import type { PlatformAdapter } from '@december/agent'

const MAX_OUTPUT_BUFFER = 10 * 1024 * 1024
const DEFAULT_COMMAND_TIMEOUT_MS = 10 * 60 * 1000

const quote = (value: string) => `'${value.replace(/'/g, `'\\''`)}'`

/**
 * Local file system and shell access for the agent on a GitHub Actions runner.
 * Implements the same PlatformAdapter interface the tools use in the CLI.
 */
export function createActionOperations(workspaceDir: string): PlatformAdapter {
    let currentDir = workspaceDir
    const resolve = (target: string) => path.resolve(currentDir, target)

    const run = (
        command: string,
        cwd: string,
        timeout = DEFAULT_COMMAND_TIMEOUT_MS
    ): Promise<{ exitCode: number | null; output: string }> =>
        new Promise((done) => {
            exec(command, { cwd, maxBuffer: MAX_OUTPUT_BUFFER, timeout }, (err, stdout, stderr) => {
                const output = [stdout, stderr].filter(Boolean).join('\n')
                if (!err) {
                    done({ exitCode: 0, output })
                    return
                }
                const code = typeof (err as any).code === 'number' ? (err as any).code : 1
                done({ exitCode: code, output: output || err.message })
            })
        })

    return {
        fs: {
            readFile: (target) => fs.promises.readFile(resolve(target), 'utf8'),
            writeFile: async (target, content) => {
                const fullPath = resolve(target)
                await fs.promises.mkdir(path.dirname(fullPath), { recursive: true })
                await fs.promises.writeFile(fullPath, content, 'utf8')
            },
            readdir: (target) => fs.promises.readdir(resolve(target)),
            mkdir: async (target, options) => {
                await fs.promises.mkdir(resolve(target), options)
            },
            exists: async (target) => fs.existsSync(resolve(target)),
        },
        bash: {
            exec: (command, cwdOrOnData, options) => {
                const cwd = typeof cwdOrOnData === 'string' ? resolve(cwdOrOnData) : currentDir
                return run(command, cwd, options?.timeout)
            },
        },
        search: {
            find: async (target, query) =>
                (
                    await run(
                        `find ${quote(resolve(target))} -name ${quote(`*${query}*`)} -not -path '*/node_modules/*' -not -path '*/.git/*'`,
                        currentDir
                    )
                ).output,
            grep: async (target, query) =>
                (
                    await run(
                        `grep -rn --exclude-dir=node_modules --exclude-dir=.git -- ${quote(query)} ${quote(resolve(target))}`,
                        currentDir
                    )
                ).output,
        },
        env: {
            cwd: () => currentDir,
            get: (key) => process.env[key],
            setCwd: (dir) => {
                currentDir = resolve(dir)
            },
        },
    }
}
