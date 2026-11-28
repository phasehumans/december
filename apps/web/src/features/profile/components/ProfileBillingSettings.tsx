import { useQuery } from '@tanstack/react-query'
import React, { useState } from 'react'

import { AddCreditsModal } from './AddCreditsModal'
import { BillingLimitsSection, ReferralRow } from './BillingSections'
import { FreeCreditsSection } from './FreeCreditsSection'
import { ListPager } from './ListPager'
import { ProfileBillingHistorySkeleton, ProfileBillingSkeleton } from './ProfileSettingsSkeleton'
import {
    PAGE_SUBTITLES,
    blueButtonClass,
    listBoxClass,
    listEmptyClass,
    listHeaderClass,
    listRowNoteClass,
    listRowTitleClass,
    listRowsClass,
    textLinkClass,
} from './settingsStyles'
import { SettingsEmptyArt, SettingsPage, SettingsSection } from './SettingsUi'

import { billingAPI, type BillingTransaction } from '@/features/billing/api/billing'
import { useBillingOverview, useBillingTransactions } from '@/features/billing/hooks/useBillingData'
import { profileAPI } from '@/features/profile/api/profile'
import { ErrorAlert } from '@/shared/components/ui/ErrorAlert'
import { downloadBlob } from '@/shared/lib/downloadBlob'
import { isSkeletonPreviewActive } from '@/shared/lib/skeletonPreview'
import { cn } from '@/shared/lib/utils'

interface ProfileBillingSettingsProps {
    profile?: {
        name: string
        email: string
    }
}

/** "$12.50", and "-$0.40" for a balance under zero (a run can take a little more than is left) */
const formatMoney = (cents: number) =>
    `${cents < 0 ? '-' : ''}$${(Math.abs(cents) / 100).toFixed(2)}`

/** "+$10.00" for credits in, "-$5.00" for credits an admin took out */
const formatChange = (cents: number) => `${cents < 0 ? '-' : '+'}${formatMoney(Math.abs(cents))}`

const DETAILS: Record<BillingTransaction['kind'], string> = {
    payment: 'Card or UPI',
    grant: 'Free credits',
    adjustment: 'Credit change',
    referral: 'Referral',
    code: 'Code',
}

const detailsOf = (tx: BillingTransaction) =>
    tx.kind === 'code' && tx.code ? `Code ${tx.code}` : DETAILS[tx.kind]

const STATUS = {
    SUCCESS: { label: 'Paid', color: 'text-emerald-500' },
    FAILED: { label: 'Failed', color: 'text-red-500' },
} as const

const statusOf = (tx: BillingTransaction) =>
    tx.status === 'FAILED'
        ? STATUS.FAILED
        : { ...STATUS.SUCCESS, label: tx.kind === 'payment' ? 'Paid' : 'Added' }

const formatDay = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    })

// one grid for the header band and the rows on desktop. no plain "grid": with "hidden" in
// the same cn() call, tailwind-merge would keep only one of the two
const historyGridClass = 'hidden md:grid grid-cols-[120px_1fr_80px_100px_64px] gap-3 items-center'

const HistoryHeader: React.FC = () => (
    <div className={listHeaderClass}>
        <div className="flex md:hidden items-center justify-between">
            <span>Details / Date</span>
            <span>Amount</span>
        </div>
        <div className={historyGridClass}>
            <div>Date</div>
            <div>Details</div>
            <div>Status</div>
            <div className="text-right">Amount</div>
            <div className="text-right">Receipt</div>
        </div>
    </div>
)

/**
 * Payments, free credits, referral credits and credit changes, one page at a time from the
 * server. Phones get two lines for each row, so the list never scrolls sideways.
 */
