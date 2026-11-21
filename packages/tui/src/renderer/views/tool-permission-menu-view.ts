import { THEME } from '../../theme'
import { drawText } from '../ui'

import type { ScreenBuffer } from '../buffer'

export interface ToolPermissionOption {
    label: string
    value: 'approve' | 'always' | 'git_tracked' | 'deny'
    keyHint?: string
}

export interface ToolPermissionMenuViewProps {
    x?: number
    y: number
    width: number
    height?: number
    toolName: string
    toolCommandOrTarget?: string
    diffPreviewLines?: string[]
    selectedIndex: number
}

/** Most diff rows the prompt shows; the full change stays in /diff */
const MAX_DIFF_ROWS = 12

const COMMAND_TOOLS = new Set(['bash', 'run_command', 'execute_command', 'terminal', 'shell'])

const RISKY_COMMAND = [
    /\brm\s+(-[a-zA-Z]*[rf][a-zA-Z]*\b|--recursive|--force)/i,
    /\bgit\s+reset\s+--hard\b/i,
    /\bgit\s+push\s+.*(--force\b|-f\b)/i,
    /\bgit\s+clean\s+.*-[a-zA-Z]*f/i,
    /\b(drop|truncate)\s+(table|database)\b/i,
    /\bmkfs\b|\bdd\s+if=/i,
]

/** Kept for callers that still import the static list */
export const DEFAULT_PERMISSION_OPTIONS: ToolPermissionOption[] = [
    { label: 'Yes', value: 'approve', keyHint: 'y' },
    // 'always' saves `<tool>: <path>` as an allow rule for this project (interceptors.ts)
    {
        label: 'Yes, always allow edits to this file in this project',
        value: 'always',
        keyHint: 'a',
    },
    { label: 'Yes, git-tracked files only', value: 'git_tracked', keyHint: 'g' },
    { label: 'No, tell December what to do instead', value: 'deny', keyHint: 'n' },
]

export function isCommandPermission(toolName: string): boolean {
    return COMMAND_TOOLS.has((toolName || '').toLowerCase())
}

/** The command text or file path from `commandOrTarget` ("tool: path" for file tools) */
function permissionTarget(toolName: string, commandOrTarget?: string): string {
    const raw = (commandOrTarget || '').replace(/\s+/g, ' ').trim()
    if (isCommandPermission(toolName)) return raw
    const match = raw.match(/^[\w-]+:\s*(.+)$/)
    return match ? match[1]! : raw
}

/** Options for one request. Commands have no "git-tracked" choice (S10). */
export function getPermissionOptions(
    toolName: string,
    commandOrTarget?: string
): ToolPermissionOption[] {
    if (isCommandPermission(toolName)) {
        // 'always' saves the exact command as an allow rule for this project (interceptors.ts)
        return [
            { label: 'Yes', value: 'approve', keyHint: 'y' },
            {
                label: 'Yes, always allow this exact command in this project',
                value: 'always',
                keyHint: 'a',
            },
            { label: 'No, tell December what to do instead', value: 'deny', keyHint: 'n' },
        ]
    }
    return DEFAULT_PERMISSION_OPTIONS
}

function permissionQuestion(toolName: string, target: string): string {
    const lower = (toolName || '').toLowerCase()
    if (isCommandPermission(toolName)) return 'Run this command?'
    if (lower === 'write_file' || lower === 'write_to_file' || lower === 'create_file') {
        return target ? `Create ${target}?` : 'Create this file?'
    }
    if (lower.includes('edit') || lower.includes('replace')) {
        return target ? `Edit ${target}?` : 'Edit this file?'
    }
    return target ? `Allow ${toolName} on ${target}?` : `Allow ${toolName}?`
}

export interface PermissionDiffRow {
    type: 'add' | 'delete' | 'context'
    lineNo?: number
    text: string
}

/** Parses unified diff lines into numbered rows, skipping file headers. */
export function parsePermissionDiff(lines: string[]): PermissionDiffRow[] {
    const rows: PermissionDiffRow[] = []
    let oldLine = 0
    let newLine = 0
    for (const line of lines) {
        if (
            line.startsWith('---') ||
            line.startsWith('+++') ||
            line.startsWith('diff ') ||
            line.startsWith('index ') ||
            line.startsWith('\\ No newline')
        ) {
            continue
        }
        const hunk = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/)
        if (hunk) {
            oldLine = Number(hunk[1])
            newLine = Number(hunk[2])
            continue
        }
        if (line.startsWith('+')) {
            rows.push({ type: 'add', lineNo: newLine || undefined, text: line.slice(1) })
            if (newLine) newLine++
        } else if (line.startsWith('-')) {
            rows.push({ type: 'delete', lineNo: oldLine || undefined, text: line.slice(1) })
            if (oldLine) oldLine++
        } else if (line.length > 0 || rows.length > 0) {
            rows.push({
                type: 'context',
                lineNo: newLine || undefined,
                text: line.startsWith(' ') ? line.slice(1) : line,
            })
            if (oldLine) oldLine++
            if (newLine) newLine++
        }
    }
    while (
        rows.length > 0 &&
        rows[rows.length - 1]!.type === 'context' &&
        !rows[rows.length - 1]!.text
    ) {
        rows.pop()
    }
    return rows
}

