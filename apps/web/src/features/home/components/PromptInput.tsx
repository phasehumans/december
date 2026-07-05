import { useQuery } from '@tanstack/react-query'
import { Code, Puzzle, MessageSquare, BookOpen, Key } from 'lucide-react'
import React, { useState, useRef, useEffect, useCallback } from 'react'

import type { PromptInputProps } from '@/features/home/types'

import { profileAPI } from '@/features/profile/api/profile'
import { Icons } from '@/shared/components/ui/Icons'
import { PromptFooter } from '@/shared/components/ui/PromptFooter'

const MENTION_PROVIDERS = [
    {
        id: 'repos',
        trigger: 'repos:',
        icon: Icons.Github,
        title: 'Repositories',
        description: 'All repositories added to December',
    },
    {
        id: 'files',
        trigger: 'files:',
        icon: Code,
        title: 'Codebase files',
        description: 'All indexed files',
    },
    {
        id: 'skills',
        trigger: 'skills:',
        icon: Puzzle,
        title: 'Skills',
        description: 'Available skills from repos',
    },
    {
        id: 'sessions',
        trigger: 'sessions:',
        icon: MessageSquare,
        title: 'December sessions',
        description: 'Your previous sessions',
    },
    {
        id: 'playbooks',
        trigger: 'playbooks:',
        icon: BookOpen,
        title: 'Playbooks',
        description: 'All team and community playbooks',
    },
    {
        id: 'secrets',
        trigger: 'secrets:',
        icon: Key,
        title: 'Secrets',
        description: 'Your stored secrets',
    },
]

