import { THEME } from '../../theme'
import { latestThoughtSentence } from '../../utils/thought'
import {
    agentRole,
    classifyTool,
    exploreTarget,
    middleEllipsis,
    parseToolInput,
    toolCommandText,
    toolFilePath,
    webQuery,
} from '../../utils/tool-kind'

import type { FormattedLine, TextSegment } from './markdown'
import type { MessageItem } from './message-list-view'

export type ActivityPhase =
    | 'thinking'
    | 'writing'
    | 'exploring'
    | 'editing'
    | 'running'
    | 'searching web'
    | 'delegating'
    | 'compacting'
    | 'retrying'
    | 'waiting'

export interface RetryInfo {
    reason: string
    attempt: number
    max?: number
    /** Epoch ms of the next attempt, when the status gave a delay */
    nextAt?: number
}

export interface ActivityInput {
    messages: MessageItem[]
    isStreaming: boolean
    statusMessage?: string
    statusSetAt?: number
    /** An approval, plan or question prompt is open and the turn waits for the user */
    waitingForUser: boolean
    now: number
    turnStartedAt: number
    /** Time spent waiting for the user in this turn, not counted as December's time */
    pausedMs: number
    pauseStartedAt?: number
    /** Last time a token, chunk or tool update arrived */
    lastActivityAt: number
    /** First token of this turn, 0 when none has arrived */
    firstTokenAt: number
    /** No token has arrived yet in this session */
    isColdStart: boolean
    tip?: string | null
    queued?: string[]
    /** Context size, named in the compacting sentence (L13) */
    contextTokens?: number
    /** Retry from the agent's typed AgentRetry event (F1); the status text is the fallback */
    retry?: RetryInfo
    /** Checklist from an approved /plan, shown until the agent sends update_plan (F2) */
    seededPlan?: PlanItem[]
    /** A panel is open: Esc closes it, so the hint slot stays empty (M27) */
    hideHint?: boolean
    reduceMotion?: boolean
    /** CJK locales draw some glyphs 2 cells wide, so the glyph set changes */
    wideAmbiguous?: boolean
}

/** Breathing ✱ (L1-A) */
const STAR_FRAMES = ['·', '∙', '∗', '✱', '✲', '✱', '∗', '∙']
/** `· ∙ ∗` are ambiguous width in Unicode; CJK terminals draw them 2 cells wide (L1.3) */
const STAR_FRAMES_NARROW = ['.', '*', '✱', '✲', '✱', '*']

const STALL_MS = 20_000
const PROVIDER_WAIT_MS = 8_000
const LONG_PHASE_MS = 120_000
const DETAIL_REFRESH_MS = 12_000
/** The thinking topic and the live thought line change at most this often (L21) */
const THOUGHT_DWELL_MS = 2_500
const FIRST_HINT_MS = 5_000
const HINT_ROTATE_MS = 4_000

/**
 * L0.6 hints for the phase, then the tip. No "tip:" label (L18-A). "esc to interrupt" is not
 * a hint: it lives in the prompt placeholder during a turn (L21).
 */
const HINTS: Record<string, string[]> = {
    default: ['/fork branches this chat', '/btw asks a side question'],
    thinking: ['@ attaches a file', '/btw asks a side question'],
    editing: ['/diff to review changes', '/rewind undoes edits'],
    running: ['ctrl+b to background', '/tasks lists background work'],
    delegating: ['ctrl+t to see agents', '/btw asks a side question'],
}

