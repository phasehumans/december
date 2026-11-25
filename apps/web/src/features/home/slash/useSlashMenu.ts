import { parsePullRequestUrl, buildReviewPrompt } from '@december/shared/review'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
    buildSlashItems,
    listSlashCommands,
    parseArgCommand,
    parseOpenCommand,
    parseRenameCommand,
    parseSlashToken,
    replaceSlashToken,
    type SlashItem,
    type SlashSkill,
} from './slashModel'

import type { SlashCommand, SlashScope } from './commands'
import type { PromptInputSubmitOptions } from '@/features/home/types'

import { useAppStore } from '@/app/store'
import { isConnectionsDemoActive } from '@/features/connections/lib/connectionsDemo'
import { usePromptBoxConnections } from '@/features/home/api/promptBoxConnections'
import { saveHomeDraft } from '@/features/home/draft'
import { usePromptConfig } from '@/features/home/promptConfig'
import {
    requestWorkspaceFile,
    requestWorkspaceTab,
} from '@/features/preview/lib/workspaceTabRequest'
import { profileAPI } from '@/features/profile/api/profile'
import { useGithubConnection } from '@/features/profile/hooks/useGithubConnection'
import { sessionAPI } from '@/features/sessions/api/session'
import { ApiError } from '@/shared/api/client'
import { getWebUrl } from '@/shared/config/env'
import {
    NEW_SESSION_REQUEST_EVENT,
    OPEN_SEARCH_EVENT,
    OPEN_SESSION_EVENT,
    TOGGLE_VOICE_EVENT,
} from '@/shared/lib/appEvents'
import { formatTokenCount } from '@/shared/lib/format'

/** one row of a list that a command shows in the menu (/model, /effort, /switch, /check) */
export interface SlashPickOption {
    id: string
    label: string
    hint?: string
    selected?: boolean
    /** the row shows a sample value (preview only), so it carries the Demo pill */
    demo?: boolean
    /** what Enter or a click does. a row with no pick only shows a fact */
    pick?: () => void
}

interface SlashSubMenu {
    title: string
    options: SlashPickOption[]
    emptyLabel?: string
    /** a longer answer shown above the rows (/btw, /compact) */
    text?: string
    loading?: boolean
}

/** a command typed in full and sent with Enter */
export interface SlashSubmitResult {
    /** empty the box */
    clear: boolean
    /** send this prompt instead, as a normal prompt (/review on Home) */
    submit?: { prompt: string; options: Partial<PromptInputSubmitOptions> }
}

// commands that take text after the name, sent with Enter
const TYPED_COMMANDS = new Set([
    'rename',
    'open',
    'compact',
    'btw',
    'codesearch',
    'review',
    'learn',
    'permissions',
])

const errorText = (error: unknown, fallback: string) =>
    error instanceof ApiError && error.message ? error.message : fallback

const formatElapsed = (seconds: number) =>
    seconds < 60
        ? `${seconds}s`
        : seconds < 3600
          ? `${Math.floor(seconds / 60)}m`
          : `${Math.floor(seconds / 3600)}h`

/** an MCP server in /check, with what the last session found when it connected */
interface CheckMcpServer {
    name: string
    status: string
    lastError?: string | null
    toolCount?: number
}

const mcpCheckHint = (server: CheckMcpServer) => {
    if (server.status === 'connected') {
        const tools = server.toolCount ?? 0
        return tools > 0 ? `Connected · ${tools} ${tools === 1 ? 'tool' : 'tools'}` : 'Connected'
    }
    if (server.status === 'needs-signin') return 'Sign in'
    if (server.status === 'error') return server.lastError || 'Error'
    // no session has used the server yet
    return 'Not used yet'
}

interface SlashChip {
    id: string
    label: string
}

type SubKind = 'model' | 'effort' | 'switch' | 'skills' | 'check'

interface UseSlashMenuArgs {
    input: string
    /** caret position in the input */
    cursor: number
    scope: SlashScope
    isAuthenticated?: boolean
    onOpenAuth?: () => void
    /** writes the prompt text and puts the caret at the given position */
    setInput: (value: string, cursor: number) => void
    /** choices for /model, /effort and /switch, built by the prompt controller */
    modelOptions: SlashPickOption[]
    effortOptions: SlashPickOption[]
    sourceOptions: SlashPickOption[]
    /** opens a page of the app (commands such as /mcp) */
    onNavigate?: (path: string) => void
}