const PromptInput: React.FC<PromptInputProps> = ({
    onSubmit,
    isLoading,
    placeholder,
    minimized = false,
    onUpload,
    value,
    onChange,
    isAuthenticated,
    onOpenAuth,
}) => {
    const [internalInput, setInternalInput] = useState('')
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const dropdownRef = useRef<HTMLDivElement>(null)
    const [cursorPosition, setCursorPosition] = useState<number | null>(null)
    const [selectedIndex, setSelectedIndex] = useState(0)
    const [selectedRepos, setSelectedRepos] = useState<any[]>([])
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

    const handleInputChange = (val: string) => {
        if (!isControlled) {
            setInternalInput(val)
        }
        onChange?.(val)
    }

    const handleSelect = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
        setCursorPosition((e.target as HTMLTextAreaElement).selectionStart)
    }

    const currentCursor = cursorPosition !== null ? cursorPosition : input.length
    const textBeforeCursor = input.slice(0, currentCursor)
    const reposMatch = textBeforeCursor?.match(/@repos:([^\s]*)$/)
    const isReposTriggered = !!reposMatch
    const repoSearchQuery = reposMatch ? reposMatch[1].toLowerCase() : ''

    const atMatch = textBeforeCursor?.match(/@([a-zA-Z0-9_-]*)$/)
    const isAtTriggered = !!atMatch && !atMatch[0].includes(':')
    const atSearchQuery = isAtTriggered ? atMatch[1].toLowerCase() : ''
    const filteredProviders = MENTION_PROVIDERS.filter(
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

    const isGithubConnected = profile?.githubConnected || (quickInfo?.githubConnected ?? false)

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

    useEffect(() => {
        setSelectedIndex(0)
    }, [atSearchQuery, repoSearchQuery, isAtTriggered, isReposTriggered])

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
        if ((isAtTriggered || isReposTriggered) && textareaRef.current) {
            const rect = textareaRef.current.getBoundingClientRect()
            const spaceBelow = window.innerHeight - rect.bottom
            if (spaceBelow < 320 && rect.top > spaceBelow) {
                setDropdownPosition('top')
            } else {
                setDropdownPosition('bottom')
            }
        }
    }, [isAtTriggered, isReposTriggered])

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
            textareaRef.current.style.height = 'auto'
            const scrollHeight = textareaRef.current.scrollHeight
            textareaRef.current.style.height = `${Math.min(scrollHeight, 200)}px`
            textareaRef.current.style.overflowY = scrollHeight >= 200 ? 'auto' : 'hidden'

            // Auto-focus if externally triggered to open the repo dropdown
            if (input?.endsWith('@repos:') && document.activeElement !== textareaRef.current) {
                textareaRef.current.focus()
                const len = input.length
                textareaRef.current.setSelectionRange(len, len)
                setCursorPosition(len)
            }
        }
    }, [input])

    const handleSubmit = (event?: React.FormEvent) => {
        event?.preventDefault()
        handleAuthCheck(() => {
            if ((!input?.trim() && selectedRepos.length === 0) || isLoading) return

            let finalPrompt = input || ''
            if (selectedRepos.length > 0) {
                const repoUrls = selectedRepos.map((r) => r.htmlUrl).join('\n')
                finalPrompt = finalPrompt.trim() ? `${repoUrls}\n\n${finalPrompt}` : repoUrls
            }

            onSubmit(finalPrompt)
            if (!isControlled) setInternalInput('')
            onChange?.('')
            setSelectedRepos([])
            if (textareaRef.current) textareaRef.current.style.height = 'auto'
        })
    }

    const handleKeyDown = (event: React.KeyboardEvent) => {
        const isDropdownOpen = (isAtTriggered && !isReposTriggered) || isReposTriggered
        const currentOptionsCount = isReposTriggered
            ? Math.min(filteredRepos.length, 10)
            : filteredProviders.length

        if (isDropdownOpen && currentOptionsCount > 0) {
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
                    if (repo) {
                        const newValue = (input || '').replace(/@repos:[^\s]*$/, '')
                        handleInputChange(newValue)
                        if (!selectedRepos.some((r) => r.id === repo.id)) {
                            setSelectedRepos((prev) => [...prev, repo])
                        }
                    }
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
                // First transcript — capture what's currently in the input as the base
                voiceBaseRef.current = isControlled ? value || '' : internalInput
                isVoiceActiveRef.current = true
            }
            const base = voiceBaseRef.current
            const separator = base && !base.endsWith(' ') ? ' ' : ''
            const newValue = base + separator + text
            handleInputChange(newValue)
        },
        [isControlled, value, internalInput]
    )

    const handleVoiceStateChange = useCallback((isListening: boolean) => {
        if (!isListening) {
            isVoiceActiveRef.current = false
        }
    }, [])

    return (
        <div
            className={`relative w-full transition-all duration-300 ${minimized ? 'max-w-full' : 'max-w-3xl'}`}
        >
            <div
                className={`
        relative group rounded-[17px] bg-[#1F1F1F] border border-[#313131]
        focus-within:border-white/10 focus-within:bg-[#1F1F1F]
        transition-all duration-300 ease-out flex flex-col
      `}
            >
                <div
                    className={`flex flex-wrap items-start w-full relative rounded-t-[16px] overflow-visible ${minimized ? 'py-4 pl-5 pr-12 min-h-[54px]' : 'pt-[17px] pl-5 pr-12 pb-1 min-h-[92px] text-[15px]'}`}
                >
                    {selectedRepos.map((repo, idx) => (
                        <div
                            key={idx}
                            className="flex items-center gap-1.5 text-[#E8E8E8] font-sans font-medium mr-1.5 mb-1 bg-[#2A2928] px-2 py-0.5 rounded-[6px]"
                        >
                            <Icons.Github className="w-3.5 h-3.5 text-white" />
                            <span className="text-[14px] leading-relaxed">
                                {repo.owner.login}/{repo.name}
                            </span>
                        </div>
                    ))}

                    <div className="relative flex-1 min-w-[100px]">
                        <textarea
                            ref={textareaRef}
                            value={input}
                            onChange={(event) => handleInputChange(event.target.value)}
                            onKeyDown={handleKeyDown}
                            onSelect={handleSelect}
                            onKeyUp={handleSelect}
                            onClick={handleSelect}
                            placeholder={
                                placeholder ||
                                (minimized
                                    ? 'Ask a follow-up...'
                                    : selectedRepos.length > 0
                                      ? ''
                                      : 'Ask December to build...')
                            }
                            className={`
                    w-full bg-transparent text-[#D6D5D4] placeholder-[#949494] caret-white
                    resize-none focus:outline-none z-10 font-sans font-medium leading-relaxed p-0 m-0 border-none
                    [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/10 hover:[&::-webkit-scrollbar-thumb]:bg-white/20
                  `}
                            rows={minimized ? 1 : 3}
                        />
                    </div>

                    {isAtTriggered && !isReposTriggered && !forceClose && (
                        <div
                            ref={dropdownRef}
                            className={`absolute left-5 z-[100] w-[320px] bg-[#1E1E1E] border border-[#2A2928] rounded-xl shadow-2xl overflow-hidden font-sans flex flex-col max-h-[320px] py-1.5 ${dropdownPosition === 'top' ? 'bottom-[calc(100%+8px)]' : 'top-[48px]'}`}
                        >
                            <div
                                className="flex flex-col overflow-y-auto px-1.5"
                                style={{ scrollbarWidth: 'none' }}
                            >
                                {filteredProviders.length > 0 ? (
                                    filteredProviders.map((provider, idx) => (
                                        <button
                                            key={provider.id}
                                            onMouseEnter={() => setSelectedIndex(idx)}
                                            onClick={() => {
                                                const newValue = (input || '').replace(
                                                    /@[a-zA-Z0-9_-]*$/,
                                                    `@${provider.trigger}`
                                                )
                                                handleInputChange(newValue)
                                                textareaRef.current?.focus()
                                            }}
                                            className={`flex items-center gap-3 px-2 py-2 rounded-lg transition-colors text-left w-full outline-none ${selectedIndex === idx ? 'bg-[#2A2928] dropdown-item-active' : 'hover:bg-[#2A2928]'}`}
                                        >
                                            <provider.icon className="w-[16px] h-[16px] text-[#8F8E8D]" />
                                            <div className="flex flex-col min-w-0 leading-tight gap-0.5">
                                                <span className="text-[13px] font-medium text-[#E8E8E8] truncate">
                                                    {provider.title}
                                                </span>
                                                <span className="text-[11.5px] text-[#8F8E8D] truncate">
                                                    {provider.description}
                                                </span>
                                            </div>
                                        </button>
                                    ))
                                ) : (
                                    <div className="px-3 py-2 text-center text-[12.5px] text-[#8F8E8D]">
                                        No matching options.
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {isReposTriggered && !forceClose && (
                        <div
                            ref={dropdownRef}
                            className={`absolute left-5 z-[100] w-[280px] bg-[#1E1E1E] border border-[#2A2928] rounded-xl shadow-2xl overflow-hidden font-sans flex flex-col max-h-[300px] py-1 ${dropdownPosition === 'top' ? 'bottom-[calc(100%+8px)]' : 'top-[48px]'}`}
                        >
                            <div className="px-3 py-1.5 mb-1">
                                <span className="text-[11.5px] font-medium text-[#8F8E8D]">
                                    Repositories
                                </span>
                            </div>
                            {!isGithubConnected && !isReposLoading ? (
                                <div className="px-3 py-2 text-[12.5px] text-[#8F8E8D]">
                                    Connect GitHub to see repos.
                                </div>
                            ) : isReposLoading ? (
                                <div className="px-3 py-2 text-[12.5px] text-[#8F8E8D]">
                                    Loading...
                                </div>
                            ) : (
                                <div
                                    className="flex flex-col overflow-y-auto px-1.5 pb-1"
                                    style={{ scrollbarWidth: 'none' }}
                                >
                                    {filteredRepos.length > 0 ? (
                                        filteredRepos.slice(0, 10).map((repo, idx) => (
                                            <button
                                                key={repo.id}
                                                onMouseEnter={() => setSelectedIndex(idx)}
                                                onClick={() => {
                                                    const newValue = (input || '').replace(
                                                        /@repos:[^\s]*$/,
                                                        ''
                                                    )
                                                    handleInputChange(newValue)
                                                    if (
                                                        !selectedRepos.some((r) => r.id === repo.id)
                                                    ) {
                                                        setSelectedRepos((prev) => [...prev, repo])
                                                    }
                                                    textareaRef.current?.focus()
                                                }}
                                                className={`flex items-start gap-3 px-2.5 py-2 rounded-lg transition-all duration-150 text-left w-full outline-none ${selectedIndex === idx ? 'bg-[#2A2928] dropdown-item-active' : 'hover:bg-[#252424]'}`}
                                            >
                                                <Icons.Github
                                                    className={`w-[15px] h-[15px] mt-[2px] ${selectedIndex === idx ? 'text-[#E8E8E8]' : 'text-[#8F8E8D]'}`}
                                                />
                                                <div className="flex flex-col min-w-0 leading-tight gap-1">
                                                    <span className="text-[13.5px] font-medium text-[#E8E8E8] truncate">
                                                        {repo.name}
                                                    </span>
                                                    <span className="text-[12px] text-[#8F8E8D] truncate">
                                                        {repo.owner.login}
                                                    </span>
                                                </div>
                                            </button>
                                        ))
                                    ) : (
                                        <div className="px-3 py-2 text-center text-[12.5px] text-[#8F8E8D]">
                                            No repos found.
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <PromptFooter
                    onUpload={() => handleAuthCheck(() => onUpload?.())}
                    onSubmit={() => handleSubmit()}
                    hasInput={!!input?.trim()}
                    isLoading={isLoading}
                    onVoiceTranscript={handleVoiceTranscript}
                    onVoiceStateChange={handleVoiceStateChange}
                    isAuthenticated={isAuthenticated}
                    onOpenAuth={onOpenAuth}
                    onOptionSelect={(trigger) => {
                        const separator = input && !input.endsWith(' ') ? ' ' : ''
                        handleInputChange((input || '') + separator + '@' + trigger)
                        textareaRef.current?.focus()
                    }}
                />
            </div>
        </div>
    )
}

export default PromptInput
