import { Plus, RotateCw, Search } from 'lucide-react'
import React from 'react'

import { SettingsPageHeader, SettingsSectionHeading } from './SettingsPageHeader'
import {
    PAGE_SUBTITLES,
    blueButtonClass,
    listBoxClass,
    listHeaderClass,
    outlineButtonClass,
    sectionBoxClass,
    segmentClass,
    segmentGroupClass,
} from './settingsStyles'

import { Skeleton } from '@/shared/components/ui/Skeleton'

interface ProfileSettingsSkeletonProps {
    activeTab?: string
}

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
                className="p-3.5 bg-[#1F1F1F] border border-[#2A2A2A] rounded-xl flex flex-col justify-between gap-3 min-h-[96px]"
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
    <div className="flex flex-col divide-y divide-[#2A2A2A] animate-in fade-in duration-200">
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
    <div className="flex flex-col w-full max-w-[772px] text-[#D6D5C9] animate-in fade-in duration-200">
        <div className="flex flex-col mb-0">
            <SettingsPageHeader title="Usage" subtitle={PAGE_SUBTITLES.usage} />
            <div className="flex flex-col gap-4">
                {/* controls row */}
                <div className="flex items-center justify-between">
                    {/* quick filters. 30d is the one the page opens with */}
                    <div className={segmentGroupClass}>
                        {['1d', '7d', '30d', '90d'].map((range) => (
                            <div key={range} className={segmentClass(range === '30d')}>
                                {range}
                            </div>
                        ))}
                    </div>

                    <div className="flex items-center gap-1.5 text-[13px] text-[#9A9998]">
                        <span>Total spent:</span>
                        <Skeleton className="h-4 w-12 bg-white/[0.06] rounded" />
                    </div>
                </div>

                {/* table skeleton */}
                <div className={listBoxClass}>
                    <div className={listHeaderClass}>
                        <div className="flex md:hidden items-center justify-between">
                            <span>Project / Date</span>
                            <span>Tokens / Cost</span>
                        </div>
                        <div className="hidden md:grid grid-cols-[130px_200px_1fr_100px_70px] items-center">
                            <div>Date</div>
                            <div>Project</div>
                            <div>Model</div>
                            <div>Tokens</div>
                            <div className="text-right">Cost</div>
                        </div>
                    </div>

                    {/* Mobile skeletons */}
                    <div className="flex md:hidden flex-col divide-y divide-[#2A2A2A]">
                        {[
                            { titleW: 'w-28', costW: 'w-12', subW: 'w-36' },
                            { titleW: 'w-36', costW: 'w-10', subW: 'w-44' },
                            { titleW: 'w-24', costW: 'w-14', subW: 'w-32' },
                            { titleW: 'w-32', costW: 'w-11', subW: 'w-40' },
                            { titleW: 'w-26', costW: 'w-12', subW: 'w-36' },
                        ].map((row, i) => (
                            <div key={i} className="p-3.5 flex flex-col gap-2">
                                <div className="flex items-center justify-between">
                                    <Skeleton
                                        className={`h-4 ${row.titleW} bg-white/[0.04] rounded`}
                                    />
                                    <Skeleton
                                        className={`h-3.5 ${row.costW} bg-white/[0.03] rounded`}
                                    />
                                </div>
                                <Skeleton className={`h-3 ${row.subW} bg-white/[0.025] rounded`} />
                            </div>
                        ))}
                    </div>

                    {/* Desktop skeletons */}
                    <div className="hidden md:flex flex-col divide-y divide-[#2A2A2A]">
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
    </div>
)

export const ProfileBillingHistorySkeleton: React.FC = () => (
    <div className="flex flex-col divide-y divide-[#2A2A2A]">
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
                        <Skeleton className={`h-4 ${row.titleW} bg-white/[0.04] rounded`} />
                        <div className="flex items-center gap-1.5 mt-0.5">
                            <Skeleton className={`h-3 ${row.dateW} bg-white/[0.02] rounded`} />
                            <Skeleton className={`h-3 ${row.statusW} bg-white/[0.03] rounded`} />
                        </div>
                        <Skeleton className="h-2.5 w-16 bg-white/[0.02] rounded mt-0.5" />
                    </div>
                    <Skeleton className={`h-4 ${row.amountW} bg-white/[0.04] rounded shrink-0`} />
                </div>

                {/* Desktop layout */}
                <div className="hidden md:grid grid-cols-12 gap-2 items-center">
                    <div className="md:col-span-3">
                        <Skeleton className={`h-3.5 ${row.dateW} bg-white/[0.025] rounded`} />
                    </div>
                    <div className="md:col-span-5 flex flex-col gap-1 min-w-0 pr-2">
                        <Skeleton className={`h-3.5 ${row.titleW} bg-white/[0.04] rounded`} />
                        <Skeleton className="h-2.5 w-20 bg-white/[0.02] rounded" />
                    </div>
                    <div className="md:col-span-2">
                        <Skeleton className={`h-3.5 ${row.statusW} bg-white/[0.03] rounded`} />
                    </div>
                    <div className="md:col-span-2 flex justify-end">
                        <Skeleton className={`h-3.5 ${row.amountW} bg-white/[0.04] rounded`} />
                    </div>
                </div>
            </div>
        ))}
    </div>
)

