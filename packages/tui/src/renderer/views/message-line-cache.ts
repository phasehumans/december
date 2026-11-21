import { THEME } from '../../theme'
import {
    editDiffRows,
    editPairs,
    editResultLines,
    toolCallChanges,
    type EditDiffRow,
} from '../../utils/edit-diff'
import { parseTuiError } from '../../utils/error-parser'
import { toRelativePath } from '../../utils/terminal-link'
import {
    agentRole,
    classifyTool,
    exploreKind,
    exploreTarget,
    formatStepDuration,
    middleEllipsis,
    parseToolInput,
    toolCommandText,
    toolFilePath,
    webQuery,
    type ToolKind,
} from '../../utils/tool-kind'
import { stringWidth } from '../cell'

import {
    createStreamingMarkdownCache,
    formatMarkdownToLines,
    wrapSegments,
    type FormattedLine,
    type StreamingMarkdownCache,
    type TextSegment,
} from './markdown'

import type { MessageItem, MessageToolCall } from './message-list-view'

export { parseToolInput }

/** Text the agent appends when a turn is interrupted */
export const INTERRUPT_MARKER = 'Interrupted · What should December do instead?'

/** Most rows an open diff shows (S4.2); the rest is in /diff */
const MAX_DIFF_ROWS = 12
/** Rows of a new file shown while it is the open step (S6) */
const MAX_NEW_FILE_ROWS = 8
/** A live turn folds its earlier steps past this many steps (S12) */
const FOLD_AFTER_STEPS = 25
const FOLD_KEEP_STEPS = 12

export interface LayoutOptions {
    /** The last turn is still running: its newest edit can show a diff, long runs fold */
    liveTurn?: boolean
    /** Clock for the running dot's 1 Hz blink */
    now?: number
    /** Files whose diff the permission prompt already showed this turn (S4.8) */
    previewedPaths?: ReadonlySet<string>
    /** An approval prompt is open: the step it asks about shows as a yellow pending row (L10) */
    awaitingApproval?: boolean
}

function blank(): FormattedLine {
    return [{ text: '', style: {} }]
}

function isFailed(tc?: MessageToolCall): boolean {
    return tc?.status === 'error' || (tc as any)?.status === 'failed'
}

function isLiveMessage(m: MessageItem | undefined): boolean {
    return Boolean(m && (m.isStreaming || m.toolCall?.status === 'running'))
}

function isToolMessage(m: MessageItem | undefined): boolean {
    return Boolean(m && (m.role === 'tool' || m.toolCall))
}

function kindOf(m: MessageItem): ToolKind {
    return classifyTool(m.toolCall?.name, m.toolCall?.command)
}

/** A bare interrupt notice attaches under the last step instead of starting a new block */
function isAttachedNotice(m: MessageItem | undefined): boolean {
    return Boolean(
        m && m.role === 'assistant' && (m.content || m.text || '').trim() === INTERRUPT_MARKER
    )
}

/** Messages that draw nothing in the chat: thoughts (L5, S2) and plan updates (L19) */
function isHidden(m: MessageItem): boolean {
    if (m.role === 'thinking') return true
    if (isToolMessage(m) && kindOf(m) === 'plan') return true
    return false
}

function truncate(text: string, max: number): string {
    if (max <= 1) return ''
    return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

function lastNonEmptyLine(text: string): string {
    const lines = text.split(/\r?\n/)
    for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i]!.trim()
        if (line) return line
    }
    return ''
}

