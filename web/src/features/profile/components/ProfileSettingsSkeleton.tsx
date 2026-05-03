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
            <div className="flex flex-col w-full max-w-[800px]">
                {/* Preferences Section */}
                <div className="flex flex-col mb-10">
                    <Skeleton className="h-[18px] w-28 mb-4 bg-[#242323]" />
                    <div className="flex flex-col gap-7 border-t border-[#242323] pt-6">
                        {/* Chat suggestions skeleton */}
                        <div className="flex items-center justify-between">
                            <div className="flex flex-col gap-2">
                                <Skeleton className="h-4 w-32 bg-[#242323]" />
                                <Skeleton className="h-3 w-72 bg-[#242323]" />
                            </div>
                            <Skeleton className="h-5 w-9 rounded-full bg-[#242323]" />
                        </div>
                        {/* Generation sound skeleton */}
                        <div className="flex items-start justify-between">
                            <div className="flex flex-col gap-2 max-w-[60%]">
                                <Skeleton className="h-4 w-48 bg-[#242323]" />
                                <Skeleton className="h-3 w-80 bg-[#242323]" />
                            </div>
                            <div className="flex flex-col gap-3">
                                {[1, 2, 3].map((i) => (
                                    <div key={i} className="flex items-center gap-3">
                                        <Skeleton className="w-4 h-4 rounded-full bg-[#242323]" />
                                        <Skeleton className="w-4 h-4 rounded-full bg-[#242323]" />
                                        <Skeleton className="h-3 w-24 bg-[#242323]" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Memories Section */}
                <div className="flex flex-col mb-10">
                    <Skeleton className="h-[18px] w-24 mb-4 bg-[#242323]" />
                    <div className="flex flex-col gap-4 border border-[#242323] rounded-xl p-5 bg-[#171615]">
                        <Skeleton className="h-3 w-full max-w-2xl bg-[#242323]" />
                        <Skeleton className="h-3 w-3/4 max-w-xl mb-2 bg-[#242323]" />
                        <Skeleton className="h-9 w-40 rounded-lg bg-[#242323]" />
                    </div>
                </div>

                {/* Custom Skills Section */}
                <div className="flex flex-col mb-10">
                    <Skeleton className="h-[18px] w-32 mb-4 bg-[#242323]" />
                    <div className="flex flex-col gap-4 border border-[#242323] rounded-xl p-5 bg-[#171615]">
                        <Skeleton className="h-3 w-full max-w-2xl bg-[#242323]" />
                        <Skeleton className="h-3 w-3/4 max-w-xl mb-2 bg-[#242323]" />
                        <Skeleton className="h-9 w-36 rounded-lg bg-[#242323]" />
                    </div>
                </div>
            </div>
        )
    }

    if (activeTab === 'Billing') {
        return (
            <div className="flex flex-col w-full max-w-[680px]">
                <div className="flex flex-col mb-8">
                    <Skeleton className="h-[18px] w-32 mb-4 bg-[#242323]" />
                    <div className="flex flex-col gap-7 border-t border-[#242323] pt-6">
                        <div className="flex items-center justify-between">
                            <div className="flex flex-col gap-2">
                                <Skeleton className="h-4 w-32 bg-[#242323]" />
                                <Skeleton className="h-3 w-48 bg-[#242323]" />
                            </div>
                            <div className="flex gap-3">
                                <Skeleton className="h-8 w-24 rounded-lg bg-[#242323]" />
                                <Skeleton className="h-8 w-24 rounded-lg bg-[#242323]" />
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex flex-col mb-8">
                    <Skeleton className="h-[18px] w-32 mb-4 bg-[#242323]" />
                    <div className="flex flex-col border-t border-[#242323] pt-6">
                        <div className="flex flex-col md:flex-row gap-8">
                            <Skeleton className="w-[220px] h-[130px] rounded-xl bg-[#242323]" />
                            <div className="flex-1 flex flex-col gap-4 py-2">
                                {[1, 2, 3, 4].map((i) => (
                                    <div key={i} className="flex justify-between">
                                        <Skeleton className="h-4 w-32 bg-[#242323]" />
                                        <Skeleton className="h-4 w-16 bg-[#242323]" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    if (activeTab === 'Usage') {
        return (
            <div className="flex flex-col w-full max-w-[680px]">
                <div className="flex flex-col mb-8">
                    <Skeleton className="h-[18px] w-16 mb-4 bg-[#242323]" />
                    <div className="flex flex-col border-t border-[#242323] pt-6">
                        <div className="flex justify-between mb-6">
                            <Skeleton className="h-8 w-48 rounded-lg bg-[#242323]" />
                            <Skeleton className="h-8 w-24 rounded-lg bg-[#242323]" />
                        </div>
                        <Skeleton className="w-full h-[400px] rounded-xl bg-[#242323]" />
                    </div>
                </div>
            </div>
        )
    }

    if (activeTab === 'API Keys') {
        return (
            <div className="flex flex-col w-full max-w-[680px]">
                <div className="flex flex-col mb-8">
                    <Skeleton className="h-[18px] w-24 mb-4 bg-[#242323]" />
                    <div className="flex flex-col border-t border-[#242323] pt-6">
                        <Skeleton className="h-4 w-full mb-2 bg-[#242323]" />
                        <Skeleton className="h-4 w-3/4 mb-8 bg-[#242323]" />
                        <Skeleton className="w-full h-[180px] rounded-xl bg-[#242323]" />
                    </div>
                </div>
            </div>
        )
    }

    if (activeTab === 'Integrations') {
        return (
            <div className="flex flex-col w-full max-w-[720px]">
                {/* Integrations list skeleton */}
                <div className="flex flex-col mb-10">
                    <Skeleton className="h-[18px] w-28 mb-4 bg-[#242323]" />
                    <div className="flex flex-col gap-5 border-t border-[#242323] pt-6">
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <Skeleton className="w-10 h-10 rounded-lg bg-[#242323]" />
                                    <div className="flex flex-col gap-2">
                                        <Skeleton className="h-4 w-20 bg-[#242323]" />
                                        <Skeleton className="h-3 w-64 bg-[#242323]" />
                                    </div>
                                </div>
                                <Skeleton className="h-8 w-24 rounded-lg bg-[#242323]" />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Repositories section skeleton */}
                <div className="flex flex-col mb-10">
                    <Skeleton className="h-[18px] w-48 mb-4 bg-[#242323]" />
                    <div className="flex flex-col border border-[#242323] rounded-xl overflow-hidden bg-[#100E12]">
                        <div className="flex items-center justify-between px-4 py-3 bg-[#171615] border-b border-[#242323]">
                            <Skeleton className="h-3 w-40 bg-[#242323]" />
                            <Skeleton className="h-7 w-28 rounded-lg bg-[#242323]" />
                        </div>
                        {[1, 2, 3, 4, 5].map((i) => (
                            <div
                                key={i}
                                className="flex items-center justify-between px-4 py-4 border-b border-[#242323] last:border-b-0"
                            >
                                <div className="flex flex-col gap-2">
                                    <Skeleton className="h-4 w-48 bg-[#242323]" />
                                    <Skeleton className="h-3 w-72 bg-[#242323]" />
                                    <div className="flex items-center gap-4 mt-0.5">
                                        <Skeleton className="h-3 w-20 bg-[#242323]" />
                                        <Skeleton className="h-3 w-16 bg-[#242323]" />
                                        <Skeleton className="h-3 w-20 bg-[#242323]" />
                                    </div>
                                </div>
                            </div>
                        ))}
                        <div className="px-4 py-4 bg-[#171615] border-t border-[#242323] flex items-center justify-between">
                            <Skeleton className="h-3 w-64 bg-[#242323]" />
                            <Skeleton className="h-8 w-32 rounded-lg bg-[#242323]" />
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    // Default to Account skeleton
    return (
        <div className="flex flex-col w-full max-w-[680px]">
            {/* Account Skeleton */}
            <div className="flex flex-col mb-8">
                <Skeleton className="h-[18px] w-24 mb-4 bg-[#242323]" />
                <div className="flex flex-col gap-3 border-t border-[#242323] pt-5">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="flex flex-col gap-2">
                                    <Skeleton className="h-4 w-32 bg-[#242323]" />
                                    <Skeleton className="h-3 w-24 bg-[#242323]" />
                                </div>
                            </div>
                            {i !== 3 && <Skeleton className="h-8 w-28 rounded-lg bg-[#242323]" />}
                        </div>
                    ))}
                </div>
            </div>

            {/* Your Subscription Skeleton */}
            <div className="flex flex-col mb-8">
                <Skeleton className="h-[18px] w-36 mb-4 bg-[#242323]" />
                <div className="flex items-center justify-between border-t border-[#242323] pt-5">
                    <div className="flex flex-col gap-2">
                        <Skeleton className="h-4 w-64 bg-[#242323]" />
                        <Skeleton className="h-3 w-48 bg-[#242323]" />
                    </div>
                    <Skeleton className="h-8 w-28 rounded-lg bg-[#242323]" />
                </div>
            </div>

            {/* Notifications Skeleton */}
            <div className="flex flex-col mb-8">
                <Skeleton className="h-[18px] w-28 mb-4 bg-[#242323]" />
                <div className="flex flex-col gap-7 border-t border-[#242323] pt-6 pb-2">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="flex items-center justify-between">
                            <div className="flex flex-col gap-2">
                                <Skeleton className="h-4 w-40 bg-[#242323]" />
                                <Skeleton className="h-3 w-64 bg-[#242323]" />
                            </div>
                            <Skeleton className="h-5 w-9 rounded-full bg-[#242323]" />
                        </div>
                    ))}
                </div>
            </div>

            {/* System Skeleton */}
            <div className="flex flex-col mb-8">
                <Skeleton className="h-[18px] w-20 mb-4 bg-[#242323]" />
                <div className="flex flex-col gap-6 border-t border-[#242323] pt-6 pb-2">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="flex items-center justify-between">
                            <div className="flex flex-col gap-2">
                                <Skeleton className="h-4 w-48 bg-[#242323]" />
                                <Skeleton className="h-3 w-72 bg-[#242323]" />
                            </div>
                            <Skeleton className="h-8 w-32 rounded-lg bg-[#242323]" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
