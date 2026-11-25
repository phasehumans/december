import { useQuery } from '@tanstack/react-query'
import { KeyRound, Folder } from 'lucide-react'
import { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo } from 'react'

import type { BillingSource } from '@/features/home/model-selection'
import type { SlashPickOption } from '@/features/home/slash/useSlashMenu'
import type { PromptInputSubmitOptions } from '@/features/home/types'

import {
    CREDIT_TIERS,
    CREDIT_TIER_LABELS,
    DEFAULT_SELECTION,
    getCreditTier,
    useModelSelection,
    type CreditTier,
} from '@/features/home/model-selection'
import { onHomePrefill, takeHomePrefill } from '@/features/home/prefill'
import { usePromptConfig } from '@/features/home/promptConfig'
import { useSlashMenu } from '@/features/home/slash/useSlashMenu'
import { profileAPI } from '@/features/profile/api/profile'
import { secretsAPI } from '@/features/profile/api/secrets'
import { useByokList } from '@/features/profile/hooks/useByokData'
import { repoKey, useConnectedRepos } from '@/features/profile/hooks/useConnectedRepos'
import { usePreferences } from '@/features/profile/lib/preferences'
import { sessionAPI } from '@/features/sessions/api/session'
import { Icons } from '@/shared/components/ui/Icons'

export const MENTION_PROVIDERS = [
    {
        id: 'repos',
        trigger: 'repos:',
        icon: Icons.Github,
        title: 'Repositories',
        description: 'All repositories added to December',
    },
    {
        id: 'sessions',
        trigger: 'sessions:',
        icon: Folder,
        title: 'Sessions',
        description: 'Your previous sessions',
    },
    {
        id: 'secrets',
        trigger: 'secrets:',
        icon: KeyRound,
        iconStyle: { transform: 'scaleY(-1) rotate(-135deg)' },
        title: 'Secrets',
        description: 'Your stored secrets',
    },
]