export const ProfileBillingSkeleton: React.FC<{ onAddCredits?: () => void }> = ({
    onAddCredits,
}) => (
    <div className="flex flex-col w-full max-w-[772px] text-[#D6D5C9] animate-in fade-in duration-200">
        <SettingsPageHeader title="Billing" subtitle={PAGE_SUBTITLES.billing} />

        {/* credits: the balance and its two buttons */}
        <div className="flex flex-col mb-5">
            <SettingsSectionHeading
                title="Credits"
                description="Your balance, and how to add to it."
            />
            <div className={sectionBoxClass}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-1">
                    <div className="flex flex-col gap-1">
                        <span className="text-[12px] font-medium text-[#7B7A79]">Balance</span>
                        <Skeleton className="h-6 sm:h-7 w-28 bg-white/[0.05] rounded" />
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={onAddCredits}
                            className={`${blueButtonClass} flex-1 sm:flex-initial text-center`}
                        >
                            Add credits
                        </button>
                    </div>
                </div>
            </div>
        </div>

        {/* history */}
        <div className="flex flex-col mb-0">
            <SettingsSectionHeading title="History" description="Payments and codes you added." />
            <div className={listBoxClass}>
                <div className={`hidden md:grid grid-cols-12 gap-2 ${listHeaderClass}`}>
                    <div className="col-span-3">Date</div>
                    <div className="col-span-5">Details</div>
                    <div className="col-span-2">Status</div>
                    <div className="col-span-2 text-right">Amount</div>
                </div>
                <div className="px-3.5 md:px-4">
                    <ProfileBillingHistorySkeleton />
                </div>
            </div>
        </div>
    </div>
)

