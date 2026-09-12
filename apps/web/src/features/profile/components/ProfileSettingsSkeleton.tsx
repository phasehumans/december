import React from 'react'

import { Skeleton } from '@/shared/components/ui/Skeleton'

interface ProfileSettingsSkeletonProps {
    activeTab?: string
}

const SettingRowSkeleton: React.FC<{
    titleWidth?: string
    descWidth?: string
    actionType?: 'button' | 'toggle' | 'badge' | 'none'
}> = ({ titleWidth = 'w-36', descWidth = 'w-56', actionType = 'button' }) => (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between py-2.5 gap-2 sm:gap-0">
        <div className="flex flex-col gap-1.5 min-w-0 pr-4">
            <Skeleton className={`h-4 ${titleWidth} bg-white/[0.04] rounded`} />
            {descWidth && <Skeleton className={`h-3 ${descWidth} bg-white/[0.025] rounded`} />}
        </div>
        {actionType === 'button' && (
            <Skeleton className="h-7 sm:h-8 w-24 rounded-lg bg-white/[0.03] shrink-0" />
        )}
        {actionType === 'toggle' && (
            <Skeleton className="h-5 w-9 rounded-full bg-white/[0.04] shrink-0" />
        )}
        {actionType === 'badge' && (
            <Skeleton className="h-5 w-16 rounded-md bg-white/[0.03] shrink-0" />
        )}
    </div>
)

const REPO_SKELETON_ITEMS = [
    { nameW: 'w-36', descW: 'w-[90%]', langW: 'w-14', starsW: 'w-10' },
    { nameW: 'w-44', descW: 'w-[75%]', langW: 'w-16', starsW: 'w-12' },
    { nameW: 'w-28', descW: 'w-[85%]', langW: 'w-12', starsW: 'w-8' },
    { nameW: 'w-40', descW: 'w-[65%]', langW: 'w-14', starsW: 'w-10' },
    { nameW: 'w-32', descW: 'w-[80%]', langW: 'w-11', starsW: 'w-14' },
    { nameW: 'w-48', descW: 'w-[70%]', langW: 'w-16', starsW: 'w-10' },
]

export const ProfileRepositoriesSkeleton: React.FC = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 animate-in fade-in duration-200">
        {REPO_SKELETON_ITEMS.map((item, i) => (
            <div
                key={i}
                className="p-3.5 bg-[#1B1B1B] border border-[#242323] rounded-xl flex flex-col justify-between gap-3 min-h-[96px]"
            >
                <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-col gap-1 min-w-0 flex-1">
                        <Skeleton className={`h-4 ${item.nameW} bg-white/[0.04] rounded`} />
                        <Skeleton className="h-3 w-20 bg-white/[0.02] rounded" />
                    </div>
                    <Skeleton className="h-4 w-12 rounded bg-white/[0.03] shrink-0" />
                </div>
                <Skeleton className={`h-3 ${item.descW} bg-white/[0.025] rounded`} />
                <div className="flex items-center gap-3 pt-1">
                    <div className="flex items-center gap-1.5">
                        <Skeleton className="w-2 h-2 rounded-full bg-white/[0.03]" />
                        <Skeleton className={`h-3 ${item.langW} bg-white/[0.02] rounded`} />
                    </div>
                    <Skeleton className={`h-3 ${item.starsW} bg-white/[0.02] rounded`} />
                    <Skeleton className="h-3 w-16 bg-white/[0.02] rounded" />
                </div>
            </div>
        ))}
    </div>
)

const SECRETS_SKELETON_ROWS = [
    { nameW: 'w-[45%]', noteW: 'w-[65%]', dateW: 'w-14' },
    { nameW: 'w-[60%]', noteW: 'w-[40%]', dateW: 'w-16' },
    { nameW: 'w-[35%]', noteW: 'w-[80%]', dateW: 'w-12' },
    { nameW: 'w-[52%]', noteW: 'w-[50%]', dateW: 'w-14' },
    { nameW: 'w-[40%]', noteW: 'w-[70%]', dateW: 'w-16' },
]

