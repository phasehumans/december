import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { useSearchModel } from '../search/useSearchModel'

import type { SearchItem, SearchRow } from '../search/searchItems'

import { Icons } from '@/shared/components/ui/Icons'
import { useBackToClose } from '@/shared/lib/useBackToClose'
import { cn } from '@/shared/lib/utils'

interface SearchModalProps {
    isOpen: boolean
    onClose: () => void
    onNewThread?: () => void
    onOpenSession?: (sessionId: string) => void
    /** desktop only; leave out to hide the sidebar action */
    onToggleSidebar?: () => void
    /** runs after an item or Ask December runs (not on a plain close) */
    onAction?: () => void
    isAuthenticated?: boolean
    isSidebarCollapsed?: boolean
}

const MOBILE_BREAKPOINT = 768
const FLASH_MS = 700

const useIsMobile = () => {
    const [isMobile, setIsMobile] = useState(() =>
        typeof window !== 'undefined' ? window.innerWidth < MOBILE_BREAKPOINT : false
    )
    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [])
    return isMobile
}

/** visible height and the space the on-screen keyboard takes at the bottom */
const useVisualViewport = (active: boolean) => {
    const [viewport, setViewport] = useState<{ height: number; bottomInset: number } | null>(null)
    useEffect(() => {
        if (!active) return
        const vv = window.visualViewport
        const update = () => {
            const height = vv ? vv.height : window.innerHeight
            const offsetTop = vv ? vv.offsetTop : 0
            setViewport({
                height,
                bottomInset: Math.max(0, window.innerHeight - height - offsetTop),
            })
        }
        update()
        vv?.addEventListener('resize', update)
        vv?.addEventListener('scroll', update)
        window.addEventListener('resize', update)
        return () => {
            vv?.removeEventListener('resize', update)
            vv?.removeEventListener('scroll', update)
            window.removeEventListener('resize', update)
        }
    }, [active])
    return viewport
}

const Highlight: React.FC<{ text: string; indexes: number[] }> = ({ text, indexes }) => {
    if (indexes.length === 0) return <>{text}</>
    const matched = new Set(indexes)
    const parts: React.ReactNode[] = []
    let run = ''
    let runMatched = matched.has(0)
    const flush = (key: number) => {
        if (!run) return
        parts.push(
            runMatched ? (
                <span key={key} className="text-white font-semibold">
                    {run}
                </span>
            ) : (
                run
            )
        )
        run = ''
    }
    for (let i = 0; i < text.length; i++) {
        const isMatch = matched.has(i)
        if (isMatch !== runMatched) {
            flush(i)
            runMatched = isMatch
        }
        run += text[i]
    }
    flush(text.length)
    return <>{parts}</>
}

