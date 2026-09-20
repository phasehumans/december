import {
    Check,
    Copy,
    Info,
    AlertTriangle,
    Lightbulb,
    ChevronLeft,
    ChevronRight,
} from 'lucide-react'
import React, { useState } from 'react'

import { DOCS_NAV_GROUPS } from '../types'

import type { DocTab } from '../types'
import type { LucideIcon } from 'lucide-react'

import { cn } from '@/shared/lib/utils'

// Code Block with Copy Button
interface CodeBlockProps {
    code: string
    language?: string
    filename?: string
    className?: string
}

export const CodeBlock: React.FC<CodeBlockProps> = ({
    code,
    language = 'bash',
    filename,
    className,
}) => {
    const [copied, setCopied] = useState(false)

    const handleCopy = () => {
        navigator.clipboard.writeText(code)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    return (
        <div
            className={cn(
                'my-3 rounded-lg border border-[#242323] bg-[#0E0E0E] overflow-hidden text-[13px] font-mono shadow-xs',
                className
            )}
        >
            {(filename || language) && (
                <div className="flex items-center justify-between px-3.5 py-2 border-b border-[#242323] bg-[#141414] text-[#8E8D8A] text-[12px]">
                    <span>{filename || language}</span>
                    <button
                        type="button"
                        onClick={handleCopy}
                        className="flex items-center gap-1.5 text-[11px] hover:text-[#EDEDEF] transition-colors cursor-pointer"
                        aria-label="Copy code"
                    >
                        {copied ? (
                            <>
                                <Check className="w-3.5 h-3.5 text-[#7FD6B0]" />
                                <span className="text-[#7FD6B0]">Copied</span>
                            </>
                        ) : (
                            <>
                                <Copy className="w-3.5 h-3.5" />
                                <span>Copy</span>
                            </>
                        )}
                    </button>
                </div>
            )}
            <div className="relative p-3.5 overflow-x-auto text-[#D6D5C9] select-all leading-relaxed whitespace-pre">
                {!filename && (
                    <button
                        type="button"
                        onClick={handleCopy}
                        className="absolute top-2.5 right-2.5 flex items-center gap-1 p-1 rounded hover:bg-[#1E1E1E] text-[#8E8D8A] hover:text-[#EDEDEF] transition-colors cursor-pointer"
                        aria-label="Copy code"
                    >
                        {copied ? (
                            <Check className="w-3.5 h-3.5 text-[#7FD6B0]" />
                        ) : (
                            <Copy className="w-3.5 h-3.5" />
                        )}
                    </button>
                )}
                <code>{code}</code>
            </div>
        </div>
    )
}

// Callout component (Tip, Info, Warning)
interface DocCalloutProps {
    type?: 'tip' | 'info' | 'warning'
    title?: string
    children: React.ReactNode
}

export const DocCallout: React.FC<DocCalloutProps> = ({ type = 'info', title, children }) => {
    const config = {
        tip: {
            icon: Lightbulb,
            borderColor: 'border-[#7FD6B0]/30',
            bgColor: 'bg-[#7FD6B0]/5',
            iconColor: 'text-[#7FD6B0]',
            defaultTitle: 'Tip',
        },
        info: {
            icon: Info,
            borderColor: 'border-[#87B2F4]/30',
            bgColor: 'bg-[#87B2F4]/5',
            iconColor: 'text-[#87B2F4]',
            defaultTitle: 'Note',
        },
        warning: {
            icon: AlertTriangle,
            borderColor: 'border-[#E5A93C]/30',
            bgColor: 'bg-[#E5A93C]/5',
            iconColor: 'text-[#E5A93C]',
            defaultTitle: 'Important',
        },
    }[type]

    const Icon = config.icon

    return (
        <div
            className={cn(
                'my-4 p-4 rounded-xl border flex gap-3 text-[13.5px] leading-relaxed',
                config.borderColor,
                config.bgColor
            )}
        >
            <Icon className={cn('w-5 h-5 shrink-0 mt-0.5', config.iconColor)} strokeWidth={1.5} />
            <div className="flex flex-col gap-1 text-[#D6D5C9]">
                {(title || config.defaultTitle) && (
                    <span className="font-medium text-[#EDEDEF]">
                        {title || config.defaultTitle}
                    </span>
                )}
                <div className="text-[#A1A1A6] [&>p]:mb-1.5 last:[&>p]:mb-0">{children}</div>
            </div>
        </div>
    )
}

// Feature Card
interface DocCardProps {
    icon: LucideIcon
    title: string
    description: string
    tag?: string
    onClick?: () => void
}

export const DocCard: React.FC<DocCardProps> = ({
    icon: Icon,
    title,
    description,
    tag,
    onClick,
}) => {
    return (
        <div
            onClick={onClick}
            className={cn(
                'group p-4 rounded-xl border border-[#242323] bg-[#141414]/90 hover:border-[#383838] hover:bg-[#181818] transition-all flex flex-col gap-2 relative',
                onClick ? 'cursor-pointer' : ''
            )}
        >
            <div className="flex items-center justify-between">
                <div className="w-8 h-8 rounded-lg bg-[#1F1F1F] border border-[#2A2A2A] flex items-center justify-center text-[#EDEDEF] group-hover:text-white transition-colors">
                    <Icon className="w-4 h-4" strokeWidth={1.5} />
                </div>
                {tag && (
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#202020] text-[#9A9998] border border-[#2B2B2B]">
                        {tag}
                    </span>
                )}
            </div>
            <h3 className="text-[14px] font-medium text-[#EDEDEF] group-hover:text-white transition-colors mt-1">
                {title}
            </h3>
            <p className="text-[13px] text-[#9A9998] leading-relaxed">{description}</p>
        </div>
    )
}

// Pagination Component (Previous & Next Page)
interface DocPaginationProps {
    currentTab: DocTab
    onNavigate: (tab: DocTab) => void
}

export const DocPagination: React.FC<DocPaginationProps> = ({ currentTab, onNavigate }) => {
    // Collect all tabs in order from DOCS_NAV_GROUPS
    const orderedItems = DOCS_NAV_GROUPS.flatMap((g) => g.items)
    const currentIndex = orderedItems.findIndex((item) => item.tab === currentTab)

    const prevItem = currentIndex > 0 ? orderedItems[currentIndex - 1] : null
    const nextItem =
        currentIndex >= 0 && currentIndex < orderedItems.length - 1
            ? orderedItems[currentIndex + 1]
            : null

    if (!prevItem && !nextItem) return null

    return (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mt-10 pt-6 border-t border-[#242323]">
            {prevItem ? (
                <button
                    type="button"
                    onClick={() => onNavigate(prevItem.tab)}
                    className="flex-1 flex items-center gap-3 p-3.5 rounded-xl border border-[#242323] hover:border-[#383838] bg-[#141414] hover:bg-[#181818] transition-all text-left cursor-pointer group"
                >
                    <ChevronLeft className="w-4 h-4 text-[#8E8D8A] group-hover:text-[#EDEDEF] transition-colors shrink-0" />
                    <div className="flex flex-col min-w-0">
                        <span className="text-[11px] font-medium text-[#8E8D8A] uppercase tracking-wider">
                            Previous
                        </span>
                        <span className="text-[13.5px] font-medium text-[#EDEDEF] truncate">
                            {prevItem.label}
                        </span>
                    </div>
                </button>
            ) : (
                <div className="flex-1 hidden sm:block" />
            )}

            {nextItem ? (
                <button
                    type="button"
                    onClick={() => onNavigate(nextItem.tab)}
                    className="flex-1 flex items-center justify-between p-3.5 rounded-xl border border-[#242323] hover:border-[#383838] bg-[#141414] hover:bg-[#181818] transition-all text-right cursor-pointer group"
                >
                    <div className="flex flex-col min-w-0 text-left sm:text-right flex-1 mr-2">
                        <span className="text-[11px] font-medium text-[#8E8D8A] uppercase tracking-wider">
                            Next
                        </span>
                        <span className="text-[13.5px] font-medium text-[#EDEDEF] truncate">
                            {nextItem.label}
                        </span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[#8E8D8A] group-hover:text-[#EDEDEF] transition-colors shrink-0" />
                </button>
            ) : (
                <div className="flex-1 hidden sm:block" />
            )}
        </div>
    )
}