export const ProfileSecretsSkeleton: React.FC = () => (
    <div className="flex flex-col divide-y divide-[#242323] animate-in fade-in duration-200">
        {SECRETS_SKELETON_ROWS.map((row, i) => (
            <React.Fragment key={i}>
                {/* Mobile card (< md) */}
                <div className="md:hidden p-3.5 flex flex-col gap-1.5 text-[13px]">
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex flex-col gap-1 min-w-0 flex-1 pr-2">
                            <Skeleton className={`h-4 ${row.nameW} bg-white/[0.04] rounded`} />
                            <Skeleton className={`h-3 ${row.noteW} bg-white/[0.025] rounded`} />
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            <Skeleton className={`h-3 ${row.dateW} bg-white/[0.02] rounded`} />
                            <Skeleton className="h-4 w-4 rounded bg-white/[0.02]" />
                        </div>
                    </div>
                </div>

                {/* Desktop row (>= md) */}
                <div className="hidden md:grid grid-cols-12 items-center px-4 py-3 text-[13px]">
                    <div className="col-span-4 pr-2">
                        <Skeleton className={`h-4 ${row.nameW} bg-white/[0.04] rounded`} />
                    </div>
                    <div className="col-span-4 pr-2">
                        <Skeleton className={`h-3.5 ${row.noteW} bg-white/[0.025] rounded`} />
                    </div>
                    <div className="col-span-2">
                        <Skeleton className={`h-3 ${row.dateW} bg-white/[0.02] rounded`} />
                    </div>
                    <div className="col-span-2 flex items-center justify-end gap-2">
                        <Skeleton className="h-4 w-4 rounded bg-white/[0.02]" />
                        <Skeleton className="h-4 w-4 rounded bg-white/[0.02]" />
                        <Skeleton className="h-4 w-4 rounded bg-white/[0.02]" />
                    </div>
                </div>
            </React.Fragment>
        ))}
    </div>
)

