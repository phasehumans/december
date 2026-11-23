import { Folder, KeyRound, Paperclip, Plug, Server, SlidersHorizontal, Zap } from 'lucide-react'
import React, { useRef, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { BottomSheet, SheetHeader } from './BottomSheet'
import { Icons } from './Icons'

import type { BillingSource } from '@/features/home/model-selection'
import type { GithubRepo } from '@/features/profile/api/profile'
import type { BackendSession } from '@/features/sessions/api/session'

import { isConnectionsDemoActive } from '@/features/connections/lib/connectionsDemo'
import { CascadeMenu, type CascadeItem } from '@/features/home/components/CascadeMenu'
import { ModelControl } from '@/features/home/components/ModelControl'
import {
    McpSessionList,
    PluginSessionList,
    PromptConfigRows,
    RepoSideList,
    SecretSideList,
    SessionSideList,
    SkillSideList,
    SoonTag,
} from '@/features/home/components/PromptMenus'
import { isPromptConfigChanged, usePromptConfig } from '@/features/home/promptConfig'
import { TOGGLE_VOICE_EVENT } from '@/shared/lib/appEvents'
import { useIsPhone } from '@/shared/lib/useIsPhone'
import { useVoiceToText } from '@/shared/lib/useVoiceToText'
import { cn } from '@/shared/lib/utils'

interface PromptFooterProps {
    onUpload: () => void
    onSubmit: () => void
    hasInput: boolean
    isLoading: boolean
    onVoiceTranscript?: (text: string) => void
    onVoiceStateChange?: (isListening: boolean) => void
    isAuthenticated?: boolean
    onOpenAuth?: () => void
    /** types "@repos:" and so on into the box. used when a row has no pick handler */
    onOptionSelect?: (trigger: string) => void
    mode?: 'agent' | 'chat'
    isThinkingMode?: boolean
    onToggleThinking?: (enabled: boolean) => void
    selectedModel?: string
    selectedProvider?: string
    selectedSource?: BillingSource
    onSelectModel?: (model: string, provider?: string, source?: BillingSource) => void
    /** the slash icon: types a slash in the box and opens the command menu */
    onSlash?: () => void
    /** picks from the lists beside the + menu */
    onPickRepo?: (repo: GithubRepo) => void
    onPickSession?: (session: BackendSession) => void
    onPickSecret?: (secret: { name: string }) => void
    onPickSkill?: (name: string) => void
}

const iconButtonClass =
    'flex items-center justify-center w-8 h-8 rounded-full text-[#8E8E8E] transition-all hover:bg-white/5 hover:text-white outline-none cursor-pointer touch-manipulation'
const tooltipClass =
    'absolute bottom-[calc(100%+6px)] z-50 hidden group-hover/btn:flex items-center gap-1.5 bg-[#1F1F1F] border border-[#282828] px-2.5 py-1 rounded-lg shadow-none whitespace-nowrap animate-in fade-in zoom-in-95 duration-150 pointer-events-none'
const plusIconClass = 'w-4 h-4 text-[#8F8E8D]'

export const PromptFooter: React.FC<PromptFooterProps> = ({
    onUpload,
    onSubmit,
    hasInput,
    isLoading,
    onVoiceTranscript,
    onVoiceStateChange,
    isAuthenticated,
    onOpenAuth,
    onOptionSelect,
    mode = 'agent',
    selectedModel,
    selectedProvider,
    selectedSource = 'CREDITS',
    onSelectModel,
    onSlash,
    onPickRepo,
    onPickSession,
    onPickSecret,
    onPickSkill,
}) => {
    const navigate = useNavigate()
    const [isPlusMenuOpen, setIsPlusMenuOpen] = useState(false)
    const [plusMenuPosition, setPlusMenuPosition] = useState<'top' | 'bottom'>('bottom')
    /** the row whose list is open in the phone sheet */
    const [sheetItemId, setSheetItemId] = useState<string | null>(null)
    const [isConfigOpen, setIsConfigOpen] = useState(false)
    const [configMenuPosition, setConfigMenuPosition] = useState<'top' | 'bottom'>('bottom')
    // skills, plugins, MCPs and the configuration have no backend yet. they work in demo mode
    const [demo] = useState(isConnectionsDemoActive)
    const isConfigChanged = usePromptConfig(isPromptConfigChanged)
    const isPhone = useIsPhone()
    const isPhoneRef = useRef(isPhone)
    useEffect(() => {
        isPhoneRef.current = isPhone
    }, [isPhone])

    const plusRef = useRef<HTMLDivElement>(null)
    const configRef = useRef<HTMLDivElement>(null)

    const { isListening, isSupported, toggleListening } = useVoiceToText({
        onTranscript: (text) => {
            onVoiceTranscript?.(text)
        },
    })

    useEffect(() => {
        onVoiceStateChange?.(isListening)
    }, [isListening, onVoiceStateChange])

    // the /voice command starts and stops the microphone
    useEffect(() => {
        if (!isSupported || !isAuthenticated) return
        window.addEventListener(TOGGLE_VOICE_EVENT, toggleListening)
        return () => window.removeEventListener(TOGGLE_VOICE_EVENT, toggleListening)
    }, [isSupported, isAuthenticated, toggleListening])

    const fileInputRef = useRef<HTMLInputElement>(null)

    const handleUploadClick = () => {
        if (fileInputRef.current) {
            fileInputRef.current.click()
        }
        if (onUpload) {
            onUpload()
        }
    }

    const closePlusMenu = () => {
        setIsPlusMenuOpen(false)
        setSheetItemId(null)
    }

    /** runs a pick from a list beside the + menu, then closes the menu */
    const picked =
        <T,>(handler: (value: T) => void) =>
        (value: T) => {
            closePlusMenu()
            handler(value)
        }

    const openConnections = (path: string) => {
        closePlusMenu()
        navigate(path)
    }

    const isSignedIn = Boolean(isAuthenticated)
    // a signed-out visitor gets no lists: any row opens sign-up
    const sideWhenSignedIn = (side: React.ReactNode) => (isSignedIn ? side : undefined)
    const run = (action: () => void) => () => {
        closePlusMenu()
        if (!isSignedIn) {
            onOpenAuth?.()
            return
        }
        action()
    }

    const allPlusItems: CascadeItem[] = [
        {
            id: 'upload',
            label: 'Upload attachment',
            icon: <Paperclip className={plusIconClass} />,
            onPick: run(handleUploadClick),
        },
        {
            id: 'repos',
            label: 'Repositories',
            icon: <Icons.Github className={plusIconClass} />,
            side: onPickRepo && sideWhenSignedIn(<RepoSideList onPick={picked(onPickRepo)} />),
            onPick: run(() => onOptionSelect?.('repos:')),
        },
        {
            id: 'sessions',
            label: 'Sessions',
            icon: <Folder className={plusIconClass} />,
            side:
                onPickSession &&
                sideWhenSignedIn(<SessionSideList onPick={picked(onPickSession)} />),
            onPick: run(() => onOptionSelect?.('sessions:')),
        },
        {
            id: 'secrets',
            label: 'Secrets',
            icon: (
                <KeyRound
                    className={plusIconClass}
                    style={{ transform: 'scaleY(-1) rotate(-135deg)' }}
                />
            ),
            side:
                onPickSecret && sideWhenSignedIn(<SecretSideList onPick={picked(onPickSecret)} />),
            onPick: run(() => onOptionSelect?.('secrets:')),
        },
        {
            id: 'skills',
            label: 'Skills',
            icon: <Zap className={plusIconClass} />,
            soon: !demo,
            side:
                demo &&
                onPickSkill &&
                sideWhenSignedIn(
                    <SkillSideList
                        onPick={picked(onPickSkill)}
                        onManage={() => openConnections('/settings/connections/skills')}
                    />
                ),
            onPick: run(() => undefined),
        },
        {
            id: 'plugins',
            label: 'Plugins',
            icon: <Plug className={plusIconClass} />,
            soon: !demo,
            side:
                demo &&
                sideWhenSignedIn(
                    <PluginSessionList
                        onBrowse={() => openConnections('/settings/connections/plugins')}
                    />
                ),
            onPick: run(() => undefined),
        },
        {
            id: 'mcps',
            label: 'MCPs',
            icon: <Server className={plusIconClass} />,
            soon: !demo,
            side:
                demo &&
                sideWhenSignedIn(
                    <McpSessionList
                        onManage={() => openConnections('/settings/connections/mcps')}
                    />
                ),
            onPick: run(() => undefined),
        },
    ]

    // a running session cannot change its repo, plugins or MCP servers
    const plusItems =
        mode === 'chat'
            ? allPlusItems.filter(
                  (item) => !['repos', 'sessions', 'plugins', 'mcps'].includes(item.id)
              )
            : allPlusItems

    const sheetItem = plusItems.find((item) => item.id === sheetItemId && item.side)

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            // on phones these menus are bottom sheets, which close from their own backdrop
            if (isPhoneRef.current) return
            if (plusRef.current && !plusRef.current.contains(e.target as Node)) {
                setIsPlusMenuOpen(false)
            }
            if (configRef.current && !configRef.current.contains(e.target as Node)) {
                setIsConfigOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    // Esc closes the configuration menu (the phone sheet handles its own keys)
    useEffect(() => {
        if (!isConfigOpen || isPhone) return
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setIsConfigOpen(false)
        }
        document.addEventListener('keydown', handleKeyDown)
        return () => document.removeEventListener('keydown', handleKeyDown)
    }, [isConfigOpen, isPhone])

    return (
        <div className="flex items-center justify-between px-3 pb-3 mt-0 pl-3 relative">
            <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                multiple
                accept="image/*,.pdf,.doc,.docx,.txt"
                onChange={(e) => {
                    // file handling will be implemented here
                    if (e.target.files && e.target.files.length > 0) {
                        console.log('Files selected:', e.target.files)
                    }
                    // reset input so the same file can be selected again
                    if (fileInputRef.current) {
                        fileInputRef.current.value = ''
                    }
                }}
            />
            <div className="flex items-center gap-1.5 min-w-0">
                <div className="flex items-center min-w-0">
                    <div className="relative group/btn" ref={plusRef}>
                        <button
                            type="button"
                            onClick={(e) => {
                                if (!isPlusMenuOpen) {
                                    const rect = e.currentTarget.getBoundingClientRect()
                                    const spaceBelow = window.innerHeight - rect.bottom
                                    if (spaceBelow < 250 && rect.top > spaceBelow) {
                                        setPlusMenuPosition('top')
                                    } else {
                                        setPlusMenuPosition('bottom')
                                    }
                                    setIsPlusMenuOpen(true)
                                } else {
                                    closePlusMenu()
                                }
                            }}
                            aria-label="Add"
                            aria-expanded={isPlusMenuOpen}
                            className={iconButtonClass}
                        >
                            <Icons.Plus className="w-[18px] h-[18px] stroke-[2.5px]" />
                        </button>
                        {!isPlusMenuOpen && (
                            <div className={cn(tooltipClass, 'left-0')}>
                                <span className="text-[12px] font-medium text-[#EDEDEF]">Add</span>
                            </div>
                        )}

                        {isPlusMenuOpen && !isPhone && (
                            <CascadeMenu
                                items={plusItems}
                                ariaLabel="Add"
                                placement={plusMenuPosition}
                                onClose={closePlusMenu}
                            />
                        )}
                    </div>

                    {onSlash && (
                        <div className="relative group/btn -ml-0.5">
                            <button
                                type="button"
                                aria-label="Commands"
                                onClick={() => onSlash()}
                                className={iconButtonClass}
                            >
                                <svg
                                    viewBox="0 0 24 24"
                                    className="w-[18px] h-[18px]"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                >
                                    <path d="M15.5 4.5 8.5 19.5" />
                                </svg>
                            </button>
                            <div className={cn(tooltipClass, 'left-1/2 -translate-x-1/2')}>
                                <span className="text-[12px] font-medium text-[#EDEDEF]">
                                    Commands
                                </span>
                            </div>
                        </div>
                    )}

                    <div className="relative group/btn -ml-0.5" ref={configRef}>
                        <button
                            type="button"
                            aria-label="Configuration"
                            aria-expanded={isConfigOpen}
                            onClick={(e) => {
                                if (!isAuthenticated && onOpenAuth) {
                                    onOpenAuth()
                                    return
                                }
                                if (!isConfigOpen) {
                                    const rect = e.currentTarget.getBoundingClientRect()
                                    const spaceBelow = window.innerHeight - rect.bottom
                                    setConfigMenuPosition(
                                        spaceBelow < 250 && rect.top > spaceBelow ? 'top' : 'bottom'
                                    )
                                }
                                setIsConfigOpen(!isConfigOpen)
                            }}
                            className={cn(
                                iconButtonClass,
                                'relative',
                                isConfigOpen && 'bg-white/10 text-white'
                            )}
                        >
                            <SlidersHorizontal className="w-4 h-4" />
                            {demo && isConfigChanged && (
                                <span
                                    data-testid="config-changed-dot"
                                    className="absolute top-[6px] right-[6px] w-1.5 h-1.5 rounded-full bg-[#87B2F4]"
                                />
                            )}
                        </button>
                        {!isConfigOpen && (
                            <div className={cn(tooltipClass, 'left-1/2 -translate-x-1/2')}>
                                <span className="text-[12px] font-medium text-[#EDEDEF]">
                                    Configuration
                                </span>
                            </div>
                        )}
                        {isConfigOpen && !isPhone && (
                            <div
                                role="group"
                                aria-label="Configuration"
                                className={cn(
                                    'absolute left-0 w-[230px] max-w-[calc(100vw-32px)] bg-[#1E1E1E] border border-[#2A2928] rounded-2xl p-1 shadow-lg shadow-black/40 z-50 flex flex-col animate-in fade-in zoom-in-95 duration-150',
                                    configMenuPosition === 'top'
                                        ? 'bottom-[calc(100%+8px)]'
                                        : 'top-[calc(100%+8px)]'
                                )}
                            >
                                <PromptConfigRows demo={demo} mode={mode} />
                            </div>
                        )}
                    </div>

                    <ModelControl
                        isAuthenticated={isAuthenticated}
                        selectedModel={selectedModel}
                        selectedProvider={selectedProvider}
                        selectedSource={selectedSource}
                        onSelectModel={onSelectModel}
                    />
                </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
                {isSupported && (
                    <div className="relative group/btn">
                        <button
                            type="button"
                            onClick={() => {
                                if (!isAuthenticated) {
                                    onOpenAuth?.()
                                    return
                                }
                                toggleListening()
                            }}
                            className={cn(
                                'flex items-center justify-center w-8 h-8 rounded-full transition-all outline-none touch-manipulation',
                                isListening
                                    ? 'bg-white/10 text-white'
                                    : 'text-[#8E8E8E] hover:bg-white/5 hover:text-white'
                            )}
                        >
                            <Icons.Microphone className="w-[14px] h-[14px] stroke-[2.5px] relative z-10" />
                        </button>
                        <div className="absolute bottom-[calc(100%+6px)] right-0 z-50 hidden group-hover/btn:flex items-center gap-1.5 bg-[#1F1F1F] border border-[#282828] px-2.5 py-1 rounded-lg shadow-none whitespace-nowrap animate-in fade-in zoom-in-95 duration-150 pointer-events-none">
                            <span className="text-[12px] font-medium text-[#EDEDEF]">
                                {isListening ? 'Stop listening' : 'Record voice prompt'}
                            </span>
                        </div>
                    </div>
                )}
                <div className="relative group/submitbtn">
                    <button
                        onClick={onSubmit}
                        disabled={!hasInput || isLoading}
                        className={`
                            flex items-center justify-center w-8 h-8 rounded-full transition-colors duration-200 outline-none touch-manipulation
                            ${
                                hasInput && !isLoading
                                    ? 'bg-[#D6D5D4] text-black hover:bg-white'
                                    : 'bg-[#2C2C2E] text-[#4A4A4A] cursor-not-allowed'
                            }
                        `}
                    >
                        {isLoading ? (
                            <div className="w-4 h-4 border-2 border-neutral-500 border-t-neutral-800 rounded-full animate-spin" />
                        ) : (
                            <Icons.ArrowRight className="w-4 h-4 stroke-[2px]" />
                        )}
                    </button>
                    <div className="absolute bottom-[calc(100%+6px)] right-0 z-50 hidden group-hover/submitbtn:flex items-center gap-1.5 bg-[#1F1F1F] border border-[#282828] px-2.5 py-1 rounded-lg shadow-none whitespace-nowrap animate-in fade-in zoom-in-95 duration-150 pointer-events-none">
                        <span className="text-[12px] font-medium text-[#EDEDEF]">
                            {!hasInput
                                ? 'Prompt required'
                                : isLoading
                                  ? 'Generating...'
                                  : 'Enter to send'}
                        </span>
                    </div>
                </div>
            </div>

            {isPhone && (
                <>
                    <BottomSheet
                        isOpen={isPlusMenuOpen}
                        onClose={closePlusMenu}
                        onBack={() => {
                            if (!sheetItem) return false
                            setSheetItemId(null)
                            return true
                        }}
                        ariaLabel="Add"
                        header={
                            sheetItem ? (
                                <SheetHeader
                                    title={sheetItem.label}
                                    onBack={() => setSheetItemId(null)}
                                />
                            ) : undefined
                        }
                    >
                        <div className="flex flex-col pb-1 [&>*]:py-2.5 [&>*]:text-[14px]">
                            {sheetItem
                                ? sheetItem.side
                                : plusItems.map((item) => (
                                      <button
                                          key={item.id}
                                          type="button"
                                          aria-disabled={item.soon || undefined}
                                          onClick={() => {
                                              if (item.soon) return
                                              if (item.side) setSheetItemId(item.id)
                                              else item.onPick?.()
                                          }}
                                          className="flex items-center gap-3 px-3 rounded-[10px] text-left font-medium text-[#D6D5D4] outline-none w-full active:bg-[#242424]"
                                      >
                                          <span
                                              className={cn(
                                                  'flex items-center gap-3 min-w-0 flex-1',
                                                  item.soon && 'opacity-50'
                                              )}
                                          >
                                              {item.icon}
                                              <span>{item.label}</span>
                                          </span>
                                          {item.soon && <SoonTag />}
                                      </button>
                                  ))}
                        </div>
                    </BottomSheet>
                    <BottomSheet
                        isOpen={isConfigOpen}
                        onClose={() => setIsConfigOpen(false)}
                        ariaLabel="Configuration"
                    >
                        <div className="flex flex-col pb-1 [&>*]:py-2.5 [&>*]:text-[14px]">
                            <PromptConfigRows demo={demo} mode={mode} />
                        </div>
                    </BottomSheet>
                </>
            )}
        </div>
    )
}
