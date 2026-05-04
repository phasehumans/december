import React, { useRef } from 'react'
import { motion } from 'framer-motion'

import { Icons } from '@/shared/components/ui/Icons'
import { TemplateCard } from './TemplateCard'
import { FEATURED_TEMPLATES } from '../data'

export const FeaturedTemplates: React.FC = () => {
    const scrollRef = useRef<HTMLDivElement>(null)

    const scroll = (dir: 'left' | 'right') => {
        if (scrollRef.current) {
            scrollRef.current.scrollBy({ left: dir === 'left' ? -520 : 520, behavior: 'smooth' })
        }
    }

    return (
        <div className="mb-14 relative">
            <div className="flex items-center justify-between mb-5">
                <h2 className="text-[15px] font-medium text-[#D6D5C9]">Featured Templates</h2>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => scroll('left')}
                        className="w-7 h-7 rounded-full border border-[#383736] bg-[#171615] flex items-center justify-center text-[#D6D5C9] hover:bg-[#1E1D1B] transition-all active:scale-95"
                    >
                        <Icons.ChevronRight className="w-3.5 h-3.5 rotate-180" />
                    </button>
                    <button
                        onClick={() => scroll('right')}
                        className="w-7 h-7 rounded-full border border-[#383736] bg-[#171615] flex items-center justify-center text-[#D6D5C9] hover:bg-[#1E1D1B] transition-all active:scale-95"
                    >
                        <Icons.ChevronRight className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>

            <div className="relative">
                <div
                    ref={scrollRef}
                    className="flex gap-x-5 md:gap-x-6 overflow-x-auto no-scrollbar pb-3 snap-x snap-mandatory"
                >
                    {FEATURED_TEMPLATES.map((template, i) => (
                        <motion.div
                            key={template.id}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.05, duration: 0.25 }}
                            className="shrink-0 w-[280px] md:w-[calc(50%-10px)] lg:w-[calc(33.333%-16px)] snap-start"
                        >
                            <TemplateCard template={template} />
                        </motion.div>
                    ))}
                </div>
            </div>
        </div>
    )
}
