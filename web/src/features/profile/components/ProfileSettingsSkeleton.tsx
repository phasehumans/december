import React from 'react'

import { Skeleton } from '@/shared/components/ui/Skeleton'

export const ProfileSettingsSkeleton: React.FC = () => {
    return (
        <div className="flex flex-col w-full max-w-[680px]">
            {/* Account Skeleton */}
            <div className="flex flex-col mb-8">
                <Skeleton className="h-[18px] w-24 mb-4" />
                <div className="flex flex-col gap-3 border-t border-[#242323] pt-5">
                    {/* Rows */}
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                {i === 1 && <Skeleton className="w-10 h-10 rounded-full" />}
                                <div className="flex flex-col gap-2">
                                    <Skeleton className="h-4 w-32" />
                                    <Skeleton className="h-3 w-24" />
                                </div>
                            </div>
                            {i !== 4 && <Skeleton className="h-8 w-28 rounded-lg" />}
                        </div>
                    ))}
                </div>
            </div>

            {/* Your Subscription Skeleton */}
            <div className="flex flex-col mb-8">
                <Skeleton className="h-[18px] w-36 mb-4" />
                <div className="flex items-center justify-between border-t border-[#242323] pt-5">
                    <div className="flex flex-col gap-2">
                        <Skeleton className="h-4 w-64" />
                        <Skeleton className="h-3 w-48" />
                    </div>
                    <Skeleton className="h-8 w-28 rounded-lg" />
                </div>
            </div>

            {/* Security Skeleton */}
            <div className="flex flex-col mb-8">
                <Skeleton className="h-[18px] w-24 mb-4" />
                <div className="flex items-center justify-between border-t border-[#242323] pt-5">
                    <div className="flex flex-col gap-2">
                        <Skeleton className="h-4 w-48" />
                        <Skeleton className="h-3 w-64" />
                    </div>
                    <Skeleton className="h-8 w-20 rounded-lg" />
                </div>
            </div>

            {/* System Skeleton */}
            <div className="flex flex-col mb-8">
                <Skeleton className="h-[18px] w-24 mb-4" />
                <div className="flex flex-col gap-3 border-t border-[#242323] pt-5">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="flex items-center justify-between">
                            <div className="flex flex-col gap-2">
                                <Skeleton className="h-4 w-48" />
                                {i !== 1 && <Skeleton className="h-3 w-64" />}
                            </div>
                            <Skeleton className="h-8 w-28 rounded-lg" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
