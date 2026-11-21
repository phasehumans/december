import { execFile } from 'child_process'
import fsSync from 'fs'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'

import type { MarketplacePluginSource } from './types'

export type ResolvedSource =
    | { kind: 'local'; path: string; label: string }
    | { kind: 'git'; url: string; ref?: string; label: string }

const GITHUB_SHORTHAND = /^(?:github:)?([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:#([\w./-]+))?$/

function expandHome(p: string): string {
    if (p === '~') return os.homedir()
    if (p.startsWith('~/')) return path.join(os.homedir(), p.slice(2))
    return p
}

function isGitUrl(value: string): boolean {
    return (
        /^(https?|ssh|git|file):\/\//.test(value) ||
        /^[\w.-]+@[\w.-]+:/.test(value) ||
        value.endsWith('.git')
    )
}

/**
 * Turns what a person typed (or a marketplace entry's source) into a local path
 * or a git url. Relative paths resolve against baseDir. An existing local path
 * always wins over the owner/repo shorthand.
 */
export function resolveSource(
    source: MarketplacePluginSource,
    baseDir: string = process.cwd()
): ResolvedSource {
    if (typeof source !== 'string') {
        if (source.source === 'github') {
            return {
                kind: 'git',
                url: `https://github.com/${source.repo}.git`,
                ref: source.ref,
                label: source.repo,
            }
        }
        return { kind: 'git', url: source.url, ref: source.ref, label: source.url }
    }

    const value = source.trim()
    if (!value) throw new Error('Enter a folder path, git url, or owner/repo.')

    if (isGitUrl(value)) {
        const [url, ref] = value.split('#')
        return { kind: 'git', url: url!, ref, label: value }
    }

    const localPath = path.resolve(baseDir, expandHome(value))
    if (fsSync.existsSync(localPath)) {
        return { kind: 'local', path: localPath, label: value }
    }

    const shorthand = value.match(GITHUB_SHORTHAND)
    if (shorthand && !value.startsWith('.') && !value.startsWith('/')) {
        const repo = `${shorthand[1]}/${shorthand[2]}`
        return {
            kind: 'git',
            url: `https://github.com/${repo}.git`,
            ref: shorthand[3],
            label: repo,
        }
    }

    throw new Error(`Cannot find "${value}". Enter a folder path, git url, or owner/repo.`)
}

export function runGit(args: string[], cwd?: string): Promise<string> {
    return new Promise((resolve, reject) => {
        execFile(
            'git',
            args,
            {
                cwd,
                timeout: 120_000,
                maxBuffer: 10 * 1024 * 1024,
                // Never wait on a credential prompt: the TUI owns the terminal
                env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
            },
            (error, stdout, stderr) => {
                if (error) {
                    const detail = String(stderr || error.message)
                        .trim()
                        .split('\n')
                        .pop()
                    reject(new Error(detail || 'git failed'))
                    return
                }
                resolve(String(stdout))
            }
        )
    })
}

export async function cloneRepo(data: { url: string; ref?: string; dest: string }): Promise<void> {
    const { url, ref, dest } = data
    const args = ['clone', '--depth', '1']
    if (ref) args.push('--branch', ref)
    args.push(url, dest)
    await runGit(args)
}

/** Clones into a fresh temp folder. The caller removes it when done. */
export async function cloneToTemp(data: { url: string; ref?: string }): Promise<string> {
    const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'december-plugin-'))
    const dest = path.join(tmpRoot, 'repo')
    try {
        await cloneRepo({ ...data, dest })
    } catch (err) {
        await fs.rm(tmpRoot, { recursive: true, force: true })
        throw err
    }
    return dest
}

export async function removeTempClone(dir: string): Promise<void> {
    await fs.rm(path.dirname(dir), { recursive: true, force: true })
}

/** Copies a plugin folder, leaving out version-control data */
export async function copyPluginDir(src: string, dest: string): Promise<void> {
    await fs.rm(dest, { recursive: true, force: true })
    await fs.mkdir(path.dirname(dest), { recursive: true })
    await fs.cp(src, dest, {
        recursive: true,
        filter: (from) => path.basename(from) !== '.git',
    })
}
