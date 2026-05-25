import { useQuery } from '@tanstack/react-query'
import { CreditCard, ArrowUpRight, Loader2, X, Gift, Check, AlertTriangle } from 'lucide-react'
import React, { useState, useEffect } from 'react'

import {
    useBillingOverview,
    useCreateSubscription,
    useVerifySubscription,
    useCancelSubscription,
    useCreatePortalSession,
    useCreditsHistory,
} from '@/features/billing/hooks/useBillingData'
import { profileAPI } from '@/features/profile/api/profile'

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

        // Simulate a brief delay for UX
        await new Promise((resolve) => setTimeout(resolve, 800))

        setError('Invalid redeem code. Please check your code and try again.')
        setIsRedeeming(false)
    }

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose()
            }}
        >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

            {/* Modal */}
            <div className="relative w-full max-w-[400px] mx-4 rounded-2xl border border-[#2A2928] bg-[#171615] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between px-6 pt-5 pb-4">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-[#D6D5C9]/10 flex items-center justify-center">
                            <Gift className="w-4 h-4 text-[#D6D5C9]" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[15px] font-medium text-[#D6D5C9]">
                                Redeem Code
                            </span>
                            <span className="text-[12px] text-[#7B7A79]">
                                Enter your code to claim gifted credits
                            </span>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg hover:bg-[#242323] transition-colors text-[#7B7A79] hover:text-[#D6D5C9]"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="h-px bg-[#242323]" />

                {/* Body */}
                <div className="px-6 py-5 flex flex-col gap-4">
                    <div className="flex flex-col gap-2">
                        <label className="text-[13px] text-[#7B7A79] font-medium">
                            Redeem Code
                        </label>
                        <input
                            type="text"
                            value={code}
                            onChange={(e) => {
                                setCode(e.target.value.toUpperCase())
                                setError(null)
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleRedeem()
                            }}
                            placeholder="e.g. GIFT-XXXX-XXXX"
                            className="w-full bg-[#100E12] border border-[#383736] rounded-xl px-4 py-2.5 text-[14px] text-[#D6D5C9] focus:outline-none focus:border-[#D6D5C9]/40 focus:ring-1 focus:ring-[#D6D5C9]/10 placeholder:text-[#4A4948] tracking-wider font-mono transition-all"
                            autoFocus
                        />
                    </div>

                    {error && <span className="text-[12px] text-red-400 font-medium">{error}</span>}
                </div>

                <div className="h-px bg-[#242323]" />

                {/* Footer */}
                <div className="px-6 py-4 flex items-center justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-xl border border-[#383736] text-[13px] text-[#7B7A79] hover:bg-[#1E1D1B] hover:text-[#D6D5C9] transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleRedeem}
                        disabled={isRedeeming || !code.trim()}
                        className="px-5 py-2 rounded-xl bg-[#D6D5C9] text-[#171615] text-[13px] font-medium hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {isRedeeming ? (
                            <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                Verifying...
                            </>
                        ) : (
                            'Redeem'
                        )}
                    </button>
                </div>
            </div>
        </div>
    )
}

