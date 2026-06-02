import { Check, X } from 'lucide-react'
import React from 'react'
import { useNavigate } from 'react-router-dom'

interface ProUpgradeModalProps {
    isOpen: boolean
    onClose: () => void
}

export const ProUpgradeModal: React.FC<ProUpgradeModalProps> = ({ isOpen, onClose }) => {
    const navigate = useNavigate()

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#171615] border border-[#242323] rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col relative animate-in fade-in zoom-in-95 duration-200">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-1.5 rounded-lg text-[#7B7A79] hover:text-[#D6D5C9] hover:bg-[#242323] transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>

                <div className="p-6 border-b border-[#242323] flex flex-col gap-2 pr-12">
                    <h2 className="text-xl font-medium text-[#D6D5C9]">Upgrade to Pro</h2>
                    <p className="text-sm text-[#7B7A79]">
                        Access premium AI models and priority execution speeds by upgrading your
                        plan.
                    </p>
                </div>

                <div className="p-6 bg-[#100E12]/30 flex flex-col md:flex-row gap-5">
                    {/* Free Plan */}
                    <div className="flex-1 rounded-xl border border-[#242323] p-5 flex flex-col justify-between opacity-50">
                        <div>
                            <div className="mb-2">
                                <span className="text-[15px] font-medium text-[#D6D5C9]">
                                    Free Plan
                                </span>
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
                            </div>
                        </div>
                    </div>

                    {/* Pro Plan */}
                    <div className="flex-1 rounded-xl border border-[#D6D5C9]/40 bg-[#D6D5C9]/5 p-5 flex flex-col justify-between relative overflow-hidden">
                        <div>
                            <div className="mb-2">
                                <span className="text-[15px] font-medium text-[#D6D5C9]">
                                    Pro Plan
                                </span>
                            </div>
                            <div className="mb-4">
                                <span className="text-[22px] font-semibold text-[#D6D5C9]">$5</span>
                                <span className="text-[#7B7A79] text-[12px] ml-1">/ month</span>
                            </div>
                            <div className="flex flex-col gap-2.5 text-[13px] text-[#D6D5C9]">
                                <div className="flex items-center gap-2">
                                    <Check className="w-4 h-4 text-[#D6D5C9] shrink-0" />
                                    <span>$5.00 monthly credit refreshes</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Check className="w-4 h-4 text-[#D6D5C9] shrink-0" />
                                    <span>Priority execution speed</span>
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={() => {
                                onClose()
                                navigate('/profile/billing')
                            }}
                            className="w-full mt-6 py-2.5 rounded-lg bg-[#D6D5C9] text-[#171615] text-[14px] font-medium hover:bg-white transition-colors flex items-center justify-center gap-2"
                        >
                            Upgrade to Pro
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
