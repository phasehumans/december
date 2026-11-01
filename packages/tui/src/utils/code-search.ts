import { exec } from 'node:child_process'
import path from 'node:path'
import { promisify } from 'node:util'

import type { CodeSearchResultItem } from '../types'
export type { CodeSearchResultItem } from '../types'

const execAsync = promisify(exec)

export function parseGrepOutput(output: string, workspaceDir: string): CodeSearchResultItem[] {
    const lines = output.split(/\r?\n/).filter((l) => Boolean(l.trim()))
    const items: CodeSearchResultItem[] = []

    for (const line of lines) {
        const firstColon = line.indexOf(':')
        if (firstColon === -1) continue
        const secondColon = line.indexOf(':', firstColon + 1)
        if (secondColon === -1) continue

        const rawFile = line.slice(0, firstColon)
        const lineNumStr = line.slice(firstColon + 1, secondColon)
        const lineNum = parseInt(lineNumStr, 10)
        if (isNaN(lineNum)) continue

        const content = line.slice(secondColon + 1).trim()
        const file = path.isAbsolute(rawFile)
            ? path.relative(workspaceDir, rawFile)
            : rawFile.replace(/^\.\//, '')

        items.push({
            file,
            line: lineNum,
            content,
        })

        if (items.length >= 100) break
    }

    return items
}

export async function searchWorkspaceCode(
    query: string,
    workspaceDir: string = process.cwd()
): Promise<CodeSearchResultItem[]> {
    const cleanQuery = query.trim()
    if (!cleanQuery) return []

    const escapedQuery = cleanQuery.replace(/"/g, '\\"')

    try {
        // Fast git grep across tracked and untracked workspace files
        const { stdout } = await execAsync(`git grep -n -I --untracked "${escapedQuery}"`, {
            cwd: workspaceDir,
            timeout: 5000,
            maxBuffer: 2 * 1024 * 1024,
        })
        return parseGrepOutput(stdout, workspaceDir)
    } catch {
        // Fallback to standard recursive grep excluding common build directories
        try {
            const { stdout } = await execAsync(
                `grep -rnI --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist "${escapedQuery}" .`,
                {
                    cwd: workspaceDir,
                    timeout: 5000,
                    maxBuffer: 2 * 1024 * 1024,
                }
            )
            return parseGrepOutput(stdout, workspaceDir)
        } catch {
            // Intentionally swallowed: return empty array when no matches found or command failed
            return []
        }
    }
}