export const ProfileUsageSkeleton: React.FC = () => (
    <div className="flex flex-col w-full max-w-[800px] text-[#D6D5C9] animate-in fade-in duration-200">
        <h1 className="text-[16px] font-medium mb-3">Usage</h1>
        <div className="flex flex-col border-t border-[#242323] pt-4 gap-4">
            <p className="text-[13px] text-[#7B7A79]">
                Track your token consumption, credit deductions, and generation costs across recent
                model sessions.
            </p>

            {/* controls row */}
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1 bg-[#191919] p-0.5 rounded-lg border border-[#242323]">
                    {['1d', '7d', '30d', '90d'].map((range, idx) => (
                        <div
                            key={range}
                            className={`px-3 py-1.5 rounded-md text-[12px] ${idx === 0 ? 'bg-[#2B2A29]' : ''}`}
                        >
                            <Skeleton className="h-3 w-5 bg-white/[0.04] rounded" />
                        </div>
                    ))}
                </div>
                <div className="flex items-center gap-1.5 text-[13px] text-neutral-400 font-medium">
                    <span>Total spent:</span>
                    <Skeleton className="h-4 w-12 bg-white/[0.04] rounded" />
                </div>
            </div>

            {/* table skeleton */}
            <div className="flex flex-col bg-[#191919] border border-[#242323] rounded-xl overflow-hidden min-h-[380px]">
                <div className="bg-[#202020] border-b border-[#242323] px-3.5 sm:px-4 py-2.5 text-[12px] text-[#7B7A79] font-medium">
                    <div className="flex md:hidden items-center justify-between">
                        <span>Project / Date</span>
                        <span>Tokens / Cost</span>
                    </div>
                    <div className="hidden md:grid grid-cols-[130px_200px_1fr_100px_70px] items-center">
                        <div>Date</div>
                        <div>Project</div>
                        <div>Model</div>
                        <div>Token Usage</div>
                        <div className="text-right">Cost</div>
                    </div>
                </div>

                {/* Mobile skeletons */}
                <div className="flex md:hidden flex-col divide-y divide-[#242323]">
                    {[
                        { titleW: 'w-28', costW: 'w-12', subW: 'w-36' },
                        { titleW: 'w-36', costW: 'w-10', subW: 'w-44' },
                        { titleW: 'w-24', costW: 'w-14', subW: 'w-32' },
                        { titleW: 'w-32', costW: 'w-11', subW: 'w-40' },
                        { titleW: 'w-26', costW: 'w-12', subW: 'w-36' },
                    ].map((row, i) => (
                        <div key={i} className="p-3.5 flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                                <Skeleton className={`h-4 ${row.titleW} bg-white/[0.04] rounded`} />
                                <Skeleton
                                    className={`h-3.5 ${row.costW} bg-white/[0.03] rounded`}
                                />
                            </div>
                            <Skeleton className={`h-3 ${row.subW} bg-white/[0.025] rounded`} />
                        </div>
                    ))}
                </div>

                {/* Desktop skeletons */}
                <div className="hidden md:flex flex-col divide-y divide-[#242323]">
                    {[
                        {
                            dateW: 'w-20',
                            projW: 'w-28',
                            modelW: 'w-24',
                            tokensW: 'w-14',
                            costW: 'w-10',
                        },
                        {
                            dateW: 'w-20',
                            projW: 'w-36',
                            modelW: 'w-20',
                            tokensW: 'w-16',
                            costW: 'w-12',
                        },
                        {
                            dateW: 'w-20',
                            projW: 'w-24',
                            modelW: 'w-24',
                            tokensW: 'w-12',
                            costW: 'w-9',
                        },
                        {
                            dateW: 'w-20',
                            projW: 'w-32',
                            modelW: 'w-28',
                            tokensW: 'w-15',
                            costW: 'w-11',
                        },
                        {
                            dateW: 'w-20',
                            projW: 'w-26',
                            modelW: 'w-20',
                            tokensW: 'w-14',
                            costW: 'w-10',
                        },
                    ].map((row, i) => (
                        <div
                            key={i}
                            className="grid grid-cols-[130px_200px_1fr_100px_70px] items-center py-3 px-4"
                        >
                            <div className="pr-4">
                                <Skeleton
                                    className={`h-3.5 ${row.dateW} bg-white/[0.03] rounded`}
                                />
                            </div>
                            <div className="pr-4">
                                <Skeleton
                                    className={`h-3.5 ${row.projW} bg-white/[0.04] rounded`}
                                />
                            </div>
                            <div className="pr-4">
                                <Skeleton
                                    className={`h-3.5 ${row.modelW} bg-white/[0.025] rounded`}
                                />
                            </div>
                            <div className="pr-4">
                                <Skeleton
                                    className={`h-3.5 ${row.tokensW} bg-white/[0.025] rounded`}
                                />
                            </div>
                            <div className="flex justify-end pr-1">
                                <Skeleton
                                    className={`h-3.5 ${row.costW} bg-white/[0.04] rounded`}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    </div>
)

export const ProfileBillingSkeleton: React.FC = () => (
    <div className="flex flex-col w-full max-w-[800px] text-[#D6D5C9] animate-in fade-in duration-200">
        {/* credits section */}
        <div className="flex flex-col mb-6">
            <h1 className="text-[16px] font-medium text-[#D6D5C9] mb-3">Credits</h1>
            <div className="flex flex-col gap-4 border-t border-[#242323] pt-4">
                <p className="text-[13px] text-[#7B7A79]">
                    Prepaid credits are used to power AI model completions and agent execution in
                    your workspaces.
                </p>

                {/* compact credits balance box */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#191919] border border-[#242323] rounded-xl p-4 sm:p-5 w-full max-w-[560px]">
                    <div className="flex flex-col gap-2">
                        <span className="text-[12px] font-medium text-[#7B7A79]">
                            Wallet Balance
                        </span>
                        <div className="flex items-baseline gap-2">
                            <Skeleton className="h-7 sm:h-8 w-28 bg-white/[0.05] rounded" />
                            <span className="text-[11px] text-[#7B7A79] font-mono">USD</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Skeleton className="h-8 w-24 rounded-lg bg-white/[0.04]" />
                    </div>
                </div>
            </div>
        </div>

        {/* credits history section */}
        <div className="flex flex-col mb-0">
            <h2 className="text-[16px] font-medium text-[#D6D5C9] mb-3">Credits History</h2>
            <div className="flex flex-col border-t border-[#242323] pt-4">
                <div className="grid grid-cols-12 gap-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500 pb-2">
                    <div className="hidden md:block md:col-span-3">Date</div>
                    <div className="col-span-7 md:col-span-5">Details</div>
                    <div className="hidden md:block md:col-span-2">Status</div>
                    <div className="col-span-5 md:col-span-2 text-right">Amount</div>
                </div>

                <div className="flex flex-col divide-y divide-[#242323]/40">
                    {[
                        { titleW: 'w-36', dateW: 'w-24', statusW: 'w-14', amountW: 'w-12' },
                        { titleW: 'w-48', dateW: 'w-20', statusW: 'w-16', amountW: 'w-14' },
                        { titleW: 'w-40', dateW: 'w-24', statusW: 'w-14', amountW: 'w-10' },
                        { titleW: 'w-32', dateW: 'w-22', statusW: 'w-16', amountW: 'w-12' },
                    ].map((row, i) => (
                        <div key={i} className="py-3 text-[13px]">
                            {/* Mobile layout */}
                            <div className="md:hidden flex items-start justify-between gap-2">
                                <div className="flex flex-col gap-1 min-w-0 pr-2">
                                    <Skeleton
                                        className={`h-4 ${row.titleW} bg-white/[0.04] rounded`}
                                    />
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                        <Skeleton
                                            className={`h-3 ${row.dateW} bg-white/[0.02] rounded`}
                                        />
                                        <Skeleton
                                            className={`h-3 ${row.statusW} bg-white/[0.03] rounded`}
                                        />
                                    </div>
                                </div>
                                <Skeleton
                                    className={`h-4 ${row.amountW} bg-white/[0.04] rounded shrink-0`}
                                />
                            </div>

                            {/* Desktop layout */}
                            <div className="hidden md:grid grid-cols-12 gap-2 items-center">
                                <div className="md:col-span-3">
                                    <Skeleton
                                        className={`h-3.5 ${row.dateW} bg-white/[0.025] rounded`}
                                    />
                                </div>
                                <div className="md:col-span-5">
                                    <Skeleton
                                        className={`h-3.5 ${row.titleW} bg-white/[0.04] rounded`}
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <Skeleton
                                        className={`h-3.5 ${row.statusW} bg-white/[0.03] rounded`}
                                    />
                                </div>
                                <div className="md:col-span-2 flex justify-end">
                                    <Skeleton
                                        className={`h-3.5 ${row.amountW} bg-white/[0.04] rounded`}
                                    />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    </div>
)

export const ProfileSettingsSkeleton: React.FC<ProfileSettingsSkeletonProps> = ({
    activeTab = 'Account',
}) => {
    if (activeTab === 'Preferences' || activeTab === 'General') {
        return (
            <div className="flex flex-col w-full max-w-[800px] text-[#D6D5C9] animate-in fade-in duration-150 gap-6">
                <div className="flex flex-col gap-2">
                    <Skeleton className="h-4 w-28 bg-white/[0.04] rounded mb-1" />
                    <div className="flex flex-col gap-1">
                        <SettingRowSkeleton
                            titleWidth="w-36"
                            descWidth="w-72"
                            actionType="toggle"
                        />
                        <SettingRowSkeleton
                            titleWidth="w-44"
                            descWidth="w-80"
                            actionType="button"
                        />
                    </div>
                </div>

                <div className="flex flex-col gap-2">
                    <Skeleton className="h-4 w-32 bg-white/[0.04] rounded mb-1" />
                    <div className="flex flex-col gap-1">
                        <SettingRowSkeleton
                            titleWidth="w-48"
                            descWidth="w-96"
                            actionType="toggle"
                        />
                        <SettingRowSkeleton
                            titleWidth="w-32"
                            descWidth="w-60"
                            actionType="button"
                        />
                    </div>
                </div>
            </div>
        )
    }

    if (activeTab === 'Connections' || activeTab === 'Integrations') {
        return (
            <div className="flex flex-col w-full max-w-[800px] text-[#D6D5C9] animate-in fade-in duration-150 gap-6">
                <div className="flex flex-col gap-3">
                    <Skeleton className="h-4 w-28 bg-white/[0.04] rounded mb-1" />
                    <div className="flex flex-col gap-3">
                        {[
                            { nameW: 'w-24', descW: 'w-64' },
                            { nameW: 'w-20', descW: 'w-56' },
                            { nameW: 'w-28', descW: 'w-72' },
                            { nameW: 'w-20', descW: 'w-60' },
                        ].map((item, i) => (
                            <div
                                key={i}
                                className="flex items-center justify-between p-2.5 rounded-lg bg-white/[0.015]"
                            >
                                <div className="flex items-center gap-3">
                                    <Skeleton className="w-8 h-8 rounded-lg bg-white/[0.03] shrink-0" />
                                    <div className="flex flex-col gap-1.5">
                                        <Skeleton
                                            className={`h-3.5 ${item.nameW} bg-white/[0.04] rounded`}
                                        />
                                        <Skeleton
                                            className={`h-3 ${item.descW} bg-white/[0.025] rounded`}
                                        />
                                    </div>
                                </div>
                                <Skeleton className="h-7 w-20 rounded-lg bg-white/[0.03] shrink-0" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )
    }

    if (activeTab === 'Repositories') {
        return (
            <div className="flex flex-col w-full max-w-[800px] text-[#D6D5C9] animate-in fade-in duration-150 gap-6">
                <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between mb-1">
                        <Skeleton className="h-4 w-32 bg-white/[0.04] rounded" />
                        <Skeleton className="h-7 w-28 rounded-lg bg-white/[0.03]" />
                    </div>
                    <ProfileRepositoriesSkeleton />
                </div>
            </div>
        )
    }

    if (activeTab === 'Secrets') {
        return (
            <div className="flex flex-col w-full max-w-[800px] text-[#D6D5C9] animate-in fade-in duration-150 gap-6">
                <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between mb-1">
                        <Skeleton className="h-4 w-24 bg-white/[0.04] rounded" />
                        <Skeleton className="h-7 w-28 rounded-lg bg-white/[0.03]" />
                    </div>
                    <div className="bg-[#191919] border border-[#242323] rounded-xl overflow-hidden">
                        <div className="bg-[#202020] border-b border-[#242323] px-4 py-2.5 text-[12px] text-[#7B7A79] font-medium hidden md:grid grid-cols-12">
                            <div className="col-span-4">Name</div>
                            <div className="col-span-4">Note</div>
                            <div className="col-span-2">Updated at</div>
                            <div className="col-span-2 text-right"></div>
                        </div>
                        <ProfileSecretsSkeleton />
                    </div>
                </div>
            </div>
        )
    }

    if (activeTab === 'Billing') {
        return <ProfileBillingSkeleton />
    }

    if (activeTab === 'Usage' || activeTab === 'Analytics') {
        return <ProfileUsageSkeleton />
    }

    if (activeTab === 'Privacy' || activeTab === 'Terms') {
        return (
            <div className="flex flex-col w-full max-w-[800px] text-[#D6D5C9] animate-in fade-in duration-150 gap-4">
                <Skeleton className="h-5 w-36 bg-white/[0.04] rounded mb-2" />
                <div className="flex flex-col gap-2.5">
                    <Skeleton className="h-3.5 w-full bg-white/[0.025] rounded" />
                    <Skeleton className="h-3.5 w-11/12 bg-white/[0.025] rounded" />
                    <Skeleton className="h-3.5 w-4/5 bg-white/[0.025] rounded" />
                    <Skeleton className="h-3.5 w-full bg-white/[0.025] rounded" />
                    <Skeleton className="h-3.5 w-3/4 bg-white/[0.025] rounded" />
                </div>
            </div>
        )
    }

    // Default Account Skeleton
    return (
        <div className="flex flex-col w-full max-w-[800px] text-[#D6D5C9] animate-in fade-in duration-150 gap-6">
            <div className="flex flex-col gap-2">
                <Skeleton className="h-4 w-24 bg-white/[0.04] rounded mb-1" />
                <div className="flex flex-col gap-1">
                    <SettingRowSkeleton titleWidth="w-28" descWidth="w-48" actionType="button" />
                    <SettingRowSkeleton titleWidth="w-32" descWidth="w-40" actionType="button" />
                    <SettingRowSkeleton titleWidth="w-24" descWidth="w-56" actionType="none" />
                    <SettingRowSkeleton titleWidth="w-28" descWidth="w-36" actionType="button" />
                </div>
            </div>

            <div className="flex flex-col gap-2">
                <Skeleton className="h-4 w-28 bg-white/[0.04] rounded mb-1" />
                <div className="flex flex-col gap-1">
                    <SettingRowSkeleton titleWidth="w-40" descWidth="w-64" actionType="toggle" />
                    <SettingRowSkeleton titleWidth="w-36" descWidth="w-52" actionType="toggle" />
                    <SettingRowSkeleton titleWidth="w-32" descWidth="w-48" actionType="toggle" />
                </div>
            </div>

            <div className="flex flex-col gap-2">
                <Skeleton className="h-4 w-20 bg-white/[0.04] rounded mb-1" />
                <div className="flex flex-col gap-1">
                    <SettingRowSkeleton titleWidth="w-36" descWidth="w-60" actionType="button" />
                    <SettingRowSkeleton titleWidth="w-32" descWidth="w-52" actionType="button" />
                    <SettingRowSkeleton titleWidth="w-28" descWidth="w-44" actionType="button" />
                </div>
            </div>
        </div>
    )
}
