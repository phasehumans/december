import { useQueryClient } from '@tanstack/react-query'
import React, { useState } from 'react'

import { billingAPI } from '@/features/billing/api/billing'
import { Modal } from '@/shared/components/ui/Modal'

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
            setError('Please enter a redeem code.')
            return
        }
        setIsRedeeming(true)
        setError(null)
        setSuccessMessage(null)

        try {
            const res = await billingAPI.redeemCode(code)
            setSuccessMessage(
                `Successfully redeemed code and claimed $${(res.creditAmount / 100).toFixed(2)} in gifted credits!`
            )

            // invalidate billing overview and profile to trigger updates across the app
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['billing-overview'] }),
                queryClient.invalidateQueries({ queryKey: ['profile'] }),
            ])

            // automatically close the modal after 2.5 seconds on success
            setTimeout(() => {
                onClose()
            }, 2500)
        } catch (err: any) {
            setError(
                err?.message ||
                    err?.errors ||
                    'Invalid redeem code. Please check your code and try again.'
            )
        } finally {
            setIsRedeeming(false)
        }
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
                        className="font-sans text-[11px] font-medium text-[#8F8E8D] uppercase tracking-wider mb-1.5 block"
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
                            if (e.key === 'Enter' && !isRedeeming && !successMessage) handleRedeem()
                        }}
                        className="w-full bg-[#141414] border border-[#2A2A2A] rounded-lg px-3.5 py-2 text-white font-mono text-xs sm:text-[13px] tracking-wider placeholder-[#666666] outline-none focus:border-[#87b2f4] transition-colors"
                        placeholder="K47B9X2P"
                        disabled={isRedeeming || !!successMessage}
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="off"
                        spellCheck={false}
                    />
                </div>

                {error && <p className="font-sans text-xs text-red-400 px-1">{error}</p>}
                {successMessage && (
                    <p className="font-sans text-xs text-emerald-400 px-1">{successMessage}</p>
                )}

                <div className="mt-1 flex items-center justify-end gap-2.5">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isRedeeming || !!successMessage}
                        className="bg-transparent text-[#9A9998] hover:text-white active:scale-95 transition-all font-sans text-[13px] font-medium px-4 py-2 rounded-lg focus:outline-none disabled:opacity-50 cursor-pointer"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleRedeem}
                        disabled={!code.trim() || isRedeeming || !!successMessage}
                        className="bg-white text-black hover:bg-neutral-200 active:scale-95 transition-all font-sans text-[13px] font-medium px-4 py-2 rounded-lg focus:outline-none disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center min-w-[110px] cursor-pointer"
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
