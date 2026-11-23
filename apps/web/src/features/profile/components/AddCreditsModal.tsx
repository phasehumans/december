import React, { useState } from 'react'

import { useBillingOverview } from '@/features/billing/hooks/useBillingData'
import {
    MAX_TOP_UP_USD,
    MIN_TOP_UP_USD,
    useRazorpayCheckout,
} from '@/features/billing/hooks/useRazorpayCheckout'
import { FormError, ModalActions } from '@/features/connections/components/ConnectionsUi'
import { Modal } from '@/shared/components/ui/Modal'
import { useIsPhone } from '@/shared/lib/useIsPhone'
import { cn } from '@/shared/lib/utils'

interface AddCreditsModalProps {
    onClose: () => void
}

/** one tap amounts under the input. all are inside the top-up limits */
const QUICK_AMOUNTS = [5, 10, 25, 50]

export const AddCreditsModal: React.FC<AddCreditsModalProps> = ({ onClose }) => {
    const { data: overview } = useBillingOverview()
    const usdToInrRate = overview?.usdToInrRate ?? 92.68
    const [amountStr, setAmountStr] = useState('10')
    const isPhone = useIsPhone()
    // the hook refreshes the balance before onPaid runs, so the page behind shows the new
    // balance when the dialog closes
    const { startCheckout, isProcessing, error, setError } = useRazorpayCheckout({
        onPaid: () => onClose(),
    })

    const handleAmountChange = (val: string) => {
        // enforce whole numbers only by stripping any non-digits
        const cleanVal = val.replace(/\D/g, '')
        setAmountStr(cleanVal)
        setError(null)

        if (cleanVal === '') {
            setError('Enter an amount in US dollars.')
            return
        }

        const amountNum = parseInt(cleanVal, 10)
        if (amountNum < MIN_TOP_UP_USD || amountNum > MAX_TOP_UP_USD) {
            setError(`Enter a whole number from $${MIN_TOP_UP_USD} to $${MAX_TOP_UP_USD}.`)
        }
    }

    const handlePayment = async () => {
        if (!amountStr) {
            setError('Enter an amount in US dollars.')
            return
        }

        await startCheckout(parseInt(amountStr, 10))
    }

    const amountNum = parseInt(amountStr, 10)
    const inrEstimate =
        !isNaN(amountNum) && amountNum >= MIN_TOP_UP_USD && amountNum <= MAX_TOP_UP_USD
            ? Math.round(amountNum * usdToInrRate)
            : null

    // desktop: its own line above the buttons, so Cancel and Pay stay on one row.
    // phones: under the full-width Pay button
    const securedBy = (
        <span className="flex items-center gap-1.5 select-none">
            <svg
                viewBox="0 0 24 24"
                className="h-3.5 w-3.5 fill-[#5893EE] shrink-0"
                xmlns="http://www.w3.org/2000/svg"
            >
                <path d="M22.436 0l-11.91 7.773-1.174 4.276 6.625-4.297L11.65 24h4.391l6.395-24zM14.26 10.098L3.389 17.166 1.564 24h9.008l3.688-13.902Z" />
            </svg>
            <span className="text-[12px] font-medium text-[#7B7A79]">
                Secured by <span className="text-[#D6D5C9] font-medium">Razorpay</span>
            </span>
        </span>
    )

    return (
        <Modal
            isOpen={true}
            onClose={onClose}
            title="Add credits"
            description={`From $${MIN_TOP_UP_USD} to $${MAX_TOP_UP_USD} for each payment.`}
            variant="premium"
            showLogo={false}
            sheetOnPhone
        >
            <form
                onSubmit={(e) => {
                    e.preventDefault()
                    // the modal is portaled, so stop the submit reaching a form behind it
                    e.stopPropagation()
                    void handlePayment()
                }}
                className="flex flex-col gap-4"
            >
                {/* amount */}
                <div className="flex items-center justify-between gap-3 p-4 bg-[#191919] border border-[#242323] rounded-xl">
                    <div className="flex items-center min-w-0">
                        <span className="text-[#7B7A79] text-3xl font-medium mr-2 select-none">
                            $
                        </span>
                        <input
                            id="credit-amount-input"
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            aria-label="Amount in US dollars"
                            value={amountStr}
                            onChange={(e) => handleAmountChange(e.target.value)}
                            className="w-full bg-transparent text-white text-3xl font-medium focus:outline-none placeholder-[#3A3A3A] tracking-tight"
                            placeholder="10"
                            disabled={isProcessing}
                            autoComplete="off"
                            autoFocus
                        />
                    </div>
                    {inrEstimate && !error && (
                        <span className="text-[12px] text-[#7B7A79] font-medium shrink-0">
                            ≈ ₹{inrEstimate.toLocaleString('en-IN')}
                        </span>
                    )}
                </div>

                {/* quick amounts */}
                <div className="flex gap-2" role="group" aria-label="Quick amounts">
                    {QUICK_AMOUNTS.map((amount) => {
                        const isPicked = amountStr === String(amount)
                        return (
                            <button
                                key={amount}
                                type="button"
                                aria-pressed={isPicked}
                                disabled={isProcessing}
                                onClick={() => handleAmountChange(String(amount))}
                                className={cn(
                                    'flex-1 py-1.5 rounded-lg border text-[13px] font-medium text-[#D6D5C9] transition-colors cursor-pointer disabled:opacity-50',
                                    isPicked
                                        ? 'border-[#2B2A29] bg-[#2B2A29]'
                                        : 'border-[#383736] hover:bg-[#242323]'
                                )}
                            >
                                ${amount}
                            </button>
                        )
                    })}
                </div>

                <FormError>{error}</FormError>

                {!isPhone && securedBy}

                <ModalActions
                    onCancel={onClose}
                    submitLabel={`Pay ${inrEstimate ? `₹${inrEstimate.toLocaleString('en-IN')}` : `$${amountStr || 0}`}`}
                    submitDisabled={!amountStr || !!error}
                    isPending={isProcessing}
                    leading={isPhone ? securedBy : undefined}
                />
            </form>
        </Modal>
    )
}
