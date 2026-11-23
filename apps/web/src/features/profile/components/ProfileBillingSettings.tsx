import { useQuery } from '@tanstack/react-query'
import { ChevronRight } from 'lucide-react'
import React, { useState } from 'react'

import { AddCreditsModal } from './AddCreditsModal'
import { BillingPreviewSections, ReferralRow } from './BillingPreviewSections'
import { ProfileBillingSkeleton } from './ProfileSettingsSkeleton'
import { RedeemCodeModal } from './RedeemCodeModal'
import { SettingsPageHeader, SettingsSectionHeading } from './SettingsPageHeader'
import { PAGE_SUBTITLES } from './settingsStyles'
import { usePreviewOn } from './SettingsUi'

import { useBillingOverview } from '@/features/billing/hooks/useBillingData'
import { ListBox } from '@/features/connections/components/ConnectionsUi'
import { profileAPI } from '@/features/profile/api/profile'
import { ErrorAlert } from '@/shared/components/ui/ErrorAlert'
import { isSkeletonPreviewActive } from '@/shared/lib/skeletonPreview'

interface ProfileBillingSettingsProps {
    profile?: {
        name: string
        email: string
    }
}

interface CreditTransaction {
    id: string
    date: string
    type: 'purchase' | 'gift'
    methodOrCode: string
    amountInCents: number
    status: 'SUCCESS' | 'PENDING' | 'FAILED'
}

