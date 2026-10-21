import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

export interface OpPaths {
    pidFile: string
    logFile: string
    exitFile: string
    metaFile: string
}

export const DEFAULT_OPS_DIR = process.env.DECEMBER_OPS_DIR || '/tmp/december-ops'

export function getOpPaths(opId: string, baseDir = DEFAULT_OPS_DIR): OpPaths {
    if (!fs.existsSync(baseDir)) {
        fs.mkdirSync(baseDir, { recursive: true })
    }
    return {
        pidFile: path.join(baseDir, `${opId}.pid`),
        logFile: path.join(baseDir, `${opId}.log`),
        exitFile: path.join(baseDir, `${opId}.exit`),
        metaFile: path.join(baseDir, `${opId}.meta.json`),
    }
}

export function isPidAlive(pid: number): boolean {
    try {
        process.kill(pid, 0)
        return true
    } catch {
        // Intentionally swallowed: process not found or no permission
        return false
    }
}

export async function handleStart(
    opId: string,
    cwd: string,
    command: string,
    baseDir = DEFAULT_OPS_DIR
): Promise<{ status: string; opId: string; pid?: number; exitCode?: number }> {
    const paths = getOpPaths(opId, baseDir)

    // Check if op is already done
    if (fs.existsSync(paths.exitFile)) {
        try {
            const exitCode = parseInt(fs.readFileSync(paths.exitFile, 'utf8').trim(), 10)
            return { status: 'done', opId, exitCode }
        } catch {
            // Intentionally swallowed: fallback to re-running if exit file corrupted
        }
    }

    // Check if op is currently running
    if (fs.existsSync(paths.pidFile)) {
        try {
            const pid = parseInt(fs.readFileSync(paths.pidFile, 'utf8').trim(), 10)
            if (isPidAlive(pid)) {
                return { status: 'running', opId, pid }
            }
        } catch {
            // Intentionally swallowed: fallback to re-running if pid file corrupted
        }
    }

    // Open log file in append mode
    const logFd = fs.openSync(paths.logFile, 'a')

    const child = spawn(command, {
        cwd: cwd || '/workspace',
        shell: true,
        detached: true,
        stdio: ['ignore', logFd, logFd],
    })

    if (!child.pid) {
        fs.closeSync(logFd)
        throw new Error(`Failed to spawn process for opId '${opId}'`)
    }

    fs.writeFileSync(paths.pidFile, String(child.pid))
    fs.writeFileSync(
        paths.metaFile,
        JSON.stringify({ opId, command, cwd, pid: child.pid, startedAt: Date.now() })
    )
    ;(child as any).on('close', (code: number | null, signal: string | null) => {
        try {
            // Preserve exitFile if already written by terminate
            if (!fs.existsSync(paths.exitFile)) {
                const effectiveCode = code !== null ? code : signal === 'SIGKILL' ? 137 : 1
                fs.writeFileSync(paths.exitFile, String(effectiveCode))
            }
        } catch {
            // Intentionally swallowed: error writing exit code on shutdown
        }
    })

    child.unref()
    fs.closeSync(logFd)

    return { status: 'started', opId, pid: child.pid }
}

export function handleStatus(
    opId: string,
    baseDir = DEFAULT_OPS_DIR
): {
    status: 'done' | 'running' | 'terminated' | 'unknown'
    opId: string
    exitCode?: number
    pid?: number
    logBytes: number
} {
    const paths = getOpPaths(opId, baseDir)
    const logBytes = fs.existsSync(paths.logFile) ? fs.statSync(paths.logFile).size : 0

    if (fs.existsSync(paths.exitFile)) {
        const exitCode = parseInt(fs.readFileSync(paths.exitFile, 'utf8').trim(), 10)
        return { status: 'done', opId, exitCode, logBytes }
    }

    if (fs.existsSync(paths.pidFile)) {
        try {
            const pid = parseInt(fs.readFileSync(paths.pidFile, 'utf8').trim(), 10)
            if (isPidAlive(pid)) {
                return { status: 'running', opId, pid, logBytes }
            }
            return { status: 'terminated', opId, exitCode: 137, logBytes }
        } catch {
            // Intentionally swallowed: parse error on pid file
        }
    }

    return { status: 'unknown', opId, logBytes }
}