export const ProfileAccountSkeleton: React.FC = () => (
    <div className="flex flex-col w-full max-w-[772px] text-[#D6D5C9] animate-in fade-in duration-200">
        {/* account: page heading, then avatar, name and email, Edit */}
        <div className="flex flex-col gap-2 mb-6">
            <Skeleton className="h-5 w-24 bg-white/[0.04] rounded" />
            <Skeleton className="h-3.5 w-72 bg-white/[0.025] rounded" />
        </div>
        <div className="flex flex-col mb-6">
            <div className="h-6 flex items-center mb-3">
                <Skeleton className="h-4 w-16 bg-white/[0.04] rounded" />
            </div>
            <div className="flex items-center gap-3 bg-[#1F1F1F] border border-[#2A2A2A] rounded-xl px-4 py-3">
                <Skeleton className="w-9 h-9 rounded-full bg-white/[0.05] shrink-0" />
                <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                    <Skeleton className="h-4 w-28 bg-white/[0.04] rounded" />
                    <Skeleton className="h-3.5 w-44 bg-white/[0.025] rounded" />
                </div>
                <Skeleton className="w-[58px] h-[31px] rounded-lg bg-white/[0.03] shrink-0" />
            </div>
        </div>

        {/* preferences: label and control. the switch shape uses another tone than the
            notification switches, which a test counts */}
        <div className="flex flex-col mb-6">
            <div className="h-6 flex items-center mb-3">
                <Skeleton className="h-4 w-24 bg-white/[0.04] rounded" />
            </div>
            <div className="flex flex-col gap-3 bg-[#1F1F1F] border border-[#2A2A2A] rounded-xl px-4 py-3">
                <div className="flex items-center justify-between min-h-8">
                    <Skeleton className="h-4 w-20 bg-white/[0.04] rounded" />
                    <Skeleton className="h-[30px] w-[150px] rounded-lg bg-white/[0.03] shrink-0" />
                </div>
                <div className="flex items-center justify-between min-h-8">
                    <Skeleton className="h-4 w-52 bg-white/[0.04] rounded" />
                    <Skeleton className="h-5 w-9 rounded-full bg-white/[0.035] shrink-0" />
                </div>
                <div className="flex items-center justify-between min-h-8">
                    <Skeleton className="h-4 w-36 bg-white/[0.04] rounded" />
                    <Skeleton className="w-[62px] h-[31px] rounded-lg bg-white/[0.03] shrink-0" />
                </div>
            </div>
        </div>

        {/* notifications: label and switch */}
        <div className="flex flex-col mb-6">
            <div className="h-6 flex items-center mb-3">
                <Skeleton className="h-4 w-28 bg-white/[0.04] rounded" />
            </div>
            <div className="flex flex-col gap-4 bg-[#1F1F1F] border border-[#2A2A2A] rounded-xl px-4 py-3">
                <div className="flex items-center justify-between">
                    <Skeleton className="h-4 w-28 bg-white/[0.04] rounded" />
                    <Skeleton className="h-5 w-9 rounded-full bg-white/[0.04] shrink-0" />
                </div>
                <div className="flex items-center justify-between">
                    <Skeleton className="h-4 w-24 bg-white/[0.04] rounded" />
                    <Skeleton className="h-5 w-9 rounded-full bg-white/[0.04] shrink-0" />
                </div>
            </div>
        </div>

        {/* sign in: label and button */}
        <div className="flex flex-col mb-0">
            <div className="h-6 flex items-center mb-3">
                <Skeleton className="h-4 w-16 bg-white/[0.04] rounded" />
            </div>
            <div className="flex flex-col gap-2 bg-[#1F1F1F] border border-[#2A2A2A] rounded-xl px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                    <Skeleton className="h-4 w-24 bg-white/[0.04] rounded" />
                    <Skeleton className="w-[78px] h-[31px] rounded-lg bg-white/[0.03] shrink-0" />
                </div>
                <div className="flex items-center justify-between gap-3">
                    <Skeleton className="h-4 w-20 bg-white/[0.04] rounded" />
                    <Skeleton className="w-[148px] h-[31px] rounded-lg bg-white/[0.03] shrink-0" />
                </div>
                <div className="flex items-center justify-between gap-3">
                    <Skeleton className="h-4 w-28 bg-white/[0.04] rounded" />
                    <Skeleton className="w-[68px] h-[31px] rounded-lg bg-white/[0.03] shrink-0" />
                </div>
            </div>
        </div>
    </div>
)

const CONNECTION_SKELETON_ITEMS = [
    { nameW: 'w-16', descW: 'w-[75%] sm:w-[340px]', btnW: 'w-16 sm:w-20' },
    { nameW: 'w-14', descW: 'w-[65%] sm:w-[300px]', btnW: 'w-16 sm:w-20' },
    { nameW: 'w-20', descW: 'w-[85%] sm:w-[380px]', btnW: 'w-16 sm:w-20' },
    { nameW: 'w-14', descW: 'w-[70%] sm:w-[320px]', btnW: 'w-16 sm:w-20' },
    { nameW: 'w-16', descW: 'w-[80%] sm:w-[360px]', btnW: 'w-12 sm:w-14' },
    { nameW: 'w-14', descW: 'w-[75%] sm:w-[340px]', btnW: 'w-12 sm:w-14' },
    { nameW: 'w-16', descW: 'w-[80%] sm:w-[370px]', btnW: 'w-12 sm:w-14' },
    { nameW: 'w-12', descW: 'w-[70%] sm:w-[330px]', btnW: 'w-12 sm:w-14' },
]