/** W1-D: a plain sentence for the phase */
export function activitySentence(phase: ActivityPhase, detail?: string, stalled = false): string {
    if (stalled) return 'Still waiting on the provider'
    switch (phase) {
        case 'thinking':
            // L21-B: a topic that starts with a verb is the sentence itself
            if (detail && GERUND_WORDS.has(detail.split(' ')[0]!.toLowerCase())) {
                return detail.charAt(0).toUpperCase() + detail.slice(1)
            }
            return detail ? `Thinking about ${detail}` : 'Thinking'
        case 'writing':
            return 'Writing the reply'
        case 'exploring':
            return detail ? `Looking through ${detail}` : 'Looking through the code'
        case 'editing':
            return detail ? `Editing ${detail}` : 'Editing files'
        case 'running':
            return detail ? `Running ${detail}` : 'Running a command'
        case 'searching web':
            return detail ? `Searching the web for ${detail}` : 'Searching the web'
        case 'delegating':
            return detail ? `Working with ${detail}` : 'Working with agents'
        case 'compacting':
            return `Compacting ${detail || 'the conversation'}`
        case 'retrying':
            return 'Retrying the request'
        case 'waiting':
            return 'Waiting for you'
    }
}

/** Reads the agent's retry status text, e.g. "Opus rate limit hit. Retrying in 4s... (attempt 2/5)" */
export function parseRetryStatus(
    message: string | undefined,
    setAt = Date.now()
): RetryInfo | null {
    if (!message) return null
    const hit = message.match(
        /^(.+?) (high demand|rate limit) hit\. Retrying in (\d+)s.*\(attempt (\d+)\/(\d+)\)/i
    )
    if (hit) {
        return {
            reason: `${hit[1]} ${hit[2]}`,
            attempt: Number(hit[4]),
            max: Number(hit[5]),
            nextAt: setAt + Number(hit[3]) * 1000,
        }
    }
    const drop = message.match(
        /^(.+?) connection timed out or closed early\. Retrying.*\(attempt (\d+)\/(\d+)\)/i
    )
    if (drop) {
        return {
            reason: `${drop[1]} connection dropped`,
            attempt: Number(drop[2]),
            max: Number(drop[3]),
        }
    }
    const connect = message.match(/^Connecting to (.+?)\.\.\. \(attempt (\d+)\)/i)
    if (connect && Number(connect[2]) > 1) {
        return { reason: `connecting to ${connect[1]}`, attempt: Number(connect[2]) }
    }
    return null
}

function currentTurn(messages: MessageItem[]): MessageItem[] {
    let start = messages.length
    while (start > 0 && messages[start - 1]?.role !== 'user') start--
    return messages.slice(start)
}

function shortTarget(text: string, max = 40): string {
    return middleEllipsis(text, max)
}

const GERUNDS: Record<string, string> = {
    check: 'checking',
    look: 'looking',
    find: 'finding',
    read: 'reading',
    update: 'updating',
    add: 'adding',
    fix: 'fixing',
    make: 'making',
    see: 'seeing',
    verify: 'verifying',
    understand: 'understanding',
    figure: 'figuring',
    determine: 'determining',
    consider: 'considering',
    write: 'writing',
    review: 'reviewing',
    investigate: 'investigating',
    examine: 'examining',
    analyze: 'analyzing',
    explore: 'exploring',
    search: 'searching',
    open: 'opening',
    run: 'running',
    test: 'testing',
    move: 'moving',
    change: 'changing',
    create: 'creating',
    remove: 'removing',
    use: 'using',
    plan: 'planning',
    compare: 'comparing',
    confirm: 'confirming',
    trace: 'tracing',
    inspect: 'inspecting',
    debug: 'debugging',
    implement: 'implementing',
    refactor: 'refactoring',
    identify: 'identifying',
    locate: 'locating',
    evaluate: 'evaluating',
    design: 'designing',
    map: 'mapping',
    outline: 'outlining',
    assess: 'assessing',
    draft: 'drafting',
}
const GERUND_WORDS = new Set(Object.values(GERUNDS))

/**
 * Topic for line 1 (L21): the newest bold header of the thought, with a leading verb turned
 * into its -ing form. No header gives no topic: a raw sentence does not make a good topic.
 */
