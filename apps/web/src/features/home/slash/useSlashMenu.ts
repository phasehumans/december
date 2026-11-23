import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
    buildSlashItems,
    formatTokenCount,
    listSlashCommands,
    parseRenameCommand,
    parseSlashToken,
    replaceSlashToken,
    type SlashItem,
    type SlashSkill,
} from './slashModel'

import type { SlashCommand, SlashScope } from './commands'

import { useAppStore } from '@/app/store'
import { useBillingOverview } from '@/features/billing/hooks/useBillingData'
import { isPluginOff, useConnectionsStore } from '@/features/connections/hooks/useConnectionsStore'
import { isConnectionsDemoActive } from '@/features/connections/lib/connectionsDemo'
import { saveHomeDraft } from '@/features/home/draft'
import { usePromptConfig } from '@/features/home/promptConfig'
import { requestWorkspaceTab } from '@/features/preview/lib/workspaceTabRequest'
import { useByokList } from '@/features/profile/hooks/useByokData'
import { useGithubConnection } from '@/features/profile/hooks/useGithubConnection'
import { sessionAPI } from '@/features/sessions/api/session'
import { getWebUrl } from '@/shared/config/env'
import {
    NEW_SESSION_REQUEST_EVENT,
    OPEN_SEARCH_EVENT,
    TOGGLE_VOICE_EVENT,
} from '@/shared/lib/appEvents'

/** one row of a list that a command shows in the menu (/model, /effort, /switch, /check) */
export interface SlashPickOption {
    id: string
    label: string
    hint?: string
    selected?: boolean
    /** what Enter or a click does. a row with no pick only shows a fact */
    pick?: () => void
}

export interface SlashSubMenu {
    title: string
    options: SlashPickOption[]
    emptyLabel?: string
}

