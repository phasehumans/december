import React, { useState } from 'react'
import { motion } from 'framer-motion'

import { Icons } from '@/shared/components/ui/Icons'
import { cn } from '@/shared/lib/utils'

interface TemplateCardProps {
    template: any
}

export const TemplateCard: React.FC<TemplateCardProps> = ({ template }) => {
    const [isLiked, setIsLiked] = useState(false)

    // Format numbers nicely (e.g., 1800 -> 1.8K)
    const formatLikes = (count: number) => {
        if (count >= 1000) {
            return (count / 1000).toFixed(1) + 'K'
        }
        return count.toString()
    }

    return (
        <div className="group flex flex-col gap-3.5 cursor-pointer w-full transition-all duration-300">
            {/* Image Container with depth and premium corners */}
            <div className="relative aspect-[16/10] bg-[#111] overflow-hidden rounded-2xl border border-white/5 group-hover:border-white/15 transition-all duration-300 shadow-md shadow-black/20 group-hover:shadow-xl group-hover:shadow-black/40">
                <img
                    src={template.image}
                    alt={template.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-[0.25,1,0.5,1]"
                />

                {/* Soft bottom gradient for depth */}
                <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/60 to-transparent pointer-events-none opacity-60"></div>

                {/* Remix Hover Interaction - Sleek Arrow/Pill */}
                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10 flex items-center justify-center">
                    <motion.div
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="bg-white text-black shadow-xl h-10 px-5 rounded-full text-[13px] font-medium transition-all flex items-center gap-2 scale-95 group-hover:scale-100 duration-300 ease-out"
                    >
                        <span>Remix</span>
                        <Icons.ArrowRight className="w-3.5 h-3.5 opacity-80" />
                    </motion.div>
                </div>
            </div>

            <div className="flex flex-col gap-1.5 px-1">
                <h3 className="text-[15px] font-medium text-textMain truncate leading-tight group-hover:text-white transition-colors">
                    {template.title}
                </h3>

                <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-3 text-[13px] text-neutral-500 font-medium">
                        <span className="hover:text-white transition-colors cursor-pointer">
                            @{template.author}
                        </span>
                    </div>
                    <div className="flex items-center">
                        <button
                            onClick={(e) => {
                                e.stopPropagation()
                                setIsLiked(!isLiked)
                            }}
                            className={cn(
                                'flex items-center gap-1.5 transition-colors cursor-pointer active:scale-95 group/btn',
                                isLiked ? 'text-white' : 'text-neutral-500 hover:text-white'
                            )}
                        >
                            <Icons.Heart
                                className={cn(
                                    'w-3.5 h-3.5 transition-transform group-hover/btn:scale-110',
                                    isLiked && 'fill-white'
                                )}
                            />
                            <span className="text-[13px] font-medium">
                                {formatLikes(template.likes + (isLiked ? 1 : 0))}
                            </span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