export function thoughtTopic(content: string): string {
    const headers = [...content.matchAll(/\*\*([^*\n]{3,60})\*\*/g)].map((m) =>
        m[1]!.trim().replace(/[.:]+$/, '')
    )
    let topic = headers.length > 0 ? headers[headers.length - 1]! : ''
    if (!topic) return ''
    const [first, ...rest] = topic.split(' ')
    const gerund = GERUNDS[first!.toLowerCase()]
    if (gerund) topic = [gerund, ...rest].join(' ')
    // Keep acronyms and names ("TTL", "API") as written; lowercase an ordinary first word
    if (!/^[A-Z0-9]{2,}/.test(topic)) topic = topic.charAt(0).toLowerCase() + topic.slice(1)
    return topic.length > 48 ? `${topic.slice(0, 47)}…` : topic
}

/** The phase and its detail from the live messages of the current turn */
export function detectPhase(
    input: ActivityInput
): { phase: ActivityPhase; detail?: string; retry?: RetryInfo; thought?: string } | null {
    if (!input.isStreaming && !input.waitingForUser) return null
    if (input.waitingForUser) return { phase: 'waiting' }

    const retry = input.retry ?? parseRetryStatus(input.statusMessage, input.statusSetAt)
    if (retry) return { phase: 'retrying', detail: retry.reason, retry }
    if (input.statusMessage && /compact/i.test(input.statusMessage)) {
        const tokens = input.contextTokens
        return {
            phase: 'compacting',
            detail: tokens ? `${formatTokenCount(tokens)} tokens` : undefined,
        }
    }

    const turn = currentTurn(input.messages)
    const running = turn.filter((m) => m.toolCall?.status === 'running')
    if (running.length > 0) {
        const byKind = (kind: string) =>
            running.filter((m) => classifyTool(m.toolCall?.name, m.toolCall?.command) === kind)
        const agents = byKind('agent')
        if (agents.length > 0) {
            if (agents.length > 1) return { phase: 'delegating', detail: `${agents.length} agents` }
            const tc = agents[0]!.toolCall!
            return { phase: 'delegating', detail: agentRole(parseToolInput(tc.input), tc.command) }
        }
        const commands = byKind('command')
        if (commands.length > 0) {
            const tc = commands[commands.length - 1]!.toolCall!
            return {
                phase: 'running',
                detail:
                    shortTarget(toolCommandText(parseToolInput(tc.input), tc.command)) || undefined,
            }
        }
        const edits = [...byKind('edit'), ...byKind('write')]
        if (edits.length > 0) {
            const tc = edits[edits.length - 1]!.toolCall!
            const path = toolFilePath(parseToolInput(tc.input), tc.command)
            return { phase: 'editing', detail: path ? shortTarget(path) : undefined }
        }
        const web = [...byKind('web'), ...byKind('fetch')]
        if (web.length > 0) {
            const tc = web[web.length - 1]!.toolCall!
            const q = webQuery(parseToolInput(tc.input), tc.command)
            return { phase: 'searching web', detail: q ? shortTarget(q) : undefined }
        }
        const explore = byKind('explore')
        if (explore.length > 0) {
            const tc = explore[explore.length - 1]!.toolCall!
            const target = exploreTarget(tc.name, parseToolInput(tc.input), tc.command)
            return { phase: 'exploring', detail: target ? shortTarget(target) : undefined }
        }
        const tc = running[running.length - 1]!.toolCall!
        return { phase: 'running', detail: tc.name || undefined }
    }

    const last = turn[turn.length - 1]
    if (last?.role === 'thinking' && last.isStreaming) {
        return {
            phase: 'thinking',
            detail: thoughtTopic(last.content || '') || undefined,
            thought: last.content || undefined,
        }
    }
    if (last?.role === 'assistant' && last.isStreaming && last.content) return { phase: 'writing' }
    return { phase: 'thinking' }
}

export function hintFor(
    phase: ActivityPhase,
    phaseElapsedMs: number,
    now: number,
    tip?: string | null
): string {
    if (phase === 'retrying' || phase === 'waiting') return ''
    const base = HINTS[phase] ?? HINTS.default!
    const list = tip ? [...base, tip] : base
    // Hints appear after the first 5s of a phase and then change every 4s
    if (phaseElapsedMs < FIRST_HINT_MS || list.length === 0) return ''
    return list[Math.floor(now / HINT_ROTATE_MS) % list.length]!
}