export const usePromptInputController = ({
    value,
    onChange,
    onSubmit,
    isAuthenticated,
    onOpenAuth,
    isLoading,
    mode = 'agent',
    initialModel,
    initialProvider,
    acceptPrefill = false,
    onModelChange,
    onNavigate,
}: {
    value?: string
    onChange?: (val: string) => void
    onSubmit: (val: string, options?: PromptInputSubmitOptions) => void
    isAuthenticated?: boolean
    onOpenAuth?: () => void
    isLoading?: boolean
    mode?: 'agent' | 'chat'
    initialModel?: string
    initialProvider?: string
    /** take a prompt or repo handed over by requestHomePrefill (Home only) */
    acceptPrefill?: boolean
    /** told when /model picks a model, the same as a pick from the model button */
    onModelChange?: (model: string, provider?: string) => void
    /** opens a page of the app, for slash commands such as /mcp */
    onNavigate?: (path: string) => void
}) => {
    const [internalInput, setInternalInput] = useState('')
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const dropdownRef = useRef<HTMLDivElement>(null)
    const [cursorPosition, setCursorPosition] = useState<number | null>(null)
    const [selectedIndex, setSelectedIndex] = useState(0)
    const [selectedRepos, setSelectedRepos] = useState<any[]>([])
    const [selectedBranch, setSelectedBranch] = useState('')
    // starts from the shared selection, so a model picked on the home page carries into
    // the session's prompt box
    const [selectedModel, setSelectedModel] = useState<string>(
        () => initialModel ?? useModelSelection.getState().model
    )
    const [selectedProvider, setSelectedProvider] = useState<string>(
        () => initialProvider ?? useModelSelection.getState().provider
    )
    const [selectedSource, setSelectedSource] = useState<BillingSource>(() =>
        initialModel ? 'CREDITS' : useModelSelection.getState().source
    )
    const [forceClose, setForceClose] = useState(false)
    const [dropdownPosition, setDropdownPosition] = useState<'top' | 'bottom'>('bottom')
    const voiceBaseRef = useRef('')
    const isVoiceActiveRef = useRef(false)

    const handleSelectModel = useCallback(
        (model: string, provider?: string, source: BillingSource = 'CREDITS') => {
            setSelectedModel(model)
            setSelectedSource(source)
            if (provider) {
                setSelectedProvider(provider)
            }
            useModelSelection.getState().select({
                model,
                provider: provider ?? useModelSelection.getState().provider,
                source,
            })
        },
        []
    )

    // follow changes made elsewhere (another prompt box, or "switch to december credits")
    useEffect(() => {
        if (initialModel) return
        return useModelSelection.subscribe((state) => {
            setSelectedModel(state.model)
            setSelectedProvider(state.provider)
            setSelectedSource(state.source)
        })
    }, [initialModel])

    // the user's default model source: when it is "your keys", start on the first saved
    // key's default model, until the user picks a model. a selection on a deleted key
    // falls back to december credits.
    const { data: defaultsProfile } = useQuery({
        queryKey: ['profile'],
        queryFn: profileAPI.getProfile,
        enabled: !!isAuthenticated,
    })
    const { data: byokData } = useByokList(!!isAuthenticated)

    useEffect(() => {
        if (!byokData) return
        const store = useModelSelection.getState()
        const credentials = byokData.credentials
        const first = credentials[0]

        if (
            selectedSource === 'OWN_KEY' &&
            !credentials.some((c) => c.provider === selectedProvider)
        ) {
            setSelectedModel(DEFAULT_SELECTION.model)
            setSelectedProvider(DEFAULT_SELECTION.provider)
            setSelectedSource('CREDITS')
            store.reset()
            return
        }

        if (
            !store.userChosen &&
            !initialModel &&
            defaultsProfile?.defaultModelSource === 'OWN_KEY' &&
            first &&
            selectedSource !== 'OWN_KEY'
        ) {
            const selection = {
                model: first.defaultModel,
                provider: first.provider,
                source: 'OWN_KEY' as const,
            }
            store.applyDefault(selection)
            setSelectedModel(selection.model)
            setSelectedProvider(selection.provider)
            setSelectedSource('OWN_KEY')
        }
    }, [byokData, defaultsProfile, initialModel, selectedProvider, selectedSource])

    // the saved session defaults (#632) replace the ones this browser remembered
    useEffect(() => {
        if (!defaultsProfile) return
        usePromptConfig.getState().applyServerDefaults({
            planFirst: defaultsProfile.defaultPlanFirst,
            openPullRequest: defaultsProfile.defaultOpenPullRequest,
        })
    }, [defaultsProfile])

    const isControlled = value !== undefined
    const input = isControlled ? value : internalInput

    const handleAuthCheck = (action: () => void) => {
        if (!isAuthenticated && onOpenAuth) {
            onOpenAuth()
            return
        }
        action()
    }

    const handleInputChange = useCallback(
        (val: string) => {
            if (!isControlled) {
                setInternalInput(val)
            }
            onChange?.(val)
        },
        [isControlled, onChange]
    )

    useEffect(() => {
        if (!acceptPrefill) return
        const applyPrefill = () => {
            const prefill = takeHomePrefill()
            if (!prefill) return
            if (prefill.prompt !== undefined) handleInputChange(prefill.prompt)
            if (prefill.repo) {
                setSelectedRepos([prefill.repo])
                setSelectedBranch(prefill.branch || prefill.repo.defaultBranch || 'main')
            }
            // after the new-session reset and its own focus call
            setTimeout(() => {
                const el = textareaRef.current
                if (!el) return
                el.focus()
                el.setSelectionRange(el.value.length, el.value.length)
            }, 80)
        }
        applyPrefill()
        return onHomePrefill(applyPrefill)
    }, [acceptPrefill, handleInputChange])

    const handleSelect = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
        setCursorPosition((e.target as HTMLTextAreaElement).selectionStart)
    }

    const currentCursor = cursorPosition !== null ? cursorPosition : input.length
    const textBeforeCursor = input.slice(0, currentCursor)

    /**
     * writes the prompt text and puts the caret at the given position. the caret is set
     * right after the new text is in the box, so a key typed next cannot land before it
     */
    const pendingCaretRef = useRef<number | null>(null)
    const placeCaret = useCallback((cursor: number) => {
        const el = textareaRef.current
        if (!el) return
        el.focus()
        el.setSelectionRange(cursor, cursor)
    }, [])
    const setInputAt = useCallback(
        (val: string, cursor: number) => {
            setCursorPosition(cursor)
            if (val === input) {
                // the text is already in the box
                placeCaret(cursor)
                return
            }
            pendingCaretRef.current = cursor
            handleInputChange(val)
        },
        [handleInputChange, input, placeCaret]
    )
    useLayoutEffect(() => {
        if (pendingCaretRef.current === null) return
        const cursor = pendingCaretRef.current
        pendingCaretRef.current = null
        placeCaret(cursor)
    }, [input, placeCaret])

    // choices for /model, /effort and /switch. they change the same state as the footer
    const pickModel = useCallback(
        (model: string, provider: string, source: BillingSource) => () => {
            handleSelectModel(model, provider, source)
            onModelChange?.(model, provider)
        },
        [handleSelectModel, onModelChange]
    )
    const isOnCredits = selectedSource !== 'OWN_KEY'

    const slashEffortOptions = useMemo<SlashPickOption[]>(
        () =>
            (Object.keys(CREDIT_TIERS) as CreditTier[]).map((tier) => ({
                id: tier,
                label: CREDIT_TIER_LABELS[tier],
                selected: isOnCredits && getCreditTier(selectedModel) === tier,
                pick: pickModel(CREDIT_TIERS[tier].model, CREDIT_TIERS[tier].provider, 'CREDITS'),
            })),
        [isOnCredits, selectedModel, pickModel]
    )

    const keyModelOptions = useMemo<SlashPickOption[]>(
        () =>
            (byokData?.credentials || []).flatMap((credential) => {
                const providerName =
                    byokData?.providers.find((p) => p.id === credential.provider)?.name ||
                    credential.provider
                return credential.models.map((model) => ({
                    id: `${credential.provider}:${model}`,
                    label: model,
                    hint: providerName,
                    selected:
                        !isOnCredits &&
                        selectedProvider === credential.provider &&
                        selectedModel === model,
                    pick: pickModel(model, credential.provider, 'OWN_KEY'),
                }))
            }),
        [byokData, isOnCredits, selectedModel, selectedProvider, pickModel]
    )
    // on credits December picks the model, so /model offers the two speeds
    const slashModelOptions = isOnCredits ? slashEffortOptions : keyModelOptions

    const lastCreditTier = useModelSelection((state) => state.lastCreditTier)
    const lastOwnKey = useModelSelection((state) => state.lastOwnKey)
    const slashSourceOptions = useMemo<SlashPickOption[]>(() => {
        const credits: SlashPickOption = {
            id: 'credits',
            label: 'December credits',
            selected: isOnCredits,
            pick: pickModel(
                CREDIT_TIERS[lastCreditTier].model,
                CREDIT_TIERS[lastCreditTier].provider,
                'CREDITS'
            ),
        }
        const credentials = byokData?.credentials || []
        if (credentials.length === 0) {
            return [
                credits,
                {
                    id: 'add-key',
                    label: 'Add your own key',
                    pick: () => onNavigate?.('/settings/models'),
                },
            ]
        }
        // the last model used on a key, when that key is still saved
        const last = lastOwnKey
        const remembered =
            last &&
            credentials.some((c) => c.provider === last.provider && c.models.includes(last.model))
                ? last
                : { model: credentials[0].defaultModel, provider: credentials[0].provider }
        return [
            credits,
            {
                id: 'keys',
                label: 'Your keys',
                hint: remembered.model.split('/').pop(),
                selected: !isOnCredits,
                pick: pickModel(remembered.model, remembered.provider, 'OWN_KEY'),
            },
        ]
    }, [byokData, isOnCredits, lastCreditTier, lastOwnKey, pickModel, onNavigate])

    const slash = useSlashMenu({
        input,
        cursor: currentCursor,
        scope: mode === 'chat' ? 'session' : 'home',
        isAuthenticated,
        onOpenAuth,
        setInput: setInputAt,
        onCredits: isOnCredits,
        modelOptions: slashModelOptions,
        effortOptions: slashEffortOptions,
        sourceOptions: slashSourceOptions,
        onNavigate,
    })

    const reposMatch = textBeforeCursor?.match(/@repos?:([^\s]*)$/)
    const isReposTriggered = !!reposMatch
    const repoSearchQuery = reposMatch ? reposMatch[1].toLowerCase() : ''

    const sessionsMatch = textBeforeCursor?.match(/@sessions?:([^\s]*)$/)
    const isSessionsTriggered = !!sessionsMatch
    const sessionsSearchQuery = sessionsMatch ? sessionsMatch[1].toLowerCase() : ''

    const secretsMatch = textBeforeCursor?.match(/@secrets?:([^\s]*)$/)
    const isSecretsTriggered = !!secretsMatch
    const secretsSearchQuery = secretsMatch ? secretsMatch[1].toLowerCase() : ''

    const isAnySubMenuTriggered = isReposTriggered || isSessionsTriggered || isSecretsTriggered

    const atMatch = textBeforeCursor?.match(/@([a-zA-Z0-9_-]*)$/)
    const isAtTriggered = !!atMatch && !atMatch[0].includes(':') && !isAnySubMenuTriggered
    const atSearchQuery = isAtTriggered ? atMatch[1].toLowerCase() : ''

    const modeProviders =
        mode === 'chat'
            ? MENTION_PROVIDERS.filter((p) => !['repos', 'sessions'].includes(p.id))
            : MENTION_PROVIDERS
    const filteredProviders = modeProviders.filter(
        (p) =>
            p.title.toLowerCase().includes(atSearchQuery) ||
            p.id.toLowerCase().includes(atSearchQuery)
    )

    const { data: profile } = useQuery({
        queryKey: ['profile'],
        queryFn: profileAPI.getProfile,
        enabled: isReposTriggered && !!isAuthenticated,
    })

    const { data: quickInfo } = useQuery({
        queryKey: ['quickinfo'],
        queryFn: profileAPI.getQuickInfo,
        enabled: isReposTriggered && !!isAuthenticated,
    })

    const hasGithub = Boolean(
        profile?.githubAppInstall || profile?.githubConnected || quickInfo?.githubConnected
    )

    const githubConnectUrl = profile?.id
        ? profileAPI.getGithubConnectUrl(profile.id)
        : profileAPI.getGithubConnectUrl('')

    const {
        repos,
        isLoading: isRepoListLoading,
        isGitlabConnected,
        isGitlabReady,
    } = useConnectedRepos({
        enabled: isReposTriggered && !!isAuthenticated,
        isGithubConnected: hasGithub,
    })
    // without GitHub, wait for the GitLab answer so "Connect GitHub" does not flash
    const isReposLoading = isRepoListLoading || (!hasGithub && isReposTriggered && !isGitlabReady)
    // any connected git host can list repos; the "Connect GitHub" hint shows only without one
    const isGithubConnected = hasGithub || isGitlabConnected

    const filteredRepos = repos.filter(
        (repo) =>
            repo.name.toLowerCase().includes(repoSearchQuery) ||
            repo.owner.login.toLowerCase().includes(repoSearchQuery)
    )

    const { data: sessionsData, isLoading: isSessionsLoading } = useQuery({
        queryKey: ['sessions', 'mention'],
        queryFn: () => sessionAPI.getSessions({ limit: 30 }),
        enabled: isSessionsTriggered && !!isAuthenticated,
    })

    const sessions = sessionsData?.sessions || []
    const filteredSessions = sessions.filter(
        (session) =>
            (session.title || 'Untitled session').toLowerCase().includes(sessionsSearchQuery) ||
            (session.lastMessage || '').toLowerCase().includes(sessionsSearchQuery)
    )

    const { data: secretsData, isLoading: isSecretsLoading } = useQuery({
        queryKey: ['secrets', 'mention'],
        queryFn: secretsAPI.getSecrets,
        enabled: isSecretsTriggered && !!isAuthenticated,
    })

    const secrets = secretsData?.secrets || []
    const filteredSecrets = secrets.filter((secret) =>
        secret.name.toLowerCase().includes(secretsSearchQuery)
    )

    useEffect(() => {
        setSelectedIndex(0)
    }, [
        atSearchQuery,
        repoSearchQuery,
        sessionsSearchQuery,
        secretsSearchQuery,
        isAtTriggered,
        isReposTriggered,
        isSessionsTriggered,
        isSecretsTriggered,
    ])

    useEffect(() => {
        setForceClose(false)
    }, [input])

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setForceClose(true)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    useEffect(() => {
        const isAnyDropdownOpen =
            isAtTriggered || isReposTriggered || isSessionsTriggered || isSecretsTriggered
        if (isAnyDropdownOpen && textareaRef.current) {
            const rect = textareaRef.current.getBoundingClientRect()
            const spaceBelow = window.innerHeight - rect.bottom
            if (spaceBelow < 320 && rect.top > spaceBelow) {
                setDropdownPosition('top')
            } else {
                setDropdownPosition('bottom')
            }
        }
    }, [isAtTriggered, isReposTriggered, isSessionsTriggered, isSecretsTriggered])

    useEffect(() => {
        if (dropdownRef.current) {
            const activeEl = dropdownRef.current.querySelector(
                '.dropdown-item-active'
            ) as HTMLElement
            if (activeEl) {
                activeEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
            }
        }
    }, [selectedIndex])

    useEffect(() => {
        if (textareaRef.current) {
            const container = document.getElementById('main-scroll-container')
            const scrollPos = container?.scrollTop

            textareaRef.current.style.height = '0px'
            const scrollHeight = textareaRef.current.scrollHeight

            textareaRef.current.style.height = `${Math.min(scrollHeight, 400)}px`
            textareaRef.current.style.overflowY = scrollHeight >= 400 ? 'auto' : 'hidden'

            if (container && scrollPos !== undefined) {
                container.scrollTop = scrollPos
            }

            if (
                (input?.endsWith('@repos:') ||
                    input?.endsWith('@sessions:') ||
                    input?.endsWith('@secrets:')) &&
                document.activeElement !== textareaRef.current
            ) {
                textareaRef.current.focus()
                const len = input.length
                textareaRef.current.setSelectionRange(len, len)
                setCursorPosition(len)
            }
        }
    }, [input])

    const handleSelectRepo = (repo: any) => {
        const newValue = (input || '').replace(/@repos?:[^\s]*$/, '')
        handleInputChange(newValue)
        if (!selectedRepos.some((r) => repoKey(r) === repoKey(repo))) {
            setSelectedRepos((prev) => [...prev, repo])
            if (!selectedBranch) {
                setSelectedBranch(repo.defaultBranch || 'main')
            }
        }
        textareaRef.current?.focus()
    }

    const handleRemoveRepo = (index: number) => {
        setSelectedRepos((prev) => {
            const next = prev.filter((_, i) => i !== index)
            if (next.length === 0) {
                setSelectedBranch('')
            }
            return next
        })
    }

    /** swaps the "@word" being typed for the mention, or adds the mention at the end */
    const insertMention = (pattern: RegExp, mention: string) => {
        const text = input || ''
        const next = pattern.test(text)
            ? text.replace(pattern, mention)
            : `${text}${text && !/\s$/.test(text) ? ' ' : ''}${mention}`
        handleInputChange(next)
        textareaRef.current?.focus()
    }

    const handleSelectSession = (session: any) => {
        insertMention(/@sessions?:[^\s]*$/, `@session:${session.title || session.id} `)
    }

    const handleSelectSecret = (secret: any) => {
        insertMention(/@secrets?:[^\s]*$/, `@secret:${secret.name} `)
    }

    const handleSubmit = (event?: React.FormEvent) => {
        event?.preventDefault()
        handleAuthCheck(() => {
            // a command typed in full (/rename new title) runs here and is not sent
            const command = slash.trySubmitCommand(input || '')
            if (command) {
                if (command.clear) {
                    if (!isControlled) setInternalInput('')
                    onChange?.('')
                }
                // /review: a new session runs the review prompt on the picked model
                if (command.submit && !isLoading) {
                    onSubmit(command.submit.prompt, {
                        model: selectedModel,
                        provider: selectedProvider,
                        billingSource: selectedSource,
                        ...command.submit.options,
                    })
                }
                return
            }

            if ((!input?.trim() && selectedRepos.length === 0) || isLoading) return

            let finalPrompt = input || ''
            let repoUrl: string | undefined
            let branch: string | undefined
            let issueNumber: number | undefined

            if (selectedRepos.length > 0) {
                const primaryRepo = selectedRepos[0]
                repoUrl = primaryRepo.htmlUrl || primaryRepo.cloneUrl
                branch = selectedBranch.trim() || primaryRepo.defaultBranch || 'main'
                const repoUrls = selectedRepos
                    .map((r) => r.htmlUrl || r.cloneUrl || r.name)
                    .join('\n')
                finalPrompt = finalPrompt.trim() ? `${repoUrls}\n\n${finalPrompt}` : repoUrls
            } else {
                const urlMatch = input.match(/https?:\/\/github\.com\/([\w.-]+)\/([\w.-]+)/i)
                if (urlMatch) {
                    repoUrl = urlMatch[0]
                }
            }

            const branchMatch = input.match(/(?:@branch:|--branch\s+|-b\s+)([\w./-]+)/i)
            if (branchMatch) {
                branch = branchMatch[1]
            }

            const issueMatch = input.match(/(?:#|issue\s+|issue\s+#)(\d+)/i)
            if (issueMatch) {
                issueNumber = parseInt(issueMatch[1], 10)
            }

            const configValues = usePromptConfig.getState().values
            const submitOptions: PromptInputSubmitOptions = {
                repoUrl,
                branch,
                issueNumber,
                model: selectedModel,
                provider: selectedProvider,
                billingSource: selectedSource,
                runConfig: {
                    planFirst: configValues.planFirst,
                    // fast or deep: on credits the tier, on a key the reasoning depth
                    effort: selectedSource === 'OWN_KEY' ? undefined : getCreditTier(selectedModel),
                    ...(mode !== 'chat' ? { openPullRequest: configValues.openPullRequest } : {}),
                },
            }

            onSubmit(finalPrompt, submitOptions)
            if (!isControlled) setInternalInput('')
            onChange?.('')
            setSelectedRepos([])
            setSelectedBranch('')
            slash.clearChips()
            // a new session starts from the saved configuration. a running session keeps its own
            if (mode !== 'chat') usePromptConfig.getState().reset()
            if (textareaRef.current) textareaRef.current.style.height = 'auto'
        })
    }

    const handleKeyDown = (event: React.KeyboardEvent) => {
        if (slash.onKeyDown(event)) return

        const isDropdownOpen =
            isAtTriggered || isReposTriggered || isSessionsTriggered || isSecretsTriggered

        const currentOptionsCount = isReposTriggered
            ? Math.min(filteredRepos.length, 10)
            : isSessionsTriggered
              ? Math.min(filteredSessions.length, 10)
              : isSecretsTriggered
                ? Math.min(filteredSecrets.length, 10)
                : isAtTriggered
                  ? filteredProviders.length
                  : 0

        if (isDropdownOpen && currentOptionsCount > 0 && !forceClose) {
            if (event.key === 'ArrowDown') {
                event.preventDefault()
                setSelectedIndex((prev) => (prev + 1) % currentOptionsCount)
                return
            }
            if (event.key === 'ArrowUp') {
                event.preventDefault()
                setSelectedIndex((prev) => (prev - 1 + currentOptionsCount) % currentOptionsCount)
                return
            }
            if (event.key === 'Enter') {
                event.preventDefault()
                if (isReposTriggered) {
                    const repo = filteredRepos[selectedIndex]
                    if (repo) handleSelectRepo(repo)
                } else if (isSessionsTriggered) {
                    const session = filteredSessions[selectedIndex]
                    if (session) handleSelectSession(session)
                } else if (isSecretsTriggered) {
                    const secret = filteredSecrets[selectedIndex]
                    if (secret) handleSelectSecret(secret)
                } else if (isAtTriggered) {
                    const provider = filteredProviders[selectedIndex]
                    if (provider) {
                        const newValue = (input || '').replace(
                            /@[a-zA-Z0-9_-]*$/,
                            `@${provider.trigger}`
                        )
                        handleInputChange(newValue)
                    }
                }
                return
            }
        }

        if (event.key === 'Backspace' && !input) {
            // chips go first (they sit after the repos), then the repos
            if (slash.popChip()) return
            if (selectedRepos.length > 0) {
                setSelectedRepos((prev) => prev.slice(0, -1))
                return
            }
        }

        if (event.key === 'Enter' && !event.shiftKey) {
            // "Send with Ctrl + Enter" (Settings, Preferences): a plain Enter is a new line
            const sendKey = usePreferences.getState().sendKey
            if (sendKey === 'mod-enter' && !event.ctrlKey && !event.metaKey) return
            event.preventDefault()
            handleSubmit()
        }
    }

    const handleVoiceTranscript = useCallback(
        (text: string) => {
            if (!isVoiceActiveRef.current) {
                voiceBaseRef.current = isControlled ? value || '' : internalInput
                isVoiceActiveRef.current = true
            }
            const base = voiceBaseRef.current
            const separator = base && !base.endsWith(' ') ? ' ' : ''
            const newValue = base + separator + text
            handleInputChange(newValue)
        },
        [isControlled, value, internalInput, handleInputChange]
    )

    const handleVoiceStateChange = useCallback((isListening: boolean) => {
        if (!isListening) {
            isVoiceActiveRef.current = false
        }
    }, [])

    return {
        input,
        textareaRef,
        dropdownRef,
        selectedIndex,
        setSelectedIndex,
        selectedRepos,
        setSelectedRepos,
        selectedBranch,
        setSelectedBranch,
        handleRemoveRepo,
        forceClose,
        dropdownPosition,
        isAtTriggered,
        isReposTriggered,
        repoSearchQuery,
        isSessionsTriggered,
        isSecretsTriggered,
        filteredProviders,
        filteredRepos,
        filteredSessions,
        filteredSecrets,
        isGithubConnected,
        isReposLoading,
        isSessionsLoading,
        isSecretsLoading,
        githubConnectUrl,
        handleSelectRepo,
        handleSelectSession,
        handleSelectSecret,
        handleInputChange,
        handleSelect,
        handleSubmit,
        handleKeyDown,
        handleVoiceTranscript,
        handleVoiceStateChange,
        handleAuthCheck,
        selectedModel,
        setSelectedModel,
        selectedProvider,
        setSelectedProvider,
        selectedSource,
        handleSelectModel,
        slash,
    }
}
