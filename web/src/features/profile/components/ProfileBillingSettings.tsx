import { useQuery } from '@tanstack/react-query'
import { ArrowUpRight, Loader2, Check } from 'lucide-react'
import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import {
    useBillingOverview,
    useCreateSubscription,
    useVerifySubscription,
    useCancelSubscription,
    useCreatePortalSession,
    useCreditsHistory,
} from '@/features/billing/hooks/useBillingData'
import { profileAPI } from '@/features/profile/api/profile'
import { Button } from '@/shared/components/ui/Button'
import { Input } from '@/shared/components/ui/Input'
import { Modal } from '@/shared/components/ui/Modal'
import { ProfileSettingsSkeleton } from './ProfileSettingsSkeleton'

interface ProfileBillingSettingsProps {
    profile?: {
        name: string
        email: string
        username: string
    }
}

// Minimal Redeem Code Modal
const RedeemCodeModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const [code, setCode] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [isRedeeming, setIsRedeeming] = useState(false)

    const handleRedeem = async () => {
        if (!code.trim()) {
            setError('Please enter a redeem code.')
            return
        }
        setIsRedeeming(true)
        setError(null)

        await new Promise((resolve) => setTimeout(resolve, 800))

        setError('Invalid redeem code. Please check your code and try again.')
        setIsRedeeming(false)
    }

    return (
        <Modal
            isOpen={true}
            onClose={onClose}
            title="Redeem Code"
            description="Enter your coupon or gift code to claim credits."
            variant="premium"
        >
            <div className="flex flex-col gap-4">
                <div>
                    <label
                        htmlFor="redeem-code-input"
                        className="text-[11px] font-semibold text-[#8F8E8D] uppercase tracking-wider mb-1.5 block"
                    >
                        Code
                    </label>
                    <input
                        id="redeem-code-input"
                        type="text"
                        autoFocus
                        value={code}
                        onChange={(e) => {
                            setCode(e.target.value.toUpperCase())
                            setError(null)
                        }}
                        onKeyDown={(e: React.KeyboardEvent) => {
                            if (e.key === 'Enter') handleRedeem()
                        }}
                        className="w-full bg-[#181817] border border-[#2B2A27] rounded-lg px-3.5 py-2.5 text-white text-[13px] focus:outline-none focus:border-[#4E4D49] focus:ring-1 focus:ring-[#4E4D49] transition-[border-color,box-shadow]"
                        placeholder="K47B9X2P5M1Z"
                        disabled={isRedeeming}
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="off"
                        spellCheck={false}
                    />
                </div>

                {error && <p className="text-[12px] text-red-500 font-medium px-1">{error}</p>}

                <div className="mt-1 flex items-center justify-end gap-2.5">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isRedeeming}
                        className="border border-[#2B2A27] bg-transparent text-white hover:bg-white/5 active:scale-95 transition-[transform,background-color,border-color,color] duration-200 text-[13px] font-medium px-4 py-2 rounded-lg focus:outline-none disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleRedeem}
                        disabled={!code.trim() || isRedeeming}
                        className="bg-white text-black hover:bg-neutral-200 active:scale-95 transition-[transform,background-color,border-color,color] duration-200 text-[13px] font-medium px-4 py-2 rounded-lg focus:outline-none disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center min-w-[110px]"
                    >
                        {isRedeeming ? (
                            <div className="flex items-center gap-1.5 justify-center">
                                <span className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                                <span>Redeeming...</span>
                            </div>
                        ) : (
                            'Redeem'
                        )}
                    </button>
                </div>
            </div>
        </Modal>
    )
}