// Add Mock Card Modal
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
        <div
            className="fixed inset-0 z-50 flex items-center justify-center"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose()
            }}
        >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <div className="relative w-full max-w-[400px] mx-4 rounded-2xl border border-[#2A2928] bg-[#171615] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between px-6 pt-5 pb-4">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-[#D6D5C9]/10 flex items-center justify-center">
                            <CreditCard className="w-4 h-4 text-[#D6D5C9]" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[15px] font-medium text-[#D6D5C9]">
                                Add Payment Card
                            </span>
                            <span className="text-[12px] text-[#7B7A79]">
                                Securely store card for future checkouts
                            </span>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg hover:bg-[#242323] transition-colors text-[#7B7A79] hover:text-[#D6D5C9]"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="h-px bg-[#242323]" />

                <div className="px-6 py-5 flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[12px] text-[#7B7A79] font-medium">
                            Card Number
                        </label>
                        <input
                            type="text"
                            maxLength={19}
                            value={cardNumber}
                            onChange={(e) => {
                                let val = e.target.value.replace(/\D/g, '')
                                val = val.match(/.{1,4}/g)?.join(' ') || val
                                setCardNumber(val)
                                setError(null)
                            }}
                            placeholder="•••• •••• •••• ••••"
                            className="w-full bg-[#100E12] border border-[#383736] rounded-xl px-4 py-2.5 text-[14px] text-[#D6D5C9] focus:outline-none focus:border-[#D6D5C9]/40 placeholder:text-[#4A4948] font-mono transition-all"
                            autoFocus
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[12px] text-[#7B7A79] font-medium">
                                Expiry Date
                            </label>
                            <input
                                type="text"
                                maxLength={5}
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
                                className="w-full bg-[#100E12] border border-[#383736] rounded-xl px-4 py-2.5 text-[14px] text-[#D6D5C9] focus:outline-none focus:border-[#D6D5C9]/40 placeholder:text-[#4A4948] font-mono transition-all"
                            />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[12px] text-[#7B7A79] font-medium">CVV</label>
                            <input
                                type="password"
                                maxLength={3}
                                value={cvv}
                                onChange={(e) => {
                                    setCvv(e.target.value.replace(/\D/g, ''))
                                    setError(null)
                                }}
                                placeholder="•••"
                                className="w-full bg-[#100E12] border border-[#383736] rounded-xl px-4 py-2.5 text-[14px] text-[#D6D5C9] focus:outline-none focus:border-[#D6D5C9]/40 placeholder:text-[#4A4948] font-mono transition-all"
                            />
                        </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label className="text-[12px] text-[#7B7A79] font-medium">
                            Cardholder Name
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => {
                                setName(e.target.value)
                                setError(null)
                            }}
                            placeholder="John Doe"
                            className="w-full bg-[#100E12] border border-[#383736] rounded-xl px-4 py-2.5 text-[14px] text-[#D6D5C9] focus:outline-none focus:border-[#D6D5C9]/40 placeholder:text-[#4A4948] transition-all"
                        />
                    </div>

                    {error && <span className="text-[12px] text-red-400 font-medium">{error}</span>}
                </div>

                <div className="h-px bg-[#242323]" />

                <div className="px-6 py-4 flex items-center justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-xl border border-[#383736] text-[13px] text-[#7B7A79] hover:bg-[#1E1D1B] hover:text-[#D6D5C9] transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={
                            isSaving ||
                            cardNumber.length < 19 ||
                            expiry.length < 5 ||
                            cvv.length < 3 ||
                            !name.trim()
                        }
                        className="px-5 py-2 rounded-xl bg-[#D6D5C9] text-[#171615] text-[13px] font-medium hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {isSaving ? (
                            <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                Saving...
                            </>
                        ) : (
                            'Save Card'
                        )}
                    </button>
                </div>
            </div>
        </div>
    )
}