export const ProfileConnectionsSkeleton: React.FC = () => (
    <div className="flex flex-col w-full max-w-[772px] text-[#D6D5C9] animate-in fade-in duration-200">
        {/* connections section */}
        <div className="flex flex-col mb-0">
            <div className="h-6 flex items-center mb-3">
                <Skeleton className="h-4 w-28 bg-white/[0.04] rounded" />
            </div>
            <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5 mb-1">
                    <Skeleton className="h-3.5 w-full bg-white/[0.025] rounded" />
                    <Skeleton className="h-3.5 w-2/3 bg-white/[0.025] rounded" />
                </div>
                <div className="flex flex-col sm:gap-5 pt-1">
                    {CONNECTION_SKELETON_ITEMS.map((item, idx) => (
                        <div
                            key={idx}
                            className="flex items-center justify-between gap-3 sm:gap-4 py-3 sm:py-0"
                        >
                            <div className="flex items-center gap-3 sm:gap-3.5 min-w-0 flex-1">
                                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-[#191919] flex items-center justify-center shrink-0">
                                    <Skeleton className="w-5 h-5 rounded bg-white/[0.04]" />
                                </div>
                                <div className="flex flex-col gap-1 sm:gap-0.5 min-w-0">
                                    <Skeleton
                                        className={`h-4 ${item.nameW} bg-white/[0.04] rounded`}
                                    />
                                    <Skeleton
                                        className={`h-3 sm:h-3.5 ${item.descW} bg-white/[0.025] rounded mt-0.5`}
                                    />
                                </div>
                            </div>
                            <Skeleton
                                className={`h-[31px] ${item.btnW} rounded-lg bg-white/[0.03] shrink-0`}
                            />
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
    if (activeTab === 'Connections' || activeTab === 'Integrations') {
        return <ProfileConnectionsSkeleton />
    }

    if (activeTab === 'Repositories') {
        return (
            <div className="flex flex-col w-full max-w-[772px] text-[#D6D5C9] animate-in fade-in duration-150">
                <div className="flex flex-col mb-0">
                    <SettingsPageHeader
                        title="Repositories"
                        subtitle={
                            <>
                                Use a repository in a prompt as{' '}
                                <span className="text-[#87B2F4]">@repos:name</span>.
                            </>
                        }
                    />

                    <div className="flex flex-col gap-4">
                        {/* Top Control Bar */}
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                            <div className="relative w-full max-w-full sm:max-w-[340px]">
                                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#7B7A79]" />
                                <input
                                    type="text"
                                    placeholder="Search repositories..."
                                    readOnly
                                    className="w-full pl-9 pr-3 py-1.5 bg-[#1F1F1F] border border-[#2A2A2A] rounded-lg text-[13px] text-[#D6D5C9] placeholder-[#7B7A79] focus:outline-none"
                                />
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    className="p-2 rounded-lg border border-[#383736] text-[#949494] transition-colors"
                                >
                                    <RotateCw className="w-3.5 h-3.5" />
                                </button>
                                <button
                                    type="button"
                                    className={`${blueButtonClass} flex-1 sm:flex-initial flex items-center justify-center gap-1.5`}
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                    <span>Connect GitHub</span>
                                </button>
                            </div>
                        </div>

                        <ProfileRepositoriesSkeleton />
                    </div>
                </div>
            </div>
        )
    }

    if (activeTab === 'Secrets') {
        return (
            <div className="flex flex-col w-full max-w-[772px] text-[#D6D5C9] animate-in fade-in duration-150">
                <div className="flex flex-col mb-0">
                    <SettingsPageHeader
                        title="Secrets"
                        subtitle={
                            <>
                                Use a secret in a session as{' '}
                                <span className="text-[#87B2F4]">$NAME</span>.
                            </>
                        }
                    />
                    <div className="flex flex-col gap-4">
                        {/* Controls Row: Search Input + Action Buttons */}
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                            <div className="relative flex-1 max-w-full sm:max-w-[280px]">
                                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#7B7A79]" />
                                <input
                                    type="text"
                                    placeholder="Search secrets"
                                    readOnly
                                    className="w-full pl-9 pr-3 py-1.5 bg-[#1F1F1F] border border-[#2A2A2A] rounded-lg text-[13px] text-[#D6D5C9] placeholder-[#7B7A79] focus:outline-none"
                                />
                            </div>

                            <div className="hidden md:flex items-center gap-2">
                                <button type="button" className={outlineButtonClass}>
                                    Bulk add
                                </button>

                                <button
                                    type="button"
                                    className={`${blueButtonClass} flex items-center justify-center gap-1.5`}
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                    <span>Add secret</span>
                                </button>
                            </div>
                        </div>

                        {/* Secrets Table Container */}
                        <div className={listBoxClass}>
                            <div className={`hidden md:block ${listHeaderClass}`}>
                                <div className="grid grid-cols-12">
                                    <div className="col-span-4">Name</div>
                                    <div className="col-span-4">Note</div>
                                    <div className="col-span-2">Updated at</div>
                                    <div className="col-span-2 text-right"></div>
                                </div>
                            </div>

                            <ProfileSecretsSkeleton />
                        </div>
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
            <div className="flex flex-col w-full max-w-[772px] text-[#D6D5C9] animate-in fade-in duration-150 gap-4">
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
    return <ProfileAccountSkeleton />
}