const NOTE_MS = 2500
const SUB_TITLES: Record<SubKind, string> = {
    model: 'Model',
    effort: 'Effort',
    switch: 'Switch',
    skills: 'Skills',
    check: 'Check',
}

const hasSpeechRecognition = () =>
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)

/**
 * The slash menu of a prompt box: which rows show, which one is selected, and what a
 * pick does. The skills are the ones turned on for the account.
 */
export const useSlashMenu = ({
    input,
    cursor,
    scope,
    isAuthenticated,
    onOpenAuth,
    setInput,
    modelOptions,
    effortOptions,
    sourceOptions,
    onNavigate,
}: UseSlashMenuArgs) => {
    const queryClient = useQueryClient()
    const [demo] = useState(isConnectionsDemoActive)

    const connections = usePromptBoxConnections(Boolean(isAuthenticated))
    // the preview has no server behind it: /check reads its sample MCP servers
    const demoMcps = connections.mcps
    const pluginsOff = usePromptConfig((s) => s.pluginsOff)
    const planFirst = usePromptConfig((s) => s.values.planFirst)
    const setConfigValue = usePromptConfig((s) => s.setValue)
    const previewState = useAppStore((s) => s.previewSession?.state)

    // a plugin switched off for this session takes its skills out of the list
    const skills = useMemo<SlashSkill[]>(
        () =>
            connections.skills.filter(
                (skill) => !(skill.plugin && pluginsOff.includes(skill.plugin))
            ),
        [connections.skills, pluginsOff]
    )

    const [selectedIndex, setSelectedIndex] = useState(0)
    const [subKind, setSubKind] = useState<SubKind | null>(null)
    const [dismissedInput, setDismissedInput] = useState<string | null>(null)
    const [skillChips, setSkillChips] = useState<string[]>([])
    const [helpTab, setHelpTab] = useState<'commands' | 'shortcuts' | null>(null)
    const [note, setNote] = useState<string | null>(null)
    // the answer of a command that asked the server (/context, /rewind, /btw ...)
    const [result, setResult] = useState<SlashSubMenu | null>(null)
    const noteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    const token = useMemo(() => parseSlashToken(input.slice(0, cursor)), [input, cursor])
    const hasToken = token !== null
    const query = token?.query ?? ''

    // no choices stay open after the menu closes
    useEffect(() => {
        if (!hasToken) setSubKind(null)
    }, [hasToken])

    const items = useMemo<SlashItem[]>(() => {
        if (!token) return []
        return buildSlashItems({ token, scope, skills }).filter(
            // the microphone needs a browser that can listen
            (item) =>
                item.type !== 'command' || item.command.name !== 'voice' || hasSpeechRecognition()
        )
    }, [token, scope, skills])

    // the checks only run while the /check list is open: one answer from the server
    const isChecking = subKind === 'check' && Boolean(isAuthenticated)
    const github = useGithubConnection(isChecking)
    const checkSessionId = scope === 'session' ? useAppStore.getState().activeProjectId : null
    const { data: check } = useQuery({
        queryKey: ['setup-check', checkSessionId],
        queryFn: () => sessionAPI.getCheck(checkSessionId ?? undefined),
        enabled: isChecking,
        staleTime: 10_000,
    })

    const addSkillChip = useCallback(
        (name: string) => setSkillChips((prev) => (prev.includes(name) ? prev : [...prev, name])),
        []
    )

    const checkOptions = useMemo<SlashPickOption[]>(() => {
        if (subKind !== 'check') return []
        const checking = 'Checking...'
        const rows: SlashPickOption[] = [
            {
                id: 'github',
                label: 'GitHub',
                hint: !check ? checking : check.github.connected ? 'Connected' : 'Not connected',
                pick:
                    check && !check.github.connected
                        ? () => window.location.assign(github.connectUrl)
                        : undefined,
            },
            {
                id: 'credits',
                label: 'December credits',
                hint: !check
                    ? checking
                    : `$ ${(Math.max(0, check.credits.balanceInCents) / 100).toFixed(2)}`,
                pick:
                    check && !check.credits.enoughToStart
                        ? () => onNavigate?.('/settings/billing')
                        : undefined,
            },
            {
                id: 'keys',
                label: 'Your keys',
                hint: !check
                    ? checking
                    : check.keys.length === 0
                      ? 'None saved'
                      : `${check.keys.length} saved`,
                pick: () => onNavigate?.('/settings/models'),
            },
        ]
        if (check?.gitlab.connected) {
            rows.push({ id: 'gitlab', label: 'GitLab', hint: 'Connected' })
        }
        // the MCP servers that are turned on. the preview has no server behind it, so it
        // lists its sample servers
        const mcpServers: CheckMcpServer[] = demo
            ? demoMcps
            : (check?.mcpServers ?? []).filter((server) => server.enabled)
        mcpServers.forEach((server) =>
            rows.push({
                id: `mcp:${server.name}`,
                label: `MCP: ${server.name}`,
                hint: mcpCheckHint(server),
                ...(demo ? { demo: true } : {}),
                // a server that needs a fix opens the MCP servers page
                pick:
                    server.status === 'error' || server.status === 'needs-signin'
                        ? () => onNavigate?.('/settings/connections/mcps')
                        : undefined,
            })
        )
        const machine = check?.machine
        const machineState = machine?.sandboxStatus ?? machine?.vmStatus ?? previewState
        if (scope === 'session' && machineState) {
            const state = String(machineState).toLowerCase()
            rows.push({
                id: 'machine',
                label: 'Session machine',
                hint: state.charAt(0).toUpperCase() + state.slice(1),
            })
        }
        return rows
    }, [subKind, check, github.connectUrl, demo, demoMcps, scope, previewState, onNavigate])

    const sub = useMemo<SlashSubMenu | null>(() => {
        if (result) return result
        if (!subKind) return null
        const title = SUB_TITLES[subKind]
        if (subKind === 'model') return { title, options: modelOptions }
        if (subKind === 'effort') return { title, options: effortOptions }
        if (subKind === 'switch') return { title, options: sourceOptions }
        if (subKind === 'check') return { title, options: checkOptions }
        return {
            title,
            emptyLabel: 'No skills yet.',
            options: skills.map((skill) => ({
                id: skill.name,
                label: `/${skill.name}`,
                hint: skill.plugin,
                pick: () => addSkillChip(skill.name),
            })),
        }
    }, [
        result,
        subKind,
        modelOptions,
        effortOptions,
        sourceOptions,
        checkOptions,
        skills,
        addSkillChip,
    ])

    // a slash in the middle of a sentence only opens the menu when something matches
    const isOpen =
        result !== null ||
        (token !== null &&
            dismissedInput !== input &&
            (subKind !== null || token.atStart || items.length > 0))

    // a command picked from the + menu types its name and selects a choice in one step.
    // the name is a new query, and this flag keeps that choice selected
    const keepIndexRef = useRef(false)
    useEffect(() => {
        if (keepIndexRef.current) {
            keepIndexRef.current = false
            return
        }
        setSelectedIndex(0)
    }, [query])

    useEffect(
        () => () => {
            if (noteTimerRef.current) clearTimeout(noteTimerRef.current)
        },
        []
    )

    const flash = useCallback((text: string) => {
        setNote(text)
        if (noteTimerRef.current) clearTimeout(noteTimerRef.current)
        noteTimerRef.current = setTimeout(() => setNote(null), NOTE_MS)
    }, [])

    /** takes the slash word out of the text (or swaps it) and returns the new text */
    const takeToken = (replacement = '') => {
        if (!token) return input
        const next = replaceSlashToken(input, cursor, token, replacement)
        setInput(next.value, next.cursor)
        return next.value
    }

    const copyLastAnswer = async () => {
        const messages = useAppStore.getState().messages
        const last = [...messages]
            .reverse()
            .find((message) => message.role === 'assistant' && message.content?.trim())
        if (!last) {
            flash('Nothing to copy yet.')
            return
        }
        try {
            await navigator.clipboard.writeText(last.content)
            flash('Copied.')
        } catch (error) {
            console.error('Failed to copy the last answer:', error)
            flash('Copy failed.')
        }
    }

    const renameSession = async (title: string) => {
        const state = useAppStore.getState()
        const sessionId = state.activeProjectId
        if (!sessionId) return
        try {
            await sessionAPI.renameSession(sessionId, title)
            state.setActiveProjectName(title)
            queryClient.invalidateQueries({ queryKey: ['sessions'] })
            flash('Session renamed.')
        } catch (error) {
            console.error('Failed to rename session:', error)
            flash('Rename failed.')
        }
    }

    const activeSessionId = () => useAppStore.getState().activeProjectId

    /** shows a command's answer in the menu: "Loading..." first, then the rows */
    const showResult = (title: string, load: () => Promise<Omit<SlashSubMenu, 'title'>>) => {
        setSubKind(null)
        setSelectedIndex(0)
        setResult({ title, options: [], loading: true, emptyLabel: 'Loading...' })
        load()
            .then((loaded) => setResult({ title, ...loaded }))
            .catch((error: unknown) => {
                console.error(`/${title.toLowerCase()} failed:`, error)
                setResult({
                    title,
                    options: [],
                    emptyLabel: errorText(error, 'Something went wrong. Try again.'),
                })
            })
    }

    /** reloads the session (or opens another one) with its messages */
    const openSession = (sessionId: string) =>
        window.dispatchEvent(new CustomEvent(OPEN_SESSION_EVENT, { detail: { sessionId } }))

    const showContext = (sessionId: string) =>
        showResult('Context', async () => {
            const context = await sessionAPI.getContext(sessionId)
            return {
                options: [
                    {
                        id: 'used',
                        label: 'In use',
                        hint: context.limitTokens
                            ? `${formatTokenCount(context.usedTokens)} of ${formatTokenCount(context.limitTokens)} (${context.percent}%)`
                            : `${formatTokenCount(context.usedTokens)} tokens`,
                    },
                    { id: 'messages', label: 'Messages', hint: String(context.messages) },
                    ...(context.model
                        ? [{ id: 'model', label: 'Model', hint: context.model }]
                        : []),
                    { id: 'compact', label: 'Compact now', pick: () => runCompact(sessionId) },
                    { id: 'clear', label: 'Clear context', pick: () => runClear(sessionId) },
                ],
            }
        })

    const runCompact = (sessionId: string, focus?: string) =>
        showResult('Compact', async () => {
            const done = await sessionAPI.compactSession(sessionId, focus)
            openSession(sessionId)
            return {
                text: done.summary,
                options: [
                    {
                        id: 'used',
                        label: 'Context in use',
                        hint: `${formatTokenCount(done.context.usedTokens)} tokens`,
                    },
                ],
            }
        })

    const runClear = async (sessionId: string) => {
        try {
            await sessionAPI.clearSession(sessionId)
            flash('Context cleared. The next message starts fresh.')
        } catch (error) {
            flash(errorText(error, 'Clear failed.'))
        }
    }

    const runFork = async (sessionId: string) => {
        try {
            const { session } = await sessionAPI.forkSession(sessionId)
            queryClient.invalidateQueries({ queryKey: ['sessions'] })
            openSession(session.id)
            flash('Forked. You are in the copy.')
        } catch (error) {
            flash(errorText(error, 'Fork failed.'))
        }
    }

    const showRewind = (sessionId: string) =>
        showResult('Rewind', async () => {
            const { turns } = await sessionAPI.getTurns(sessionId)
            return {
                emptyLabel: 'No messages to go back to.',
                options: turns.map((turn) => ({
                    id: `turn:${turn.sequence}`,
                    label: turn.prompt.replace(/\s+/g, ' '),
                    pick: () => void runRewind(sessionId, turn.sequence),
                })),
            }
        })

    const runRewind = async (sessionId: string, sequence: number) => {
        try {
            const done = await sessionAPI.rewindSession(sessionId, sequence)
            openSession(sessionId)
            // the prompt goes back in the box, to edit and send again
            setInput(done.prompt, done.prompt.length)
            flash(done.filesRestored ? 'Rewound. Files restored.' : done.filesNote || 'Rewound.')
        } catch (error) {
            flash(errorText(error, 'Rewind failed.'))
        }
    }

    const showTasks = (sessionId: string) =>
        showResult('Tasks', async () => {
            const { tasks } = await sessionAPI.getTasks(sessionId)
            return {
                emptyLabel: 'Nothing is running.',
                options: [
                    ...tasks.map((task) => ({
                        id: `task:${task.pid}`,
                        label: task.command,
                        hint: formatElapsed(task.elapsedSeconds),
                    })),
                    {
                        id: 'shell',
                        label: 'Open the shell',
                        pick: () => requestWorkspaceTab('shell'),
                    },
                ],
            }
        })

    const showSessionUsage = (sessionId: string) =>
        showResult('Usage', async () => {
            const usage = await sessionAPI.getSessionUsage(sessionId)
            return {
                options: [
                    { id: 'tokens', label: 'Tokens', hint: formatTokenCount(usage.totalTokens) },
                    {
                        id: 'cost',
                        label: 'Credits',
                        hint: `$ ${(usage.costInCents / 100).toFixed(2)}`,
                    },
                    ...usage.byModel.map((row) => ({
                        id: `model:${row.model}:${row.billingSource}`,
                        label: row.model,
                        hint: `${formatTokenCount(row.totalTokens)}${row.billingSource === 'OWN_KEY' ? ' · your key' : ''}`,
                    })),
                ],
            }
        })

    const showPermissions = () =>
        showResult('Blocked tools', async () => {
            const { rules } = await profileAPI.getToolDenyRules()
            return {
                emptyLabel: 'Nothing is blocked. /permissions <rule> blocks a tool.',
                options: rules.map((rule) => ({
                    id: `rule:${rule}`,
                    label: rule,
                    hint: 'Remove',
                    pick: () => void removeDenyRule(rule),
                })),
            }
        })

    const addDenyRule = async (rule: string) => {
        try {
            const { rules } = await profileAPI.getToolDenyRules()
            await profileAPI.updateToolDenyRules([...rules, rule])
            flash(`Blocked: ${rule}`)
        } catch (error) {
            flash(errorText(error, 'Could not save the rule.'))
        }
    }

    const removeDenyRule = async (rule: string) => {
        try {
            const { rules } = await profileAPI.getToolDenyRules()
            await profileAPI.updateToolDenyRules(rules.filter((item) => item !== rule))
            showPermissions()
        } catch (error) {
            flash(errorText(error, 'Could not remove the rule.'))
        }
    }

    const askSideQuestion = (sessionId: string, question: string) =>
        showResult('btw', async () => {
            const { answer } = await sessionAPI.askSideQuestion(sessionId, question)
            return { text: answer, options: [] }
        })

    const searchCode = (sessionId: string, query: string) =>
        showResult('Search code', async () => {
            const { matches } = await sessionAPI.searchCode(sessionId, query)
            return {
                emptyLabel: 'No matches.',
                options: matches.map((match, index) => ({
                    id: `match:${index}`,
                    label: `${match.path}:${match.line}`,
                    hint: match.preview,
                    pick: () => requestWorkspaceFile(match.path),
                })),
            }
        })

    const writeTitle = async (sessionId: string) => {
        try {
            const { title } = await sessionAPI.generateTitle(sessionId)
            useAppStore.getState().setActiveProjectName(title)
            queryClient.invalidateQueries({ queryKey: ['sessions'] })
            flash(`Renamed: ${title}`)
        } catch (error) {
            flash(errorText(error, 'Rename failed.'))
        }
    }

    const runAction = (name: string) => {
        if (name === 'resume') {
            window.dispatchEvent(new CustomEvent(OPEN_SEARCH_EVENT))
        } else if (name === 'new' || name === 'exit') {
            // both leave the session for Home
            window.dispatchEvent(new CustomEvent(NEW_SESSION_REQUEST_EVENT))
        } else if (name === 'diff') {
            requestWorkspaceTab('changes')
        } else if (name === 'copy') {
            void copyLastAnswer()
        } else if (name === 'voice') {
            window.dispatchEvent(new CustomEvent(TOGGLE_VOICE_EVENT))
        } else if (name === 'update') {
            // the web is always the newest version after a reload
            window.location.reload()
        } else if (name === 'usage' && scope !== 'session') {
            onNavigate?.('/settings/usage')
        }

        // the rest work on the open session
        const sessionId = activeSessionId()
        if (!sessionId || scope !== 'session') return
        if (name === 'usage') showSessionUsage(sessionId)
        else if (name === 'tasks') showTasks(sessionId)
        else if (name === 'context') showContext(sessionId)
        else if (name === 'clear') void runClear(sessionId)
        else if (name === 'fork') void runFork(sessionId)
        else if (name === 'rewind') showRewind(sessionId)
    }

    const openSub = (kind: SubKind, options: SlashPickOption[]) => {
        setSubKind(kind)
        // the choices open with the current value selected
        setSelectedIndex(
            Math.max(
                0,
                options.findIndex((option) => option.selected)
            )
        )
    }

    const selectCommand = (command: SlashCommand) => {
        if (command.kind === 'model') return openSub('model', modelOptions)
        if (command.kind === 'effort') return openSub('effort', effortOptions)
        if (command.kind === 'switch') return openSub('switch', sourceOptions)
        if (command.kind === 'skills') return openSub('skills', [])
        if (command.kind === 'check') return openSub('check', [])
        if (command.kind === 'plan') {
            takeToken()
            setConfigValue('planFirst', true)
            return
        }
        if (command.kind === 'help') {
            takeToken()
            setHelpTab(command.helpTab ?? 'commands')
            return
        }
        if (command.kind === 'navigate' && command.to) {
            const rest = takeToken()
            if (scope === 'home') saveHomeDraft(rest)
            onNavigate?.(command.to)
            return
        }
        if (command.kind === 'external' && command.to) {
            takeToken()
            const url = command.to.startsWith('http') ? command.to : `${getWebUrl()}${command.to}`
            window.open(url, '_blank', 'noopener,noreferrer')
            return
        }
        if (TYPED_COMMANDS.has(command.name)) {
            // the text after the command is typed and sent with Enter
            takeToken(`/${command.name} `)
            return
        }
        takeToken()
        runAction(command.name)
    }

    const selectItem = (item: SlashItem | undefined) => {
        if (!item) return
        if (!isAuthenticated) {
            onOpenAuth?.()
            return
        }
        if (item.type === 'skill') {
            takeToken()
            addSkillChip(item.name)
            return
        }
        selectCommand(item.command)
    }

    const selectOption = (option: SlashPickOption | undefined) => {
        if (!option?.pick) return
        // a pick can show a new answer (Remove in /permissions), so the old one goes first
        setResult(null)
        option.pick()
        setSubKind(null)
        takeToken()
    }

    const back = () => {
        setResult(null)
        setSubKind(null)
        setSelectedIndex(0)
    }

    const dismiss = useCallback(() => {
        setResult(null)
        setDismissedInput(input)
    }, [input])

    /** types a slash and opens the menu, for the Commands row of the + menu */
    const open = () => {
        const base = input || ''
        const endsWithSlash = token !== null && token.query === '' && cursor === base.length
        const separator = base && !/\s$/.test(base) ? ' ' : ''
        const value = endsWithSlash ? base : `${base}${separator}/`
        setDismissedInput(null)
        setSubKind(null)
        setInput(value, value.length)
    }

    /** puts a slash word in the box: over the slash word at the caret, or at the end */
    const typeWord = (word: string) => {
        const base = input || ''
        setDismissedInput(null)
        if (token) {
            const next = replaceSlashToken(base, cursor, token, word)
            setInput(next.value, next.cursor)
            return
        }
        const separator = base && !/\s$/.test(base) ? ' ' : ''
        const value = `${base}${separator}${word}`
        setInput(value, value.length)
    }

    /**
     * runs a command picked in the Commands list of the + menu. a command with choices
     * (/model, /effort, /switch, /skills, /check) is typed in the box and its choices
     * open in the slash menu
     */
    const runCommand = (command: SlashCommand) => {
        if (!isAuthenticated) {
            onOpenAuth?.()
            return
        }
        const { kind, name } = command
        if (
            kind === 'model' ||
            kind === 'effort' ||
            kind === 'switch' ||
            kind === 'skills' ||
            kind === 'check'
        ) {
            keepIndexRef.current = query !== name
            typeWord(`/${name}`)
            const options =
                kind === 'model'
                    ? modelOptions
                    : kind === 'effort'
                      ? effortOptions
                      : kind === 'switch'
                        ? sourceOptions
                        : []
            openSub(kind, options)
            return
        }
        if (TYPED_COMMANDS.has(name)) {
            // the text after the command is typed and sent with Enter
            typeWord(`/${name} `)
            return
        }
        selectCommand(command)
    }

    /** true when the key was used by the menu */
    const onKeyDown = (event: React.KeyboardEvent): boolean => {
        if (!isOpen) return false
        const count = sub ? sub.options.length : items.length

        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            if (count === 0) return false
            event.preventDefault()
            const step = event.key === 'ArrowDown' ? 1 : -1
            setSelectedIndex((prev) => (prev + step + count) % count)
            return true
        }
        if (event.key === 'Enter' && !event.shiftKey) {
            if (sub) {
                event.preventDefault()
                selectOption(sub.options[selectedIndex])
                return true
            }
            // nothing matched: the text goes out as a normal prompt
            if (count === 0) return false
            event.preventDefault()
            selectItem(items[selectedIndex])
            return true
        }
        if (event.key === 'Escape') {
            event.preventDefault()
            if (sub) back()
            else dismiss()
            return true
        }
        return false
    }

    /**
     * a command typed in full and sent with Enter (/rename, /open, /compact, /btw,
     * /codesearch, /permissions, /review). returns null when the text is a normal
     * prompt; /learn is one: the agent saves the lesson in a turn.
     */
    const trySubmitCommand = (text: string): SlashSubmitResult | null => {
        const review = parseArgCommand(text, 'review')
        if (review) {
            const parsed = parsePullRequestUrl(review.arg)
            if (!parsed) {
                flash('Paste a pull request link after /review.')
                return { clear: false }
            }
            // a new session that reviews the pull request and opens none
            return {
                clear: true,
                submit: {
                    prompt: buildReviewPrompt(parsed),
                    options: {
                        repoUrl: parsed.repoUrl,
                        runConfig: { openPullRequest: false, planFirst: false },
                    },
                },
            }
        }

        if (scope !== 'session') return null
        const sessionId = activeSessionId()

        const open = parseOpenCommand(text)
        if (open) {
            if (!open.path) {
                flash('Add a file after /open.')
                return { clear: false }
            }
            requestWorkspaceFile(open.path)
            return { clear: true }
        }
        const rename = parseRenameCommand(text)
        if (rename) {
            if (rename.title) void renameSession(rename.title)
            else if (sessionId) void writeTitle(sessionId)
            return { clear: true }
        }
        if (!sessionId) return null

        const compact = parseArgCommand(text, 'compact')
        if (compact) {
            runCompact(sessionId, compact.arg || undefined)
            return { clear: true }
        }
        const btw = parseArgCommand(text, 'btw')
        if (btw) {
            if (!btw.arg) {
                flash('Add a question after /btw.')
                return { clear: false }
            }
            askSideQuestion(sessionId, btw.arg)
            return { clear: true }
        }
        const codesearch = parseArgCommand(text, 'codesearch')
        if (codesearch) {
            if (!codesearch.arg) {
                flash('Add text to search for after /codesearch.')
                return { clear: false }
            }
            searchCode(sessionId, codesearch.arg)
            return { clear: true }
        }
        const permissions = parseArgCommand(text, 'permissions')
        if (permissions) {
            if (permissions.arg) void addDenyRule(permissions.arg)
            else showPermissions()
            return { clear: true }
        }
        return null
    }

    const chips = useMemo<SlashChip[]>(
        () => [
            ...(planFirst ? [{ id: 'plan', label: '/plan' }] : []),
            ...skillChips.map((name) => ({ id: `skill:${name}`, label: `/${name}` })),
        ],
        [planFirst, skillChips]
    )

    const removeChip = (id: string) => {
        if (id === 'plan') setConfigValue('planFirst', false)
        else setSkillChips((prev) => prev.filter((name) => `skill:${name}` !== id))
    }

    /** Backspace on an empty box: removes the last chip. false when there is none */
    const popChip = (): boolean => {
        const last = chips[chips.length - 1]
        if (!last) return false
        removeChip(last.id)
        return true
    }

    const clearChips = () => setSkillChips([])

    /** the commands this box can run, for the help panel */
    const commands = useMemo(
        () =>
            listSlashCommands({ scope }).filter(
                (command) => command.name !== 'voice' || hasSpeechRecognition()
            ),
        [scope]
    )

    return {
        demo,
        scope,
        isOpen,
        items,
        sub,
        selectedIndex,
        setSelectedIndex,
        selectItem,
        selectOption,
        back,
        dismiss,
        open,
        runCommand,
        onKeyDown,
        trySubmitCommand,
        chips,
        /** the names of the skill chips, sent with the prompt */
        pickedSkills: skillChips,
        removeChip,
        popChip,
        clearChips,
        addSkillChip,
        note,
        commands,
        helpTab,
        closeHelp: () => setHelpTab(null),
    }
}

export type SlashMenuState = ReturnType<typeof useSlashMenu>
