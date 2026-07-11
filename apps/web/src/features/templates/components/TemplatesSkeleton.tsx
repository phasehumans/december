import React from 'react'

import { Skeleton } from '@/shared/components/ui/Skeleton'

export const TemplatesSkeleton: React.FC = () => {
    return (
        <div className="flex flex-col gap-10">
            {/* Featured Templates Skeleton */}
            <div className="mb-4">
                <div className="flex items-center justify-between mb-5">
                    <Skeleton className="h-[18px] w-40 bg-white/[0.06]" />
                    <div className="flex items-center gap-2">
                        <Skeleton className="w-7 h-7 rounded-full bg-white/[0.04]" />
                        <Skeleton className="w-7 h-7 rounded-full bg-white/[0.04]" />
                    </div>
                </div>
                <div className="flex gap-x-5 md:gap-x-6 overflow-hidden pb-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div
                            key={`featured-skeleton-${i}`}
                            className="shrink-0 w-[280px] md:w-[calc(50%-10px)] lg:w-[calc(33.333%-16px)]"
                        >
                            <div className="flex flex-col gap-3.5 w-full">
                                <Skeleton className="aspect-[16/10] w-full rounded-xl bg-white/[0.06] border border-[#242323]" />
                                <div className="flex items-start justify-between w-full gap-4 px-1 pb-1">
                                    <div className="flex flex-col gap-2 min-w-0 flex-1">
                                        <Skeleton className="h-4 w-3/4 bg-white/[0.06]" />
                                        <Skeleton className="h-3 w-[90%] bg-white/[0.04]" />
                                        <Skeleton className="h-3.5 w-24 bg-white/[0.04] mt-1" />
                                    </div>
                                    <div className="flex flex-col items-end gap-2.5 shrink-0">
                                        <Skeleton className="h-3.5 w-10 bg-white/[0.04]" />
                                        <Skeleton className="h-7 w-[64px] rounded-md bg-white/[0.04]" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Standard Templates Grid Skeleton */}
            <div>
                <div className="flex items-center justify-between mb-6 border-b border-[#242323] pb-4">
                    <Skeleton className="h-5 w-28 bg-white/[0.06]" />
                    <div className="flex items-center gap-2">
                        <Skeleton className="h-8 w-32 rounded-full bg-white/[0.04]" />
                        <Skeleton className="h-8 w-36 rounded-full bg-white/[0.04]" />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-5 md:gap-x-6 gap-y-10">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={`grid-skeleton-${i}`} className="flex flex-col gap-3.5 w-full">
                            <Skeleton className="aspect-[16/10] w-full rounded-xl bg-white/[0.06] border border-[#242323]" />
                            <div className="flex items-start justify-between w-full gap-4 px-1 pb-1">
                                <div className="flex flex-col gap-2 min-w-0 flex-1">
                                    <Skeleton className="h-4 w-3/4 bg-white/[0.06]" />
                                    <Skeleton className="h-3 w-[90%] bg-white/[0.04]" />
                                    <Skeleton className="h-3.5 w-24 bg-white/[0.04] mt-1" />
                                </div>
                                <div className="flex flex-col items-end gap-2.5 shrink-0">
                                    <Skeleton className="h-3.5 w-10 bg-white/[0.04]" />
                                    <Skeleton className="h-7 w-[64px] rounded-md bg-white/[0.04]" />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
