import { useQuery } from '@tanstack/react-query'
import React, { useState } from 'react'

import { AddCreditsModal } from './AddCreditsModal'
import { BillingLimitsSection, ReferralRow } from './BillingPreviewSections'
import { FreeCreditsSection } from './FreeCreditsSection'
import { ProfileBillingSkeleton } from './ProfileSettingsSkeleton'
import { RedeemCodeModal } from './RedeemCodeModal'
import {
    PAGE_SUBTITLES,
    blueButtonClass,
    listEmptyClass,
    listHeaderClass,
    listRowsClass,
    outlineButtonClass,
    textLinkClass,
} from './settingsStyles'
import { SettingsPage, SettingsSection } from './SettingsUi'

import { billingAPI } from '@/features/billing/api/billing'
import { useBillingOverview } from '@/features/billing/hooks/useBillingData'
import { ListBox } from '@/features/connections/components/ConnectionsUi'
import { profileAPI } from '@/features/profile/api/profile'
import { ErrorAlert } from '@/shared/components/ui/ErrorAlert'
import { downloadBlob } from '@/shared/lib/downloadBlob'
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
    // a payment that went through has a receipt. free credits, a credit change and a code do not
    hasReceipt: boolean
}

export const ProfileBillingSettings: React.FC<ProfileBillingSettingsProps> = (props) => {
    const { profile: propProfile } = props
    // no value is read here: the query only loads the profile when the page gets none
    useQuery({
        queryKey: ['profile'],
        queryFn: profileAPI.getProfile,
        enabled: !propProfile,
    })

    const {
        data: overview,
        isLoading: isOverviewLoading,
        error: overviewError,
    } = useBillingOverview()

    const [showRedeemModal, setShowRedeemModal] = useState(false)
    const [showAddCreditsModal, setShowAddCreditsModal] = useState(false)
    const [receiptLoadingId, setReceiptLoadingId] = useState<string | null>(null)
    const [receiptError, setReceiptError] = useState<string | null>(null)

    // the receipt is fetched, not linked: the request needs the sign-in of the user
    const handleDownloadReceipt = async (tx: CreditTransaction) => {
        setReceiptError(null)
        setReceiptLoadingId(tx.id)
        try {
            const receipt = await billingAPI.downloadReceipt(tx.id)
            const day = new Date(tx.date)
            const fallbackName = `december-receipt-${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}.pdf`
            downloadBlob(receipt.blob, receipt.fileName ?? fallbackName)
        } catch (error) {
            console.error('Failed to download the receipt:', error)
            setReceiptError('The receipt did not download. Try again.')
        } finally {
            setReceiptLoadingId(null)
        }
    }

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
            hasReceipt: false,
        }))

        const dbTransactions: CreditTransaction[] = (overview.transactions || [])
            .filter((tx: any) => tx.status !== 'PENDING')
            .map((tx: any) => ({
                id: tx.id,
                date: tx.createdAt,
                type: 'purchase',
                methodOrCode:
                    tx.provider === 'GRANT'
                        ? 'Free credits'
                        : tx.provider === 'ADJUSTMENT'
                          ? 'Credit change'
                          : tx.provider === 'REFERRAL'
                            ? 'Referral'
                            : 'Card/UPI (Razorpay)',
                amountInCents: tx.amountInCents,
                status: tx.status as 'SUCCESS' | 'PENDING' | 'FAILED',
                hasReceipt:
                    tx.status === 'SUCCESS' &&
                    (tx.provider === 'RAZORPAY' || tx.provider === 'COINBASE'),
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
            <SettingsPage title="Billing" subtitle={PAGE_SUBTITLES.billing}>
                <p className="text-[13px] text-[#7B7A79]">
                    Billing did not load. Reload the page to try again.
                </p>
                <ErrorAlert message={(overviewError as any)?.message || 'Billing did not load'} />
            </SettingsPage>
        )
    }

    const remainingInCents = overview.creditBalance ?? 0

    return (
        <>
            <SettingsPage
                title="Billing"
                subtitle={PAGE_SUBTITLES.billing}
                className="animate-in fade-in duration-200"
            >
                {/* credits: a section like the ones on Account. the balance and its two
                    buttons are one box on desktop and on phones */}
                <SettingsSection title="Credits" description="Your balance, and how to add to it.">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-1">
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
                                className={`${outlineButtonClass} flex-1 sm:flex-initial text-center`}
                            >
                                Redeem code
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowAddCreditsModal(true)}
                                className={`${blueButtonClass} flex-1 sm:flex-initial text-center`}
                            >
                                Add credits
                            </button>
                        </div>
                    </div>
                    <ReferralRow />
                </SettingsSection>

                <FreeCreditsSection />

                <BillingLimitsSection />

                {/* history: the same list box as Secrets and Usage */}
                <SettingsSection title="History" description="Payments and codes you added." bare>
                    <ListBox>
                        {mergedHistory.length === 0 ? (
                            <div className={listEmptyClass}>No payments yet</div>
                        ) : (
                            <>
                                <div
                                    className={`hidden md:grid grid-cols-12 gap-2 ${listHeaderClass}`}
                                >
                                    <div className="col-span-3">Date</div>
                                    <div className="col-span-4">Details</div>
                                    <div className="col-span-2">Status</div>
                                    <div className="col-span-2 text-right">Amount</div>
                                    <div className="col-span-1 text-right">Receipt</div>
                                </div>

                                <div className={listRowsClass}>
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
                                            SUCCESS: {
                                                label: 'Success',
                                                color: 'text-emerald-500',
                                            },
                                            PENDING: { label: 'Pending', color: 'text-amber-500' },
                                            FAILED: { label: 'Failed', color: 'text-red-500' },
                                        }[tx.status] || {
                                            label: tx.status,
                                            color: 'text-neutral-500',
                                        }

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
                                                    <div className="flex flex-col items-end gap-1 shrink-0 pt-0.5">
                                                        <span className="font-medium text-emerald-400 text-[13.5px]">
                                                            {tx.amountInCents < 0 ? '-' : '+'}
                                                            {formatCents(
                                                                Math.abs(tx.amountInCents)
                                                            )}
                                                        </span>
                                                        {tx.hasReceipt && (
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    handleDownloadReceipt(tx)
                                                                }
                                                                disabled={
                                                                    receiptLoadingId === tx.id
                                                                }
                                                                className={`text-[12px] ${textLinkClass}`}
                                                            >
                                                                PDF
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* desktop: one grid row */}
                                                <div className="hidden md:grid grid-cols-12 gap-2 items-center">
                                                    <div className="col-span-3 text-[#7B7A79]">
                                                        {formattedDate}
                                                    </div>
                                                    <div className="col-span-4 flex flex-col min-w-0 pr-2">
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
                                                        {tx.amountInCents < 0 ? '-' : '+'}
                                                        {formatCents(Math.abs(tx.amountInCents))}
                                                    </div>
                                                    <div className="col-span-1 text-right text-[#7B7A79]">
                                                        {tx.hasReceipt ? (
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    handleDownloadReceipt(tx)
                                                                }
                                                                disabled={
                                                                    receiptLoadingId === tx.id
                                                                }
                                                                className={textLinkClass}
                                                            >
                                                                PDF
                                                            </button>
                                                        ) : (
                                                            '-'
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </>
                        )}
                    </ListBox>
                </SettingsSection>
            </SettingsPage>

            <ErrorAlert message={receiptError} onClear={() => setReceiptError(null)} />

            {/* modals */}
            {showRedeemModal && <RedeemCodeModal onClose={() => setShowRedeemModal(false)} />}
            {showAddCreditsModal && (
                <AddCreditsModal onClose={() => setShowAddCreditsModal(false)} />
            )}
        </>
    )
}