// Minimal Add Card Modal
const AddCardModal: React.FC<{
    onClose: () => void
    onSave: (number: string, expiry: string) => void
}> = ({ onClose, onSave }) => {
    const [cardNumber, setCardNumber] = useState('')
    const [expiry, setExpiry] = useState('')
    const [cvv, setCvv] = useState('')
    const [name, setName] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [isSaving, setIsSaving] = useState(false)

    const handleSave = async () => {
        const cleanNumber = cardNumber.replace(/\s+/g, '')
        if (cleanNumber.length < 16) {
            setError('Please enter a valid 16-digit card number.')
            return
        }
        if (!/^\d{2}\/\d{2}$/.test(expiry)) {
            setError('Please enter expiry in MM/YY format.')
            return
        }
        if (cvv.length < 3) {
            setError('Please enter a valid 3-digit CVV.')
            return
        }
        if (!name.trim()) {
            setError('Please enter the cardholder name.')
            return
        }

        setIsSaving(true)
        setError(null)
        await new Promise((resolve) => setTimeout(resolve, 800))
        onSave(cleanNumber, expiry)
        setIsSaving(false)
        onClose()
    }

    return (
        <Modal isOpen={true} onClose={onClose} title="Add Payment Card" maxWidth="max-w-[420px]">
            <div className="space-y-4">
                <Input
                    label="Card Number"
                    value={cardNumber}
                    onChange={(e) => {
                        let val = e.target.value.replace(/\D/g, '')
                        val = val.match(/.{1,4}/g)?.join(' ') || val
                        setCardNumber(val)
                        setError(null)
                    }}
                    placeholder="•••• •••• •••• ••••"
                    maxLength={19}
                    autoFocus
                />
                <div className="grid grid-cols-2 gap-4">
                    <Input
                        label="Expiry Date"
                        value={expiry}
                        onChange={(e) => {
                            let val = e.target.value.replace(/\D/g, '')
                            if (val.length > 2) {
                                val = `${val.slice(0, 2)}/${val.slice(2, 4)}`
                            }
                            setExpiry(val)
                            setError(null)
                        }}
                        placeholder="MM/YY"
                        maxLength={5}
                    />
                    <Input
                        label="CVV"
                        type="password"
                        value={cvv}
                        onChange={(e) => {
                            setCvv(e.target.value.replace(/\D/g, ''))
                            setError(null)
                        }}
                        placeholder="•••"
                        maxLength={3}
                    />
                </div>
                <Input
                    label="Cardholder Name"
                    value={name}
                    onChange={(e) => {
                        setName(e.target.value)
                        setError(null)
                    }}
                    placeholder="John Doe"
                />
                {error && <p className="text-[13px] text-red-400 px-1">{error}</p>}
                <div className="mt-8 flex items-center justify-end gap-3">
                    <Button variant="ghost" onClick={onClose} disabled={isSaving}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSave}
                        isLoading={isSaving}
                        disabled={
                            cardNumber.length < 19 ||
                            expiry.length < 5 ||
                            cvv.length < 3 ||
                            !name.trim()
                        }
                    >
                        Save Card
                    </Button>
                </div>
            </div>
        </Modal>
    )
}