// Upgrade Flow Confirmation Modal
const UpgradeConfirmationModal: React.FC<{
    onClose: () => void
    onConfirm: (isRecurring: boolean) => void
    isUpgrading: boolean
}> = ({ onClose, onConfirm, isUpgrading }) => {
    const [isRecurring, setIsRecurring] = useState(true)

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose()
            }}
        >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <div className="relative w-full max-w-[440px] mx-4 rounded-2xl border border-[#2A2928] bg-[#171615] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between px-6 pt-5 pb-4">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-[#D6D5C9]/10 flex items-center justify-center">
                            <CreditCard className="w-4 h-4 text-[#D6D5C9]" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[15px] font-medium text-[#D6D5C9]">
                                Upgrade to Pro Plan
                            </span>
                            <span className="text-[12px] text-[#7B7A79]">
                                Unlock premium generation & $5.00 monthly credits
                            </span>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg hover:bg-[#242323] transition-colors text-[#7B7A79] hover:text-[#D6D5C9]"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="h-px bg-[#242323]" />

                <div className="px-6 py-5 flex flex-col gap-5">
                    {/* Upgrade details */}
                    <div className="flex flex-col gap-2.5">
                        <span className="text-[13px] text-[#7B7A79] font-medium">
                            Select Plan Type
                        </span>
                        <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-[#100E12] border border-[#242323]">
                            <button
                                onClick={() => setIsRecurring(true)}
                                className={`py-2.5 rounded-lg text-[13px] font-medium transition-all ${
                                    isRecurring
                                        ? 'bg-[#242323] text-[#D6D5C9] shadow-sm'
                                        : 'text-[#7B7A79] hover:text-[#D6D5C9]'
                                }`}
                            >
                                Auto-Renewing
                            </button>
                            <button
                                onClick={() => setIsRecurring(false)}
                                className={`py-2.5 rounded-lg text-[13px] font-medium transition-all ${
                                    !isRecurring
                                        ? 'bg-[#242323] text-[#D6D5C9] shadow-sm'
                                        : 'text-[#7B7A79] hover:text-[#D6D5C9]'
                                }`}
                            >
                                One-Time Purchase
                            </button>
                        </div>
                    </div>

                    {/* Breakdown */}
                    <div className="rounded-xl border border-[#242323] bg-[#100E12]/50 p-4 flex flex-col gap-3 text-[13px]">
                        <div className="flex justify-between items-center text-[#7B7A79]">
                            <span>december Pro Plan</span>
                            <span className="text-[#D6D5C9]">$20.00</span>
                        </div>
                        <div className="flex justify-between items-center text-[#7B7A79]">
                            <span>Credits Included</span>
                            <span className="text-[#D6D5C9]">$5.00</span>
                        </div>
                        <div className="flex justify-between items-center text-[#7B7A79]">
                            <span>Recurrence</span>
                            <span className="text-[#D6D5C9]">
                                {isRecurring ? 'Monthly Auto-Renew' : '30 Days Access (One-time)'}
                            </span>
                        </div>
                        <div className="h-px bg-[#242323] my-1" />
                        <div className="flex justify-between items-center font-medium">
                            <span className="text-[#D6D5C9]">Amount Due Today</span>
                            <span className="text-[#D6D5C9] font-semibold text-[15px]">$20.00</span>
                        </div>
                    </div>
                </div>

                <div className="h-px bg-[#242323]" />

                <div className="px-6 py-4 flex items-center justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-xl border border-[#383736] text-[13px] text-[#7B7A79] hover:bg-[#1E1D1B] hover:text-[#D6D5C9] transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => onConfirm(isRecurring)}
                        disabled={isUpgrading}
                        className="px-5 py-2 rounded-xl bg-[#D6D5C9] text-[#171615] text-[13px] font-medium hover:bg-white transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                        {isUpgrading ? (
                            <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                Processing...
                            </>
                        ) : (
                            'Proceed to Payment'
                        )}
                    </button>
                </div>
            </div>
        </div>
    )
}

