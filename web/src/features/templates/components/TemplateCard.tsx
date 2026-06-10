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
                <div className="absolute w-[300%] h-[300%] origin-top-left scale-[0.333333] transition-transform duration-700 ease-[0.25,1,0.5,1] group-hover:scale-[0.34]">
                    <iframe
                        src={`${API_BASE_URL}/template/${template.id}/preview.html`}
                        title={template.title}
                        className="w-full h-full border-0 pointer-events-none select-none bg-white"
                        loading="lazy"
                        sandbox="allow-scripts allow-same-origin"
                    />
                </div>

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
