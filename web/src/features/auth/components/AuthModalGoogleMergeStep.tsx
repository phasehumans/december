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
        <div className="flex flex-col items-center mb-[22px]">
            <div className="mb-[18px] text-[#D6D5D4]">
                <Icons.DecemberLogo className="w-[32px] h-[32px]" />
            </div>
            <h2 className="text-[20px] font-medium text-[#f5f5f5] text-center tracking-tight mb-1.5">
                Google sign-in active
            </h2>
            <p className="text-[13.5px] text-[#A3A3A3] text-center leading-relaxed">
                This email already uses Google sign-in. Choose how you&apos;d like to continue.
            </p>
        </div>

        <div className="flex flex-col gap-2.5">
            <button
                type="button"
                onClick={onGoogleLogin}
                disabled={isPending}
                className="w-full bg-[#E5E5E5] hover:bg-white text-black font-medium h-[44px] rounded-[10px] flex items-center justify-center gap-2.5 transition-colors disabled:opacity-50"
            >
                <AuthModalGoogleIcon />
                <span className="text-[15px]">Continue with Google</span>
            </button>

            <button
                type="button"
                onClick={onCreatePassword}
                disabled={isPending}
                className="w-full bg-[#2A2A2A] hover:bg-[#333333] text-[#E5E5E5] font-medium h-[44px] rounded-[10px] flex items-center justify-center transition-colors disabled:opacity-50"
            >
                {isPending ? 'Please wait...' : 'Create Password'}
            </button>

            <button
                type="button"
                onClick={onBack}
                disabled={isPending}
                className="mt-[8px] text-[13px] text-[#A3A3A3] hover:text-white transition-colors"
            >
                Back to login
            </button>
        </div>
    </div>
)
