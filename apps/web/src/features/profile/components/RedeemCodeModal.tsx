import { useQueryClient } from '@tanstack/react-query'
import React, { useState } from 'react'

import { billingAPI } from '@/features/billing/api/billing'
import {
    FormError,
    ModalActions,
    inputClass,
} from '@/features/connections/components/ConnectionsUi'
import { Modal } from '@/shared/components/ui/Modal'
import { cn } from '@/shared/lib/utils'

interface RedeemCodeModalProps {
    onClose: () => void
}

export const RedeemCodeModal: React.FC<RedeemCodeModalProps> = ({ onClose }) => {
    const queryClient = useQueryClient()
    const [code, setCode] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [isRedeeming, setIsRedeeming] = useState(false)
    const [successMessage, setSuccessMessage] = useState<string | null>(null)

    const handleRedeem = async () => {
        if (!code.trim()) {
            setError('Enter a code.')
            return
        }
        setIsRedeeming(true)
        setError(null)
        setSuccessMessage(null)

        try {
            const res = await billingAPI.redeemCode(code)
            setSuccessMessage(`Added $${(res.creditAmount / 100).toFixed(2)} in credits.`)

            // invalidate billing overview and profile to trigger updates across the app
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['billing-overview'] }),
                queryClient.invalidateQueries({ queryKey: ['profile'] }),
            ])

            // show the amount for a moment, then close
            setTimeout(() => {
                onClose()
            }, 1500)
        } catch (err: any) {
            setError(
                err?.message || err?.errors || 'This code is not valid. Check it and try again.'
            )
        } finally {
            setIsRedeeming(false)
        }
    }

    return (
        <Modal
            isOpen={true}
            onClose={onClose}
            title="Redeem code"
            description="Enter a coupon or gift code."
            variant="premium"
            showLogo={false}
            sheetOnPhone
        >
            <form
                onSubmit={(e) => {
                    e.preventDefault()
                    // the modal is portaled, so stop the submit reaching a form behind it
                    e.stopPropagation()
                    if (!isRedeeming && !successMessage) void handleRedeem()
                }}
                className="flex flex-col gap-4"
            >
                <input
                    id="redeem-code-input"
                    type="text"
                    autoFocus
                    aria-label="Code"
                    value={code}
                    onChange={(e) => {
                        setCode(e.target.value.toUpperCase())
                        setError(null)
                    }}
                    className={cn(inputClass, 'font-mono tracking-wider')}
                    placeholder="K47B9X2P"
                    disabled={isRedeeming || !!successMessage}
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                />

                <FormError>{error}</FormError>
                {successMessage && (
                    <p role="status" className="text-[12.5px] text-emerald-400 font-medium">
                        {successMessage}
                    </p>
                )}

                <ModalActions
                    onCancel={onClose}
                    submitLabel="Redeem"
                    submitDisabled={!code.trim() || !!successMessage}
                    isPending={isRedeeming}
                />
            </form>
        </Modal>
    )
}
