import { Check } from 'lucide-react'
import React from 'react'
import { useNavigate } from 'react-router-dom'

import { Modal } from '@/shared/components/ui/Modal'

interface ProUpgradeModalProps {
    isOpen: boolean
    onClose: () => void
}

export const ProUpgradeModal: React.FC<ProUpgradeModalProps> = ({ isOpen, onClose }) => {
    const navigate = useNavigate()

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Upgrade to Pro"
            description="Get unlimited power, premium AI models, and priority execution."
            variant="premium"
        >
            <div className="flex flex-col gap-4 mt-2">
                <div className="flex flex-col gap-3 px-2">
                    <div className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center shrink-0">
                            <Check className="w-3.5 h-3.5 text-[#D6D5C9]" />
                        </div>
                        <span className="text-[13px] text-[#D6D5C9]">
                            Unlimited usage with $5.00 monthly credits
                        </span>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center shrink-0">
                            <Check className="w-3.5 h-3.5 text-[#D6D5C9]" />
                        </div>
                        <span className="text-[13px] text-[#D6D5C9]">
                            Priority execution to build faster
                        </span>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center shrink-0">
                            <Check className="w-3.5 h-3.5 text-[#D6D5C9]" />
                        </div>
                        <span className="text-[13px] text-[#D6D5C9]">
                            Access to premium models and tools
                        </span>
                    </div>
                </div>

                <div className="flex flex-col gap-2 mt-2">
                    <button
                        onClick={() => {
                            onClose()
                            navigate('/settings/billing')
                        }}
                        className="w-full py-2.5 rounded-lg bg-white text-black text-[13px] font-semibold hover:bg-[#E5E5E5] transition-colors focus:outline-none"
                    >
                        Upgrade for $5/month
                    </button>
                    <span className="text-[11px] text-[#7B7A79] text-center">
                        Cancel anytime. Secure checkout.
                    </span>
                </div>
            </div>
        </Modal>
    )
}