function commandRisk(toolName: string, command: string): string | null {
    if (!isCommandPermission(toolName)) return null
    return RISKY_COMMAND.some((re) => re.test(command)) ? '! can delete files or data' : null
}

export const ToolPermissionMenuView = {
    getHeight(toolName = '', diffLines: string[] = [], commandOrTarget?: string): number {
        const isCommand = isCommandPermission(toolName)
        const target = permissionTarget(toolName, commandOrTarget)
        const diffRows = Math.min(parsePermissionDiff(diffLines).length, MAX_DIFF_ROWS + 1)
        const options = getPermissionOptions(toolName, commandOrTarget).length
        // question, (command line, risk line), blank, diff + blank, options, footer
        let height = 1
        if (isCommand) height += 1 + (commandRisk(toolName, target) ? 1 : 0)
        height += 1
        if (diffRows > 0) height += diffRows + 1
        height += options + 1
        return height
    },

    render(buffer: ScreenBuffer, props: ToolPermissionMenuViewProps): void {
        const x = (props.x ?? 0) + THEME.padding.paddingLeft
        let y = props.y
        const width = Math.max(
            20,
            props.width - THEME.padding.paddingLeft - THEME.padding.paddingRight
        )
        const toolName = props.toolName || 'tool'
        const target = permissionTarget(toolName, props.toolCommandOrTarget)
        const isCommand = isCommandPermission(toolName)

        // K9: no divider line above the prompt; the question row starts it

        // The question is the only bold text on screen (T3.6)
        drawText(buffer, permissionQuestion(toolName, isCommand ? '' : target), {
            x,
            y,
            maxWidth: width,
            style: { fg: THEME.colors.text, bold: true },
        })
        y += 1

        if (isCommand) {
            drawText(buffer, '$ ', { x: x + 2, y, style: { fg: THEME.colors.dim } })
            drawText(buffer, target, {
                x: x + 4,
                y,
                maxWidth: width - 4,
                style: { fg: THEME.colors.text },
            })
            y += 1
            const risk = commandRisk(toolName, target)
            if (risk) {
                drawText(buffer, risk, { x: x + 2, y, style: { fg: THEME.colors.warning } })
                y += 1
            }
        }
        y += 1

        const rows = parsePermissionDiff(props.diffPreviewLines || [])
        if (rows.length > 0) {
            const visible = rows.slice(0, MAX_DIFF_ROWS)
            for (const row of visible) {
                const bg =
                    row.type === 'add'
                        ? THEME.colors.diffAddBg
                        : row.type === 'delete'
                          ? THEME.colors.diffDeleteBg
                          : undefined
                if (bg) {
                    for (let c = 0; c < width; c++) buffer.setChar(x + c, y, ' ', { bg })
                }
                const num = row.lineNo !== undefined ? String(row.lineNo).padStart(6) : '      '
                drawText(buffer, `${num} `, { x, y, style: { fg: THEME.colors.dim, bg } })
                const sign = row.type === 'add' ? '+ ' : row.type === 'delete' ? '- ' : '  '
                drawText(buffer, sign, {
                    x: x + 7,
                    y,
                    style: {
                        fg:
                            row.type === 'add'
                                ? THEME.colors.success
                                : row.type === 'delete'
                                  ? THEME.colors.error
                                  : THEME.colors.dim,
                        bg,
                    },
                })
                drawText(buffer, row.text, {
                    x: x + 9,
                    y,
                    maxWidth: Math.max(0, width - 9),
                    style: {
                        fg: row.type === 'context' ? THEME.colors.muted : THEME.colors.text,
                        bg,
                    },
                })
                y += 1
            }
            if (rows.length > MAX_DIFF_ROWS) {
                drawText(buffer, `         … ${rows.length - MAX_DIFF_ROWS} more lines · /diff`, {
                    x,
                    y,
                    style: { fg: THEME.colors.dim },
                })
                y += 1
            }
            y += 1
        }

        const options = getPermissionOptions(toolName, props.toolCommandOrTarget)
        options.forEach((opt, idx) => {
            const isSelected = idx === props.selectedIndex
            drawText(
                buffer,
                isSelected ? `${THEME.glyphs.selector} ${opt.label}` : `  ${opt.label}`,
                {
                    x,
                    y,
                    maxWidth: width,
                    style: { fg: isSelected ? THEME.colors.brand : THEME.colors.muted },
                }
            )
            y += 1
        })

        const height = props.height ?? buffer.height
        const footerY = Math.min(y, (props.y ?? 0) + height - 1)
        const keys = options.map((o) => o.keyHint).join(' ')
        drawText(buffer, `enter select · esc no · ${keys}`, {
            x,
            y: footerY,
            maxWidth: width,
            style: { fg: THEME.colors.dim },
        })
    },
}
