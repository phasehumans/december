import { Check, X } from 'lucide-react'
import React from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'

interface ProUpgradeModalProps {
    isOpen: boolean
    onClose: () => void
}

export const ProUpgradeModal: React.FC<ProUpgradeModalProps> = ({ isOpen, onClose }) => {
    const navigate = useNavigate()

    if (!isOpen) return null

    return createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-[#171615] border border-white/10 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col relative animate-in fade-in zoom-in-95 duration-300 min-h-[460px]">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500" />
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-1.5 rounded-lg text-[#7B7A79] hover:text-white hover:bg-white/10 transition-colors z-20"
                >
                    <X className="w-5 h-5" />
                </button>

                <div className="p-8 border-b border-white/5 flex flex-col gap-3 relative overflow-hidden pr-12">
                    <div className="absolute -right-20 -top-20 w-60 h-60 bg-blue-500/10 blur-[80px] rounded-full pointer-events-none" />
                    <h2 className="text-2xl font-bold text-white tracking-tight">Upgrade to Pro</h2>
                    <p className="text-[15px] text-[#A1A1AA] leading-relaxed max-w-[90%]">
                        Access premium AI models and priority execution speeds by upgrading your
                        plan.
                    </p>
                </div>

                <div className="p-8 bg-[#100E12] flex flex-col md:flex-row gap-6 relative">
                    {/* Free Plan */}
                    <div className="flex-1 rounded-2xl border border-white/5 bg-white/[0.02] p-6 flex flex-col justify-between opacity-50 backdrop-blur-sm transition-all hover:bg-white/[0.04]">
                        <div>
                            <div className="mb-3">
                                <span className="text-[14px] uppercase tracking-wider font-semibold text-[#A1A1AA]">
                                    Free Plan
                                </span>
                            </div>
                            <div className="mb-6">
                                <span className="text-3xl font-bold text-white">$0</span>
                                <span className="text-[#7B7A79] text-sm ml-1 font-medium">
                                    / month
                                </span>
                            </div>
                            <div className="flex flex-col gap-3.5 text-sm text-[#A1A1AA]">
                                <div className="flex items-center gap-3">
                                    <div className="w-5 h-5 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                                        <Check className="w-3 h-3 text-emerald-500" />
                                    </div>
                                    <span>$1.00 standard credit limit</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-5 h-5 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                                        <Check className="w-3 h-3 text-emerald-500" />
                                    </div>
                                    <span>Standard execution speed</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-5 h-5 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                                        <Check className="w-3 h-3 text-emerald-500" />
                                    </div>
                                    <span>Community support</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-5 h-5 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                                        <Check className="w-3 h-3 text-emerald-500" />
                                    </div>
                                    <span>One-time credits (no expiry)</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Pro Plan */}
                    <div className="flex-1 rounded-2xl border border-blue-500/30 bg-blue-500/[0.04] p-6 flex flex-col justify-between relative overflow-hidden backdrop-blur-sm group hover:bg-blue-500/[0.08] transition-all duration-300 shadow-[0_0_40px_-15px_rgba(59,130,246,0.3)] hover:shadow-[0_0_60px_-15px_rgba(59,130,246,0.4)]">
                        <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-blue-500/20 blur-[50px] rounded-full pointer-events-none group-hover:bg-blue-500/30 transition-colors" />

                        <div className="relative z-10">
                            <div className="mb-3">
                                <span className="text-[14px] uppercase tracking-wider font-semibold text-blue-400">
                                    Pro Plan
                                </span>
                            </div>
                            <div className="mb-6">
                                <span className="text-3xl font-bold text-white">$5</span>
                                <span className="text-blue-400/60 text-sm ml-1 font-medium">
                                    / month
                                </span>
                            </div>
                            <div className="flex flex-col gap-3.5 text-sm text-[#E4E4E7]">
                                <div className="flex items-center gap-3">
                                    <div className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0">
                                        <Check className="w-3 h-3 text-blue-400" />
                                    </div>
                                    <span className="font-medium text-white">
                                        $5.00 monthly credits
                                    </span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0">
                                        <Check className="w-3 h-3 text-blue-400" />
                                    </div>
                                    <span>Priority execution speed</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0">
                                        <Check className="w-3 h-3 text-blue-400" />
                                    </div>
                                    <span>Premium models & tools</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0">
                                        <Check className="w-3 h-3 text-blue-400" />
                                    </div>
                                    <span>Early access to new features</span>
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={() => {
                                onClose()
                                navigate('/profile/billing')
                            }}
                            className="w-full mt-8 py-3.5 rounded-xl bg-white text-black text-[14px] font-bold hover:scale-[1.02] hover:shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2 relative z-10"
                        >
                            Upgrade to Pro
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    )
}
