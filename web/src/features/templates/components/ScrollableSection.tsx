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
                <h2 className="text-[17px] font-medium text-textMain">{title}</h2>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => scroll('left')}
                        className="w-8 h-8 rounded-full bg-transparent border border-white/10 flex items-center justify-center text-textMain hover:bg-white/5 transition-all active:scale-95 shadow-sm"
                    >
                        <Icons.ChevronRight className="w-4 h-4 rotate-180" />
                    </button>
                    <button
                        onClick={() => scroll('right')}
                        className="w-8 h-8 rounded-full bg-transparent border border-white/10 flex items-center justify-center text-textMain hover:bg-white/5 transition-all active:scale-95 shadow-sm"
                    >
                        <Icons.ChevronRight className="w-4 h-4" />
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
