import React from 'react'

import { Skeleton } from '@/shared/components/ui/Skeleton'

interface ProfileSettingsSkeletonProps {
    activeTab?: string
}

export const ProfileSettingsSkeleton: React.FC<ProfileSettingsSkeletonProps> = ({
    activeTab = 'Account',
}) => {
    if (activeTab === 'Preferences' || activeTab === 'General') {
        return (
            <div className="flex flex-col w-full max-w-[800px] text-[#D6D5C9]">
                {/* Preferences Section */}
                <div className="flex flex-col mb-10">
                    <Skeleton className="h-[18px] w-28 mb-4 bg-white/[0.06]" />
                    <div className="flex flex-col gap-7 border-t border-[#242323] pt-6">
                        {/* Chat suggestions skeleton */}
                        <div className="flex items-center justify-between">
                            <div className="flex flex-col gap-2">
                                <Skeleton className="h-4 w-32 bg-white/[0.06]" />
                                <Skeleton className="h-3 w-[260px] md:w-[480px] bg-white/[0.04]" />
                            </div>
                            <Skeleton className="h-5 w-9 rounded-full bg-white/[0.06]" />
                        </div>
                        {/* Generation sound skeleton */}
                        <div className="flex items-start justify-between">
                            <div className="flex flex-col gap-2 max-w-[60%]">
                                <Skeleton className="h-4 w-48 bg-white/[0.06]" />
                                <Skeleton className="h-3 w-[240px] md:w-[380px] bg-white/[0.04]" />
                            </div>
                            <div className="flex flex-col gap-3">
                                {[1, 2, 3].map((i) => (
                                    <div key={i} className="flex items-center gap-3">
                                        <Skeleton className="w-4 h-4 rounded-full bg-white/[0.04]" />
                                        <Skeleton className="w-4 h-4 rounded-full bg-white/[0.04]" />
                                        <Skeleton className="h-3 w-24 bg-white/[0.04]" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Custom Skills Section */}
                <div className="flex flex-col mb-10">
                    <Skeleton className="h-[18px] w-32 mb-4 bg-white/[0.06]" />
                    <div className="flex flex-col gap-4 border border-[#242323] rounded-xl p-5 bg-[#171615]">
                        <Skeleton className="h-3.5 w-[90%] bg-white/[0.04]" />
                        <Skeleton className="h-3.5 w-3/4 mb-4 bg-white/[0.04]" />

                        {/* Skills Editor skeleton */}
                        <div className="flex flex-col border border-[#2B2A29] rounded-xl overflow-hidden bg-[#131211]">
                            <div className="flex items-center justify-between px-4 py-3 bg-[#131211] border-b border-[#2B2A29]">
                                <Skeleton className="h-4 w-20 bg-white/[0.06]" />
                                <Skeleton className="h-3 w-16 bg-white/[0.04]" />
                            </div>
                            <div className="p-4 bg-[#131211] flex flex-col gap-4">
                                <Skeleton className="w-full h-[320px] rounded-lg bg-[#0E0D0C] border border-[#2B2A29]" />
                                <div className="flex items-center gap-3">
                                    <Skeleton className="h-8 w-16 rounded-lg bg-white/[0.04]" />
                                    <Skeleton className="h-8 w-20 rounded-lg bg-white/[0.04]" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    if (activeTab === 'Billing') {
        return (
            <div className="flex flex-col w-full max-w-[680px] text-[#D6D5C9] animate-in fade-in duration-200">
                {/* Current Plan Skeleton */}
                <div className="flex flex-col mb-8">
                    <Skeleton className="h-[18px] w-32 mb-4 bg-white/[0.06]" />
                    <div className="flex flex-col gap-7 border-t border-[#242323] pt-6">
                        <div className="flex items-center justify-between">
                            <div className="flex flex-col gap-2">
                                <Skeleton className="h-4 w-40 bg-white/[0.06]" />
                                <Skeleton className="h-3.5 w-64 bg-white/[0.04]" />
                            </div>
                            <Skeleton className="h-8 w-28 rounded-lg bg-white/[0.04]" />
                        </div>
                    </div>
                </div>

                {/* Plans Comparison Skeleton */}
                <div className="flex flex-col mb-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {[1, 2].map((i) => (
                            <div
                                key={i}
                                className="rounded-xl border border-[#242323] bg-[#1E1D1B]/5 p-5 flex flex-col justify-between h-[220px]"
                            >
                                <div className="space-y-4">
                                    <div className="flex justify-between">
                                        <Skeleton className="h-4 w-20 bg-white/[0.06]" />
                                        <Skeleton className="h-3.5 w-12 bg-white/[0.04]" />
                                    </div>
                                    <Skeleton className="h-6 w-16 bg-white/[0.06]" />
                                    <div className="space-y-2">
                                        <Skeleton className="h-3 w-3/4 bg-white/[0.04]" />
                                        <Skeleton className="h-3 w-2/3 bg-white/[0.04]" />
                                        <Skeleton className="h-3 w-1/2 bg-white/[0.04]" />
                                    </div>
                                </div>
                                <Skeleton className="h-9 w-full rounded-lg bg-white/[0.04]" />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Credit Balance Skeleton */}
                <div className="flex flex-col mb-8">
                    <Skeleton className="h-[18px] w-32 mb-4 bg-white/[0.06]" />
                    <div className="flex flex-col gap-6 border-t border-[#242323] pt-6">
                        <Skeleton className="h-3.5 w-[90%] bg-white/[0.04]" />
                        <div className="flex flex-col md:flex-row gap-8 items-center mt-2">
                            <Skeleton className="w-[220px] h-[130px] rounded-2xl bg-white/[0.04]" />
                            <div className="flex-1 w-full flex flex-col gap-4 py-2">
                                {[1, 2].map((i) => (
                                    <div key={i} className="flex justify-between">
                                        <Skeleton className="h-4 w-32 bg-white/[0.04]" />
                                        <Skeleton className="h-4 w-16 bg-white/[0.04]" />
                                    </div>
                                ))}
                                <div className="border-t border-[#242323] pt-3 flex justify-between">
                                    <Skeleton className="h-4 w-36 bg-white/[0.06]" />
                                    <Skeleton className="h-4 w-12 bg-white/[0.06]" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Credit Expiration Schedule Skeleton */}
                <div className="flex flex-col mb-8">
                    <Skeleton className="h-[18px] w-48 mb-4 bg-white/[0.06]" />
                    <div className="flex flex-col border-t border-[#242323]">
                        <div className="flex justify-between py-3 border-b border-[#242323]">
                            <Skeleton className="h-3.5 w-16 bg-white/[0.04]" />
                            <Skeleton className="h-3.5 w-24 bg-white/[0.04]" />
                            <Skeleton className="h-3.5 w-20 bg-white/[0.04]" />
                        </div>
                        <div className="flex justify-between py-4">
                            <Skeleton className="h-4 w-20 bg-white/[0.06]" />
                            <Skeleton className="h-4 w-24 bg-white/[0.04]" />
                            <Skeleton className="h-4 w-28 bg-white/[0.04]" />
                        </div>
                    </div>
                </div>

                {/* Used and Expired Credits Skeleton */}
                <div className="flex flex-col mb-8">
                    <Skeleton className="h-[18px] w-56 mb-4 bg-white/[0.06]" />
                    <div className="flex flex-col border-t border-[#242323]">
                        <div className="flex justify-between py-3 border-b border-[#242323]">
                            <Skeleton className="h-3.5 w-24 bg-white/[0.04]" />
                            <Skeleton className="h-3.5 w-20 bg-white/[0.04]" />
                            <Skeleton className="h-3.5 w-16 bg-white/[0.04]" />
                        </div>
                        {[1, 2, 3].map((i) => (
                            <div
                                key={i}
                                className="flex justify-between py-4 border-b border-[#242323]/50 last:border-b-0"
                            >
                                <Skeleton className="h-4 w-28 bg-white/[0.06]" />
                                <Skeleton className="h-4 w-16 bg-white/[0.04]" />
                                <Skeleton className="h-4 w-20 bg-white/[0.04]" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )
    }

    if (activeTab === 'Usage') {
        return (
            <div className="flex flex-col w-full max-w-[800px] text-[#D6D5C9]">
                <div className="flex flex-col mb-8">
                    <Skeleton className="h-[18px] w-16 mb-4 bg-white/[0.06]" />
                    <div className="flex flex-col border-t border-[#242323] pt-6">
                        <div className="flex justify-between mb-6">
                            <Skeleton className="h-8 w-48 rounded-lg bg-white/[0.04]" />
                            <Skeleton className="h-8 w-24 rounded-lg bg-white/[0.04]" />
                        </div>

                        <div className="flex flex-col border border-[#242323] rounded-xl overflow-hidden bg-[#100E12] shadow-sm">
                            {/* Table Header skeleton */}
                            <div className="grid grid-cols-[130px_1fr_140px_100px_70px] items-center py-3.5 px-5 border-b border-[#242323] bg-[#171615] text-[12px] text-[#7B7A79] font-medium">
                                <div>Date</div>
                                <div>Project</div>
                                <div>Model</div>
                                <div>Token Usage</div>
                                <div className="text-right">Cost</div>
                            </div>
                            {/* Table rows skeleton */}
                            {Array.from({ length: 8 }).map((_, i) => (
                                <div
                                    key={i}
                                    className="grid grid-cols-[130px_1fr_140px_100px_70px] items-center py-5 px-5 border-b border-[#242323]/50 last:border-b-0"
                                >
                                    <div className="pr-4">
                                        <Skeleton className="h-4 w-24 bg-white/[0.06] rounded" />
                                    </div>
                                    <div className="pr-4">
                                        <Skeleton className="h-4 w-20 bg-white/[0.04] rounded" />
                                    </div>
                                    <div className="pr-4">
                                        <Skeleton className="h-4 w-24 bg-white/[0.04] rounded" />
                                    </div>
                                    <div className="pr-4">
                                        <Skeleton className="h-4 w-14 bg-white/[0.04] rounded" />
                                    </div>
                                    <div className="flex justify-end pr-1">
                                        <Skeleton className="h-4 w-10 bg-white/[0.06] rounded" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    if (activeTab === 'API Keys') {
        return (
            <div className="flex flex-col w-full max-w-[680px] text-[#D6D5C9]">
                <div className="flex flex-col mb-8">
                    <Skeleton className="h-[18px] w-24 mb-4 bg-white/[0.06]" />
                    <div className="flex flex-col border-t border-[#242323] pt-6">
                        <Skeleton className="h-4 w-full mb-2 bg-white/[0.04]" />
                        <Skeleton className="h-4 w-3/4 mb-8 bg-white/[0.04]" />

                        {/* API keys card skeleton */}
                        <div className="w-full rounded-xl border border-dashed border-[#383736] py-20 flex flex-col items-center justify-center gap-4 bg-[#100E12]/30">
                            <Skeleton className="h-4 w-32 bg-white/[0.04]" />
                            <Skeleton className="h-8 w-24 rounded-lg bg-white/[0.04]" />
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    if (activeTab === 'Integrations') {
        return (
            <div className="flex flex-col w-full max-w-[720px] text-[#D6D5C9]">
                {/* Integrations list skeleton */}
                <div className="flex flex-col mb-10">
                    <Skeleton className="h-[18px] w-28 mb-4 bg-white/[0.06]" />
                    <div className="flex flex-col gap-5 border-t border-[#242323] pt-6">
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <Skeleton className="w-10 h-10 rounded-lg bg-white/[0.04]" />
                                    <div className="flex flex-col gap-2">
                                        <Skeleton className="h-4 w-20 bg-white/[0.06]" />
                                        <Skeleton className="h-3 w-[220px] md:w-[380px] bg-white/[0.04]" />
                                    </div>
                                </div>
                                <Skeleton className="h-8 w-24 rounded-lg bg-white/[0.04]" />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Repositories section skeleton */}
                <div className="flex flex-col mb-10">
                    <Skeleton className="h-[18px] w-48 mb-4 bg-white/[0.06]" />
                    <div className="flex flex-col border border-[#2B2A29] rounded-xl overflow-hidden bg-[#131211]">
                        {/* Header skeleton */}
                        <div className="flex items-center px-5 py-3 bg-[#171615] border-b border-[#2B2A29]">
                            <Skeleton className="h-4 w-40 bg-white/[0.06] rounded" />
                        </div>
                        {/* Repo list skeleton */}
                        {[1, 2, 3, 4, 5].map((i) => (
                            <div
                                key={i}
                                className="flex items-center justify-between px-5 py-4 border-b border-[#1E1D1B] last:border-b-0"
                            >
                                <div className="flex flex-col gap-2 min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        <Skeleton className="h-4 w-44 bg-white/[0.06] rounded" />
                                        <Skeleton className="h-4 w-16 bg-white/[0.04] rounded" />
                                    </div>
                                    <Skeleton className="h-3 w-[75%] bg-white/[0.04] mt-0.5 rounded" />
                                    <div className="flex items-center gap-3.5 mt-1.5">
                                        <Skeleton className="h-3 w-16 bg-white/[0.04] rounded" />
                                        <Skeleton className="h-3 w-14 bg-white/[0.04] rounded" />
                                        <Skeleton className="h-3 w-20 bg-white/[0.04] rounded" />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )
    }

    // Default to Account skeleton
    return (
        <div className="flex flex-col w-full max-w-[680px] text-[#D6D5C9]">
            {/* Account Skeleton */}
            <div className="flex flex-col mb-8">
                <Skeleton className="h-[18px] w-24 mb-4 bg-white/[0.06]" />
                <div className="flex flex-col gap-3 border-t border-[#242323] pt-5">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="flex flex-col gap-2">
                                    <Skeleton className="h-4 w-32 bg-white/[0.06]" />
                                    <Skeleton className="h-3 w-24 bg-white/[0.04]" />
                                </div>
                            </div>
                            {i !== 3 && (
                                <Skeleton className="h-8 w-28 rounded-lg bg-white/[0.04]" />
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Your Subscription Skeleton */}
            <div className="flex flex-col mb-8">
                <Skeleton className="h-[18px] w-36 mb-4 bg-white/[0.06]" />
                <div className="flex items-center justify-between border-t border-[#242323] pt-5">
                    <div className="flex flex-col gap-2">
                        <Skeleton className="h-4 w-64 bg-white/[0.06]" />
                        <Skeleton className="h-3 w-48 bg-white/[0.04]" />
                    </div>
                    <Skeleton className="h-8 w-28 rounded-lg bg-white/[0.04]" />
                </div>
            </div>

            {/* Notifications Skeleton */}
            <div className="flex flex-col mb-8">
                <Skeleton className="h-[18px] w-28 mb-4 bg-white/[0.06]" />
                <div className="flex flex-col gap-7 border-t border-[#242323] pt-6 pb-2">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="flex items-center justify-between">
                            <div className="flex flex-col gap-2">
                                <Skeleton className="h-4 w-40 bg-white/[0.06]" />
                                <Skeleton className="h-3 w-64 bg-white/[0.04]" />
                            </div>
                            <Skeleton className="h-5 w-9 rounded-full bg-white/[0.06]" />
                        </div>
                    ))}
                </div>
            </div>

            {/* System Skeleton */}
            <div className="flex flex-col mb-8">
                <Skeleton className="h-[18px] w-20 mb-4 bg-white/[0.06]" />
                <div className="flex flex-col gap-6 border-t border-[#242323] pt-6 pb-2">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="flex items-center justify-between">
                            <div className="flex flex-col gap-2">
                                <Skeleton className="h-4 w-48 bg-white/[0.06]" />
                                <Skeleton className="h-3 w-72 bg-white/[0.04]" />
                            </div>
                            <Skeleton className="h-8 w-32 rounded-lg bg-white/[0.04]" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