const BillingHistory: React.FC = () => {
    const [limit, setLimit] = useState(10)
    const [offset, setOffset] = useState(0)
    const { data, isLoading, error } = useBillingTransactions({ limit, offset })
    const [receiptLoadingId, setReceiptLoadingId] = useState<string | null>(null)
    const [receiptError, setReceiptError] = useState<string | null>(null)

    // the receipt is fetched, not linked: the request needs the sign-in of the user
    const handleDownloadReceipt = async (tx: BillingTransaction) => {
        if (receiptLoadingId) return
        setReceiptError(null)
        setReceiptLoadingId(tx.id)
        try {
            const receipt = await billingAPI.downloadReceipt(tx.id)
            const day = new Date(tx.createdAt)
            const fallbackName = `december-receipt-${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}.pdf`
            downloadBlob(receipt.blob, receipt.fileName ?? fallbackName)
        } catch (err) {
            console.error('Failed to download the receipt:', err)
            setReceiptError('The receipt did not download. Try again.')
        } finally {
            setReceiptLoadingId(null)
        }
    }

    const items = data?.items ?? []
    const total = data?.total ?? 0

    const receiptButton = (tx: BillingTransaction) => (
        <button
            type="button"
            onClick={() => void handleDownloadReceipt(tx)}
            disabled={receiptLoadingId === tx.id}
            aria-label={`Download the receipt of ${formatDay(tx.createdAt)}`}
            className={textLinkClass}
        >
            PDF
        </button>
    )

    return (
        <SettingsSection title="History" description="Payments and credits added." bare>
            <div className={listBoxClass}>
                <HistoryHeader />
                {isLoading ? (
                    <div className="px-3.5 md:px-4">
                        <ProfileBillingHistorySkeleton />
                    </div>
                ) : error ? (
                    <div className={listEmptyClass}>History did not load. Reload the page.</div>
                ) : items.length === 0 ? (
                    <SettingsEmptyArt art="payments" title="No payments yet" />
                ) : (
                    <div className={listRowsClass}>
                        {items.map((tx) => {
                            const status = statusOf(tx)
                            const day = formatDay(tx.createdAt)
                            const amountClass =
                                tx.status === 'FAILED'
                                    ? 'text-[#7B7A79] line-through'
                                    : 'text-[#D6D5C9]'
                            return (
                                <div
                                    key={tx.id}
                                    data-testid="history-row"
                                    className="px-3.5 md:px-4 py-3 text-[13px]"
                                >
                                    {/* phones: details and amount, then date, status and PDF */}
                                    <div className="md:hidden flex flex-col gap-1 min-w-0">
                                        <div className="flex items-center justify-between gap-3">
                                            <span className={listRowTitleClass}>
                                                {detailsOf(tx)}
                                            </span>
                                            <span
                                                className={cn(
                                                    'font-mono font-medium shrink-0',
                                                    amountClass
                                                )}
                                            >
                                                {formatChange(tx.amountInCents)}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between gap-3">
                                            <span className={listRowNoteClass}>
                                                {day} ·{' '}
                                                <span className={cn('font-medium', status.color)}>
                                                    {status.label}
                                                </span>
                                            </span>
                                            {tx.hasReceipt && (
                                                <span className="shrink-0 text-[12px]">
                                                    {receiptButton(tx)}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* desktop: one row of the grid */}
                                    <div className={historyGridClass}>
                                        <div className="text-[#7B7A79] truncate">{day}</div>
                                        <div className={listRowTitleClass} title={detailsOf(tx)}>
                                            {detailsOf(tx)}
                                        </div>
                                        <div className={cn('font-medium', status.color)}>
                                            {status.label}
                                        </div>
                                        <div
                                            className={cn(
                                                'text-right font-mono font-medium',
                                                amountClass
                                            )}
                                        >
                                            {formatChange(tx.amountInCents)}
                                        </div>
                                        <div className="text-right text-[#7B7A79]">
                                            {tx.hasReceipt ? receiptButton(tx) : '-'}
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
            <ListPager
                total={total}
                limit={limit}
                offset={offset}
                onOffsetChange={setOffset}
                onLimitChange={(next) => {
                    setLimit(next)
                    setOffset(0)
                }}
                className="mt-2"
            />
            <ErrorAlert message={receiptError} onClear={() => setReceiptError(null)} />
        </SettingsSection>
    )
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

    const [showAddCreditsModal, setShowAddCreditsModal] = useState(false)

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

    const balance = overview.creditBalance ?? 0

    return (
        <>
            <SettingsPage
                title="Billing"
                subtitle={PAGE_SUBTITLES.billing}
                className="animate-in fade-in duration-200"
            >
                {/* credits: a section like the ones on Account. the balance and its button
                    are one box on desktop and on phones */}
                <SettingsSection title="Credits" description="Your balance, and how to add to it.">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-1">
                        <div className="flex flex-col gap-1 min-w-0">
                            <span className="text-[12px] font-medium text-[#7B7A79]">Balance</span>
                            <span
                                data-testid="credit-balance"
                                className={cn(
                                    'text-[24px] sm:text-[28px] font-medium font-mono leading-none tracking-tight truncate',
                                    balance < 0 ? 'text-red-400' : 'text-[#D6D5C9]'
                                )}
                            >
                                {formatMoney(balance)}
                            </span>
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowAddCreditsModal(true)}
                            className={`${blueButtonClass} w-full sm:w-auto text-center`}
                        >
                            Add credits
                        </button>
                    </div>
                    <ReferralRow />
                </SettingsSection>

                <FreeCreditsSection />

                <BillingLimitsSection />

                <BillingHistory />
            </SettingsPage>

            {showAddCreditsModal && (
                <AddCreditsModal onClose={() => setShowAddCreditsModal(false)} />
            )}
        </>
    )
}
