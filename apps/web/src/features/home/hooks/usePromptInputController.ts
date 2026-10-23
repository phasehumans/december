import { useQuery } from '@tanstack/react-query'
import { KeyRound, Folder } from 'lucide-react'
import { useState, useRef, useEffect, useCallback } from 'react'

import type { PromptInputSubmitOptions } from '@/features/home/types'

import { profileAPI } from '@/features/profile/api/profile'
import { secretsAPI } from '@/features/profile/api/secrets'
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
}: {
    value?: string
    onChange?: (val: string) => void
    onSubmit: (val: string, options?: PromptInputSubmitOptions) => void
    isAuthenticated?: boolean
    onOpenAuth?: () => void
    isLoading?: boolean
    mode?: 'agent' | 'chat'
}) => {
    const [internalInput, setInternalInput] = useState('')
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const dropdownRef = useRef<HTMLDivElement>(null)
    const [cursorPosition, setCursorPosition] = useState<number | null>(null)
    const [selectedIndex, setSelectedIndex] = useState(0)
    const [selectedRepos, setSelectedRepos] = useState<any[]>([])
    const [selectedBranch, setSelectedBranch] = useState('')
    const [forceClose, setForceClose] = useState(false)
    const [dropdownPosition, setDropdownPosition] = useState<'top' | 'bottom'>('bottom')
    const voiceBaseRef = useRef('')
    const isVoiceActiveRef = useRef(false)

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

    const handleSelect = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
        setCursorPosition((e.target as HTMLTextAreaElement).selectionStart)
    }

    const currentCursor = cursorPosition !== null ? cursorPosition : input.length
    const textBeforeCursor = input.slice(0, currentCursor)

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

    const isGithubConnected = Boolean(
        profile?.githubAppInstall || profile?.githubConnected || quickInfo?.githubConnected
    )

    const githubConnectUrl = profile?.id
        ? profileAPI.getGithubConnectUrl(profile.id)
        : profileAPI.getGithubConnectUrl('')

    const { data: repos = [], isLoading: isReposLoading } = useQuery({
        queryKey: ['github-repos'],
        queryFn: profileAPI.getGithubRepos,
        enabled: isReposTriggered && isGithubConnected,
    })

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
            (session.title || 'Untitled Session').toLowerCase().includes(sessionsSearchQuery) ||
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
        if (!selectedRepos.some((r) => r.id === repo.id)) {
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

    const handleSelectSession = (session: any) => {
        const title = session.title || session.id
        const newValue = (input || '').replace(/@sessions?:[^\s]*$/, `@session:${title} `)
        handleInputChange(newValue)
        textareaRef.current?.focus()
    }

    const handleSelectSecret = (secret: any) => {
        const newValue = (input || '').replace(/@secrets?:[^\s]*$/, `@secret:${secret.name} `)
        handleInputChange(newValue)
        textareaRef.current?.focus()
    }

    const handleSubmit = (event?: React.FormEvent) => {
        event?.preventDefault()
        handleAuthCheck(() => {
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

            const submitOptions: PromptInputSubmitOptions = {
                repoUrl,
                branch,
                issueNumber,
            }

            onSubmit(finalPrompt, submitOptions)
            if (!isControlled) setInternalInput('')
            onChange?.('')
            setSelectedRepos([])
            setSelectedBranch('')
            if (textareaRef.current) textareaRef.current.style.height = 'auto'
        })
    }

    const handleKeyDown = (event: React.KeyboardEvent) => {
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

        if (event.key === 'Backspace' && !input && selectedRepos.length > 0) {
            setSelectedRepos((prev) => prev.slice(0, -1))
            return
        }

        if (event.key === 'Enter' && !event.shiftKey) {
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
    }
}
