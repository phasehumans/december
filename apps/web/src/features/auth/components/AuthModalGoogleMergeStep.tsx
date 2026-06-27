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
        <div className="flex flex-col items-start mb-8">
            <h2 className="text-[28px] font-medium text-white tracking-tight mb-2">
                Google sign-in active
            </h2>
            <p className="text-[15px] text-[#A3A3A3] leading-relaxed">
                This email already uses Google sign-in. Choose how you&apos;d like to continue.
            </p>
        </div>

        <div className="flex flex-col gap-4">
            <button
                type="button"
                onClick={onGoogleLogin}
                disabled={isPending}
                className="w-full bg-[#EDEDED] hover:bg-white text-[#111111] font-medium h-[46px] rounded-[12px] flex items-center justify-center gap-3 transition-all duration-200 active:scale-[0.98] shadow-sm disabled:opacity-50"
            >
                <AuthModalGoogleIcon />
                <span className="text-[15px]">Continue with Google</span>
            </button>

            <button
                type="button"
                onClick={onCreatePassword}
                disabled={isPending}
                className="w-full bg-[#141414] border border-[#2A2A2A] hover:border-[#3A3A3A] text-white font-medium h-[46px] rounded-[12px] flex items-center justify-center transition-all duration-200 active:scale-[0.98] disabled:opacity-50 shadow-sm"
            >
                {isPending ? 'Please wait...' : 'Create Password'}
            </button>

            <button
                type="button"
                onClick={onBack}
                disabled={isPending}
                className="self-start mt-4 text-[14px] text-[#888888] hover:text-white transition-colors underline decoration-transparent hover:decoration-white/50 underline-offset-4"
            >
                Back to login
            </button>
        </div>
    </div>
)