export const SearchModal: React.FC<SearchModalProps> = ({
    isOpen,
    onClose,
    onNewThread,
    onOpenSession,
    onToggleSidebar,
    onAction,
    isAuthenticated,
    isSidebarCollapsed = false,
}) => {
    const [query, setQuery] = useState('')
    const [selectedIndex, setSelectedIndex] = useState(0)
    const [flash, setFlash] = useState<{ id: string; label: string } | null>(null)
    const inputRef = useRef<HTMLInputElement>(null)
    const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const isMobile = useIsMobile()
    const viewport = useVisualViewport(isOpen && isMobile)
    // back button and back swipe close the search instead of leaving the page
    useBackToClose({ isOpen, onClose })

    const { sections, askDecember, isAiSearching } = useSearchModel({
        isOpen,
        query,
        isAuthenticated,
        isMobile,
        onNewThread,
        onOpenSession,
        onToggleSidebar: isMobile ? undefined : onToggleSidebar,
        isSidebarCollapsed,
    })

    const rows = useMemo<SearchRow[]>(() => sections.flatMap((s) => s.rows), [sections])
    const hasQuery = query.trim().length > 0

    useEffect(() => {
        if (!isOpen) return
        setQuery('')
        setSelectedIndex(0)
        setFlash(null)
        const timer = setTimeout(() => inputRef.current?.focus(), 50)
        return () => clearTimeout(timer)
    }, [isOpen])

    useEffect(() => {
        return () => {
            if (flashTimerRef.current) clearTimeout(flashTimerRef.current)
        }
    }, [])

    useEffect(() => {
        setSelectedIndex(0)
    }, [query])

    useEffect(() => {
        if (selectedIndex >= rows.length && rows.length > 0) setSelectedIndex(rows.length - 1)
    }, [rows.length, selectedIndex])

    useEffect(() => {
        if (!isOpen) return
        document.getElementById(`search-row-${selectedIndex}`)?.scrollIntoView({ block: 'nearest' })
    }, [selectedIndex, isOpen])

    const runItem = useCallback(
        (item: SearchItem, newTab: boolean) => {
            if (item.flashLabel) {
                item.run()
                setFlash({ id: item.id, label: item.flashLabel })
                if (flashTimerRef.current) clearTimeout(flashTimerRef.current)
                flashTimerRef.current = setTimeout(() => {
                    onClose()
                    onAction?.()
                }, FLASH_MS)
                return
            }
            onClose()
            if (newTab && item.href && !item.external) {
                window.open(item.href, '_blank', 'noopener,noreferrer')
            } else {
                item.run()
            }
            onAction?.()
        },
        [onClose, onAction]
    )

    const activate = useCallback(
        (index: number, newTab: boolean) => {
            const row = rows[index]
            if (!row) return
            if (row.kind === 'ask') {
                onClose()
                askDecember(row.prompt)
                onAction?.()
                return
            }
            runItem(row.item, newTab)
        },
        [rows, onClose, askDecember, onAction, runItem]
    )

    useEffect(() => {
        if (!isOpen) return
        const handleKeyDown = (e: KeyboardEvent) => {
            const count = rows.length || 1
            if (e.key === 'ArrowDown') {
                e.preventDefault()
                setSelectedIndex((selectedIndex + 1) % count)
            } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setSelectedIndex((selectedIndex - 1 + count) % count)
            } else if (e.key === 'Enter') {
                e.preventDefault()
                activate(selectedIndex, e.metaKey || e.ctrlKey)
            } else if (e.key === 'Escape') {
                e.preventDefault()
                onClose()
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [isOpen, rows.length, selectedIndex, activate, onClose])

    if (!isOpen) return null

    let rowIndex = 0
    const list = (
        <div
            role="listbox"
            className={cn(
                'flex flex-col py-1.5 overflow-y-auto no-scrollbar',
                isMobile
                    ? 'flex-1 min-h-0 pb-[max(6px,env(safe-area-inset-bottom))]'
                    : 'max-h-[440px]'
            )}
        >
            {sections.map((section, sectionIndex) => (
                <div
                    key={section.key}
                    className={cn(
                        'flex flex-col px-2 pb-1',
                        // a divider only when other rows sit above Ask December
                        section.isAsk && sectionIndex > 0 && 'border-t border-[#282828] mt-1 pt-1.5'
                    )}
                >
                    {section.title && (
                        <div className="px-2.5 pt-1 pb-0.5 text-[11px] font-semibold text-[#7B7A79]">
                            {section.title}
                        </div>
                    )}
                    {section.rows.map((row) => {
                        const index = rowIndex++
                        const isSelected = index === selectedIndex
                        return (
                            <button
                                key={row.kind === 'ask' ? 'ask' : row.item.id}
                                id={`search-row-${index}`}
                                type="button"
                                role="option"
                                aria-selected={isSelected}
                                onMouseMove={() => {
                                    if (index !== selectedIndex) setSelectedIndex(index)
                                }}
                                onClick={(e) => activate(index, e.metaKey || e.ctrlKey)}
                                className={cn(
                                    'flex items-center gap-2.5 w-full text-left rounded-[10px] px-2.5 outline-none cursor-pointer transition-colors',
                                    isMobile ? 'min-h-[42px] py-2' : 'min-h-[32px] py-1.5',
                                    isSelected ? 'bg-[#2A2928]' : 'hover:bg-[#2A2928]/40'
                                )}
                            >
                                {row.kind === 'ask' ? (
                                    <>
                                        <span
                                            className={cn(
                                                'shrink-0 font-medium',
                                                isMobile ? 'text-[14px]' : 'text-[13px]',
                                                isSelected ? 'text-[#EDEDED]' : 'text-[#D6D5D4]'
                                            )}
                                        >
                                            Ask December
                                        </span>
                                        <span
                                            className={cn(
                                                'flex-1 min-w-0 truncate text-[#7B7A79]',
                                                isMobile ? 'text-[14px]' : 'text-[13px]'
                                            )}
                                        >
                                            {row.prompt}
                                        </span>
                                    </>
                                ) : (
                                    <ItemRowContent
                                        row={row}
                                        isSelected={isSelected}
                                        isMobile={isMobile}
                                        hasQuery={hasQuery}
                                        flashLabel={flash?.id === row.item.id ? flash.label : null}
                                    />
                                )}
                            </button>
                        )
                    })}
                </div>
            ))}
            {rows.length === 0 && (
                <div className="py-6 text-center text-[13px] text-[#7B7A79]">No results</div>
            )}
        </div>
    )

    const input = (
        <div
            className={cn(
                'relative flex items-center gap-2.5 border-b border-[#282828]',
                isMobile ? 'px-4 py-3' : 'px-[18px] py-[15px]'
            )}
        >
            {isAiSearching && (
                <span
                    aria-hidden
                    className="absolute left-0 right-0 -bottom-px h-[2px] overflow-hidden pointer-events-none"
                >
                    <span className="absolute inset-y-0 w-[28%] bg-gradient-to-r from-transparent via-[#A8A7A6] to-transparent animate-line-sweep" />
                </span>
            )}
            <Icons.Search className="w-3.5 h-3.5 text-[#888888] shrink-0" />
            <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search"
                aria-label="Search"
                autoComplete="off"
                spellCheck={false}
                aria-busy={isAiSearching}
                className={cn(
                    'w-full bg-transparent font-medium text-[#EDEDED] placeholder-[#777777] focus:outline-none caret-white font-sans',
                    isMobile ? 'text-[16px]' : 'text-[15px]'
                )}
            />
        </div>
    )

    if (isMobile) {
        const sheetHeight = viewport ? Math.min(viewport.height - 48, 640) : undefined
        return (
            <div className="fixed inset-0 z-[200]">
                <div
                    className="fixed inset-0 bg-black/55 animate-in fade-in duration-200"
                    onClick={onClose}
                />
                <div
                    className="fixed left-0 right-0 flex flex-col bg-[#1E1E1E] border border-b-0 border-[#282828] rounded-t-[20px] shadow-[0_-10px_40px_rgba(0,0,0,0.6)] overflow-hidden font-sans animate-sheet-in"
                    style={{
                        bottom: viewport?.bottomInset ?? 0,
                        height: sheetHeight ?? '80dvh',
                    }}
                >
                    <div className="w-9 h-1 rounded-full bg-[#3A3A3A] mx-auto mt-2 shrink-0" />
                    {input}
                    {list}
                </div>
            </div>
        )
    }

    return (
        <div className="fixed inset-0 z-[200]">
            <div
                className="fixed inset-0 bg-black/50 animate-in fade-in duration-200"
                onClick={onClose}
            />
            {/* centered in the area right of the desktop sidebar */}
            <div
                className={cn(
                    'fixed inset-0 flex items-start justify-center p-4 pt-[12vh] pointer-events-none transition-[left] duration-300',
                    isSidebarCollapsed ? 'md:left-[56px]' : 'md:left-[200px]'
                )}
            >
                <div
                    className="w-full max-w-[560px] bg-[#1E1E1E] border border-[#282828] rounded-[18px] shadow-[0_0_80px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 font-sans pointer-events-auto"
                    onClick={(e) => e.stopPropagation()}
                >
                    {input}
                    {list}
                </div>
            </div>
        </div>
    )
}

const ItemRowContent: React.FC<{
    row: Extract<SearchRow, { kind: 'item' }>
    isSelected: boolean
    isMobile: boolean
    hasQuery: boolean
    flashLabel: string | null
}> = ({ row, isSelected, isMobile, hasQuery, flashLabel }) => {
    const { item, indexes } = row
    const labelColor = hasQuery
        ? isSelected
            ? 'text-[#CFCECD]'
            : 'text-[#B9B8B7]'
        : isSelected
          ? 'text-[#EDEDED]'
          : 'text-[#D6D5D4]'

    return (
        <>
            <span
                className={cn(
                    'min-w-0 truncate font-medium',
                    isMobile ? 'text-[14px]' : 'text-[13px]',
                    labelColor
                )}
            >
                {flashLabel ?? <Highlight text={item.label} indexes={indexes} />}
            </span>
            <span className="flex-1" />
            {(item.repo || item.time) && (
                <span className="shrink-0 flex items-center gap-2.5 text-[11.5px] text-[#7B7A79] tabular-nums">
                    {item.repo && <span className="max-w-[140px] truncate">{item.repo}</span>}
                    {item.time && <span className="min-w-[22px] text-right">{item.time}</span>}
                </span>
            )}
        </>
    )
}
