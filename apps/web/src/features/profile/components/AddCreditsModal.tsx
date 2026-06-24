import { useQueryClient } from '@tanstack/react-query'
import React, { useState } from 'react'
import { billingAPI } from '@/features/billing/api/billing'
import { Modal } from '@/shared/components/ui/Modal'
import { Check } from 'lucide-react'

interface AddCreditsModalProps {
    onClose: () => void
}

const loadRazorpayScript = () => {
    return new Promise<boolean>((resolve) => {
        if ((window as any).Razorpay) {
            resolve(true)
            return
        }
        const script = document.createElement('script')
        script.src = 'https://checkout.razorpay.com/v1/checkout.js'
        script.onload = () => resolve(true)
        script.onerror = () => resolve(false)
        document.body.appendChild(script)
    })
}

export const AddCreditsModal: React.FC<AddCreditsModalProps> = ({ onClose }) => {
    const queryClient = useQueryClient()
    const [amountStr, setAmountStr] = useState('5')
    const [paymentMethod, setPaymentMethod] = useState<'razorpay' | 'coinbase'>('razorpay')
    const [error, setError] = useState<string | null>(null)
    const [isProcessing, setIsProcessing] = useState(false)
    const [successMessage, setSuccessMessage] = useState<string | null>(null)

    const handleAmountChange = (val: string) => {
        // Enforce whole numbers only by stripping any non-digits
        const cleanVal = val.replace(/\D/g, '')
        setAmountStr(cleanVal)
        setError(null)

        if (cleanVal === '') {
            setError('Please enter a USD amount.')
            return
        }

        const amountNum = parseInt(cleanVal, 10)
        if (amountNum < 2 || amountNum > 20) {
            setError('Amount must be a whole number between $2 and $20.')
        }
    }

    const handlePayment = async () => {
        if (!amountStr) {
            setError('Please enter a USD amount.')
            return
        }

        const amount = parseInt(amountStr, 10)
        if (isNaN(amount) || amount < 2 || amount > 20) {
            setError('Amount must be a whole number between $2 and $20.')
            return
        }

        const amountInCents = amount * 100
        setIsProcessing(true)
        setError(null)

        try {
            if (paymentMethod === 'razorpay') {
                const scriptLoaded = await loadRazorpayScript()
                if (!scriptLoaded) {
                    throw new Error(
                        'Failed to load Razorpay payment SDK. Check your internet connection.'
                    )
                }

                const order = await billingAPI.createRazorpayOrder({ amountInCents })

                const options = {
                    key: order.keyId,
                    amount: order.amount,
                    currency: order.currency,
                    name: 'December',
                    description: `Add $${amount} Credits to Wallet`,
                    order_id: order.orderId,
                    handler: async function (response: any) {
                        setIsProcessing(true)
                        try {
                            const verifyRes = await billingAPI.verifyRazorpayPayment({
                                razorpay_order_id: response.razorpay_order_id,
                                razorpay_payment_id: response.razorpay_payment_id,
                                razorpay_signature: response.razorpay_signature,
                            })

                            if (verifyRes.success) {
                                setSuccessMessage(
                                    `Successfully added $${amount}.00 credits to your wallet!`
                                )
                                await Promise.all([
                                    queryClient.invalidateQueries({
                                        queryKey: ['billing-overview'],
                                    }),
                                    queryClient.invalidateQueries({ queryKey: ['profile'] }),
                                ])
                                setTimeout(() => {
                                    onClose()
                                }, 2500)
                            } else {
                                throw new Error('Verification failed. Please contact support.')
                            }
                        } catch (err: any) {
                            setError(err?.message || 'Failed to verify payment signature.')
                        } finally {
                            setIsProcessing(false)
                        }
                    },
                    modal: {
                        ondismiss: function () {
                            setIsProcessing(false)
                        },
                    },
                    prefill: {
                        name: '',
                        email: '',
                    },
                    theme: {
                        color: '#FFFFFF', // Clean white theme for checkout button
                    },
                }

                const rzp = new (window as any).Razorpay(options)
                rzp.open()
            } else {
                // Crypto / Coinbase Commerce
                const charge = await billingAPI.createCryptoOrder({ amountInCents })
                setSuccessMessage('Redirecting to Coinbase Commerce...')
                setTimeout(() => {
                    window.location.href = charge.hostedUrl
                }, 1000)
            }
        } catch (err: any) {
            setError(
                err?.message || err?.errors || 'An error occurred during payment initialization.'
            )
            setIsProcessing(false)
        }
    }

    return (
        <Modal
            isOpen={true}
            onClose={onClose}
            title="Add Wallet Credits"
            description="Enter a USD amount to top up your credits. Minimum $2, maximum $20."
            variant="premium"
        >
            <div className="flex flex-col gap-6 py-2">
                {/* Amount Input */}
                <div className="flex flex-col gap-2">
                    <label
                        htmlFor="credit-amount-input"
                        className="text-[11px] font-semibold text-[#8F8E8D] uppercase tracking-wider block"
                    >
                        Amount (USD)
                    </label>
                    <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 font-mono text-lg font-medium">
                            $
                        </span>
                        <input
                            id="credit-amount-input"
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={amountStr}
                            onChange={(e) => handleAmountChange(e.target.value)}
                            className="w-full bg-[#181817] border border-[#2B2A27] rounded-xl pl-9 pr-4 py-3 text-white text-lg font-mono font-medium focus:outline-none focus:border-[#4E4D49] focus:ring-1 focus:ring-[#4E4D49] transition-[border-color,box-shadow]"
                            placeholder="5"
                            disabled={isProcessing || !!successMessage}
                            autoComplete="off"
                        />
                    </div>
                    {/* Error displayed directly below input in simple red text */}
                    {error && (
                        <p className="text-[12px] text-red-500 mt-1 px-1 animate-in fade-in duration-200">
                            {error}
                        </p>
                    )}
                </div>

                {/* Payment Methods */}
                <div className="flex flex-col gap-2.5">
                    <span className="text-[11px] font-semibold text-[#8F8E8D] uppercase tracking-wider block">
                        Select Payment Method
                    </span>
                    <div className="grid grid-cols-2 gap-4">
                        {/* Card/UPI (Razorpay) */}
                        <button
                            type="button"
                            onClick={() => {
                                setPaymentMethod('razorpay')
                                setError(null)
                            }}
                            disabled={isProcessing || !!successMessage}
                            className={`group flex flex-col items-center justify-between p-5 rounded-2xl border text-center transition-all duration-300 relative overflow-hidden cursor-pointer h-36 ${
                                paymentMethod === 'razorpay'
                                    ? 'border-white bg-white/5 text-white'
                                    : 'border-[#2B2A27] bg-[#181817] text-neutral-400 hover:border-neutral-700 hover:text-white'
                            }`}
                        >
                            {/* Selected Indicator (White Circle / Black Check) */}
                            {paymentMethod === 'razorpay' && (
                                <div className="absolute right-3 top-3 bg-white text-black rounded-full p-0.5">
                                    <Check className="h-3 w-3 stroke-[3]" />
                                </div>
                            )}

                            {/* SVG Logo - Razorpay */}
                            <div className="flex items-center justify-center flex-grow">
                                <svg
                                    fill={paymentMethod === 'razorpay' ? '#FFFFFF' : '#8F8E8D'}
                                    role="img"
                                    viewBox="0 0 24 24"
                                    className="h-9 w-9 transition-colors duration-300 group-hover:scale-105"
                                    xmlns="http://www.w3.org/2000/svg"
                                >
                                    <title>Razorpay</title>
                                    <path d="M22.436 0l-11.91 7.773-1.174 4.276 6.625-4.297L11.65 24h4.391l6.395-24zM14.26 10.098L3.389 17.166 1.564 24h9.008l3.688-13.902Z" />
                                </svg>
                            </div>

                            <div className="flex flex-col items-center mt-2">
                                <span className="text-[13px] font-semibold tracking-wide">
                                    Razorpay
                                </span>
                                <span className="text-[10px] text-neutral-500 font-medium mt-0.5">
                                    Cards, UPI & Netbanking
                                </span>
                            </div>
                        </button>

                        {/* Crypto (Coinbase) */}
                        <button
                            type="button"
                            onClick={() => {
                                setPaymentMethod('coinbase')
                                setError(null)
                            }}
                            disabled={isProcessing || !!successMessage}
                            className={`group flex flex-col items-center justify-between p-5 rounded-2xl border text-center transition-all duration-300 relative overflow-hidden cursor-pointer h-36 ${
                                paymentMethod === 'coinbase'
                                    ? 'border-white bg-white/5 text-white'
                                    : 'border-[#2B2A27] bg-[#181817] text-neutral-400 hover:border-neutral-700 hover:text-white'
                            }`}
                        >
                            {/* Selected Indicator */}
                            {paymentMethod === 'coinbase' && (
                                <div className="absolute right-3 top-3 bg-white text-black rounded-full p-0.5">
                                    <Check className="h-3 w-3 stroke-[3]" />
                                </div>
                            )}

                            {/* SVG Logo - Coinbase */}
                            <div className="flex items-center justify-center flex-grow">
                                <svg
                                    viewBox="0 0 24 24"
                                    className="h-9 w-9 transition-transform duration-300 group-hover:scale-105"
                                    xmlns="http://www.w3.org/2000/svg"
                                >
                                    <circle
                                        cx="12"
                                        cy="12"
                                        r="11"
                                        fill={paymentMethod === 'coinbase' ? '#0052FF' : '#2B2A27'}
                                        className="transition-colors duration-300"
                                    />
                                    <path
                                        d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5c1.66 0 3.12-.81 4-2.07l-1.63-1.2A3.003 3.003 0 0 1 12 15c-1.66 0-3-1.34-3-3s1.34-3 3-3c.9 0 1.7.4 2.23 1.03l1.64-1.22A4.985 4.985 0 0 0 12 7z"
                                        fill="white"
                                    />
                                </svg>
                            </div>

                            <div className="flex flex-col items-center mt-2">
                                <span className="text-[13px] font-semibold tracking-wide">
                                    Coinbase
                                </span>
                                <span className="text-[10px] text-neutral-500 font-medium mt-0.5">
                                    USDT, BTC & Ethereum
                                </span>
                            </div>
                        </button>
                    </div>
                </div>

                {/* Success Messaging (Error is displayed above) */}
                {successMessage && (
                    <div className="flex items-center gap-2 text-xs text-emerald-500 bg-emerald-500/5 border border-emerald-500/10 p-3.5 rounded-xl animate-in fade-in slide-in-from-top-2 duration-200">
                        <Check className="h-4 w-4 shrink-0" />
                        <span>{successMessage}</span>
                    </div>
                )}

                {/* Footer Controls */}
                <div className="mt-2 flex items-center justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isProcessing || !!successMessage}
                        className="border border-[#2B2A27] bg-transparent text-white hover:bg-white/5 active:scale-95 transition-[transform,background-color,border-color,color] duration-200 text-[13px] font-medium px-4 py-2.5 rounded-xl focus:outline-none disabled:opacity-50 cursor-pointer"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handlePayment}
                        disabled={isProcessing || !!successMessage || !amountStr || !!error}
                        className="bg-white text-black hover:bg-neutral-200 active:scale-95 transition-[transform,background-color,border-color,color] duration-200 text-[13px] font-semibold px-6 py-2.5 rounded-xl focus:outline-none disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center min-w-[150px] cursor-pointer"
                    >
                        {isProcessing ? (
                            <div className="flex items-center gap-1.5 justify-center">
                                <span className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                                <span>Processing...</span>
                            </div>
                        ) : paymentMethod === 'razorpay' ? (
                            'Pay with Razorpay'
                        ) : (
                            'Pay with Crypto'
                        )}
                    </button>
                </div>
            </div>
        </Modal>
    )
}
