import * as cp from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export function openPlanInPager(planText: string, title = 'december-plan'): Promise<void> {
    if (
        process.env.NODE_ENV === 'test' ||
        Boolean(process.env.BUN_TEST) ||
        Boolean(process.env.VITEST)
    ) {
        return Promise.resolve()
    }

    return new Promise((resolve) => {
        try {
            const tmpFile = path.join(os.tmpdir(), `${title}-${Date.now()}.md`)
            fs.writeFileSync(tmpFile, planText, 'utf8')

            const pager =
                process.env.PAGER ||
                process.env.EDITOR ||
                (os.platform() === 'win32' ? 'notepad' : 'less -R')

            const child = cp.spawn(pager, [tmpFile], {
                stdio: 'inherit',
                shell: true,
            })

            ;(child as any).on('exit', () => {
                try {
                    fs.unlinkSync(tmpFile)
                } catch {
                    // Intentionally swallowed: cleanup of temporary file fallback
                }
                resolve()
            })
            ;(child as any).on('error', () => {
                resolve()
            })
        } catch {
            // Intentionally swallowed: fallback when pager fails to spawn
            resolve()
        }
    })
}

export function extractPlanSummary(planText: string, maxLines = 6): string {
    if (!planText) return ''
    const lines = planText
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)

    const stepLines = lines.filter(
        (l) =>
            /^(?:\d+[\.\)]|[-*#])\s+/.test(l) ||
            l.toLowerCase().startsWith('step ') ||
            l.toLowerCase().startsWith('create ') ||
            l.toLowerCase().startsWith('modify ') ||
            l.toLowerCase().startsWith('delete ')
    )

    if (stepLines.length > 0) {
        return stepLines.slice(0, maxLines).join('\n')
    }

    return lines.slice(0, maxLines).join('\n')
}
