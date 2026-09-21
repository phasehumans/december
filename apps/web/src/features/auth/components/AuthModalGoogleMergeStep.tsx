import React from 'react'

import { AuthModalGoogleIcon } from './AuthModalGoogleIcon'

import { Icons } from '@/shared/components/ui/Icons'

interface AuthModalGoogleMergeStepProps {
    email: string
    isPending: boolean
    onGoogleLogin: () => void
    onCreatePassword: () => void
    onBack: () => void
}

export const AuthModalGoogleMergeStep: React.FC<AuthModalGoogleMergeStepProps> = ({
    email,
    isPending,
    onGoogleLogin,
    onCreatePassword,
    onBack,
}) => (
    <div className="flex flex-col animate-in fade-in duration-200">
        <div className="flex flex-col items-center text-center mb-6">
            <div className="mb-5 text-white">
                <Icons.DecemberLogo className="w-[42px] h-[42px] text-white" />
            </div>
            <h2 className="text-[22px] sm:text-[24px] font-medium text-white tracking-[-0.025em] leading-snug mb-1.5">
                Google sign-in active
            </h2>
            <p className="text-[13px] text-[#A1A1A6] leading-relaxed">
                This email already uses Google sign-in. Choose how you&apos;d like to continue.
            </p>
        </div>

        <div className="flex flex-col gap-3">
            <button
                type="button"
                onClick={onGoogleLogin}
                disabled={isPending}
                className="w-full bg-white hover:bg-[#EDEDED] text-[#090a0f] font-mono text-xs sm:text-[13px] font-medium h-10 rounded-none flex items-center justify-center gap-2.5 transition-all cursor-pointer disabled:opacity-50"
            >
                <div className="w-4 h-4 flex items-center justify-center shrink-0">
                    <AuthModalGoogleIcon />
                </div>
                <span>Continue with Google</span>
            </button>

            <button
                type="button"
                onClick={onCreatePassword}
                disabled={isPending}
                className="w-full bg-[#1e1e1e] hover:bg-[#252525] text-white font-mono text-xs sm:text-[13px] font-medium h-10 border border-[#2A2A2A] hover:border-[#3A3A3A] rounded-none flex items-center justify-center transition-all cursor-pointer disabled:opacity-50"
            >
                {isPending ? 'Please wait...' : 'Create Email Password'}
            </button>

            <div className="mt-3 pt-4 border-t border-[#262626] flex justify-center">
                <button
                    type="button"
                    onClick={onBack}
                    disabled={isPending}
                    className="font-mono text-xs text-[#888888] hover:text-[#87b2f4] transition-colors cursor-pointer"
                >
                    ← Back to login
                </button>
            </div>
        </div>
    </div>
)