// Premium Cancellation Flow Modal
const CancellationFlowModal: React.FC<{
    onClose: () => void
    onConfirm: (feedback: string) => void
    isCancelling: boolean
    periodEnd: string
    limit: string
}> = ({ onClose, onConfirm, isCancelling, periodEnd, limit }) => {
    const [confirmText, setConfirmText] = useState('')
    const isConfirmEnabled = confirmText === 'cancel'

    const handleConfirm = () => {
        if (isConfirmEnabled) {
            onConfirm('')
        }
    }

    return (
        <Modal
            isOpen={true}
            onClose={onClose}
            title="Cancel Subscription"
            description={`You will retain Pro benefits and your ${limit} credits until your billing cycle ends on ${new Date(periodEnd).toLocaleDateString()}.`}
            maxWidth="max-w-[420px]"
            variant="premium"
        >
            <div className="flex flex-col gap-4">
                <p className="text-[13px] text-[#8F8E8D] leading-relaxed">
                    After this date, your plan will revert to Free.
                </p>

                <div>
                    <label
                        htmlFor="cancel-confirm-input"
                        className="text-[13px] text-[#8F8E8D] mb-2 block leading-relaxed"
                    >
                        To confirm, type{' '}
                        <span className="font-semibold text-white bg-white/[0.06] px-1.5 py-0.5 rounded text-[12px] font-mono">
                            cancel
                        </span>{' '}
                        below:
                    </label>
                    <input
                        id="cancel-confirm-input"
                        type="text"
                        autoFocus
                        value={confirmText}
                        onChange={(e) => setConfirmText(e.target.value)}
                        className="w-full bg-[#181817] border border-[#2B2A27] rounded-lg px-3.5 py-2.5 text-white text-[13px] focus:outline-none focus:border-[#4E4D49] focus:ring-1 focus:ring-[#4E4D49] transition-[border-color,box-shadow] duration-200 placeholder:text-[#4A4948]"
                        placeholder="cancel"
                        disabled={isCancelling}
                        autoComplete="off"
                        spellCheck={false}
                    />
                </div>

                <div className="mt-1 flex items-center justify-end gap-2.5">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isCancelling}
                        className="border border-[#2B2A27] bg-transparent text-white hover:bg-white/5 active:scale-95 transition-[transform,background-color,border-color,color] duration-200 text-[13px] font-medium px-4 py-2 rounded-lg focus:outline-none disabled:opacity-50"
                    >
                        Keep Pro Plan
                    </button>
                    <button
                        type="button"
                        onClick={handleConfirm}
                        disabled={!isConfirmEnabled || isCancelling}
                        className="bg-red-500/10 border border-red-500/20 text-red-300 hover:bg-red-500/20 active:scale-[0.97] transition-[transform,background-color,border-color,color] duration-200 text-[13px] font-medium px-4 py-2 rounded-lg focus:outline-none disabled:opacity-30 disabled:pointer-events-none flex items-center gap-1.5 justify-center min-w-[150px]"
                    >
                        {isCancelling ? (
                            <div className="flex items-center gap-1.5 justify-center">
                                <span className="w-3.5 h-3.5 border-2 border-red-300 border-t-transparent rounded-full animate-spin" />
                                <span>Cancelling...</span>
                            </div>
                        ) : (
                            'Confirm Cancellation'
                        )}
                    </button>
                </div>
            </div>
        </Modal>
    )
}

