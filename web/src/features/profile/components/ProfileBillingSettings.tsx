import { CreditCard, ArrowUpRight, Loader2 } from 'lucide-react'
import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { profileAPI } from '@/features/profile/api/profile'
import {
    useBillingOverview,
    useCreateSubscription,
    useVerifySubscription,
    useCancelSubscription,
    useCreatePortalSession,
    useCreditsHistory,
} from '@/features/billing/hooks/useBillingData'

interface ProfileBillingSettingsProps {
    profile?: {
        name: string
        email: string
        username: string
    }
}

export const ProfileBillingSettings: React.FC<ProfileBillingSettingsProps> = ({
    profile: propProfile,
}) => {
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
    const { data: historyData } = useCreditsHistory({ limit: 5 })

    const createSubscriptionMutation = useCreateSubscription()
    const verifySubscriptionMutation = useVerifySubscription()
    const cancelSubscriptionMutation = useCancelSubscription()
    const createPortalSessionMutation = useCreatePortalSession()

    const [isUpgrading, setIsUpgrading] = useState(false)
    const [actionError, setActionError] = useState<string | null>(null)

    const loadRazorpayScript = () => {
        return new Promise<boolean>((resolve) => {
            if ((window as any).Razorpay) {
                resolve(true)
                return
            }
            const script = document.createElement('script')
            script.src = 'https://checkout.razorpay.com/v1/checkout.js'
            script.async = true
            script.onload = () => resolve(true)
            script.onerror = () => resolve(false)
            document.body.appendChild(script)
        })
    }

    const handleUpgrade = async () => {
        setIsUpgrading(true)
        setActionError(null)
        try {
            const scriptLoaded = await loadRazorpayScript()
            if (!scriptLoaded) {
                throw new Error('Failed to load Razorpay SDK. Check your internet connection.')
            }

            const res = await createSubscriptionMutation.mutateAsync({ plan: 'PRO' })

            const options = {
                key: res.keyId,
                subscription_id: res.subscriptionId,
                name: 'december',
                description: 'Upgrade to december Pro Plan',
                handler: async (response: any) => {
                    try {
                        setIsUpgrading(true)
                        await verifySubscriptionMutation.mutateAsync({
                            razorpay_subscription_id: response.razorpay_subscription_id,
                            razorpay_payment_id: response.razorpay_payment_id,
                            razorpay_signature: response.razorpay_signature,
                        })
                    } catch (err: any) {
                        setActionError(err.message || 'Verification failed')
                    } finally {
                        setIsUpgrading(false)
                    }
                },
                prefill: {
                    name: profile?.name || '',
                    email: profile?.email || '',
                },
                theme: {
                    color: '#D6D5C9',
                },
            }

            const rzp = new (window as any).Razorpay(options)
            rzp.on('payment.failed', (resp: any) => {
                setActionError(resp.error.description || 'Payment failed')
                setIsUpgrading(false)
            })
            rzp.open()
        } catch (err: any) {
            setActionError(err.message || 'Failed to initialize upgrade process.')
            setIsUpgrading(false)
        }
    }

    const handleCancel = async () => {
        if (!window.confirm('Are you sure you want to cancel your Pro subscription?')) {
            return
        }
        setActionError(null)
        try {
            await cancelSubscriptionMutation.mutateAsync({ cancelAtPeriodEnd: true })
        } catch (err: any) {
            setActionError(err.message || 'Failed to cancel subscription')
        }
    }

    const handleManageBilling = async () => {
        setActionError(null)
        try {
            const res = await createPortalSessionMutation.mutateAsync()
            if (res.url) {
                window.open(res.url, '_blank')
            } else {
                throw new Error('No portal URL returned')
            }
        } catch (err: any) {
            setActionError(err.message || 'Failed to open billing portal')
        }
    }

    if (isOverviewLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 w-full text-[#D6D5C9]">
                <Loader2 className="w-8 h-8 animate-spin text-[#D6D5C9] mb-4" />
                <span className="text-[13px] text-[#7B7A79]">Loading billing overview...</span>
            </div>
        )
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

    const isPro = overview.plan === 'PRO'
    const subStatus = overview.status
    const isCanceled = overview.subscription?.cancelAtPeriodEnd ?? false

    // Convert values
    const limitInCents = overview.credits.limitInCents
    const usedInCents = overview.credits.usedInCents
    const remainingInCents = overview.credits.remainingInCents
    const unlimited = overview.credits.unlimited

    const formatCents = (cents: number | null) => {
        if (cents === null) return 'Unlimited'
        return `$${(cents / 100).toFixed(2)}`
    }

    return (
        <div className="flex flex-col w-full max-w-[680px] text-[#D6D5C9]">
            {actionError && (
                <div className="mb-6 p-4 rounded-xl border border-red-500/20 bg-red-500/10 text-red-200 text-sm">
                    {actionError}
                </div>
            )}

            {/* Current Plan */}
            <div className="flex flex-col mb-8">
                <h1 className="text-[16px] font-medium mb-4">Current Plan</h1>
                <div className="flex flex-col gap-7 border-t border-[#242323] pt-6">
                    <div className="flex items-center justify-between">
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[14px] text-[#D6D5C9]">
                                {isPro ? 'Pro Plan' : 'Free Plan'}{' '}
                                <span className="text-[#7B7A79] ml-1">
                                    {isPro ? '$20.00/mo' : '$0/mo'}
                                </span>
                            </span>
                            <span className="text-[13px] text-[#7B7A79]">
                                {isPro ? (
                                    <>
                                        {isCanceled ? (
                                            <span className="text-amber-500/80">
                                                Canceled. Access active until{' '}
                                                {new Date(overview.periodEnd).toLocaleDateString()}
                                            </span>
                                        ) : subStatus === 'PAST_DUE' ? (
                                            <span className="text-red-500/80">
                                                Past due. Action required.
                                            </span>
                                        ) : (
                                            <span>
                                                Renews on{' '}
                                                {new Date(overview.periodEnd).toLocaleDateString()}
                                            </span>
                                        )}
                                    </>
                                ) : (
                                    'Includes $5.00 credits every month.'
                                )}
                            </span>
                        </div>
                        <div className="flex items-center gap-3">
                            {isPro ? (
                                !isCanceled && (
                                    <button
                                        onClick={handleCancel}
                                        disabled={cancelSubscriptionMutation.isPending}
                                        className="px-4 py-1.5 rounded-lg border border-[#383736] text-[13px] text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                                    >
                                        {cancelSubscriptionMutation.isPending ? (
                                            <Loader2 className="w-4 h-4 animate-spin inline mr-1" />
                                        ) : null}
                                        Cancel Subscription
                                    </button>
                                )
                            ) : (
                                <button
                                    onClick={handleUpgrade}
                                    disabled={isUpgrading}
                                    className="px-4 py-1.5 rounded-lg bg-[#D6D5C9] text-[#171615] text-[13px] font-medium hover:bg-white transition-colors disabled:opacity-50 flex items-center gap-1.5"
                                >
                                    {isUpgrading ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : null}
                                    Upgrade to Pro
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Credit Balance */}
            <div className="flex flex-col mb-8">
                <h1 className="text-[16px] font-medium mb-4">Credit Balance</h1>
                <div className="flex flex-col gap-6 border-t border-[#242323] pt-6">
                    <div className="flex items-start justify-between">
                        <div className="flex flex-col gap-0.5 max-w-[85%]">
                            <span className="text-[13px] text-[#7B7A79] leading-relaxed">
                                Your monthly credits reset on{' '}
                                {new Date(overview.periodEnd).toLocaleDateString()}. Monthly credits
                                are used first. Remaining credits expire at the end of the billing
                                period.
                            </span>
                        </div>
                        {!isPro && (
                            <button
                                onClick={handleUpgrade}
                                disabled={isUpgrading}
                                className="px-4 py-1.5 rounded-lg border border-[#383736] text-[13px] text-[#D6D5C9] hover:bg-[#1E1D1B] transition-colors mt-1 whitespace-nowrap disabled:opacity-50"
                            >
                                Upgrade
                            </button>
                        )}
                    </div>

                    <div className="flex flex-col md:flex-row gap-8 mt-2 items-center">
                        <div className="w-[220px] h-[130px] rounded-xl border border-[#383736] bg-gradient-to-br from-[#1E1D1B] to-[#171615] p-5 flex flex-col justify-between relative overflow-hidden shadow-lg">
                            <div className="absolute top-4 right-4 text-[#7B7A79] opacity-50">
                                <CreditCard className="w-6 h-6" strokeWidth={1.5} />
                            </div>
                            <div className="flex flex-col mt-auto">
                                <span className="text-[24px] font-medium text-[#D6D5C9] tracking-tight">
                                    {unlimited ? 'Unlimited' : formatCents(remainingInCents)}
                                </span>
                                <span className="text-[12px] text-[#7B7A79] truncate mt-1">
                                    {profile?.name || 'december User'}
                                </span>
                            </div>
                        </div>

                        <div className="flex-1 w-full flex flex-col justify-center gap-3.5 text-[13px]">
                            <div className="flex justify-between items-center text-[#7B7A79]">
                                <span>Gifted Credits</span>
                                <span>$0.00</span>
                            </div>
                            <div className="flex justify-between items-center text-[#D6D5C9]">
                                <span>Monthly Credits</span>
                                <span>
                                    {unlimited
                                        ? 'Unlimited'
                                        : `${formatCents(usedInCents)} / ${formatCents(limitInCents)}`}
                                </span>
                            </div>
                            <div className="flex justify-between items-center text-[#7B7A79]">
                                <span>Purchased Credits</span>
                                <span>$0.00</span>
                            </div>
                            <div className="flex justify-between items-center text-[#D6D5C9] font-medium pt-3 border-t border-[#242323]">
                                <span>Total Available Credits</span>
                                <span>
                                    {unlimited ? 'Unlimited' : formatCents(remainingInCents)}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Credit Expiration Schedule */}
            <div className="flex flex-col mb-8">
                <h1 className="text-[16px] font-medium mb-4">Credit Expiration Schedule</h1>
                <div className="flex flex-col border-t border-[#242323]">
                    <div className="flex justify-between py-3 border-b border-[#242323] text-[12px] text-[#7B7A79]">
                        <span className="w-1/3">Type</span>
                        <span className="w-1/3">Credit Balance</span>
                        <span className="w-1/3 text-right">Expiration</span>
                    </div>
                    <div className="flex justify-between py-4 text-[13px] text-[#D6D5C9]">
                        <span className="w-1/3 font-medium">Monthly</span>
                        <span className="w-1/3">
                            {unlimited
                                ? 'Unlimited'
                                : `${formatCents(remainingInCents)} / ${formatCents(limitInCents)}`}
                        </span>
                        <span className="w-1/3 text-right">
                            {new Date(overview.periodEnd).toLocaleDateString(undefined, {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                            })}
                        </span>
                    </div>
                </div>
            </div>

            {/* Used and Expired Credits Over Past Months */}
            {historyData && historyData.periods && historyData.periods.length > 0 && (
                <div className="flex flex-col mb-8">
                    <h1 className="text-[16px] font-medium mb-4">
                        Used and Expired Credits Over Past Months
                    </h1>
                    <div className="flex flex-col border-t border-[#242323]">
                        <div className="flex justify-between py-3 border-b border-[#242323] text-[12px] text-[#7B7A79]">
                            <span className="w-1/3">Period Range</span>
                            <span className="w-1/3">Total Usage</span>
                            <span className="w-1/3 text-right">Period End</span>
                        </div>
                        <div className="flex flex-col">
                            {historyData.periods.map((period, idx) => (
                                <div
                                    key={idx}
                                    className={`flex justify-between py-3.5 text-[13px] text-[#D6D5C9] ${
                                        idx !== historyData.periods.length - 1
                                            ? 'border-b border-[#242323]'
                                            : ''
                                    }`}
                                >
                                    <span className="w-1/3 font-medium">
                                        {new Date(period.periodStart).toLocaleDateString(
                                            undefined,
                                            {
                                                month: 'short',
                                                day: 'numeric',
                                            }
                                        )}{' '}
                                        -{' '}
                                        {new Date(period.periodEnd).toLocaleDateString(undefined, {
                                            month: 'short',
                                            day: 'numeric',
                                        })}
                                    </span>
                                    <span className="w-1/3">{formatCents(period.costInCents)}</span>
                                    <span className="w-1/3 text-right">
                                        {new Date(period.periodEnd).toLocaleDateString(undefined, {
                                            year: 'numeric',
                                            month: 'short',
                                            day: 'numeric',
                                        })}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Payment & Invoices */}
            <div className="flex flex-col mb-8">
                <h1 className="text-[16px] font-medium mb-4">Payment & Verification</h1>
                <div className="flex flex-col gap-7 border-t border-[#242323] pt-6">
                    {/* Payment Method */}
                    <div className="flex items-center justify-between">
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[14px] text-[#D6D5C9]">Payment Method</span>
                            <span className="text-[13px] text-[#7B7A79]">
                                {isPro
                                    ? `Managed via Razorpay. Status: ${subStatus}`
                                    : 'No payment method added. Upgrade to activate premium billing.'}
                            </span>
                        </div>
                        {!isPro && (
                            <button
                                onClick={handleUpgrade}
                                disabled={isUpgrading}
                                className="px-4 py-1.5 rounded-lg border border-[#383736] text-[13px] text-[#D6D5C9] hover:bg-[#1E1D1B] transition-colors disabled:opacity-50"
                            >
                                Add Card
                            </button>
                        )}
                    </div>

                    {/* Usage Code */}
                    <div className="flex items-center justify-between">
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[14px] text-[#D6D5C9]">Redeem a Usage Code</span>
                            <span className="text-[13px] text-[#7B7A79]">
                                Redeem a usage code to claim your gifted credits.
                            </span>
                        </div>
                        <button className="px-4 py-1.5 rounded-lg border border-[#383736] text-[13px] text-[#D6D5C9] hover:bg-[#1E1D1B] transition-colors">
                            Redeem Code
                        </button>
                    </div>

                    {/* Student Verification */}
                    <div className="flex items-center justify-between">
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[14px] text-[#D6D5C9]">Student Verification</span>
                            <span className="text-[13px] text-[#7B7A79]">
                                Verify your student email to unlock Premium benefits.
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <input
                                type="email"
                                placeholder="name@university.edu"
                                className="bg-[#100E12] border border-[#383736] rounded-lg px-3 py-1.5 text-[13px] text-[#D6D5C9] focus:outline-none focus:border-[#7B7A79] w-[180px] placeholder:text-[#4A4948]"
                            />
                            <button className="px-4 py-1.5 rounded-lg border border-[#383736] text-[13px] text-[#7B7A79] opacity-50 cursor-not-allowed">
                                Verify Email
                            </button>
                        </div>
                    </div>

                    {/* Invoices */}
                    <div className="flex items-center justify-between">
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[14px] text-[#D6D5C9]">Invoices</span>
                            <span className="text-[13px] text-[#7B7A79]">
                                Your invoices are managed on the dashboard.
                            </span>
                        </div>
                        <button
                            onClick={handleManageBilling}
                            disabled={createPortalSessionMutation.isPending}
                            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg border border-[#383736] text-[13px] text-[#D6D5C9] hover:bg-[#1E1D1B] transition-colors disabled:opacity-50"
                        >
                            {createPortalSessionMutation.isPending ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : null}
                            Dashboard
                            <ArrowUpRight className="w-3.5 h-3.5 text-[#7B7A79]" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
