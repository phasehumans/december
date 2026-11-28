import { ATTACHMENT_MAX_FILES, checkAttachment } from '@december/shared/attachments'
import { useQuery } from '@tanstack/react-query'
import { KeyRound, Folder } from 'lucide-react'
import { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo } from 'react'

import type { BillingSource, Speed } from '@/features/home/model-selection'
import type { SlashPickOption } from '@/features/home/slash/useSlashMenu'
import type { PromptInputSubmitOptions, UploadedAttachment } from '@/features/home/types'

import { attachmentAPI } from '@/features/generation/api/attachments'
import { generationAPI } from '@/features/generation/api/generation'
import {
    DEFAULT_SELECTION,
    SPEEDS,
    SPEED_LABELS,
    useModelSelection,
} from '@/features/home/model-selection'
import { onHomePrefill, takeHomePrefill } from '@/features/home/prefill'
import { usePromptConfig } from '@/features/home/promptConfig'
import { useSlashMenu } from '@/features/home/slash/useSlashMenu'
import { profileAPI } from '@/features/profile/api/profile'
import { SECRETS_MENTION_KEY, secretsAPI, uniqueSecretNames } from '@/features/profile/api/secrets'
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
    sessionId,
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
    /** the open session (session box). its files are stored there before the prompt goes */
    sessionId?: string | null
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

    // the files picked for this prompt (#634). they are stored on the server when the
    // prompt is sent, before the box is cleared: a refused file leaves the box as it was
    const [attachments, setAttachments] = useState<File[]>([])
    const [attachmentNote, setAttachmentNote] = useState<string | null>(null)
    /** the file the server refused in the last send */
    const [refusedAttachment, setRefusedAttachment] = useState<File | null>(null)
    const [isUploading, setIsUploading] = useState(false)
    const isUploadingRef = useRef(false)
    /** the session made for the files of a first prompt. a retry stores its files there */
    const pendingSessionRef = useRef<{ key: string; session: { id: string } } | null>(null)
    const attachmentNoteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    useEffect(
        () => () => {
            if (attachmentNoteTimerRef.current) clearTimeout(attachmentNoteTimerRef.current)
        },
        []
    )

    /** adds picked files. a refused file shows one short line for a few seconds */
    const addAttachments = (files: File[]) => {
        const next = [...attachments]
        let problem: string | null = null
        for (const file of files) {
            const reason = checkAttachment({ name: file.name, size: file.size, count: next.length })
            if (!reason) {
                next.push(file)
                continue
            }
            problem ??=
                reason === 'count'
                    ? `Up to ${ATTACHMENT_MAX_FILES} files for each prompt.`
                    : reason === 'size'
                      ? `${file.name} is over 5 MB.`
                      : reason === 'empty'
                        ? `${file.name} is empty.`
                        : `${file.name} cannot be attached. Use images or text files.`
        }
        setAttachments(next)
        if (attachmentNoteTimerRef.current) clearTimeout(attachmentNoteTimerRef.current)
        setAttachmentNote(problem)
        if (problem) {
            attachmentNoteTimerRef.current = setTimeout(() => setAttachmentNote(null), 5000)
        }
    }

    const removeAttachment = (index: number) => {
        if (attachments[index] === refusedAttachment) {
            // the reason goes with its file
            if (attachmentNoteTimerRef.current) clearTimeout(attachmentNoteTimerRef.current)
            setRefusedAttachment(null)
            setAttachmentNote(null)
        }
        setAttachments((prev) => prev.filter((_, i) => i !== index))
    }

    /** files pasted into the text: the same checks and chips as the file picker */
    const handlePaste = (event: React.ClipboardEvent) => {
        const files = Array.from(event.clipboardData?.files ?? [])
        // pasted text has no files: the text box takes it
        if (files.length === 0) return
        event.preventDefault()
        handleAuthCheck(() => addAttachments(files))
    }

    /** files dropped on the box: the same checks and chips as the file picker */
    const handleDrop = (event: React.DragEvent) => {
        const files = Array.from(event.dataTransfer?.files ?? [])
        if (files.length === 0) return
        // without this the browser opens the file in place of the app
        event.preventDefault()
        handleAuthCheck(() => addAttachments(files))
    }

    /** lets the box take a drop of files */
    const handleDragOver = (event: React.DragEvent) => {
        if (Array.from(event.dataTransfer?.types ?? []).includes('Files')) event.preventDefault()
    }

    /** the session that takes the files: the open one, or one made for this first prompt */
    const sessionForFiles = async (prompt: string, options: PromptInputSubmitOptions) => {
        if (mode === 'chat') {
            if (!sessionId) throw new Error('The session is not ready. Send again in a moment.')
            return { id: sessionId, created: undefined }
        }
        // a retry with the same repository and payment source uses the session of the
        // first try. a change of those makes a new one, and the old one goes
        const key = JSON.stringify([
            options.repoUrl,
            options.branch,
            options.issueNumber,
            options.billingSource,
            options.model,
            options.provider,
        ])
        const pending = pendingSessionRef.current
        if (pending?.key === key) return { id: pending.session.id, created: pending.session }
        if (pending) {
            pendingSessionRef.current = null
            void sessionAPI.deleteSession(pending.session.id).catch((error: unknown) => {
                console.warn('[PromptBox] could not remove the unused session:', error)
            })
        }
        const session = await generationAPI.createPromptSession({ prompt, ...options })
        pendingSessionRef.current = { key, session }
        return { id: session.id, created: session }
    }

    /**
     * Stores the files of a prompt, in order. It gives the stored files and the session,
     * or null when a file was refused: then the box keeps its text and chips, the line
     * under it tells the server's reason, and the files stored before it are removed so
     * they do not count to the session cap.
     */
    const storeAttachments = async (prompt: string, options: PromptInputSubmitOptions) => {
        const files = attachments
        const stored: UploadedAttachment[] = []
        let targetId: string | null = null
        let current: File | null = null
        try {
            const target = await sessionForFiles(prompt, options)
            targetId = target.id
            for (const file of files) {
                current = file
                const info = await attachmentAPI.upload(target.id, file)
                stored.push({ id: info.id, name: info.name })
            }
            return { stored, session: target.created }
        } catch (error) {
            for (const file of stored) {
                if (!targetId) break
                void attachmentAPI.remove(targetId, file.id).catch((cleanupError: unknown) => {
                    console.warn('[PromptBox] could not remove a stored file:', cleanupError)
                })
            }
            const reason =
                error instanceof Error && error.message ? error.message : 'Upload failed.'
            if (attachmentNoteTimerRef.current) clearTimeout(attachmentNoteTimerRef.current)
            setRefusedAttachment(current)
            setAttachmentNote(current ? `${current.name}: ${reason}` : reason)
            return null
        }
    }

    // Fast or Deep: on credits the server picks the model for it, on a key it is how
    // much the model reasons. every prompt box shows the same speed
    const selectedSpeed = useModelSelection((state) => state.speed)
    const handleSelectSpeed = useCallback(
        (speed: Speed) => useModelSelection.getState().setSpeed(speed),
        []
    )

    /** December credits: there is no model to pick */
    const handleSelectCredits = useCallback(() => {
        setSelectedModel(DEFAULT_SELECTION.model)
        setSelectedProvider(DEFAULT_SELECTION.provider)
        setSelectedSource('CREDITS')
        useModelSelection.getState().select({ ...DEFAULT_SELECTION })
    }, [])

    /** a model of one of the user's own keys */
    const handleSelectModel = useCallback(
        (model: string, provider?: string, source: BillingSource = 'OWN_KEY') => {
            if (source !== 'OWN_KEY') {
                handleSelectCredits()
                return
            }
            setSelectedModel(model)
            setSelectedSource('OWN_KEY')
            if (provider) {
                setSelectedProvider(provider)
            }
            useModelSelection.getState().select({
                model,
                provider: provider ?? useModelSelection.getState().provider,
                source: 'OWN_KEY',
            })
        },
        [handleSelectCredits]
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
        // "your keys" starts on the default model of the first key
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
        (model: string, provider: string) => () => {
            handleSelectModel(model, provider, 'OWN_KEY')
            onModelChange?.(model, provider)
        },
        [handleSelectModel, onModelChange]
    )
    const isOnCredits = selectedSource !== 'OWN_KEY'

    const slashEffortOptions = useMemo<SlashPickOption[]>(
        () =>
            SPEEDS.map((speed) => ({
                id: speed,
                label: SPEED_LABELS[speed],
                selected: selectedSpeed === speed,
                pick: () => handleSelectSpeed(speed),
            })),
        [selectedSpeed, handleSelectSpeed]
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
                    pick: pickModel(model, credential.provider),
                }))
            }),
        [byokData, isOnCredits, selectedModel, selectedProvider, pickModel]
    )
    // on credits December picks the model, so /model offers the two speeds
    const slashModelOptions = isOnCredits ? slashEffortOptions : keyModelOptions

    const lastOwnKey = useModelSelection((state) => state.lastOwnKey)
    const slashSourceOptions = useMemo<SlashPickOption[]>(() => {
        const credits: SlashPickOption = {
            id: 'credits',
            label: 'December credits',
            selected: isOnCredits,
            pick: handleSelectCredits,
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
                pick: pickModel(remembered.model, remembered.provider),
            },
        ]
    }, [byokData, isOnCredits, lastOwnKey, pickModel, handleSelectCredits, onNavigate])

    const slash = useSlashMenu({
        input,
        cursor: currentCursor,
        scope: mode === 'chat' ? 'session' : 'home',
        isAuthenticated,
        onOpenAuth,
        setInput: setInputAt,
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

    const githubConnectUrl = profileAPI.getGithubConnectUrl()

    const {
        repos,
        isLoading: isRepoListLoading,
        isGitlabConnected,
        isGitlabReady,
    } = useConnectedRepos({
        enabled: isReposTriggered && !!isAuthenticated,
        isGithubConnected: hasGithub,
    })
    // a picked repository starts on its default branch; the branch picker changes it
    const startBranchFor = (repo: { defaultBranch?: string | null }) =>
        setSelectedBranch(repo.defaultBranch || 'main')
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
        queryKey: SECRETS_MENTION_KEY,
        queryFn: secretsAPI.getSecrets,
        enabled: isSecretsTriggered && !!isAuthenticated,
    })

    const secrets = uniqueSecretNames(secretsData?.secrets || [])
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
                startBranchFor(repo)
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
            // on December credits the server picks the model, so the prompt names none
            const ownKeyModel =
                selectedSource === 'OWN_KEY'
                    ? { model: selectedModel, provider: selectedProvider }
                    : { model: undefined, provider: undefined }

            // a command typed in full (/rename new title) runs here and is not sent
            const command = slash.trySubmitCommand(input || '')
            if (command) {
                if (command.clear) {
                    if (!isControlled) setInternalInput('')
                    onChange?.('')
                }
                // /review: a new session runs the review prompt on the picked source
                if (command.submit && !isLoading) {
                    onSubmit(command.submit.prompt, {
                        ...ownKeyModel,
                        billingSource: selectedSource,
                        ...command.submit.options,
                    })
                }
                return
            }

            if ((!input?.trim() && selectedRepos.length === 0) || isLoading) return
            // a send that still stores its files is not sent twice
            if (isUploadingRef.current) return

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

            const { values: configValues, pluginsOff, mcpsOff } = usePromptConfig.getState()
            const skills = slash.pickedSkills
            // a running session cannot change its plugins or MCP servers
            const isNewSession = mode !== 'chat'
            const submitOptions: PromptInputSubmitOptions = {
                repoUrl,
                branch,
                issueNumber,
                ...ownKeyModel,
                billingSource: selectedSource,
                runConfig: {
                    planFirst: configValues.planFirst,
                    // fast or deep: on credits the tier, on a key how much the model reasons
                    effort: selectedSpeed,
                    ...(isNewSession ? { openPullRequest: configValues.openPullRequest } : {}),
                    ...(skills.length > 0 ? { skills } : {}),
                    ...(isNewSession && pluginsOff.length > 0
                        ? { disabledPlugins: pluginsOff }
                        : {}),
                    ...(isNewSession && mcpsOff.length > 0 ? { disabledMcps: mcpsOff } : {}),
                },
            }

            const send = (options: PromptInputSubmitOptions) => {
                onSubmit(finalPrompt, options)
                setAttachments([])
                setRefusedAttachment(null)
                setAttachmentNote(null)
                if (!isControlled) setInternalInput('')
                onChange?.('')
                setSelectedRepos([])
                setSelectedBranch('')
                slash.clearChips()
                // a new session starts from the saved configuration. a running session keeps its own
                if (isNewSession) usePromptConfig.getState().reset()
                if (textareaRef.current) textareaRef.current.style.height = 'auto'
            }

            if (attachments.length === 0) {
                send(submitOptions)
                return
            }

            // the files go to the server first. nothing is cleared or sent until all are stored
            isUploadingRef.current = true
            setIsUploading(true)
            void storeAttachments(finalPrompt, submitOptions)
                .then((result) => {
                    if (!result) return
                    pendingSessionRef.current = null
                    send({
                        ...submitOptions,
                        attachments: result.stored,
                        ...(result.session ? { session: result.session } : {}),
                    })
                })
                .finally(() => {
                    isUploadingRef.current = false
                    setIsUploading(false)
                })
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
        selectedSpeed,
        handleSelectModel,
        handleSelectCredits,
        handleSelectSpeed,
        slash,
        attachments,
        attachmentNote,
        refusedAttachment,
        isUploading,
        addAttachments,
        removeAttachment,
        handlePaste,
        handleDrop,
        handleDragOver,
    }
}