function formatTokenCount(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
    if (n >= 1_000) return `${Math.round(n / 1_000)}k`
    return String(n)
}

export function formatElapsed(ms: number): string {
    const s = Math.max(0, Math.floor(ms / 1000))
    return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`
}

/** One shimmer band sweeping across the text (L3) */
function shimmer(text: string, now: number, base: string, reduceMotion?: boolean): TextSegment[] {
    if (reduceMotion) return [{ text, style: { fg: base } }]
    const n = text.length
    const pos = (Math.floor(now / 60) % (n + 14)) - 3
    const segments: TextSegment[] = []
    let run = ''
    let runColor = base
    for (let i = 0; i < n; i++) {
        const d = Math.abs(i - pos)
        const color = d === 0 ? THEME.colors.highlight : d === 1 ? THEME.colors.text : base
        if (color !== runColor && run) {
            segments.push({ text: run, style: { fg: runColor } })
            run = ''
        }
        runColor = color
        run += text[i]
    }
    if (run) segments.push({ text: run, style: { fg: runColor } })
    return segments
}

export interface PlanItem {
    text: string
    status: 'pending' | 'in_progress' | 'done'
}

/** Checklist items from a plan's numbered steps; the first step is current (F2) */
export function planStepsFromText(planText: string): PlanItem[] {
    const steps = [...planText.matchAll(/^\s*\d+[.)]\s+(.+)$/gm)]
        .map((m) => m[1]!.replace(/\*\*|`/g, '').trim())
        .filter(Boolean)
    return steps.map((text, i) => ({
        text: text.length > 72 ? `${text.slice(0, 71)}…` : text,
        status: i === 0 ? 'in_progress' : 'pending',
    }))
}

/** The latest update_plan call of the current turn (L19) */
export function currentPlan(messages: MessageItem[]): PlanItem[] {
    const turn = currentTurn(messages)
    for (let i = turn.length - 1; i >= 0; i--) {
        const tc = turn[i]?.toolCall
        if (tc && classifyTool(tc.name, tc.command) === 'plan') {
            const input = parseToolInput(tc.input)
            const items = Array.isArray(input.items)
                ? input.items
                : Array.isArray(input.plan)
                  ? input.plan
                  : []
            return items
                .filter((item: any) => item && typeof item.text === 'string')
                .map((item: any) => ({
                    text: item.text,
                    status:
                        item.status === 'done' || item.status === 'completed'
                            ? 'done'
                            : item.status === 'in_progress'
                              ? 'in_progress'
                              : 'pending',
                }))
        }
    }
    return []
}

function planLines(items: PlanItem[], width: number): FormattedLine[] {
    if (items.length === 0) return []
    const MAX_ROWS = 5
    const lines: FormattedLine[] = []
    let visible = items
    let hidden = 0
    if (items.length > MAX_ROWS) {
        const done = items.filter((i) => i.status === 'done')
        const rest = items.filter((i) => i.status !== 'done')
        if (done.length > 0) {
            lines.push([{ text: `    ✓ ${done.length} done`, style: { fg: THEME.colors.dim } }])
        }
        const budget = MAX_ROWS - lines.length
        // Keep the 5-row limit: when steps do not fit, the last row says how many are hidden
        visible = rest.length > budget ? rest.slice(0, budget - 1) : rest
        hidden = rest.length - visible.length
    }
    const max = Math.max(10, width - 8)
    for (const item of visible) {
        const text = item.text.length > max ? `${item.text.slice(0, max - 1)}…` : item.text
        if (item.status === 'done') {
            lines.push([{ text: `    ✓ ${text}`, style: { fg: THEME.colors.dim } }])
        } else if (item.status === 'in_progress') {
            lines.push([
                { text: '    ▸ ', style: { fg: THEME.colors.brand } },
                { text, style: { fg: THEME.colors.text } },
            ])
        } else {
            lines.push([{ text: `    ○ ${text}`, style: { fg: THEME.colors.dim } }])
        }
    }
    if (hidden > 0) {
        lines.push([{ text: `    ○ … ${hidden} more`, style: { fg: THEME.colors.dim } }])
    }
    return lines
}

