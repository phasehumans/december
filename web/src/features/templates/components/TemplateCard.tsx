import React from 'react'

import type { Template } from '@/features/templates/types'

import { Icons } from '@/shared/components/ui/Icons'
import { cn } from '@/shared/lib/utils'
import { API_BASE_URL } from '@/shared/api/client'

interface TemplateCardProps {
    template: Template
    isLikePending?: boolean
    isRemixPending?: boolean
    onToggleLike: (template: Template) => void
    onRemix: (template: Template) => void
}

export const TemplateCard: React.FC<TemplateCardProps> = ({
    template,
    isLikePending = false,
    isRemixPending = false,
    onToggleLike,
    onRemix,
}) => {
    const formatLikes = (count: number) => {
        if (count >= 1000) {
            return (count / 1000).toFixed(1) + 'K'
        }
        return count.toString()
    }

    return (
        <div className="group flex flex-col gap-3.5 cursor-pointer w-full">
            {/* Image Container */}
            <div className="relative aspect-[16/10] bg-[#111] overflow-hidden rounded-xl border border-[#242323] transition-all duration-300">
                {template.previewImageKey ? (
                    <img
                        src={`${API_BASE_URL}/template/${template.id}/preview.png`}
                        alt={template.title}
                        className="w-full h-full object-cover transition-transform duration-700 ease-[0.25,1,0.5,1] group-hover:scale-[1.04]"
                        loading="lazy"
                    />
                ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-[#FAF9F6] to-[#F3F2EE] select-none p-4 text-center">
                        <svg
                            className="w-7 h-7 mb-2 text-[#8C8B86] opacity-90 stroke-[1.5]"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                            <circle cx="9" cy="9" r="2" />
                            <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                        </svg>
                        <span className="text-[12px] font-medium text-[#6B6964] tracking-tight">
                            No preview available
                        </span>
                    </div>
                )}

                {/* Soft bottom gradient for depth */}
                <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/60 to-transparent pointer-events-none opacity-60"></div>
            </div>

            <div className="flex items-start justify-between w-full gap-4 px-1 mt-1">
                {/* Left Info */}
                <div className="flex flex-col gap-1 min-w-0 flex-1">
                    <h3 className="text-[14px] font-medium text-[#D6D5C9] truncate leading-tight">
                        {template.title}
                    </h3>
                    <p className="text-[12px] text-[#7B7A79] line-clamp-1 leading-snug">
                        {template.description ||
                            'High-performance template with clean, modern design.'}
                    </p>
                    <div className="text-[13px] text-[#7B7A79]/80 font-medium mt-0.5">
                        @{template.author}
                    </div>
                </div>

                {/* Right Actions */}
                <div className="flex flex-col items-end gap-2.5 shrink-0">
                    <button
                        onClick={(e) => {
                            e.stopPropagation()
                            onToggleLike(template)
                        }}
                        disabled={isLikePending}
                        className={
                            'flex items-center gap-1.5 transition-colors cursor-pointer active:scale-95 group/btn ' +
                            (template.isLiked
                                ? 'text-[#D6D5C9]'
                                : 'text-[#7B7A79] hover:text-[#D6D5C9]')
                        }
                    >
                        <Icons.Heart
                            className={cn(
                                'w-3.5 h-3.5 transition-transform group-hover/btn:scale-110',
                                template.isLiked && 'fill-[#D6D5C9]'
                            )}
                        />
                        <span className="text-[11px] font-medium">
                            {formatLikes(template.likeCount)}
                        </span>
                    </button>

                    <button
                        onClick={(e) => {
                            e.stopPropagation()
                            onRemix(template)
                        }}
                        disabled={isRemixPending}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[#383736] bg-[#171615] text-[11px] font-medium text-[#D6D5C9] hover:bg-[#1E1D1B] hover:border-[#4B4A49] transition-all active:scale-[0.98] group/remix disabled:opacity-70"
                    >
                        <Icons.Remix className="w-3 h-3 opacity-70 group-hover/remix:opacity-100 transition-opacity" />
                        Remix
                    </button>
                </div>
            </div>
        </div>
    )
}