export const ProfileBillingSettings: React.FC<ProfileBillingSettingsProps> = ({
    profile: propProfile,
}) => {
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
    const { data: historyData } = useCreditsHistory({ limit: 5 })

    const createSubscriptionMutation = useCreateSubscription()
    const verifySubscriptionMutation = useVerifySubscription()
    const cancelSubscriptionMutation = useCancelSubscription()
    const createPortalSessionMutation = useCreatePortalSession()

    const [isUpgrading, setIsUpgrading] = useState(false)
    const [actionError, setActionError] = useState<string | null>(null)

    // Custom Modals visibility
    const [showRedeemModal, setShowRedeemModal] = useState(false)
    const [showAddCardModal, setShowAddCardModal] = useState(false)
    const [showUpgradeModal, setShowUpgradeModal] = useState(false)
    const [showCancelModal, setShowCancelModal] = useState(false)

    // Local Card storage simulation
    const [cardInfo, setCardInfo] = useState<{ number: string; expiry: string } | null>(() => {
        try {
            const saved = localStorage.getItem('december_billing_card')
            return saved ? JSON.parse(saved) : null
        } catch {
            return null
        }
    })

    const handleSaveCard = (number: string, expiry: string) => {
        const info = { number: number.slice(-4), expiry }
        setCardInfo(info)
        localStorage.setItem('december_billing_card', JSON.stringify(info))
    }

    const handleRemoveCard = () => {
        setCardInfo(null)
        localStorage.removeItem('december_billing_card')
    }

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

    const handleUpgradeConfirm = async (isRecurring: boolean) => {
        setIsUpgrading(true)
        setActionError(null)
        try {
            const scriptLoaded = await loadRazorpayScript()
            if (!scriptLoaded) {
                throw new Error('Failed to load Razorpay SDK. Check your internet connection.')
            }

            // Map recurring to totalCount 120, and one-time to 1
            const totalCount = isRecurring ? 120 : 1
            const res = await createSubscriptionMutation.mutateAsync({
                plan: 'PRO',
                totalCount,
            })

            const options = {
                key: res.keyId,
                subscription_id: res.subscriptionId,
                name: 'december',
                description: isRecurring
                    ? 'Upgrade to Pro (Auto-Renew)'
                    : 'Upgrade to Pro (One-Time)',
                handler: async (response: any) => {
                    try {
                        setIsUpgrading(true)
                        await verifySubscriptionMutation.mutateAsync({
                            razorpay_subscription_id: response.razorpay_subscription_id,
                            razorpay_payment_id: response.razorpay_payment_id,
                            razorpay_signature: response.razorpay_signature,
                        })
                        setShowUpgradeModal(false)
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
                modal: {
                    ondismiss: () => {
                        setIsUpgrading(false)
                    },
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

    const handleCancelConfirm = async (feedback: string) => {
        setActionError(null)
        try {
            await cancelSubscriptionMutation.mutateAsync({ cancelAtPeriodEnd: true })
            setShowCancelModal(false)
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
        <div className="flex flex-col w-full max-w-[680px] text-[#D6D5C9] animate-in fade-in duration-200">
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
                                    {isPro ? '$5/mo' : '$0/mo'}
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
                                    'Includes $1.00 credits (One-Time grant).'
                                )}
                            </span>
                        </div>
                        <div className="flex items-center gap-3">
                            {isPro ? (
                                !isCanceled && (
                                    <button
                                        onClick={() => setShowCancelModal(true)}
                                        className="px-4 py-1.5 rounded-lg border border-[#383736] text-[13px] text-red-400 hover:bg-red-500/10 transition-colors"
                                    >
                                        Cancel Subscription
                                    </button>
                                )
                            ) : (
                                <button
                                    onClick={() => handleUpgradeConfirm(true)}
                                    disabled={isUpgrading}
                                    className="px-4 py-1.5 rounded-lg bg-[#D6D5C9] text-[#171615] text-[13px] font-medium hover:bg-white transition-colors flex items-center gap-1.5 disabled:opacity-50"
                                >
                                    {isUpgrading ? (
                                        <>
                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                            Upgrading...
                                        </>
                                    ) : (
                                        'Upgrade to Pro'
                                    )}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Plans Comparison Section */}
            <div className="flex flex-col mb-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* Free Plan Card */}
                    <div className="rounded-xl border border-[#242323] bg-[#100E12]/30 p-5 flex flex-col justify-between">
                        <div>
                            <div className="flex justify-between items-start mb-2">
                                <span className="text-[15px] font-medium text-[#D6D5C9]">
                                    Free Plan
                                </span>
                                {!isPro && (
                                    <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-[#242323] text-[#7B7A79]">
                                        Active
                                    </span>
                                )}
                            </div>
                            <div className="mb-4">
                                <span className="text-[22px] font-semibold text-[#D6D5C9]">$0</span>
                                <span className="text-[#7B7A79] text-[12px] ml-1">/ month</span>
                            </div>
                            <div className="flex flex-col gap-2.5 text-[13px] text-[#7B7A79]">
                                <div className="flex items-center gap-2">
                                    <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                                    <span>$1.00 standard credit limit</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                                    <span>Standard execution speed</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                                    <span>Community support</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                                    <span>One-time credits (no expiry)</span>
                                </div>
                            </div>
                        </div>
                        <button
                            disabled
                            className="w-full mt-6 py-2 rounded-lg bg-[#242323] text-[#7B7A79] text-[13px] font-medium cursor-not-allowed"
                        >
                            {!isPro ? 'Current Plan' : 'Free Tier'}
                        </button>
                    </div>

                    {/* Pro Plan Card */}
                    <div
                        className={`rounded-xl border p-5 flex flex-col justify-between relative overflow-hidden ${
                            isPro
                                ? 'border-[#D6D5C9]/40 bg-[#D6D5C9]/5'
                                : 'border-[#383736] bg-[#1E1D1B]/5 hover:bg-[#1E1D1B]/15 transition-all'
                        }`}
                    >
                        <div>
                            <div className="flex justify-between items-start mb-2">
                                <span className="text-[15px] font-medium text-[#D6D5C9]">
                                    Pro Plan
                                </span>
                                {isPro && (
                                    <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-[#D6D5C9]/10 text-[#D6D5C9]">
                                        Active
                                    </span>
                                )}
                            </div>
                            <div className="mb-4">
                                <span className="text-[22px] font-semibold text-[#D6D5C9]">$5</span>
                                <span className="text-[#7B7A79] text-[12px] ml-1">/ month</span>
                            </div>
                            <div className="flex flex-col gap-2.5 text-[13px] text-[#7B7A79]">
                                <div className="flex items-center gap-2 text-[#D6D5C9]">
                                    <Check className="w-4 h-4 text-[#D6D5C9] shrink-0" />
                                    <span>$5.00 monthly credit refreshes</span>
                                </div>
                                <div className="flex items-center gap-2 text-[#D6D5C9]">
                                    <Check className="w-4 h-4 text-[#D6D5C9] shrink-0" />
                                    <span>Priority execution speed</span>
                                </div>
                                <div className="flex items-center gap-2 text-[#D6D5C9]">
                                    <Check className="w-4 h-4 text-[#D6D5C9] shrink-0" />
                                    <span>Premium 24/7 support</span>
                                </div>
                                <div className="flex items-center gap-2 text-[#D6D5C9]">
                                    <Check className="w-4 h-4 text-[#D6D5C9] shrink-0" />
                                    <span>Early access to new features</span>
                                </div>
                            </div>
                        </div>
                        {isPro ? (
                            <button
                                disabled
                                className="w-full mt-6 py-2 rounded-lg bg-[#D6D5C9]/10 text-[#D6D5C9] text-[13px] font-medium cursor-not-allowed"
                            >
                                Current Plan
                            </button>
                        ) : (
                            <button
                                onClick={() => handleUpgradeConfirm(true)}
                                disabled={isUpgrading}
                                className="w-full mt-6 py-2 rounded-lg bg-[#D6D5C9] text-[#171615] text-[13px] font-medium hover:bg-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {isUpgrading ? (
                                    <>
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        Upgrading...
                                    </>
                                ) : (
                                    'Upgrade to Pro'
                                )}
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Credit Balance */}
            <div className="flex flex-col mb-8">
                <h1 className="text-[16px] font-medium mb-4">Credit Balance</h1>
                <div className="flex flex-col gap-6 border-t border-[#242323] pt-6">
                    <div className="flex flex-col gap-0.5">
                        <span className="text-[13px] text-[#7B7A79] leading-relaxed">
                            {isPro ? (
                                <>
                                    Your monthly credits reset on{' '}
                                    <span className="text-white font-medium">
                                        {new Date(overview.periodEnd).toLocaleDateString()}
                                    </span>
                                    . Monthly credits are used first. Remaining credits expire at
                                    the end of the billing period.
                                </>
                            ) : (
                                'Your free plan credits are a one-time grant of $1.00 and do not expire. Upgrade to Pro to receive monthly credits.'
                            )}
                        </span>
                    </div>

                    <div className="flex flex-col md:flex-row gap-8 mt-2 items-center">
                        {/* Premium Redesigned Credit Card Dummy */}
                        <div className="w-[220px] h-[130px] rounded-2xl border border-[#2C2B2A] bg-gradient-to-tr from-[#131211] via-[#1A1918] to-[#252423] p-5 flex flex-col justify-between relative overflow-hidden shadow-xl">
                            <div className="absolute -right-8 -top-8 w-24 h-24 rounded-full bg-[#D6D5C9]/5 blur-2xl pointer-events-none" />

                            <div className="flex justify-between items-start">
                                {/* Silver metallic chip with linear grid details */}
                                <div className="w-7 h-5 rounded-[4px] border border-white/20 bg-gradient-to-br from-white/10 to-white/5 relative overflow-hidden flex items-center justify-center">
                                    <div className="absolute inset-x-1 inset-y-0.5 border-r border-b border-white/10" />
                                    <div className="absolute top-1/2 left-0 right-0 h-[1px] bg-white/10 -translate-y-1/2" />
                                    <div className="absolute left-1/2 top-0 bottom-0 w-[1px] bg-white/10 -translate-x-1/2" />
                                </div>
                                <span className="text-[9px] font-medium tracking-wider text-[#7B7A79]/85 uppercase">
                                    december
                                </span>
                            </div>

                            <div className="flex flex-col mt-auto gap-1">
                                <span className="text-[22px] font-semibold text-[#D6D5C9] tracking-tight">
                                    {unlimited ? 'Unlimited' : formatCents(remainingInCents)}
                                </span>
                                <span className="text-[10px] text-[#7B7A79] truncate tracking-wide font-medium">
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
                                <span>{isPro ? 'Monthly Credits' : 'One-Time Credits'}</span>
                                <span>
                                    {unlimited
                                        ? 'Unlimited'
                                        : `${formatCents(usedInCents)} / ${formatCents(limitInCents)}`}
                                </span>
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
                        <span className="w-1/3 font-medium">{isPro ? 'Monthly' : 'One-Time'}</span>
                        <span className="w-1/3">
                            {unlimited
                                ? 'Unlimited'
                                : `${formatCents(remainingInCents)} / ${formatCents(limitInCents)}`}
                        </span>
                        <span className="w-1/3 text-right">
                            {isPro
                                ? new Date(overview.periodEnd).toLocaleDateString(undefined, {
                                      year: 'numeric',
                                      month: 'short',
                                      day: 'numeric',
                                  })
                                : 'Does not expire'}
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
                                        {period.periodEnd.startsWith('2099')
                                            ? 'Never'
                                            : new Date(period.periodEnd).toLocaleDateString(
                                                  undefined,
                                                  {
                                                      year: 'numeric',
                                                      month: 'short',
                                                      day: 'numeric',
                                                  }
                                              )}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Credits */}
            <div className="flex flex-col mb-8">
                <h1 className="text-[16px] font-medium mb-4">Credits</h1>
                <div className="flex flex-col gap-7 border-t border-[#242323] pt-6">
                    {/* Gifted credits */}
                    <div className="flex items-center justify-between">
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[14px] text-[#D6D5C9]">Gifted credits</span>
                            <span className="text-[13px] text-[#7B7A79]">
                                Have a redeem code? Use it to claim free credits instantly.
                            </span>
                        </div>
                        <button
                            onClick={() => setShowRedeemModal(true)}
                            className="px-4 py-1.5 rounded-lg border border-[#383736] text-[13px] text-[#D6D5C9] hover:bg-[#1E1D1B] transition-colors"
                        >
                            Claim Credits
                        </button>
                    </div>

                    {/* Manage Usage */}
                    <div className="flex items-center justify-between">
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[14px] text-[#D6D5C9]">Manage Usage</span>
                            <span className="text-[13px] text-[#7B7A79]">
                                View and manage your resource usage and generation metrics.
                            </span>
                        </div>
                        <button
                            onClick={() => navigate('/profile/usage')}
                            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg border border-[#383736] text-[13px] text-[#D6D5C9] hover:bg-[#1E1D1B] transition-colors"
                        >
                            Dashboard
                            <ArrowUpRight className="w-3.5 h-3.5 text-[#7B7A79]" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Custom Modals */}
            {showRedeemModal && <RedeemCodeModal onClose={() => setShowRedeemModal(false)} />}
            {showAddCardModal && (
                <AddCardModal onClose={() => setShowAddCardModal(false)} onSave={handleSaveCard} />
            )}
            {showCancelModal && (
                <CancellationFlowModal
                    onClose={() => setShowCancelModal(false)}
                    onConfirm={handleCancelConfirm}
                    isCancelling={cancelSubscriptionMutation.isPending}
                    periodEnd={overview.periodEnd}
                    limit={formatCents(limitInCents)}
                />
            )}
        </div>
    )
}