/**
 * Keeps the phase start and the detail latch between frames, so the sentence only
 * changes on a phase change or every 12s (W2-C).
 */
export class ActivityTracker {
    private phase: ActivityPhase | null = null
    private phaseSince = 0
    private detail: string | undefined
    private detailSince = 0
    private thought: string | undefined
    private thoughtSince = 0

    reset(): void {
        this.phase = null
        this.phaseSince = 0
        this.detail = undefined
        this.detailSince = 0
        this.thought = undefined
        this.thoughtSince = 0
    }

    /** Every line of the activity block: the activity line, the plan, queued messages */
    getLines(input: ActivityInput, width: number): FormattedLine[] {
        const { turn, queued } = this.getBlock(input, width)
        return [...turn, ...queued]
    }

    /**
     * The activity block split by where it is drawn (L20): `turn` is the activity line and
     * the plan, drawn at the end of the chat; `queued` stays above the prompt box.
     */
    getBlock(
        input: ActivityInput,
        width: number
    ): { turn: FormattedLine[]; queued: FormattedLine[] } {
        const detected = detectPhase(input)
        if (!detected) {
            this.reset()
            return { turn: [], queued: [] }
        }
        const { now } = input
        if (detected.phase !== this.phase) {
            this.phase = detected.phase
            this.phaseSince = now
            this.detail = detected.detail
            this.detailSince = now
        } else if (
            detected.detail !== this.detail &&
            now - this.detailSince >=
                (detected.phase === 'thinking' ? THOUGHT_DWELL_MS : DETAIL_REFRESH_MS)
        ) {
            this.detail = detected.detail
            this.detailSince = now
        } else if (!this.detail && detected.detail) {
            this.detail = detected.detail
            this.detailSince = now
        }

        // L21: line 2 is the live thought, the latest sentence held for 2.5s, while thinking
        const sentence =
            detected.phase === 'thinking' && detected.thought
                ? latestThoughtSentence(detected.thought)
                : ''
        if (!sentence) {
            this.thought = undefined
        } else if (
            sentence !== this.thought &&
            (!this.thought || now - this.thoughtSince >= THOUGHT_DWELL_MS)
        ) {
            this.thought = sentence
            this.thoughtSince = now
        }

        const lines: FormattedLine[] = [
            this.activityLine(input, detected.phase, detected.retry, width, Boolean(this.thought)),
        ]
        if (this.thought) {
            const room = Math.max(10, width - 4)
            const text =
                this.thought.length > room ? `${this.thought.slice(0, room - 1)}…` : this.thought
            lines.push([{ text: `    ${text}`, style: { fg: THEME.colors.dim } }])
        }
        const plan = currentPlan(input.messages)
        lines.push(...planLines(plan.length > 0 ? plan : (input.seededPlan ?? []), width))
        const queuedLines: FormattedLine[] = []
        const queued = (input.queued ?? []).filter(Boolean)
        if (queued.length > 0) {
            const max = Math.max(10, width - 8)
            for (const text of queued.slice(0, 2)) {
                const flat = text.replace(/\s+/g, ' ').trim()
                queuedLines.push([
                    {
                        text: `    ${THEME.glyphs.prompt} ${flat.length > max ? `${flat.slice(0, max - 1)}…` : flat}`,
                        style: { fg: THEME.colors.dim },
                    },
                ])
            }
            queuedLines.push([
                {
                    text: '      queued · sends when this turn ends · ↑ to edit',
                    style: { fg: THEME.colors.dim },
                },
            ])
        }
        return { turn: lines, queued: queuedLines }
    }

