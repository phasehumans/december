import React, { useState } from 'react'

import { Modal } from '@/shared/components/ui/Modal'

interface CancellationFlowModalProps {
    onClose: () => void
    onConfirm: (feedback: string) => void
    isCancelling: boolean
    periodEnd: string
    limit: string
}

export const CancellationFlowModal: React.FC<CancellationFlowModalProps> = ({
    onClose,
    onConfirm,
    isCancelling,
    periodEnd,
    limit,
}) => {
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
                        className="w-full bg-[#2A2A2A] border border-[#2B2A27] rounded-lg px-3.5 py-2.5 text-white text-[13px] focus:outline-none focus:border-[#4E4D49] focus:ring-1 focus:ring-[#4E4D49] transition-[border-color,box-shadow] duration-200 placeholder:text-[#4A4948]"
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
                        className="border border-[#2B2A27] bg-transparent text-white hover:bg-white/5 active:scale-95 transition-[transform,background-color,border-color,color] duration-200 text-[13px] font-medium px-4 py-2 rounded-lg focus:outline-none disabled:opacity-50 cursor-pointer"
                    >
                        Keep Pro Plan
                    </button>
                    <button
                        type="button"
                        onClick={handleConfirm}
                        disabled={!isConfirmEnabled || isCancelling}
                        className="bg-red-500/10 border border-red-500/20 text-red-300 hover:bg-red-500/20 active:scale-[0.97] transition-[transform,background-color,border-color,color] duration-200 text-[13px] font-medium px-4 py-2 rounded-lg focus:outline-none disabled:opacity-30 disabled:pointer-events-none flex items-center gap-1.5 justify-center min-w-[150px] cursor-pointer"
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