export interface SlashChip {
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
    /** true while the run is paid with December credits */
    onCredits: boolean
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
 * pick does. Skills and /plan need server work, so they only show in demo mode.
 */
export const useSlashMenu = ({
    input,
    cursor,
    scope,
    isAuthenticated,
    onOpenAuth,
    setInput,
    onCredits,
    modelOptions,
    effortOptions,
    sourceOptions,
    onNavigate,
}: UseSlashMenuArgs) => {
    const queryClient = useQueryClient()
    const [demo] = useState(isConnectionsDemoActive)

    const allSkills = useConnectionsStore((s) => s.skills)
    const plugins = useConnectionsStore((s) => s.plugins)
    const mcps = useConnectionsStore((s) => s.mcps)
    const pluginsOff = usePromptConfig((s) => s.pluginsOff)
    const planFirst = usePromptConfig((s) => s.values.planFirst)
    const setConfigValue = usePromptConfig((s) => s.setValue)
    const previewState = useAppStore((s) => s.previewSession?.state)

    const skills = useMemo<SlashSkill[]>(() => {
        if (!demo) return []
        return allSkills
            .filter(
                (skill) =>
                    skill.enabled &&
                    !isPluginOff(plugins, skill.plugin) &&
                    !(skill.plugin && pluginsOff.includes(skill.plugin))
            )
            .map((skill) => ({
                name: skill.name,
                description: skill.description,
                plugin: skill.plugin,
            }))
    }, [demo, allSkills, plugins, pluginsOff])

    const [selectedIndex, setSelectedIndex] = useState(0)
    const [subKind, setSubKind] = useState<SubKind | null>(null)
    const [dismissedInput, setDismissedInput] = useState<string | null>(null)
    const [skillChips, setSkillChips] = useState<string[]>([])
    const [helpTab, setHelpTab] = useState<'commands' | 'shortcuts' | null>(null)
    const [note, setNote] = useState<string | null>(null)
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
        return buildSlashItems({ token, scope, demo, onCredits, skills }).filter(
            // the microphone needs a browser that can listen
            (item) =>
                item.type !== 'command' || item.command.name !== 'voice' || hasSpeechRecognition()
        )
    }, [token, scope, demo, onCredits, skills])

    // the checks only run while the /check list is open
    const isChecking = subKind === 'check' && Boolean(isAuthenticated)
    const github = useGithubConnection(isChecking)
    const { data: overview } = useBillingOverview(isChecking)
    const { data: byokData } = useByokList(isChecking)

    const addSkillChip = useCallback(
        (name: string) => setSkillChips((prev) => (prev.includes(name) ? prev : [...prev, name])),
        []
    )

    const checkOptions = useMemo<SlashPickOption[]>(() => {
        if (subKind !== 'check') return []
        const rows: SlashPickOption[] = [
            {
                id: 'github',
                label: 'GitHub',
                hint: !github.isReady
                    ? 'Checking...'
                    : github.isConnected
                      ? 'Connected'
                      : 'Not connected',
                pick:
                    github.isReady && !github.isConnected
                        ? () => window.location.assign(github.connectUrl)
                        : undefined,
            },
            {
                id: 'credits',
                label: 'December credits',
                hint:
                    overview === undefined
                        ? 'Checking...'
                        : `$ ${(Math.max(0, overview.creditBalance ?? 0) / 100).toFixed(2)}`,
                pick:
                    overview !== undefined && (overview.creditBalance ?? 0) <= 0
                        ? () => onNavigate?.('/settings/billing')
                        : undefined,
            },
            {
                id: 'keys',
                label: 'Your keys',
                hint:
                    byokData === undefined
                        ? 'Checking...'
                        : byokData.credentials.length === 0
                          ? 'None saved'
                          : `${byokData.credentials.length} saved`,
                pick: () => onNavigate?.('/settings/models'),
            },
        ]
        if (demo) {
            mcps.filter((mcp) => mcp.enabled && mcp.status !== 'connected').forEach((mcp) =>
                rows.push({
                    id: `mcp:${mcp.name}`,
                    label: `MCP: ${mcp.name}`,
                    hint: mcp.status === 'needs-signin' ? 'Sign in' : mcp.lastError || 'Error',
                    pick: () => onNavigate?.('/settings/connections/mcps'),
                })
            )
        }
        if (scope === 'session' && previewState) {
            const state = String(previewState).toLowerCase()
            rows.push({
                id: 'machine',
                label: 'Session machine',
                hint: state.charAt(0).toUpperCase() + state.slice(1),
            })
        }
        return rows
    }, [subKind, github, overview, byokData, demo, mcps, scope, previewState, onNavigate])

    const sub = useMemo<SlashSubMenu | null>(() => {
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
    }, [subKind, modelOptions, effortOptions, sourceOptions, checkOptions, skills, addSkillChip])

    // a slash in the middle of a sentence only opens the menu when something matches
    const isOpen =
        token !== null &&
        dismissedInput !== input &&
        (subKind !== null || token.atStart || items.length > 0)

    useEffect(() => {
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

    const showSessionUsage = () => {
        const tokens = useAppStore
            .getState()
            .messages.reduce((sum, message) => sum + (message.tokensUsed || 0), 0)
        flash(`This session: ${formatTokenCount(tokens)} tokens.`)
    }

    const runAction = (name: string) => {
        if (name === 'resume') {
            window.dispatchEvent(new CustomEvent(OPEN_SEARCH_EVENT))
        } else if (name === 'new' || name === 'exit') {
            // both leave the session for Home
            window.dispatchEvent(new CustomEvent(NEW_SESSION_REQUEST_EVENT))
        } else if (name === 'diff') {
            requestWorkspaceTab('changes')
        } else if (name === 'tasks') {
            requestWorkspaceTab('shell')
        } else if (name === 'copy') {
            void copyLastAnswer()
        } else if (name === 'voice') {
            window.dispatchEvent(new CustomEvent(TOGGLE_VOICE_EVENT))
        } else if (name === 'update') {
            // the web is always the newest version after a reload
            window.location.reload()
        } else if (name === 'usage') {
            if (scope === 'session') showSessionUsage()
            else onNavigate?.('/settings/usage')
        }
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
        if (command.name === 'rename') {
            // the title is typed after the command and sent with Enter
            takeToken('/rename ')
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
        option.pick()
        setSubKind(null)
        takeToken()
    }

    const back = () => {
        setSubKind(null)
        setSelectedIndex(0)
    }

    const dismiss = useCallback(() => setDismissedInput(input), [input])

    /** types a slash and opens the menu, for the slash icon */
    const open = () => {
        const base = input || ''
        const endsWithSlash = token !== null && token.query === '' && cursor === base.length
        const separator = base && !/\s$/.test(base) ? ' ' : ''
        const value = endsWithSlash ? base : `${base}${separator}/`
        setDismissedInput(null)
        setSubKind(null)
        setInput(value, value.length)
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
     * a command typed in full and sent with Enter (only /rename today).
     * returns null when the text is a normal prompt.
     */
    const trySubmitCommand = (text: string): { clear: boolean } | null => {
        if (scope !== 'session') return null
        const rename = parseRenameCommand(text)
        if (!rename) return null
        if (!rename.title) {
            flash('Add a title after /rename.')
            return { clear: false }
        }
        void renameSession(rename.title)
        return { clear: true }
    }

    const chips = useMemo<SlashChip[]>(
        () => [
            ...(demo && planFirst ? [{ id: 'plan', label: '/plan' }] : []),
            ...skillChips.map((name) => ({ id: `skill:${name}`, label: `/${name}` })),
        ],
        [demo, planFirst, skillChips]
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
            listSlashCommands({ scope, demo, onCredits }).filter(
                (command) => command.name !== 'voice' || hasSpeechRecognition()
            ),
        [scope, demo, onCredits]
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
        onKeyDown,
        trySubmitCommand,
        chips,
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