    private activityLine(
        input: ActivityInput,
        phase: ActivityPhase,
        retry: RetryInfo | undefined,
        width: number,
        /** The live thought shows on line 2, so line 1 has no hint (L21) */
        hasThought = false
    ): FormattedLine {
        const { now } = input
        const pausedNow = input.pauseStartedAt ? now - input.pauseStartedAt : 0
        const activeMs = Math.max(0, now - input.turnStartedAt - input.pausedMs - pausedNow)

        if (phase === 'waiting') {
            return [
                { text: '✱ ', style: { fg: THEME.colors.warning } },
                { text: 'Waiting for you', style: { fg: THEME.colors.text } },
                ...(activeMs >= 3000
                    ? [
                          {
                              text: `  paused at ${formatElapsed(activeMs)}`,
                              style: { fg: THEME.colors.dim },
                          },
                      ]
                    : []),
            ]
        }

        const noTokenYet = input.firstTokenAt === 0
        const quietMs = now - Math.max(input.lastActivityAt, input.turnStartedAt)
        const canStall = phase === 'thinking' || phase === 'writing'
        const stalled = canStall && quietMs >= STALL_MS
        const warn = stalled || phase === 'retrying'

        const frames = input.wideAmbiguous ? STAR_FRAMES_NARROW : STAR_FRAMES
        const glyph = input.reduceMotion
            ? '✱'
            : frames[Math.floor(now / (stalled ? 300 : 130)) % frames.length]!

        let sentence = activitySentence(
            phase,
            phase === 'retrying' ? undefined : this.detail,
            stalled
        )
        if (phase === 'thinking' && noTokenYet && input.isColdStart && !stalled && !hasThought)
            sentence = 'Warming up'

        const meta: string[] = []
        // L11: a retry names its reason after the sentence, then the countdown and attempt
        const detailText = phase === 'retrying' && retry ? ` · ${retry.reason}` : ''
        if (activeMs >= 3000 && phase !== 'retrying') meta.push(formatElapsed(activeMs))
        if (phase === 'retrying' && retry) {
            if (retry.nextAt !== undefined) {
                meta.push(`next try in ${Math.max(0, Math.ceil((retry.nextAt - now) / 1000))}s`)
            }
            meta.push(
                retry.max ? `attempt ${retry.attempt} of ${retry.max}` : `attempt ${retry.attempt}`
            )
        } else if (stalled) {
            meta.push(`no response for ${Math.floor(quietMs / 1000)}s`)
        } else if (noTokenYet && activeMs >= PROVIDER_WAIT_MS) {
            meta.push('waiting on provider')
        } else if (now - this.phaseSince >= LONG_PHASE_MS) {
            meta.push('still on it')
        }
        const hint =
            input.hideHint || hasThought
                ? ''
                : hintFor(phase, now - this.phaseSince, now, input.tip)

        // Narrow terminals (S24): drop the hint, then shorten the sentence, then drop the time
        const available = Math.max(10, width)
        const glyphWidth = 2
        const fits = (s: string, m: string) =>
            glyphWidth + s.length + 1 + detailText.length + (m ? 2 + m.length : 0) <= available
        let metaText = [...meta, hint].filter(Boolean).join(' · ')
        if (!fits(sentence, metaText)) metaText = meta.join(' · ')
        if (!fits(sentence, metaText)) {
            const room =
                available -
                glyphWidth -
                1 -
                detailText.length -
                (metaText ? 2 + metaText.length : 0)
            if (room >= 12) {
                sentence = `${sentence.slice(0, room - 1)}…`
            } else {
                metaText = ''
                const room2 = available - glyphWidth - 1 - detailText.length
                if (sentence.length > room2) {
                    sentence = `${sentence.slice(0, Math.max(4, room2 - 1))}…`
                }
            }
        }

        const base = warn ? THEME.colors.warning : THEME.colors.muted
        return [
            { text: `${glyph} `, style: { fg: warn ? THEME.colors.warning : THEME.colors.brand } },
            ...shimmer(`${sentence}…`, now, base, input.reduceMotion),
            ...(detailText ? [{ text: detailText, style: { fg: THEME.colors.dim } }] : []),
            ...(metaText ? [{ text: `  ${metaText}`, style: { fg: THEME.colors.dim } }] : []),
        ]
    }
}
