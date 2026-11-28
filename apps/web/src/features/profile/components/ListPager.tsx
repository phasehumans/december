import { ChevronLeft, ChevronRight } from 'lucide-react'
import React from 'react'

import { PageSizeSelect } from './SettingsUi'

import { cn } from '@/shared/lib/utils'

const pageButtonClass =
    'p-1.5 rounded-lg border border-[#383736] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#191919] transition-colors bg-[#141414] text-[#D6D5C9] cursor-pointer'

/**
 * The footer of a settings list that the server pages (Usage, Billing history): "Show 10"
 * on the left, "1 of 3" and the two arrows on the right. Phones have no "Show" control, and
 * the pager shows there only with a second page.
 */
export const ListPager: React.FC<{
    /** the count of every row, not of the rows on this page */
    total: number
    limit: number
    offset: number
    onOffsetChange: (offset: number) => void
    /** a new page size starts at the first page */
    onLimitChange: (limit: number) => void
    className?: string
}> = ({ total, limit, offset, onOffsetChange, onLimitChange, className }) => {
    if (total <= 0) return null

    const currentPage = Math.floor(offset / limit) + 1
    const totalPages = Math.max(Math.ceil(total / limit), 1)

    return (
        <div
            className={cn(
                'items-center justify-between',
                totalPages > 1 ? 'flex' : 'hidden md:flex',
                className
            )}
        >
            <div className="hidden md:flex">
                <PageSizeSelect value={limit} onChange={onLimitChange} />
            </div>

            <div className="flex items-center gap-4 text-[12.5px] text-[#7B7A79] font-medium ml-auto">
                <span>
                    {currentPage} of {totalPages}
                </span>
                <div className="flex items-center gap-1.5">
                    <button
                        type="button"
                        aria-label="Previous page"
                        onClick={() => onOffsetChange(Math.max(offset - limit, 0))}
                        disabled={offset === 0}
                        className={pageButtonClass}
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                        type="button"
                        aria-label="Next page"
                        onClick={() => onOffsetChange(offset + limit)}
                        disabled={offset + limit >= total}
                        className={pageButtonClass}
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    )
}