export function handleRead(
    opId: string,
    offset = 0,
    baseDir = DEFAULT_OPS_DIR
): { opId: string; offset: number; data: string; isDone: boolean; exitCode?: number } {
    const paths = getOpPaths(opId, baseDir)
    const status = handleStatus(opId, baseDir)

    if (!fs.existsSync(paths.logFile)) {
        return {
            opId,
            offset,
            data: '',
            isDone: status.status === 'done',
            exitCode: status.exitCode,
        }
    }

    const fileSize = fs.statSync(paths.logFile).size
    if (fileSize <= offset) {
        return {
            opId,
            offset,
            data: '',
            isDone: status.status === 'done',
            exitCode: status.exitCode,
        }
    }

    const fd = fs.openSync(paths.logFile, 'r')
    const buffer = Buffer.alloc(fileSize - offset)
    fs.readSync(fd, buffer, 0, buffer.length, offset)
    fs.closeSync(fd)

    return {
        opId,
        offset: fileSize,
        data: buffer.toString('utf8'),
        isDone: status.status === 'done',
        exitCode: status.exitCode,
    }
}

export function handleDetach(
    opId: string,
    baseDir = DEFAULT_OPS_DIR
): { status: 'detached'; opId: string; isAlive: boolean } {
    const paths = getOpPaths(opId, baseDir)
    let isAlive = false

    if (fs.existsSync(paths.pidFile)) {
        try {
            const pid = parseInt(fs.readFileSync(paths.pidFile, 'utf8').trim(), 10)
            isAlive = isPidAlive(pid)
        } catch {
            // Intentionally swallowed: pid read error
        }
    }

    return { status: 'detached', opId, isAlive }
}

export function handleTerminate(
    opId: string,
    baseDir = DEFAULT_OPS_DIR
): { status: 'terminated'; opId: string; exitCode: number } {
    const paths = getOpPaths(opId, baseDir)
    const exitCode = 137

    if (fs.existsSync(paths.pidFile)) {
        try {
            const pid = parseInt(fs.readFileSync(paths.pidFile, 'utf8').trim(), 10)
            if (isPidAlive(pid)) {
                try {
                    process.kill(-pid, 'SIGKILL')
                } catch {
                    // Intentionally swallowed: try killing single process if process group kill fails
                    try {
                        process.kill(pid, 'SIGKILL')
                    } catch {
                        // Intentionally swallowed: already exited
                    }
                }
            }
        } catch {
            // Intentionally swallowed: pid read or kill error
        }
    }

    try {
        fs.writeFileSync(paths.exitFile, String(exitCode))
    } catch {
        // Intentionally swallowed: write exit file error
    }

    return { status: 'terminated', opId, exitCode }
}

// Standalone CLI runner when executed directly via Node / Bun
if (
    import.meta.main ||
    (typeof process !== 'undefined' && process.argv[1] && process.argv[1].includes('hands-daemon'))
) {
    const [action, opId, ...rest] = process.argv.slice(2)
    if (!action || !opId) {
        console.error(
            'Usage: hands-daemon <start|status|read|attach|detach|terminate> <opId> [args...]'
        )
        process.exit(1)
    }

    try {
        switch (action) {
            case 'start': {
                const cwd = rest[0] || '/workspace'
                const cmd = rest.slice(1).join(' ')
                handleStart(opId, cwd, cmd)
                    .then((res) => {
                        console.log(JSON.stringify(res))
                        process.exit(0)
                    })
                    .catch((err) => {
                        console.error(JSON.stringify({ error: String(err) }))
                        process.exit(1)
                    })
                break
            }
            case 'status': {
                const res = handleStatus(opId)
                console.log(JSON.stringify(res))
                break
            }
            case 'read': {
                const offset = parseInt(rest[0] || '0', 10)
                const res = handleRead(opId, offset)
                console.log(JSON.stringify(res))
                break
            }
            case 'detach': {
                const res = handleDetach(opId)
                console.log(JSON.stringify(res))
                break
            }
            case 'terminate': {
                const res = handleTerminate(opId)
                console.log(JSON.stringify(res))
                break
            }
            default: {
                console.error(`Unknown action: ${action}`)
                process.exit(1)
            }
        }
    } catch (e: any) {
        console.error(JSON.stringify({ error: e?.message || String(e) }))
        process.exit(1)
    }
}
