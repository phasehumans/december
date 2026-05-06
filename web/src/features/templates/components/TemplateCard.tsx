import React from 'react'

import { Icons } from '@/shared/components/ui/Icons'
import { cn } from '@/shared/lib/utils'
import type { Template } from '@/features/templates/types'

interface TemplateCardProps {
    template: Template
    isLikePending?: boolean
    isRemixPending?: boolean
    onToggleLike: (template: Template) => void
    onRemix: (template: Template) => void
}

const previewImages = [
    'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&q=80&w=900&h=560',
    'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&q=80&w=900&h=560',
    'https://images.unsplash.com/photo-1499951360447-b19be8fe80f5?auto=format&fit=crop&q=80&w=900&h=560',
    'https://images.unsplash.com/photo-1555421689-491a97ff2040?auto=format&fit=crop&q=80&w=900&h=560',
]

const getPreviewImage = (templateId: string) => {
    const sum = Array.from(templateId).reduce((acc, char) => acc + char.charCodeAt(0), 0)
    return previewImages[sum % previewImages.length]!
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
                <img
                    src={getPreviewImage(template.id)}
                    alt={template.title}
                    className="w-full h-full object-cover transition-transform duration-700 ease-[0.25,1,0.5,1]"
                />

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
