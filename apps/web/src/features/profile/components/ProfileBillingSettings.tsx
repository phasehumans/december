import { useQuery } from '@tanstack/react-query'
import { ArrowUpRight } from 'lucide-react'
import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { ProfileSettingsSkeleton } from './ProfileSettingsSkeleton'
import { RedeemCodeModal } from './RedeemCodeModal'

import { useBillingOverview } from '@/features/billing/hooks/useBillingData'
import { profileAPI } from '@/features/profile/api/profile'

interface ProfileBillingSettingsProps {
    profile?: {
        name: string
        email: string
        username: string
    }
}

interface CreditTransaction {
    id: string
    date: string
    type: 'purchase' | 'gift'
    methodOrCode: string
    amountInCents: number
}

export const ProfileBillingSettings: React.FC<ProfileBillingSettingsProps> = (props) => {
    const { profile: propProfile } = props
    const navigate = useNavigate()
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

    const [showRedeemModal, setShowRedeemModal] = useState(false)

    // Local Storage transaction log
    const [localTxHistory] = useState<CreditTransaction[]>(() => {
        try {
            const saved = localStorage.getItem('december_credit_transactions')
            return saved ? JSON.parse(saved) : []
        } catch {
            return []
        }
    })

    const formatCents = (cents: number | null) => {
        if (cents === null) return 'Unlimited'
        return `$${(cents / 100).toFixed(2)}`
    }

    const getGreeting = () => {
        const hr = new Date().getHours()
        if (hr < 12) return 'Good morning'
        if (hr < 17) return 'Good afternoon'
        return 'Good evening'
    }

    const mergedHistory = React.useMemo(() => {
        const dummyHistory: CreditTransaction[] = [
            {
                id: 'a8f9d2',
                date: '2026-06-18T14:30:00.000Z',
                type: 'purchase',
                methodOrCode: 'Credit Card Purchase',
                amountInCents: 2500,
            },
            {
                id: 'claim_welcome5',
                date: '2026-06-15T09:15:00.000Z',
                type: 'gift',
                methodOrCode: 'Promo Code: WELCOME5',
                amountInCents: 500,
            },
            {
                id: 'e3c1b8',
                date: '2026-06-10T18:45:00.000Z',
                type: 'purchase',
                methodOrCode: 'UPI QR Purchase',
                amountInCents: 1000,
            },
            {
                id: 'claim_gift10',
                date: '2026-06-05T11:00:00.000Z',
                type: 'gift',
                methodOrCode: 'Promo Code: DEVELOPER10',
                amountInCents: 1000,
            },
            {
                id: 'd9e7f4',
                date: '2026-05-28T16:20:00.000Z',
                type: 'purchase',
                methodOrCode: 'Cryptocurrency Purchase (USDT)',
                amountInCents: 5000,
            },
            {
                id: 'claim_signuppromo',
                date: '2026-05-20T08:00:00.000Z',
                type: 'gift',
                methodOrCode: 'Sign-up Gift Credits',
                amountInCents: 500,
            },
            {
                id: 'b2a4c6',
                date: '2026-05-15T12:00:00.000Z',
                type: 'purchase',
                methodOrCode: 'Credit Card Purchase',
                amountInCents: 1000,
            },
        ]

        const dbClaims: CreditTransaction[] = !overview
            ? []
            : (overview.claims || []).map((claim: any) => ({
                  id: claim.id,
                  date: claim.createdAt,
                  type: 'gift',
                  methodOrCode: `Promo Code: ${claim.code}`,
                  amountInCents: claim.amountInCents,
              }))

        const combined = [...localTxHistory, ...dbClaims, ...dummyHistory]
        return combined.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    }, [localTxHistory, overview])

    if (isOverviewLoading) {
        return <ProfileSettingsSkeleton activeTab="Billing" />
    }

    if (overviewError || !overview) {
        return (
            <div className="flex flex-col items-center justify-center py-20 w-full text-red-400">
                <span className="text-[14px] font-medium mb-2">
                    Failed to load billing settings
                </span>
                <span className="text-[13px] text-[#7B7A79]">
                    {(overviewError as any)?.message || 'Unknown error'}
                </span>
            </div>
        )
    }

    const remainingInCents = overview.credits.remainingInCents

    return (
        <div className="flex flex-col w-full max-w-[680px] text-[#D6D5C9] animate-in fade-in duration-200">
            {/* Credits Section */}
            <div className="flex flex-col mb-6">
                <h1 className="text-[16px] font-medium text-[#D6D5C9] mb-3">Credits</h1>
                <div className="flex flex-col gap-4 border-t border-[#242323] pt-4">
                    {/* Compact credits balance box (items-end moves buttons slightly below to align with balance text bottom) */}
                    <div className="flex items-end justify-between border border-[#242323] rounded-2xl p-6 w-full max-w-[520px]">
                        <div className="flex flex-col gap-2">
                            <span className="text-[13px] text-[#7B7A79]">Credit remaining</span>
                            <span className="text-[36px] font-semibold text-[#D6D5C9] font-mono leading-none">
                                {formatCents(remainingInCents)}
                            </span>
                        </div>
                        <div className="flex items-center gap-2 mb-0.5">
                            <button
                                type="button"
                                className="px-4 py-1.5 rounded-lg border border-[#383736] text-[13px] text-[#D6D5C9] hover:bg-[#242323] transition-colors active:scale-[0.98]"
                            >
                                Add payment details
                            </button>
                            <button
                                type="button"
                                className="px-4 py-1.5 rounded-lg bg-white text-black hover:bg-neutral-200 text-[13px] font-semibold transition-colors active:scale-[0.98]"
                            >
                                Add Credits
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Credits History Section */}
            <div className="flex flex-col mb-6">
                <h2 className="text-[16px] font-medium text-[#D6D5C9] mb-3">Credits History</h2>
                <div className="flex flex-col border-t border-[#242323] pt-4">
                    {mergedHistory.length === 0 ? (
                        <div className="text-[13px] text-[#7B7A79] py-2">
                            No recent credit transactions.
                        </div>
                    ) : (
                        <div className="flex flex-col gap-4">
                            {/* Header Row */}
                            <div className="grid grid-cols-4 gap-4 text-[11px] font-semibold uppercase tracking-wider text-neutral-500 pb-1">
                                <div>Date</div>
                                <div>Transaction ID</div>
                                <div>Details</div>
                                <div className="text-right">Amount</div>
                            </div>
                            {/* Data Rows */}
                            <div className="flex flex-col gap-3">
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
                                    return (
                                        <div
                                            key={tx.id}
                                            className="grid grid-cols-4 gap-4 items-center text-[13px] text-neutral-300"
                                        >
                                            <div className="text-[#7B7A79]">{formattedDate}</div>
                                            <div
                                                className="font-mono text-xs text-[#7B7A79] truncate"
                                                title={txId}
                                            >
                                                {txId}
                                            </div>
                                            <div
                                                className="text-neutral-400 truncate"
                                                title={tx.methodOrCode}
                                            >
                                                {tx.methodOrCode}
                                            </div>
                                            {/* Neutral color amount display (no green) */}
                                            <div className="text-right text-[#D6D5C9] font-medium font-mono">
                                                +{formatCents(tx.amountInCents)}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Promotions & Usage Section */}
            <div className="flex flex-col mb-6">
                <h2 className="text-[16px] font-medium text-[#D6D5C9] mb-3">Promotions & Usage</h2>
                <div className="flex flex-col gap-6 border-t border-[#242323] pt-4">
                    {/* Gifted credits / Coupon */}
                    <div className="flex items-center justify-between">
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[14px] text-[#D6D5C9]">Redeem Coupon Code</span>
                            <span className="text-[13px] text-[#7B7A79]">
                                Have a promotional redeem code? Claim gifted credits here.
                            </span>
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowRedeemModal(true)}
                            className="px-4 py-1.5 rounded-lg border border-[#383736] text-[13px] text-[#D6D5C9] hover:bg-[#242323] transition-colors cursor-pointer"
                        >
                            Claim Credits
                        </button>
                    </div>

                    {/* Usage Dashboard Link */}
                    <div className="flex items-center justify-between">
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[14px] text-[#D6D5C9]">Usage Dashboard</span>
                            <span className="text-[13px] text-[#7B7A79]">
                                View detailed metrics, token history, and cost distribution.
                            </span>
                        </div>
                        <button
                            type="button"
                            onClick={() => navigate('/profile/usage')}
                            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg border border-[#383736] text-[13px] text-[#D6D5C9] hover:bg-[#242323] transition-colors cursor-pointer"
                        >
                            View Usage
                            <ArrowUpRight className="w-3.5 h-3.5 text-neutral-500" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Modals */}
            {showRedeemModal && <RedeemCodeModal onClose={() => setShowRedeemModal(false)} />}
        </div>
    )
}
