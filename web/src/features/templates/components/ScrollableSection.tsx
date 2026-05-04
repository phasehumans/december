import React, { useRef } from 'react'

import { Icons } from '@/shared/components/ui/Icons'

interface ScrollableSectionProps {
    title: string
    children: React.ReactNode
}

export const ScrollableSection: React.FC<ScrollableSectionProps> = ({ title, children }) => {
    const scrollContainerRef = useRef<HTMLDivElement>(null)

    const scroll = (direction: 'left' | 'right') => {
        if (scrollContainerRef.current) {
            const { current } = scrollContainerRef
            const scrollAmount = direction === 'left' ? -400 : 400
            current.scrollBy({ left: scrollAmount, behavior: 'smooth' })
        }
    }

    return (
        <div className="mb-14 relative group/section">
            <div className="flex items-center justify-between mb-5">
                <h2 className="text-[15px] font-medium text-[#D6D5C9]">{title}</h2>
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
            <div className="-mx-5 lg:-mx-8 px-5 lg:px-8">
                <div
                    ref={scrollContainerRef}
                    className="flex gap-4 md:gap-5 overflow-x-auto no-scrollbar pb-4 snap-x snap-mandatory"
                    style={{ scrollBehavior: 'smooth' }}
                >
                    {children}
                </div>
            </div>
        </div>
    )
}