export const ProfileBillingSettings: React.FC<ProfileBillingSettingsProps> = (props) => {
    const { profile: propProfile } = props
    const { data: cachedProfile } = useQuery({
        queryKey: ['profile'],
        queryFn: profileAPI.getProfile,
        enabled: !propProfile,
    })

    const profile = propProfile || cachedProfile

    const {
        data: overview,
        isLoading: isOverviewLoading,
        error: overviewError,
    } = useBillingOverview()

    // limits, auto top-up, referrals and receipts are ui only (issue 638)
    const isPreview = usePreviewOn()
    const [showRedeemModal, setShowRedeemModal] = useState(false)
    const [showAddCreditsModal, setShowAddCreditsModal] = useState(false)

    const formatCents = (cents: number | null) => {
        if (cents === null) return 'Unlimited'
        return `$${(cents / 100).toFixed(2)}`
    }

    const mergedHistory = React.useMemo(() => {
        if (!overview) return []

        const dbClaims: CreditTransaction[] = (overview.claims || []).map((claim: any) => ({
            id: claim.id,
            date: claim.createdAt,
            type: 'gift',
            methodOrCode: `Promo code ${claim.code}`,
            amountInCents: claim.amountInCents,
            status: 'SUCCESS',
        }))

        const dbTransactions: CreditTransaction[] = (overview.transactions || [])
            .filter((tx: any) => tx.status !== 'PENDING')
            .map((tx: any) => ({
                id: tx.id,
                date: tx.createdAt,
                type: 'purchase',
                methodOrCode: 'Card/UPI (Razorpay)',
                amountInCents: tx.amountInCents,
                status: tx.status as 'SUCCESS' | 'PENDING' | 'FAILED',
            }))

        const combined = [...dbClaims, ...dbTransactions]
        return combined.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    }, [overview])

    if (isOverviewLoading || isSkeletonPreviewActive()) {
        return (
            <>
                <ProfileBillingSkeleton onAddCredits={() => setShowAddCreditsModal(true)} />
                {showAddCreditsModal && (
                    <AddCreditsModal onClose={() => setShowAddCreditsModal(false)} />
                )}
            </>
        )
    }

    if (overviewError || !overview) {
        return (
            <div className="flex flex-col w-full max-w-[772px] text-[#D6D5C9]">
                <SettingsPageHeader title="Billing" subtitle={PAGE_SUBTITLES.billing} />
                <p className="text-[13px] text-[#7B7A79]">
                    Billing did not load. Reload the page to try again.
                </p>
                <ErrorAlert message={(overviewError as any)?.message || 'Billing did not load'} />
            </div>
        )
    }

    const remainingInCents = overview.creditBalance ?? 0

    return (
        <div className="flex flex-col w-full max-w-[772px] text-[#D6D5C9] animate-in fade-in duration-200">
            {/* balance. phones show the page name in the top bar */}
            <div className="flex flex-col mb-6">
                <SettingsPageHeader title="Billing" subtitle={PAGE_SUBTITLES.billing} />
                <div className="flex flex-col gap-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#1F1F1F] border border-[#2A2A2A] rounded-xl p-4 w-full">
                        <div className="flex flex-col gap-1">
                            <span className="text-[12px] font-medium text-[#7B7A79]">Balance</span>
                            <span className="text-[24px] sm:text-[28px] font-medium text-[#D6D5C9] font-mono leading-none tracking-tight">
                                {formatCents(remainingInCents)}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setShowRedeemModal(true)}
                                className="hidden md:block px-4 py-1.5 rounded-lg border border-[#383736] text-[13px] text-[#D6D5C9] hover:bg-[#242323] transition-colors cursor-pointer"
                            >
                                Redeem code
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowAddCreditsModal(true)}
                                className="w-full sm:w-auto px-4 py-1.5 rounded-lg bg-[#87B2F4] text-[#100E12] hover:bg-[#A3C7FF] text-[13px] font-medium transition-colors cursor-pointer text-center shadow-sm"
                            >
                                Add credits
                            </button>
                        </div>
                    </div>

                    {/* phones: redeem is a row, kept from the phone review */}
                    <button
                        type="button"
                        onClick={() => setShowRedeemModal(true)}
                        className="md:hidden flex items-center justify-between h-10 -mx-1 px-1 rounded-lg text-left text-[14px] text-[#D6D5C9] active:bg-[#1F1F1F] transition-colors outline-none cursor-pointer"
                    >
                        Redeem code
                        <ChevronRight className="w-4 h-4 text-[#7B7A79]" strokeWidth={1.75} />
                    </button>

                    {isPreview && <ReferralRow name={profile?.name} />}
                </div>
            </div>

            {isPreview && (
                <div className="flex flex-col gap-5 mb-5">
                    <BillingPreviewSections />
                </div>
            )}

            {/* history: the same list box as Secrets and Usage */}
            <div className="flex flex-col mb-0">
                <SettingsSectionHeading
                    title="History"
                    description="Payments and codes you added."
                />
                <ListBox>
                    {mergedHistory.length === 0 ? (
                        <div className="px-4 py-6 text-[13px] text-[#7B7A79]">No payments yet</div>
                    ) : (
                        <>
                            <div className="hidden md:grid grid-cols-12 gap-2 bg-[#202020] border-b border-[#242323] px-4 py-2 text-[11px] font-medium uppercase tracking-wider text-[#7B7A79]">
                                <div className="col-span-3">Date</div>
                                <div className={isPreview ? 'col-span-4' : 'col-span-5'}>
                                    Details
                                </div>
                                <div className="col-span-2">Status</div>
                                <div className="col-span-2 text-right">Amount</div>
                                {isPreview && <div className="col-span-1 text-right">Receipt</div>}
                            </div>

                            <div className="flex flex-col divide-y divide-[#242323]">
                                {mergedHistory.map((tx) => {
                                    const formattedDate = new Date(tx.date).toLocaleDateString(
                                        undefined,
                                        {
                                            year: 'numeric',
                                            month: 'short',
                                            day: 'numeric',
                                        }
                                    )
                                    const txId =
                                        tx.id.startsWith('claim_') || tx.id.length < 5
                                            ? tx.id
                                            : `tx_${tx.id}`

                                    // status styling mapping
                                    const statusConfig = {
                                        SUCCESS: { label: 'Success', color: 'text-emerald-500' },
                                        PENDING: { label: 'Pending', color: 'text-amber-500' },
                                        FAILED: { label: 'Failed', color: 'text-red-500' },
                                    }[tx.status] || { label: tx.status, color: 'text-neutral-500' }

                                    return (
                                        <div
                                            key={tx.id}
                                            className="px-3.5 md:px-4 py-3 text-[13px]"
                                        >
                                            {/* phones: two lines */}
                                            <div className="md:hidden flex items-start justify-between gap-2">
                                                <div className="flex flex-col min-w-0 pr-2">
                                                    <span className="text-[#D6D5C9] font-medium truncate">
                                                        {tx.methodOrCode}
                                                    </span>
                                                    <div className="flex items-center gap-1.5 text-[11.5px] text-[#7B7A79] mt-0.5">
                                                        <span>{formattedDate}</span>
                                                        <span>•</span>
                                                        <span
                                                            className={`font-medium ${statusConfig.color}`}
                                                        >
                                                            {statusConfig.label}
                                                        </span>
                                                    </div>
                                                    <span className="text-[11px] text-[#7B7A79] mt-0.5 truncate select-all">
                                                        {txId}
                                                    </span>
                                                </div>
                                                <div className="text-right shrink-0 pt-0.5">
                                                    <span className="font-medium text-emerald-400 text-[13.5px]">
                                                        +{formatCents(tx.amountInCents)}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* desktop: one grid row */}
                                            <div className="hidden md:grid grid-cols-12 gap-2 items-center">
                                                <div className="col-span-3 text-[#7B7A79]">
                                                    {formattedDate}
                                                </div>
                                                <div
                                                    className={`${isPreview ? 'col-span-4' : 'col-span-5'} flex flex-col min-w-0 pr-2`}
                                                >
                                                    <span
                                                        className="text-[#D6D5C9] font-medium truncate"
                                                        title={tx.methodOrCode}
                                                    >
                                                        {tx.methodOrCode}
                                                    </span>
                                                    <span
                                                        className="text-[11px] text-[#7B7A79] mt-0.5 truncate select-all"
                                                        title={txId}
                                                    >
                                                        {txId}
                                                    </span>
                                                </div>
                                                <div
                                                    className={`col-span-2 font-medium ${statusConfig.color}`}
                                                >
                                                    {statusConfig.label}
                                                </div>
                                                <div className="col-span-2 text-right text-[#D6D5C9] font-medium">
                                                    +{formatCents(tx.amountInCents)}
                                                </div>
                                                {/* receipts are ui only: the file comes with the server part */}
                                                {isPreview && (
                                                    <div
                                                        className="col-span-1 text-right text-[#7B7A79]"
                                                        title="Receipts are coming soon"
                                                    >
                                                        {tx.type === 'purchase' &&
                                                        tx.status === 'SUCCESS'
                                                            ? 'PDF'
                                                            : '-'}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </>
                    )}
                </ListBox>
            </div>

            {/* modals */}
            {showRedeemModal && <RedeemCodeModal onClose={() => setShowRedeemModal(false)} />}
            {showAddCreditsModal && (
                <AddCreditsModal onClose={() => setShowAddCreditsModal(false)} />
            )}
        </div>
    )
}