/** Splits one prompt row into text, @mention (accent) and paste chip (dim) segments. */
function promptRowSegments(rowText: string, bg: string): FormattedLine {
    const segments: FormattedLine = []
    const tokenRegex = /(\[Pasted \d+ lines(?: #\d+)?\])|(@[^\s]+)/gi
    let last = 0
    let match: RegExpExecArray | null
    while ((match = tokenRegex.exec(rowText)) !== null) {
        if (match.index > last) {
            segments.push({
                text: rowText.slice(last, match.index),
                style: { fg: THEME.colors.text, bg },
            })
        }
        segments.push({
            text: match[1] ? match[1].toLowerCase() : match[0],
            style: { fg: match[1] ? THEME.colors.dim : THEME.colors.brand, bg },
        })
        last = match.index + match[0].length
    }
    if (last < rowText.length) {
        segments.push({ text: rowText.slice(last), style: { fg: THEME.colors.text, bg } })
    }
    return segments
}

/**
 * User prompt rows: a band on the surface color that spans the chat width (ending where the
 * prompt separator ends). Long and multi-line prompts wrap under the text, not the glyph.
 */
export function formatUserPromptRows(text: string, width: number): FormattedLine[] {
    const bg = THEME.colors.surface
    const style = { fg: THEME.colors.text, bg }
    const glyph = `${THEME.glyphs.prompt} `
    const rowWidth = Math.max(glyph.length + 4, width - THEME.padding.paddingRight)
    const textWidth = rowWidth - glyph.length

    const rows: string[] = []
    for (const paragraph of text.split(/\r?\n/)) {
        if (!paragraph.trim()) {
            rows.push('')
            continue
        }
        for (const line of wrapSegments([{ text: paragraph, style }], textWidth)) {
            rows.push(line.map((seg) => seg.text).join(''))
        }
    }

    return rows.map((rowText, i) => {
        const prefix = i === 0 ? glyph : ' '.repeat(glyph.length)
        const pad = ' '.repeat(Math.max(0, rowWidth - prefix.length - stringWidth(rowText)))
        return [
            { text: prefix, style: { fg: THEME.colors.brand, bg } },
            ...promptRowSegments(rowText, bg),
            { text: pad, style: { bg } },
        ]
    })
}

/**
 * One diff row: a dim line number, the sign, and the text, on a tinted band for
 * added and removed lines.
 */
export function formatDiffRow(
    type: 'add' | 'delete' | 'context' | 'hunk',
    content: string,
    width: number,
    lineNo?: number
): FormattedLine {
    const bg =
        type === 'add'
            ? THEME.colors.diffAddBg
            : type === 'delete'
              ? THEME.colors.diffDeleteBg
              : undefined
    const num = lineNo !== undefined ? String(lineNo).padStart(6) : '      '
    const sign = type === 'add' ? '+ ' : type === 'delete' ? '- ' : '  '
    const signColor =
        type === 'add'
            ? THEME.colors.success
            : type === 'delete'
              ? THEME.colors.error
              : THEME.colors.dim
    const textColor = type === 'context' || type === 'hunk' ? THEME.colors.muted : THEME.colors.text
    const prefixLen = num.length + 1 + sign.length
    const maxText = Math.max(0, width - prefixLen - 1)
    const text = content.length > maxText ? content.slice(0, maxText) : content
    const tokens: FormattedLine = [
        { text: `${num} `, style: { fg: THEME.colors.dim, bg } },
        { text: sign, style: { fg: signColor, bg } },
        { text, style: { fg: textColor, bg } },
    ]
    const pad = bg ? Math.max(0, width - 1 - prefixLen - text.length) : 0
    if (pad > 0) tokens.push({ text: ' '.repeat(pad), style: { bg } })
    return tokens
}

function diffRowLines(rows: EditDiffRow[], width: number, max = MAX_DIFF_ROWS): FormattedLine[] {
    const lines = rows
        .slice(0, max)
        .map((row) => formatDiffRow(row.type, row.text, width, row.lineNo))
    if (rows.length > max) {
        lines.push([
            {
                text: `         … ${rows.length - max} more lines · /diff`,
                style: { fg: THEME.colors.dim },
            },
        ])
    }
    return lines
}

// ---------- step rows ----------

interface RowContext {
    width: number
    blinkOn: boolean
}

function glyphColor(tc: MessageToolCall | undefined, ctx: RowContext): string {
    if (isFailed(tc)) return THEME.colors.error
    if (tc?.status === 'running') return ctx.blinkOn ? THEME.colors.brand : THEME.colors.dim
    return THEME.colors.dim
}

/** The step an open approval prompt asks about: a static yellow dot and the plain action (L10) */
function pendingRow(m: MessageItem, width: number): FormattedLine[] {
    const tc = m.toolCall!
    const input = parseToolInput(tc.input)
    const kind = kindOf(m)
    let verb: string
    let target: string
    if (kind === 'command') {
        verb = 'Run'
        target = toolCommandText(input, tc.command)
    } else if (kind === 'edit' || kind === 'write') {
        verb = kind === 'write' ? 'Create' : 'Edit'
        target = middleEllipsis(toolFilePath(input, tc.command), Math.max(10, width - 16))
    } else {
        const match = (tc.command || '').match(/^([A-Za-z0-9_]+)\(([\s\S]*)\)$/)
        verb = match ? match[1]! : tc.name || 'Tool'
        target = match ? match[2]!.replace(/\s+/g, ' ').trim() : ''
    }
    return [
        [
            { text: `${THEME.glyphs.step} `, style: { fg: THEME.colors.warning } },
            { text: verb, style: { fg: THEME.colors.muted } },
            ...(target
                ? [
                      {
                          text: ` ${truncate(target, Math.max(10, width - verb.length - 6))}`,
                          style: { fg: THEME.colors.dim },
                      },
                  ]
                : []),
        ],
    ]
}

function stepRow(color: string, parts: TextSegment[]): FormattedLine {
    return [{ text: `${THEME.glyphs.step} `, style: { fg: color } }, ...parts]
}

function resultLine(text: string, width: number, color: string = THEME.colors.dim): FormattedLine {
    return [
        { text: `    ${THEME.glyphs.result} `, style: { fg: THEME.colors.dim } },
        { text: truncate(text, Math.max(10, width - 6)), style: { fg: color } },
    ]
}

function meta(text: string): TextSegment[] {
    return text ? [{ text: `  ${text}`, style: { fg: THEME.colors.dim } }] : []
}

function counts(added: number, removed: number): TextSegment[] {
    const parts: TextSegment[] = []
    if (added > 0) parts.push({ text: `  +${added}`, style: { fg: THEME.colors.success } })
    if (removed > 0)
        parts.push({
            text: `${added > 0 ? ' ' : '  '}-${removed}`,
            style: { fg: THEME.colors.error },
        })
    return parts
}

function plural(n: number, one: string, many: string): string {
    return `${n} ${n === 1 ? one : many}`
}

/** A run of read, list, search and code-intel calls as one row (S3) */
function exploreRows(group: MessageItem[], ctx: RowContext): FormattedLine[] {
    const running = group.find((m) => m.toolCall?.status === 'running')
    const failed = group.filter((m) => isFailed(m.toolCall))
    const color =
        failed.length > 0
            ? THEME.colors.error
            : glyphColor(running?.toolCall ?? group[0]!.toolCall, ctx)
    const maxTarget = Math.max(10, ctx.width - 16)
    const lines: FormattedLine[] = []

    if (running) {
        const live = [...group].reverse().find((m) => m.toolCall?.status === 'running')!.toolCall!
        const target = exploreTarget(live.name, parseToolInput(live.input), live.command)
        lines.push(
            stepRow(color, [
                { text: 'Exploring', style: { fg: THEME.colors.muted } },
                ...(target
                    ? [
                          {
                              text: ` · ${middleEllipsis(target, maxTarget)}`,
                              style: { fg: THEME.colors.dim },
                          },
                      ]
                    : []),
            ])
        )
    } else if (group.length === 1) {
        const tc = group[0]!.toolCall!
        const kind = exploreKind(tc.name, tc.command)
        const target = exploreTarget(tc.name, parseToolInput(tc.input), tc.command)
        const verb = kind === 'read' ? 'Read' : kind === 'list' ? 'Listed' : 'Searched'
        lines.push(
            stepRow(color, [
                { text: verb, style: { fg: THEME.colors.text } },
                ...(target
                    ? [
                          {
                              text: ` ${middleEllipsis(target, maxTarget)}`,
                              style: { fg: THEME.colors.muted },
                          },
                      ]
                    : []),
                ...meta(formatStepDuration(tc.durationMs)),
            ])
        )
    } else {
        const files = new Set<string>()
        let searches = 0
        let dirs = 0
        for (const m of group) {
            const tc = m.toolCall!
            const kind = exploreKind(tc.name, tc.command)
            if (kind === 'read')
                files.add(exploreTarget(tc.name, parseToolInput(tc.input), tc.command))
            else if (kind === 'list') dirs++
            else searches++
        }
        const parts: string[] = []
        if (files.size > 0) parts.push(plural(files.size, 'file', 'files'))
        if (searches > 0) parts.push(plural(searches, 'search', 'searches'))
        if (dirs > 0) parts.push(plural(dirs, 'directory', 'directories'))
        lines.push(
            stepRow(color, [
                { text: 'Explored', style: { fg: THEME.colors.text } },
                { text: ` ${parts.join(' · ')}`, style: { fg: THEME.colors.dim } },
            ])
        )
    }

    for (const m of failed.slice(0, 2)) {
        const tc = m.toolCall!
        const target = exploreTarget(tc.name, parseToolInput(tc.input), tc.command)
        const first = (tc.output || '').trim().split(/\r?\n/)[0] || 'failed'
        lines.push(
            resultLine(target ? `${target}: ${first}` : first, ctx.width, THEME.colors.error)
        )
    }
    return lines
}

/** Consecutive edits to one file as one row; the newest can show its diff (S4) */
function editRows(group: MessageItem[], ctx: RowContext, open: boolean): FormattedLine[] {
    const newest = group[group.length - 1]!.toolCall!
    const input = parseToolInput(newest.input)
    const filePath = toolFilePath(input, newest.command)
    const isWrite = kindOf(group[group.length - 1]!) === 'write'
    const running = newest.status === 'running'
    const failed = isFailed(newest)
    const color = glyphColor(newest, ctx)
    const shownPath = middleEllipsis(filePath, Math.max(10, ctx.width - 24))
    const lines: FormattedLine[] = []

    if (running) {
        lines.push(
            stepRow(color, [
                { text: isWrite ? 'Creating' : 'Editing', style: { fg: THEME.colors.muted } },
                { text: ` ${shownPath}`, style: { fg: THEME.colors.dim } },
            ])
        )
        return lines
    }

    let added = 0
    let removed = 0
    for (const m of group) {
        const change = toolCallChanges(m.toolCall!)
        if (change) {
            added += change.added
            removed += change.removed
        }
    }

    if (isWrite && !failed) {
        lines.push(
            stepRow(color, [
                { text: 'Created', style: { fg: THEME.colors.text } },
                { text: ` ${shownPath}`, style: { fg: THEME.colors.muted } },
                ...meta(plural(added, 'line', 'lines')),
            ])
        )
    } else {
        lines.push(
            stepRow(color, [
                {
                    text: failed ? (isWrite ? 'Create' : 'Edit') : 'Edited',
                    style: { fg: THEME.colors.text },
                },
                { text: ` ${shownPath}`, style: { fg: THEME.colors.muted } },
                ...(failed ? [] : counts(added, removed)),
                ...(group.length > 1
                    ? [{ text: ` · ${group.length} edits`, style: { fg: THEME.colors.dim } }]
                    : []),
            ])
        )
    }

    if (failed) {
        const first = (newest.output || '').trim().split(/\r?\n/)[0] || 'failed'
        lines.push(
            resultLine(
                first.replace(/^Failed to edit file:\s*/i, ''),
                ctx.width,
                THEME.colors.error
            )
        )
        return lines
    }

    if (open) {
        if (isWrite) {
            const content = String(
                input.content ?? input.Content ?? input.CodeContent ?? input.code ?? ''
            )
            const rows: EditDiffRow[] = content
                .split(/\r?\n/)
                .map((text, i) => ({ type: 'add' as const, lineNo: i + 1, text }))
            lines.push(...diffRowLines(rows, ctx.width, MAX_NEW_FILE_ROWS))
        } else {
            lines.push(
                ...diffRowLines(
                    editDiffRows(filePath, editPairs(input), editResultLines(newest.output)),
                    ctx.width
                )
            )
        }
    }
    return lines
}

function exitCode(output: string): string | null {
    return output.match(/exit code (\d+)/i)?.[1] ?? null
}

function backgroundTaskId(output?: string): string | null {
    if (!output) return null
    return (
        output.match(
            /(?:\[Moved to background task:\s*|\[Auto-Backgrounded\]\s*Task ID:\s*)([A-Za-z0-9_-]+)/i
        )?.[1] ?? null
    )
}

function commandRows(m: MessageItem, ctx: RowContext): FormattedLine[] {
    const tc = m.toolCall!
    const cmd = toolCommandText(parseToolInput(tc.input), tc.command)
    const shownCmd = truncate(cmd, Math.max(10, ctx.width - 24))
    const color = glyphColor(tc, ctx)
    const output = tc.output || ''
    const lines: FormattedLine[] = []

    if (tc.status === 'running') {
        lines.push(
            stepRow(color, [
                { text: 'Running', style: { fg: THEME.colors.muted } },
                { text: ` ${shownCmd}`, style: { fg: THEME.colors.dim } },
            ])
        )
        // Live output tail: the last 3 lines, indented, with no gutter (L7, S7)
        const tail = output
            .trim()
            .split(/\r?\n/)
            .filter((l) => l.trim())
            .slice(-3)
        for (const line of tail) {
            lines.push([
                {
                    text: `    ${truncate(line, Math.max(10, ctx.width - 6))}`,
                    style: { fg: THEME.colors.dim },
                },
            ])
        }
        return lines
    }

    const taskId = backgroundTaskId(output)
    if (taskId) {
        lines.push(
            stepRow(color, [
                { text: 'Ran', style: { fg: THEME.colors.text } },
                { text: ` ${shownCmd}`, style: { fg: THEME.colors.muted } },
                ...meta(`in background · ${taskId} · /tasks`),
            ])
        )
        return lines
    }

    const duration = formatStepDuration(tc.durationMs)
    if (isFailed(tc) || /^Command failed with exit code/m.test(output)) {
        const code = exitCode(output)
        lines.push(
            stepRow(THEME.colors.error, [
                { text: 'Ran', style: { fg: THEME.colors.text } },
                { text: ` ${shownCmd}`, style: { fg: THEME.colors.muted } },
                ...(code ? [{ text: `  exit ${code}`, style: { fg: THEME.colors.error } }] : []),
                ...(duration
                    ? [
                          {
                              text: `${code ? ' · ' : '  '}${duration}`,
                              style: { fg: THEME.colors.dim },
                          },
                      ]
                    : []),
            ])
        )
        // First error line, up to 3 rows, then how much more there is (S8)
        const body = output
            .split(/\r?\n/)
            .filter(
                (l) =>
                    l.trim() && !/^Command failed with exit code/i.test(l) && !/^\$ /.test(l.trim())
            )
        const firstErr = Math.max(
            0,
            body.findIndex((l) => /error|failed/i.test(l))
        )
        const shown = body.slice(firstErr, firstErr + 1)
        if (shown.length > 0) {
            const wrapped = wrapSegments(
                [{ text: shown[0]!, style: {} }],
                Math.max(10, ctx.width - 8)
            )
                .slice(0, 3)
                .map((l) => l.map((s) => s.text).join(''))
            wrapped.forEach((text, i) => {
                lines.push(
                    i === 0
                        ? [
                              {
                                  text: `    ${THEME.glyphs.result} `,
                                  style: { fg: THEME.colors.dim },
                              },
                              { text, style: { fg: THEME.colors.error } },
                          ]
                        : [{ text: `      ${text}`, style: { fg: THEME.colors.error } }]
                )
            })
            const moreErrors = body.slice(firstErr + 1).filter((l) => /error/i.test(l)).length
            const moreLines = body.length - firstErr - 1
            if (moreErrors > 0) {
                lines.push([
                    {
                        text: `      +${moreErrors} more ${moreErrors === 1 ? 'error' : 'errors'}`,
                        style: { fg: THEME.colors.dim },
                    },
                ])
            } else if (moreLines > 0) {
                lines.push([
                    { text: `      +${moreLines} more lines`, style: { fg: THEME.colors.dim } },
                ])
            }
        }
        return lines
    }

    // A command that lists or prints things gets a line count, not its last line: that line
    // is just whatever came last, not a summary. One line of output is still shown.
    const outputLines = output.split(/\r?\n/).filter((l) => l.trim()).length
    if (outputLines > 1 && isListingCommand(cmd)) {
        lines.push(
            stepRow(color, [
                { text: 'Ran', style: { fg: THEME.colors.text } },
                { text: ` ${shownCmd}`, style: { fg: THEME.colors.muted } },
                ...meta([`${outputLines} lines`, duration].filter(Boolean).join(' · ')),
            ])
        )
        return lines
    }

    lines.push(
        stepRow(color, [
            { text: 'Ran', style: { fg: THEME.colors.text } },
            { text: ` ${shownCmd}`, style: { fg: THEME.colors.muted } },
            ...meta(duration),
        ])
    )
    const last = lastNonEmptyLine(output)
    if (last) lines.push(resultLine(last, ctx.width))
    return lines
}

const LISTING_COMMANDS = new Set([
    'find',
    'fd',
    'ls',
    'tree',
    'grep',
    'egrep',
    'rg',
    'ag',
    'cat',
    'head',
    'tail',
    'bat',
    'less',
    'more',
    'nl',
])
const LISTING_GIT = new Set(['log', 'ls-files', 'show', 'diff', 'grep', 'branch', 'tag'])
/** Filters that keep a listing a listing when piped after it */
const LISTING_FILTERS = new Set([
    'head',
    'tail',
    'sort',
    'uniq',
    'grep',
    'rg',
    'cut',
    'less',
    'more',
])

/**
 * True when a command only lists or prints things (find, ls, grep, cat, git log), so its
 * last output line is not a summary. Looks at the last command of a && or ; chain, and every
 * stage of its pipe must be a listing command or a filter such as head or sort.
 */
export function isListingCommand(command: string): boolean {
    const chain = command.split(/&&|\|\||;/)
    const lastCommand = chain[chain.length - 1]?.trim() ?? ''
    if (!lastCommand) return false
    const stages = lastCommand.split('|').map((stage) => stage.trim().split(/\s+/))
    return stages.every((words, i) => {
        const args = words.filter((w) => !/^[A-Za-z_][A-Za-z0-9_]*=/.test(w))
        const name = (args[0] ?? '').replace(/^.*\//, '')
        if (name === 'git') return LISTING_GIT.has(args[1] ?? '')
        return i === 0 ? LISTING_COMMANDS.has(name) : LISTING_FILTERS.has(name)
    })
}

function agentRows(m: MessageItem, ctx: RowContext): FormattedLine[] {
    const tc = m.toolCall!
    const role = agentRole(parseToolInput(tc.input), tc.command)
    const color = glyphColor(tc, ctx)
    const output = tc.output || ''
    if (tc.status === 'running') {
        const action = lastNonEmptyLine(output).replace(/^\[SubAgent:[^\]]+\]\s*/i, '')
        return [
            stepRow(color, [
                { text: 'Agent', style: { fg: THEME.colors.text } },
                { text: ` ${role}`, style: { fg: THEME.colors.muted } },
                ...(action
                    ? [
                          {
                              text: ` · ${truncate(action, Math.max(10, ctx.width - role.length - 14))}`,
                              style: { fg: THEME.colors.dim },
                          },
                      ]
                    : []),
            ]),
        ]
    }
    const turns = output.match(/(?:Total Turns\*\*:\s*(\d+)|\((\d+)\s*turns)/i)
    const tools = output.match(/(?:Tool Calls\*\*:\s*(\d+)|,\s*(\d+)\s*tool(?:s|\s*calls)?)/i)
    const stats: string[] = []
    const t = turns ? turns[1] || turns[2] : ''
    const n = tools ? tools[1] || tools[2] : ''
    if (t) stats.push(`${t} turns`)
    if (n) stats.push(`${n} tools`)
    const duration = formatStepDuration(tc.durationMs)
    if (duration) stats.push(duration)
    const lines = [
        stepRow(color, [
            { text: 'Agent', style: { fg: THEME.colors.text } },
            { text: ` ${role}`, style: { fg: THEME.colors.muted } },
            ...meta(stats.join(' · ')),
        ]),
    ]
    const findings = output.match(/#### Rollup Summary & Findings:\s*([\s\S]*)$/i)?.[1] ?? ''
    const first = findings
        .split(/\r?\n/)
        .map((s) => s.trim().replace(/^[-•*]\s*/, ''))
        .filter(Boolean)[0]
    if (first) lines.push(resultLine(first, ctx.width))
    else if (isFailed(tc))
        lines.push(
            resultLine(output.trim().split(/\r?\n/)[0] || 'failed', ctx.width, THEME.colors.error)
        )
    return lines
}

function webRows(m: MessageItem, ctx: RowContext, kind: 'web' | 'fetch'): FormattedLine[] {
    const tc = m.toolCall!
    const q = webQuery(parseToolInput(tc.input), tc.command)
    const color = glyphColor(tc, ctx)
    const running = tc.status === 'running'
    const shown =
        kind === 'web'
            ? `"${truncate(q, Math.max(10, ctx.width - 30))}"`
            : truncate(q.replace(/^https?:\/\//, ''), Math.max(10, ctx.width - 24))
    const verb =
        kind === 'web'
            ? running
                ? 'Searching web'
                : 'Searched web'
            : running
              ? 'Fetching'
              : 'Fetched'
    const extra: string[] = []
    if (!running && kind === 'web' && tc.output && !isFailed(tc)) {
        const results = (tc.output.match(/^\d+\.\s/gm) || []).length
        if (results > 0) extra.push(plural(results, 'result', 'results'))
    }
    if (!running && kind === 'fetch' && tc.output) {
        const kb = Math.max(1, Math.round(Buffer.byteLength(tc.output, 'utf8') / 1024))
        extra.push(`${kb} KB`)
    }
    const duration = formatStepDuration(tc.durationMs)
    if (!running && duration) extra.push(duration)
    const lines = [
        stepRow(color, [
            { text: verb, style: { fg: running ? THEME.colors.muted : THEME.colors.text } },
            { text: ` ${shown}`, style: { fg: running ? THEME.colors.dim : THEME.colors.muted } },
            ...meta(extra.join(' · ')),
        ]),
    ]
    if (isFailed(tc))
        lines.push(
            resultLine(
                (tc.output || 'failed').trim().split(/\r?\n/)[0]!,
                ctx.width,
                THEME.colors.error
            )
        )
    return lines
}

function mcpRows(m: MessageItem, ctx: RowContext): FormattedLine[] {
    const tc = m.toolCall!
    const input = parseToolInput(tc.input)
    const name = tc.name || ''
    let server = name
    let action: string
    if (tc.mcpServer) {
        // The agent tells us the server (F7), so nothing is guessed
        server = tc.mcpServer
        action = tc.mcpTool || name
    } else if (name.includes('__')) {
        const parts = name.replace(/^mcp__?/i, '').split('__')
        server = parts[0] || name
        action = parts.slice(1).join(' ')
    } else if (/^mcp_/i.test(name)) {
        // "mcp_<server>_<tool>" cannot be split when names have underscores: show it whole
        server = name.replace(/^mcp_/i, '')
        action = ''
    } else {
        action = String(input.tool || input.action || input.method || '')
    }
    action = action.replace(/_/g, ' ').trim()
    const mainArg = ['title', 'name', 'query', 'path', 'url']
        .map((k) => input[k])
        .find((v) => typeof v === 'string' && v.trim()) as string | undefined
    const color = glyphColor(tc, ctx)
    const lines = [
        stepRow(color, [
            { text: server, style: { fg: THEME.colors.text } },
            ...(action || mainArg
                ? [
                      { text: ' · ', style: { fg: THEME.colors.dim } },
                      {
                          text: truncate(
                              `${action}${mainArg ? `${action ? ' ' : ''}"${mainArg}"` : ''}`,
                              Math.max(10, ctx.width - server.length - 16)
                          ),
                          style: { fg: THEME.colors.muted },
                      },
                  ]
                : []),
            ...meta(tc.status === 'running' ? '' : formatStepDuration(tc.durationMs)),
        ]),
    ]
    if (tc.status !== 'running' && tc.output) {
        const first = tc.output.trim().split(/\r?\n/)[0] || ''
        if (first)
            lines.push(
                resultLine(first, ctx.width, isFailed(tc) ? THEME.colors.error : THEME.colors.dim)
            )
    }
    return lines
}

function otherRows(m: MessageItem, ctx: RowContext): FormattedLine[] {
    const tc = m.toolCall || {
        id: '',
        name: 'tool',
        command: m.content,
        status: 'success' as const,
    }
    const cmdStr = tc.command || `${tc.name}()`
    const match = cmdStr.match(/^([A-Za-z0-9_]+)\(([\s\S]*)\)$/)
    const label = match ? match[1]! : tc.name || cmdStr
    const args = match ? match[2]!.replace(/\s+/g, ' ').trim() : ''
    const color = glyphColor(tc, ctx)
    const running = tc.status === 'running'
    const lines = [
        stepRow(color, [
            { text: label, style: { fg: running ? THEME.colors.muted : THEME.colors.text } },
            ...(args
                ? [
                      {
                          text: ` ${truncate(args, Math.max(10, ctx.width - label.length - 16))}`,
                          style: { fg: running ? THEME.colors.dim : THEME.colors.muted },
                      },
                  ]
                : []),
            ...meta(running ? '' : formatStepDuration(tc.durationMs)),
        ]),
    ]
    if (isFailed(tc) && tc.output) {
        lines.push(
            resultLine(
                tc.output.trim().split(/\r?\n/)[0] || 'failed',
                ctx.width,
                THEME.colors.error
            )
        )
    }
    return lines
}

// ---------- non-tool messages ----------

/** "⟳ Context compacted · 182k → 24k tokens" (S15). The summary is not shown (S25-B). */
function compactionLines(msg: MessageItem): FormattedLine[] {
    const text = msg.content || msg.text || ''
    const tokens = text.match(/~?([\d.]+[kM]?)\s*→\s*~?([\d.]+[kM]?)\s*tokens/)
    const focus = text.match(/focus:\s*(.+)$/)?.[1]
    let line = '⟳ Context compacted'
    const clean = (n: string) => n.replace(/\.0(?=[kM]|$)/, '')
    if (tokens) line += ` · ${clean(tokens[1]!)} → ${clean(tokens[2]!)} tokens`
    if (focus) line += ` · focus: ${focus.trim()}`
    return [[{ text: line, style: { fg: THEME.colors.dim } }], blank()]
}

function taskNoticeLines(msg: MessageItem, width: number): FormattedLine[] {
    const dotColor =
        msg.tone === 'success'
            ? THEME.colors.success
            : msg.tone === 'error'
              ? THEME.colors.error
              : THEME.colors.muted
    const text = (msg.content || msg.text || '').replace(/\s+/g, ' ').trim()
    return [
        [
            { text: `${THEME.glyphs.status} `, style: { fg: dotColor } },
            { text: truncate(text, Math.max(1, width - 2)), style: { fg: THEME.colors.muted } },
        ],
        blank(),
    ]
}

function errorLines(msg: MessageItem, width: number): FormattedLine[] {
    const rawText = msg.content || msg.text || ''
    const parsed = parseTuiError(rawText, (msg as any).cause, (msg as any).hint)
    const lines: FormattedLine[] = []
    const message = formatMarkdownToLines(parsed.message, width - 4)
    message.forEach((line, i) => {
        for (const seg of line)
            seg.style = { ...seg.style, fg: THEME.colors.error, bold: undefined }
        line.unshift({
            text: i === 0 ? `${THEME.glyphs.step} ` : '  ',
            style: { fg: THEME.colors.error },
        })
    })
    lines.push(...message)
    if (parsed.hint) {
        for (const line of formatMarkdownToLines(parsed.hint, width - 6)) {
            for (const seg of line)
                if (!seg.style?.fg || seg.style.fg === THEME.colors.text)
                    seg.style = { ...seg.style, fg: THEME.colors.muted }
            line.unshift({ text: '    ', style: {} })
            lines.push(line)
        }
    }
    if (parsed.cause) {
        for (const line of formatMarkdownToLines(parsed.cause, width - 6)) {
            for (const seg of line) seg.style = { ...seg.style, fg: THEME.colors.dim }
            line.unshift({ text: '    ', style: {} })
            lines.push(line)
        }
    }
    lines.push(blank())
    return lines
}

function formatElapsed(ms: number): string {
    const s = Math.max(0, Math.round(ms / 1000))
    return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`
}

function formatTokens(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
    if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}k`
    return String(n)
}

/** "✱ Worked for 1m 12s · 8.4k tokens · 2 files changed +4 -1 · /diff" (L16, S5) */
function turnSummaryLines(msg: MessageItem): FormattedLine[] {
    const s = msg.summary
    if (!s) return []
    const facts: string[] = [`Worked for ${formatElapsed(s.durationMs)}`]
    if (s.outputTokens) facts.push(`${formatTokens(s.outputTokens)} tokens`)
    if (s.files.length > 0) facts.push(`${plural(s.files.length, 'file', 'files')} changed`)
    const parts: TextSegment[] = [
        { text: `✱ ${facts.join(' · ')}`, style: { fg: THEME.colors.dim } },
    ]
    if (s.files.length > 0) {
        const added = s.files.reduce((n, f) => n + f.added, 0)
        const removed = s.files.reduce((n, f) => n + f.removed, 0)
        if (added > 0) parts.push({ text: ` +${added}`, style: { fg: THEME.colors.success } })
        if (removed > 0) parts.push({ text: ` -${removed}`, style: { fg: THEME.colors.error } })
        parts.push({ text: ' · /diff', style: { fg: THEME.colors.dim } })
    }
    return [parts, blank()]
}

// ---------- caches ----------

interface CacheEntry {
    contentKey: string
    width: number
    lines: FormattedLine[]
}

/**
 * Lines for messages [0, end) of a conversation, cached while those messages are unchanged.
 * Validation compares each message's identity, content, tool status and tool output by
 * reference: one pointer check per field, so a hit stays cheap, and an in-place edit or a
 * replaced message (as the login flow does) still invalidates the entry.
 */
/** Cached lines of one settled turn, with what they were built from */
interface TurnEntry {
    refs: MessageItem[]
    contents: (string | undefined)[]
    statuses: (string | undefined)[]
    outputs: (string | undefined)[]
    streaming: boolean[]
    width: number
    lines: FormattedLine[]
}

function isTurnEntryValid(
    entry: TurnEntry,
    messages: MessageItem[],
    start: number,
    end: number,
    width: number
): boolean {
    if (entry.width !== width || entry.refs.length !== end - start) return false
    for (let i = start; i < end; i++) {
        const m = messages[i]!
        const k = i - start
        if (
            entry.refs[k] !== m ||
            entry.contents[k] !== (m.content ?? m.text) ||
            entry.statuses[k] !== m.toolCall?.status ||
            entry.outputs[k] !== m.toolCall?.output ||
            entry.streaming[k] !== Boolean(m.isStreaming)
        ) {
            return false
        }
    }
    return true
}

function makeTurnEntry(
    messages: MessageItem[],
    start: number,
    end: number,
    width: number,
    lines: FormattedLine[]
): TurnEntry {
    const refs = messages.slice(start, end)
    return {
        refs,
        contents: refs.map((m) => m.content ?? m.text),
        statuses: refs.map((m) => m.toolCall?.status),
        outputs: refs.map((m) => m.toolCall?.output),
        streaming: refs.map((m) => Boolean(m.isStreaming)),
        width,
        lines,
    }
}

/** Turn boundaries [start, end): a user message and the messages after it, up to the next one */
function splitTurns(messages: MessageItem[]): [number, number][] {
    const turns: [number, number][] = []
    let i = 0
    while (i < messages.length) {
        let j = i
        if (messages[j]?.role === 'user') j++
        while (j < messages.length && messages[j]?.role !== 'user') j++
        turns.push([i, j])
        i = j
    }
    return turns
}

/** Options for one history layout pass */
export interface SegmentOptions extends LayoutOptions {
    /**
     * Only the newest lines are needed (the view follows the bottom). Settled turns past
     * this many lines are skipped unless already cached; see isComplete().
     */
    tailLines?: number
}

interface Block {
    lines: FormattedLine[]
    /** Tool rows stack with no blank line between them */
    isStep: boolean
}

export class MessageLineCache {
    private messageCache = new WeakMap<MessageItem, CacheEntry>()
    private streamMarkdownCaches = new WeakMap<MessageItem, StreamingMarkdownCache>()
    /** Settled turns, keyed by the first message of the turn */
    private turnCache = new WeakMap<MessageItem, TurnEntry>()
    /** Set when the last pass skipped older turns; layoutPending() finishes them */
    private pending: { messages: MessageItem[]; width: number; settledCount: number } | null = null
    /**
     * The last complete settled history: messages[0, end) laid out as `segments`. A frame whose
     * settled messages all still match reuses it with one flat check, instead of a lookup per turn.
     */
    private lastSettled: {
        entry: TurnEntry
        end: number
        segments: FormattedLine[][]
    } | null = null

    /** Clears all cached lines. */
    clear(): void {
        this.messageCache = new WeakMap<MessageItem, CacheEntry>()
        this.streamMarkdownCaches = new WeakMap<MessageItem, StreamingMarkdownCache>()
        this.turnCache = new WeakMap<MessageItem, TurnEntry>()
        this.pending = null
        this.lastSettled = null
    }

    /** False when the last getLineSegments() left out older turns that are not laid out yet */
    isComplete(): boolean {
        return this.pending === null
    }

    /** Lines of a user, assistant, error, notice or summary message, cached per message */
    private textMessageLines(msg: MessageItem, width: number): FormattedLine[] {
        const text = msg.content || msg.text || ''
        const key = `${msg.role}|${text}|${Boolean(msg.isStreaming)}|${msg.tone ?? ''}|${JSON.stringify(msg.summary ?? '')}`
        const cached = this.messageCache.get(msg)
        if (cached && cached.width === width && cached.contentKey === key && !msg.isStreaming) {
            return cached.lines
        }

        let lines: FormattedLine[] = []
        if (msg.role === 'user') {
            lines = [...formatUserPromptRows(text, width), blank()]
        } else if (msg.role === 'assistant') {
            if (text.includes(INTERRUPT_MARKER)) {
                const preText = text.split(INTERRUPT_MARKER)[0]?.trimEnd() || ''
                if (preText) {
                    lines.push(...formatMarkdownToLines(preText, width - 2))
                    lines.push(blank())
                }
                lines.push([
                    {
                        text: `    ${THEME.glyphs.result} Interrupted · tell December what to do instead`,
                        style: { fg: THEME.colors.dim },
                    },
                ])
                lines.push(blank())
            } else {
                let streamCache: StreamingMarkdownCache | undefined
                if (msg.isStreaming) {
                    streamCache = this.streamMarkdownCaches.get(msg)
                    if (!streamCache) {
                        streamCache = createStreamingMarkdownCache({ stabilizeInline: true })
                        this.streamMarkdownCaches.set(msg, streamCache)
                    }
                }
                lines = [...formatMarkdownToLines(text, width - 2, streamCache), blank()]
            }
        } else if (msg.role === 'compaction' || (msg as any).type === 'compaction') {
            lines = compactionLines(msg)
        } else if (msg.role === 'task_notice') {
            lines = taskNoticeLines(msg, width)
        } else if (msg.role === 'error') {
            lines = errorLines(msg, width)
        } else if (msg.role === 'turn_summary') {
            lines = turnSummaryLines(msg)
        }

        this.messageCache.set(msg, { contentKey: key, width, lines })
        return lines
    }

    /** Groups one turn's messages into blocks: explore runs, same-file edit runs, single steps, text */
    private turnBlocks(
        msgs: MessageItem[],
        width: number,
        live: boolean,
        options: LayoutOptions
    ): Block[] {
        const visible = msgs.filter((m) => !isHidden(m))
        const ctx: RowContext = {
            width,
            blinkOn: Math.floor((options.now ?? Date.now()) / 500) % 2 === 0,
        }

        // The open diff (S4): the newest edit of the live turn, until another tool starts
        let openIndex = -1
        if (live) {
            for (let i = visible.length - 1; i >= 0; i--) {
                const m = visible[i]!
                if (!isToolMessage(m)) continue
                const kind = kindOf(m)
                if (kind === 'edit' || kind === 'write') {
                    const tc = m.toolCall!
                    const p = toRelativePath(toolFilePath(parseToolInput(tc.input), tc.command))
                    if (tc.status !== 'running' && !isFailed(tc) && !options.previewedPaths?.has(p))
                        openIndex = i
                }
                break
            }
        }

        // L10: the newest running step is the one an open approval prompt asks about
        let pending: MessageItem | undefined
        if (live && options.awaitingApproval) {
            for (let k = visible.length - 1; k >= 0; k--) {
                if (visible[k]!.toolCall?.status === 'running') {
                    pending = visible[k]
                    break
                }
            }
        }

        const blocks: Block[] = []
        let i = 0
        while (i < visible.length) {
            const m = visible[i]!
            if (m === pending) {
                blocks.push({ lines: pendingRow(m, width), isStep: true })
                i++
                continue
            }
            if (!isToolMessage(m)) {
                blocks.push({ lines: this.textMessageLines(m, width), isStep: isAttachedNotice(m) })
                i++
                continue
            }
            const kind = kindOf(m)
            if (kind === 'explore') {
                let j = i + 1
                while (
                    j < visible.length &&
                    isToolMessage(visible[j]) &&
                    kindOf(visible[j]!) === 'explore'
                )
                    j++
                blocks.push({ lines: exploreRows(visible.slice(i, j), ctx), isStep: true })
                i = j
                continue
            }
            if (kind === 'edit' || kind === 'write') {
                const tc = m.toolCall!
                const p = toolFilePath(parseToolInput(tc.input), tc.command)
                let j = i + 1
                while (
                    kind === 'edit' &&
                    j < visible.length &&
                    isToolMessage(visible[j]) &&
                    kindOf(visible[j]!) === 'edit' &&
                    visible[j]!.toolCall?.status !== 'running' &&
                    toolFilePath(
                        parseToolInput(visible[j]!.toolCall!.input),
                        visible[j]!.toolCall!.command
                    ) === p
                ) {
                    j++
                }
                blocks.push({
                    lines: editRows(visible.slice(i, j), ctx, openIndex >= i && openIndex < j),
                    isStep: true,
                })
                i = j
                continue
            }
            let lines: FormattedLine[]
            if (kind === 'command') lines = commandRows(m, ctx)
            else if (kind === 'agent') lines = agentRows(m, ctx)
            else if (kind === 'web' || kind === 'fetch') lines = webRows(m, ctx, kind)
            else if (kind === 'mcp') lines = mcpRows(m, ctx)
            else lines = otherRows(m, ctx)
            blocks.push({ lines, isStep: true })
            i++
        }
        return blocks
    }

    /** Folds the earlier steps of a long live turn into one row, keeping the last 12 (S12) */
    private foldLiveTurn(msgs: MessageItem[]): {
        leading: MessageItem[]
        summary: FormattedLine | null
        rest: MessageItem[]
    } {
        const stepIdx = msgs
            .map((m, i) => (isToolMessage(m) && !isHidden(m) ? i : -1))
            .filter((i) => i >= 0)
        if (stepIdx.length <= FOLD_AFTER_STEPS) return { leading: [], summary: null, rest: msgs }
        const cut = stepIdx[stepIdx.length - FOLD_KEEP_STEPS]!
        const folded = msgs.slice(0, cut)
        const leading = folded[0]?.role === 'assistant' && folded[0].content ? [folded[0]] : []
        let reads = 0
        let edits = 0
        let commands = 0
        let steps = 0
        for (const m of folded) {
            if (!isToolMessage(m) || isHidden(m)) continue
            steps++
            const kind = kindOf(m)
            if (kind === 'explore') reads++
            else if (kind === 'edit' || kind === 'write') edits++
            else if (kind === 'command') commands++
        }
        const parts = [`${steps} earlier steps`]
        if (reads > 0) parts.push(`${reads} files read`)
        if (edits > 0) parts.push(plural(edits, 'edit', 'edits'))
        if (commands > 0) parts.push(plural(commands, 'command', 'commands'))
        return {
            leading,
            summary: [
                {
                    text: `${THEME.glyphs.step} ${parts.join(' · ')}`,
                    style: { fg: THEME.colors.dim },
                },
            ],
            rest: msgs.slice(cut),
        }
    }

    private layoutTurnBody(
        msgs: MessageItem[],
        width: number,
        live: boolean,
        options: LayoutOptions
    ): FormattedLine[] {
        const lines: FormattedLine[] = []
        let body = msgs
        if (live) {
            const fold = this.foldLiveTurn(msgs)
            if (fold.summary) {
                for (const m of fold.leading) lines.push(...this.textMessageLines(m, width))
                lines.push(fold.summary)
                body = fold.rest
            }
        }
        const blocks = this.turnBlocks(body, width, live, options)
        blocks.forEach((block, idx) => {
            lines.push(...block.lines)
            const next = blocks[idx + 1]
            // A run of steps ends with one blank line before text; steps stack with none
            if (block.isStep && !(next && next.isStep)) lines.push(blank())
        })
        return lines
    }

    /** Lines of the turn messages[start, end): the user prompt, then the turn body */
    private layoutTurn(
        messages: MessageItem[],
        start: number,
        end: number,
        width: number,
        live: boolean,
        options: LayoutOptions
    ): FormattedLine[] {
        let bodyStart = start
        const lines: FormattedLine[] = []
        if (messages[start]?.role === 'user') {
            lines.push(...this.textMessageLines(messages[start]!, width))
            bodyStart++
        }
        const body = this.layoutTurnBody(messages.slice(bodyStart, end), width, live, options)
        for (const line of body) lines.push(line)
        return lines
    }

    /** Cached lines of a settled turn, or null when the cache has none that still match */
    private cachedTurn(
        messages: MessageItem[],
        start: number,
        end: number,
        width: number
    ): FormattedLine[] | null {
        const entry = this.turnCache.get(messages[start]!)
        return entry && isTurnEntryValid(entry, messages, start, end, width) ? entry.lines : null
    }

    /** Lines of a settled turn, laid out once and then reused until the turn changes */
    private settledTurn(
        messages: MessageItem[],
        start: number,
        end: number,
        width: number,
        options: LayoutOptions
    ): FormattedLine[] {
        const cached = this.cachedTurn(messages, start, end, width)
        if (cached) return cached
        const lines = this.layoutTurn(messages, start, end, width, false, options)
        this.turnCache.set(messages[start]!, makeTurnEntry(messages, start, end, width, lines))
        return lines
    }

    /**
     * Lays out older turns that the last tail-only pass skipped, newest first, for up to
     * `budgetMs`. Returns true when nothing is left.
     */
    layoutPending(budgetMs: number): boolean {
        const pending = this.pending
        if (!pending) return true
        const startedAt = performance.now()
        const { messages, width } = pending
        const turns = splitTurns(messages).slice(0, pending.settledCount)
        for (let t = turns.length - 1; t >= 0; t--) {
            const [start, end] = turns[t]!
            if (this.cachedTurn(messages, start, end, width)) continue
            this.settledTurn(messages, start, end, width, {})
            if (performance.now() - startedAt >= budgetMs && t > 0) return false
        }
        this.pending = null
        return true
    }

    /**
     * Returns the aggregated formatted lines for all messages as one array.
     * Prefer getLineSegments() on hot paths: it avoids copying every line per frame.
     */
    getLines(messages: MessageItem[], width: number, options?: LayoutOptions): FormattedLine[] {
        const segments = this.getLineSegments(messages, width, options)
        if (segments.length === 1) return segments[0]!
        return ([] as FormattedLine[]).concat(...segments)
    }

    /**
     * Returns the formatted lines for all messages as ordered segments, one per turn. Joined,
     * they equal getLines(). Settled turns come back as shared cached arrays, so a frame only
     * lays out the live turn, and a new turn only lays out itself.
     *
     * With `tailLines`, older settled turns that are not cached yet are left out once enough
     * lines are found; isComplete() then returns false until layoutPending() finishes them.
     */
    getLineSegments(
        messages: MessageItem[],
        width: number,
        options: SegmentOptions = {}
    ): FormattedLine[][] {
        const live = Boolean(options.liveTurn) || messages.some(isLiveMessage)

        // Fast path: only the live turn changed since the last complete pass
        if (live) {
            let liveStart = messages.length - 1
            while (liveStart > 0 && messages[liveStart]?.role !== 'user') liveStart--
            const last = this.lastSettled
            if (
                last &&
                liveStart > 0 &&
                last.end === liveStart &&
                isTurnEntryValid(last.entry, messages, 0, liveStart, width)
            ) {
                this.pending = null
                const liveLines = this.layoutTurn(
                    messages,
                    liveStart,
                    messages.length,
                    width,
                    true,
                    options
                )
                return [...last.segments, liveLines]
            }
        }

        const turns = splitTurns(messages)
        let settledCount = turns.length

        let liveLines: FormattedLine[] | null = null
        if (live && turns.length > 0) {
            const [start, end] = turns[turns.length - 1]!
            liveLines = this.layoutTurn(messages, start, end, width, true, options)
            settledCount--
        }

        const tail = options.tailLines
        let have = liveLines?.length ?? 0
        const reversed: FormattedLine[][] = []
        this.pending = null
        for (let t = settledCount - 1; t >= 0; t--) {
            const [start, end] = turns[t]!
            const lines =
                tail === undefined || have < tail
                    ? this.settledTurn(messages, start, end, width, options)
                    : this.cachedTurn(messages, start, end, width)
            if (!lines) {
                this.pending = { messages, width, settledCount }
                break
            }
            reversed.push(lines)
            have += lines.length
        }

        const segments = reversed.reverse()
        const settledEnd = settledCount > 0 ? turns[settledCount - 1]![1] : 0
        if (!this.pending && settledEnd > 0) {
            this.lastSettled = {
                entry: makeTurnEntry(messages, 0, settledEnd, width, []),
                end: settledEnd,
                segments: segments.slice(),
            }
        }
        if (liveLines) segments.push(liveLines)
        return segments
    }
}
