import { useQuery, useQueryClient } from '@tanstack/react-query'
import React from 'react'

import { billingAPI } from '@/features/billing/api/billing'
import { profileAPI } from '@/features/profile/api/profile'

export const MIN_TOP_UP_USD = 1
export const MAX_TOP_UP_USD = 50

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

type UseRazorpayCheckoutOptions = {
    /** runs after the payment is verified and the balance queries are refreshed */
    onPaid?: (amountUsd: number) => void
}

/** opens the Razorpay checkout for a wallet top-up and verifies the payment on the server */
export const useRazorpayCheckout = ({ onPaid }: UseRazorpayCheckoutOptions = {}) => {
    const queryClient = useQueryClient()
    const { data: profile } = useQuery({
        queryKey: ['profile'],
        queryFn: profileAPI.getProfile,
        staleTime: 60000,
    })

    const [isProcessing, setIsProcessing] = React.useState(false)
    const [error, setError] = React.useState<string | null>(null)

    const startCheckout = React.useCallback(
        async (amountUsd: number) => {
            if (
                !Number.isInteger(amountUsd) ||
                amountUsd < MIN_TOP_UP_USD ||
                amountUsd > MAX_TOP_UP_USD
            ) {
                setError(
                    `Amount must be a whole number between $${MIN_TOP_UP_USD} and $${MAX_TOP_UP_USD}.`
                )
                return
            }

            setIsProcessing(true)
            setError(null)

            try {
                const scriptLoaded = await loadRazorpayScript()
                if (!scriptLoaded) {
                    throw new Error(
                        'Failed to load Razorpay payment SDK. Check your internet connection.'
                    )
                }

                const order = await billingAPI.createRazorpayOrder({
                    amountInCents: amountUsd * 100,
                })

                const options = {
                    key: order.keyId,
                    amount: order.amount,
                    currency: order.currency,
                    name: 'December',
                    description: `Add $${amountUsd} Credits to Wallet`,
                    order_id: order.orderId,
                    handler: async (response: any) => {
                        setIsProcessing(true)
                        try {
                            const verifyRes = await billingAPI.verifyRazorpayPayment({
                                razorpay_order_id: response.razorpay_order_id,
                                razorpay_payment_id: response.razorpay_payment_id,
                                razorpay_signature: response.razorpay_signature,
                            })

                            if (!verifyRes.success) {
                                throw new Error('Verification failed. Please contact support.')
                            }

                            await Promise.all([
                                queryClient.invalidateQueries({ queryKey: ['billing-overview'] }),
                                queryClient.invalidateQueries({ queryKey: ['profile'] }),
                                queryClient.invalidateQueries({ queryKey: ['onboarding'] }),
                            ])
                            onPaid?.(amountUsd)
                        } catch (err: any) {
                            setError(err?.message || 'Failed to verify payment signature.')
                        } finally {
                            setIsProcessing(false)
                        }
                    },
                    modal: {
                        ondismiss: () => {
                            setIsProcessing(false)
                        },
                    },
                    prefill: {
                        name: profile?.name || '',
                        email: profile?.email || '',
                    },
                    theme: {
                        color: '#FFFFFF',
                    },
                }

                const rzp = new (window as any).Razorpay(options)
                rzp.open()
            } catch (err: any) {
                setError(
                    err?.message ||
                        err?.errors ||
                        'An error occurred during payment initialization.'
                )
                setIsProcessing(false)
            }
        },
        [onPaid, profile?.email, profile?.name, queryClient]
    )

    return { startCheckout, isProcessing, error, setError }
}