// Cancellation Feedback Flow Modal
const CancellationFlowModal: React.FC<{
    onClose: () => void
    onConfirm: (feedback: string) => void
    isCancelling: boolean
    periodEnd: string
    limit: string
}> = ({ onClose, onConfirm, isCancelling, periodEnd, limit }) => {
    const reasons = [
        'Too expensive for my budget',
        'Not using it enough',
        'Missing crucial features',
        'Another product suits my needs better',
        'Other / Prefer not to say',
    ]

    const [selectedReason, setSelectedReason] = useState('')
    const [customFeedback, setCustomFeedback] = useState('')

    const handleConfirm = () => {
        const fullFeedback = `Reason: ${selectedReason}. Custom: ${customFeedback}`
        onConfirm(fullFeedback)
    }

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose()
            }}
        >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <div className="relative w-full max-w-[460px] mx-4 rounded-2xl border border-[#2A2928] bg-[#171615] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between px-6 pt-5 pb-4">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center">
                            <AlertTriangle className="w-4 h-4 text-red-400" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[15px] font-medium text-[#D6D5C9]">
                                Cancel Subscription
                            </span>
                            <span className="text-[12px] text-[#7B7A79]">
                                We are sorry to see you go
                            </span>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg hover:bg-[#242323] transition-colors text-[#7B7A79] hover:text-[#D6D5C9]"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="h-px bg-[#242323]" />

                <div className="px-6 py-5 flex flex-col gap-4.5">
                    {/* Warning Card */}
                    <div className="p-4 rounded-xl border border-amber-500/10 bg-amber-500/5 text-[13px] text-amber-300 leading-relaxed flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 shrink-0 text-amber-500 mt-0.5" />
                        <div>
                            <span className="font-semibold text-white block mb-0.5">
                                Important Subscription Notice
                            </span>
                            You will retain Pro benefits and your {limit} credits until your billing
                            cycle ends on{' '}
                            <span className="font-medium text-white">
                                {new Date(periodEnd).toLocaleDateString()}
                            </span>
                            . After this date, you will lose your $5.00 monthly credits and revert
                            to the Free Plan ($1.00 one-time credit).
                        </div>
                    </div>

                    {/* Feedback Form */}
                    <div className="flex flex-col gap-3">
                        <span className="text-[13px] text-[#7B7A79] font-medium">
                            Why are you canceling?
                        </span>
                        <div className="flex flex-col gap-2">
                            {reasons.map((reason) => (
                                <label
                                    key={reason}
                                    className="flex items-center gap-3 px-4 py-3 rounded-xl border border-[#242323] hover:border-[#383736] bg-[#100E12]/30 cursor-pointer transition-colors"
                                >
                                    <input
                                        type="radio"
                                        name="cancel-reason"
                                        checked={selectedReason === reason}
                                        onChange={() => setSelectedReason(reason)}
                                        className="accent-[#D6D5C9] bg-transparent border-[#383736]"
                                    />
                                    <span className="text-[13px] text-[#D6D5C9]">{reason}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Text Comments */}
                    {selectedReason && (
                        <div className="flex flex-col gap-1.5 animate-in fade-in slide-in-from-top-2 duration-200">
                            <label className="text-[12px] text-[#7B7A79] font-medium">
                                Anything else you'd like to share? (Optional)
                            </label>
                            <textarea
                                value={customFeedback}
                                onChange={(e) => setCustomFeedback(e.target.value)}
                                placeholder="Tell us how we can improve..."
                                className="w-full bg-[#100E12] border border-[#383736] rounded-xl px-4 py-2.5 text-[13px] text-[#D6D5C9] focus:outline-none focus:border-[#D6D5C9]/40 min-h-[80px] max-h-[140px] resize-y placeholder:text-[#4A4948]"
                            />
                        </div>
                    )}
                </div>

                <div className="h-px bg-[#242323]" />

                <div className="px-6 py-4 flex items-center justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-xl border border-[#383736] text-[13px] text-[#7B7A79] hover:bg-[#1E1D1B] hover:text-[#D6D5C9] transition-colors"
                    >
                        Keep Pro Plan
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={isCancelling || !selectedReason}
                        className="px-5 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-[13px] font-medium hover:bg-red-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {isCancelling ? (
                            <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                Cancelling...
                            </>
                        ) : (
                            'Confirm Cancellation'
                        )}
                    </button>
                </div>
            </div>
        </div>
    )
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
                                    onClick={() => setShowUpgradeModal(true)}
                                    className="px-4 py-1.5 rounded-lg bg-[#D6D5C9] text-[#171615] text-[13px] font-medium hover:bg-white transition-colors flex items-center gap-1.5"
                                >
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
                                {isPro ? (
                                    <>
                                        Your monthly credits reset on{' '}
                                        <span className="text-white font-medium">
                                            {new Date(overview.periodEnd).toLocaleDateString()}
                                        </span>
                                        . Monthly credits are used first. Remaining credits expire
                                        at the end of the billing period.
                                    </>
                                ) : (
                                    'Your free plan credits are a one-time grant of $1.00 and do not expire. Upgrade to Pro to receive monthly credits.'
                                )}
                            </span>
                        </div>
                        {!isPro && (
                            <button
                                onClick={() => setShowUpgradeModal(true)}
                                className="px-4 py-1.5 rounded-lg border border-[#383736] text-[13px] text-[#D6D5C9] hover:bg-[#1E1D1B] transition-colors mt-1 whitespace-nowrap"
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

            {/* Plans Comparison Section */}
            <div className="flex flex-col mb-8">
                <h1 className="text-[16px] font-medium mb-4">Compare Plans</h1>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 border-t border-[#242323] pt-6">
                    {/* Free Plan Card */}
                    <div className="rounded-xl border border-[#242323] bg-[#100E12]/30 p-5 flex flex-col justify-between">
                        <div>
                            <div className="flex justify-between items-start mb-2">
                                <span className="text-[15px] font-medium text-[#D6D5C9]">
                                    Free Plan
                                </span>
                                <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-[#242323] text-[#7B7A79]">
                                    Active
                                </span>
                            </div>
                            <div className="mb-4">
                                <span className="text-[22px] font-semibold text-[#D6D5C9]">$0</span>
                                <span className="text-[#7B7A79] text-[12px] ml-1">one-time</span>
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
                                <span className="text-[22px] font-semibold text-[#D6D5C9]">
                                    $20
                                </span>
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
                                    <span>Auto-renew or manual monthly choice</span>
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
                                onClick={() => setShowUpgradeModal(true)}
                                className="w-full mt-6 py-2 rounded-lg bg-[#D6D5C9] text-[#171615] text-[13px] font-medium hover:bg-white transition-colors"
                            >
                                Upgrade to Pro
                            </button>
                        )}
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

            {/* Payment & Credits */}
            <div className="flex flex-col mb-8">
                <h1 className="text-[16px] font-medium mb-4">Payment & Credits</h1>
                <div className="flex flex-col gap-7 border-t border-[#242323] pt-6">
                    {/* Secure Card Option */}
                    <div className="flex items-center justify-between">
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[14px] text-[#D6D5C9]">Payment Card</span>
                            <span className="text-[13px] text-[#7B7A79]">
                                {cardInfo
                                    ? `Visa ending in ${cardInfo.number} (Expires ${cardInfo.expiry})`
                                    : 'No card added. Link a card for manual or automated renewals.'}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            {cardInfo ? (
                                <>
                                    <button
                                        onClick={() => setShowAddCardModal(true)}
                                        className="px-4 py-1.5 rounded-lg border border-[#383736] text-[13px] text-[#D6D5C9] hover:bg-[#1E1D1B] transition-colors"
                                    >
                                        Update
                                    </button>
                                    <button
                                        onClick={handleRemoveCard}
                                        className="px-4 py-1.5 rounded-lg border border-red-500/20 text-[13px] text-red-400 hover:bg-red-500/10 transition-colors"
                                    >
                                        Remove
                                    </button>
                                </>
                            ) : (
                                <button
                                    onClick={() => setShowAddCardModal(true)}
                                    className="px-4 py-1.5 rounded-lg border border-[#383736] text-[13px] text-[#D6D5C9] hover:bg-[#1E1D1B] transition-colors"
                                >
                                    Add Card
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Redeem Code */}
                    <div className="flex items-center justify-between">
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[14px] text-[#D6D5C9]">Redeem a Usage Code</span>
                            <span className="text-[13px] text-[#7B7A79]">
                                Redeem a usage code to claim your gifted credits.
                            </span>
                        </div>
                        <button
                            onClick={() => setShowRedeemModal(true)}
                            className="px-4 py-1.5 rounded-lg border border-[#383736] text-[13px] text-[#D6D5C9] hover:bg-[#1E1D1B] transition-colors"
                        >
                            Redeem Code
                        </button>
                    </div>

                    {/* Manage Billing Dashboard */}
                    {isPro && (
                        <div className="flex items-center justify-between">
                            <div className="flex flex-col gap-0.5">
                                <span className="text-[14px] text-[#D6D5C9]">Manage Billing</span>
                                <span className="text-[13px] text-[#7B7A79]">
                                    View and manage your subscription on the billing dashboard.
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
                    )}
                </div>
            </div>

            {/* Custom Modals */}
            {showRedeemModal && <RedeemCodeModal onClose={() => setShowRedeemModal(false)} />}
            {showAddCardModal && (
                <AddCardModal onClose={() => setShowAddCardModal(false)} onSave={handleSaveCard} />
            )}
            {showUpgradeModal && (
                <UpgradeConfirmationModal
                    onClose={() => setShowUpgradeModal(false)}
                    onConfirm={handleUpgradeConfirm}
                    isUpgrading={isUpgrading}
                />
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
